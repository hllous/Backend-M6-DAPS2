# Excepciones de la colección Postman

Generado por `npm run api:collection` desde `test/api/excepciones.json`. La colección cubre las 152 operaciones
del OpenAPI con caso de éxito (151/152, más 1 con excepción) y de error (149/152, más 3 con excepción).
`npm run api:coverage` falla si alguna operación queda sin caso y sin excepción justificada acá.

## Sin caso de éxito

| Endpoint | Motivo |
|---|---|
| `POST /evidence` | Sube el archivo a Cloudflare R2 (cliente S3 con endpoint fijo https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com). El CI no tiene credenciales ni bucket: sin ellos el camino válido responde 503 por diseño. Los casos de error (401, 403 de rol, 400) sí corren. |

## Sin caso de error

| Endpoint | Motivo |
|---|---|
| `GET /health` | No recibe entradas ni depende de nada: solo declara 200, no hay forma de provocarle un error. |
| `GET /health/ready` | Su único error es el 503 con la base caída; el CI no puede tirar la base sin cortar el resto de la colección. |
| `GET /public/zones` | No recibe parámetros; su único error declarado es el 429 del límite del portal, que dejaría bloqueadas por IP las demás rutas públicas de la corrida. |

## Hallazgos de Schemathesis

Defectos reales del backend frente a `docs/api/openapi.json` (corrida local, solo GET, #572). No se arreglan en esta rama.

- **H-1, 400 no declarado (resuelto, #593):** los GET con parámetros declaran el 400 con `@ApiBadRequestParams()`, lo exige `openapi-contract.spec` y el step `status_code_conformance` de `api-tests.yml` es bloqueante.
- **H-2, 503 en `GET /neighborhoods` (resuelto, #594):** el CI y el compose cargan el catálogo local `prisma/data/m9-barrios.json` con `NEIGHBORHOODS_CATALOG_FILE`; en producción sigue siendo 503 sin el catálogo real de M9.
