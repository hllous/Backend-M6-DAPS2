# Pruebas de API (Newman + Schemathesis)

Colección Postman versionada en el repo y corrida en CI por el workflow `.github/workflows/api-tests.yml`
(job `api (newman + schemathesis)`), contra el backend real con Postgres y el seed de demo.

| Archivo | Qué es |
|---|---|
| `m6.postman_collection.json` | La colección. **Generada**, no se edita a mano: `npm run api:collection` |
| `m6.postman_environment.json` | Variables (`baseUrl` y los tokens, que pasa el CI por `--env-var`) |
| `make-token.mjs` | Firma los tokens de prueba (`admin`, `auditor`, `campo`) con el `JWT_SECRET` efímero del job |
| `excepciones.json` | Operaciones que no se pueden probar con éxito (o con error) en CI, con el motivo |
| `PENDIENTES.md` | Las mismas excepciones en una tabla, generada |

## Cómo se arma la colección

`scripts/build-postman-collection.mjs` convierte `docs/api/openapi.json` y le suma, por operación:

- **Errores:** 401 sin token, 403 con token de auditor en las escrituras, 400/404 con id inexistente o cuerpo inválido.
- **Éxitos de lectura:** los GET se prueban contra el seed, con ids tomados del listado del padre.
- **Éxitos de escritura:** los **flujos** de `scripts/api-flujos.mjs`, una carpeta `Flujos` al final de la colección.
  Cada flujo crea su propio recurso (zona, recorrido, cuadrilla, contenedor, servicio, expediente…), lo recorre por la
  máquina de estados (alta, edición, transiciones, cierre) y guarda los ids en variables de colección. Cada paso verifica
  el status y el estado o los campos del cuerpo. No toca datos del seed salvo para leerlos y reencolar los eventos
  `FAILED` del outbox sembrados.

Los endpoints de Campo (`M6_CAMPO_CUADRILLA`, `M6_CAMPO_INSPECTOR`) no los puede usar un `M6_ADMIN`. El primer
flujo le asigna esos roles por la API (`PUT /role-assignments/29001`) al usuario `29001`, que no está en el seed, y
sus pasos usan `campoToken` (`make-token.mjs campo`); la cuadrilla y la inspección del flujo lo tienen como integrante e
inspector, así que pasan la pertenencia de Campo.

## Cobertura exigida

`npm run api:coverage` (`scripts/check-api-coverage.mjs`, también como spec en `npm test` y como primer paso del job `api`)
compara las operaciones del OpenAPI con la colección y **falla** si alguna queda sin caso de éxito (2xx con al menos una
aserción además del status) o sin caso de error (4xx), salvo las de `excepciones.json`. Agregar un endpoint sin caso
rompe el check.

## Excepciones justificadas

| Operación | Falta | Motivo |
|---|---|---|
| `POST /evidence` | éxito | Sube a Cloudflare R2 con endpoint fijo (`https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`). El CI no tiene credenciales ni bucket, así que el camino válido responde 503 por diseño. Sus casos de error (401, 403, 400) sí corren. |
| `GET /health` | error | No recibe entradas ni depende de nada: solo declara 200. |
| `GET /health/ready` | error | Su único error es el 503 con la base caída; el CI no puede tirarla sin cortar el resto de la colección. |
| `GET /public/zones` | error | Sin parámetros; su único error declarado es el 429 del límite del portal, que bloquearía por IP las demás rutas públicas de la corrida. |

## Correrla en local

```bash
export DATABASE_URL=postgresql://m6:m6@localhost:5432/m6_api?schema=public JWT_ISSUER=modulo1-ciudadanos
export JWT_SECRET=$(openssl rand -base64 32)
npm run prisma:migrate:deploy && npm run prisma:seed && npm run build
NEIGHBORHOODS_CATALOG_FILE=prisma/data/m9-barrios.json THROTTLE_LIMIT=100000 node dist/main &
npx newman run test/api/m6.postman_collection.json -e test/api/m6.postman_environment.json \
  --env-var "token=$(node test/api/make-token.mjs admin)" \
  --env-var "auditorToken=$(node test/api/make-token.mjs auditor)" \
  --env-var "campoToken=$(node test/api/make-token.mjs campo)"
```

Los flujos reencolan los `FAILED` del seed (`POST /events/outbox/{id}/retry`): una segunda corrida sobre la misma base ya
no los encuentra. Para repetirla, resembrar o volver a marcar dos eventos del outbox como `FAILED`. Los códigos únicos de
cada corrida salen de la variable `run`, así que el resto de los flujos se puede repetir.
