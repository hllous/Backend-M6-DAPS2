# Desplegar y verificar

URLs, workflows y variables: [referencia.md](referencia.md). Si algo falla: [runbooks.md](runbooks.md).

## Cómo verificar que está todo OK

```bash
# Backend, liveness: no toca la base, sigue en 200 aunque la base esté caída
curl https://m6-backend-m64k.onrender.com/health
# → {"status":"ok","timestamp":"...","service":"m6-ambiente-backend"}

# Backend, readiness: 200 con la base arriba, 503 si no responde
curl https://m6-backend-m64k.onrender.com/health/ready
# → {"status":"ok","database":"up","broker":"connected","timestamp":"...","service":"m6-ambiente-backend"}

# Portal ciudadano: público, 200 sin token
curl https://m6-backend-m64k.onrender.com/public/zones
# → [{"id":"...","code":"...","name":"..."}, ...]

# Cualquier endpoint de dominio sin token: 401, no 500
curl https://m6-backend-m64k.onrender.com/zones
# → {"statusCode":401,"message":"Unauthorized",...}

# Frontend
curl https://m6-ambiente-higiene.vercel.app/api/health
# → {"status":"ok","timestamp":"...","service":"m6-ambiente-frontend"}
```

Códigos reales de la última corrida (07/11/2026 12:21 UTC, servicio ya despierto): `/health` 200, `/health/ready` 200 con `"database":"up"` y `"broker":"connected"`, `/public/zones` 200, `/zones` sin token 401, `/` 404, `/api/docs` 200, frontend `/api/health` 200.

- Un **401 es la respuesta correcta**: la base tiene esquema y el guard funciona. Un `500` sí es un problema.
- `broker` puede ser `connected`, `reconnecting` o `disabled` (sin `RABBITMQ_URL`). Es informativo: un bus caído no da 503.
- Un `GET /` responde `404 Cannot GET /`: es esperado.
- Si el primer request tarda 30-60 s es el spin-down de Render (free tier se duerme tras 15 min sin requests).
- Para probar con datos: login en M1 (`POST https://ciudadanos-m1-backend.onrender.com/auth/usuario/login` con `{"email": …, "password": …}`; el token viene en el header `authorization` y dura 15 min) y pegarlo en **Authorize** del [Swagger UI](https://m6-backend-m64k.onrender.com/api/docs). Las cuentas de la demo están en [seed.md](../seed.md).

## Cómo funciona el deploy

El deploy está enlazado a la rama `main` de cada repo. Lo que se mergea a `develop` **no** se despliega hasta el release `develop` → `test` → `main`.

### Automático (lo normal)

**Backend (Render)**, lo dispara GitHub Actions:

```
git push origin main   (el release develop → test → main)
    ↓
GitHub Actions corre build + test (CI)
    ↓  si ambos pasan
Job "deploy" dispara el Deploy Hook de Render (con el commit exacto)
    ↓
Render buildea Docker y deploya (el CMD corre `prisma migrate deploy` y arranca)
    ↓
Backend actualizado en ~3-5 min
```

**Frontend (Vercel)**: deploy nativo al pushear a `main` de `Frontend-M6-DAPS2` (~2-5 min).

No hay que hacer nada manual. Si el CI falla, **no** se deploya. Si la migración falla, el contenedor no levanta (preferimos no servir una API contra un esquema desactualizado).

### Manual (cuando hace falta forzarlo)

- **Render** → servicio → pestaña **Deploys** → **Manual Deploy → Deploy latest commit**.
- **Vercel** → proyecto → **Deployments** → **Redeploy** del último deploy.

## Checklist de despliegue para DevOps

Qué cargar, dónde, de dónde sale cada valor y en qué orden, antes de promover `develop` a `main`. Los valores **secretos no van en el chat ni en el repo**: se cargan directo en el panel. Cada variable está descripta en [referencia.md](referencia.md#variables-de-entorno-del-backend).

**Render (backend)**

| Variable | Qué va | Por qué | A quién pedirlo | Cuándo | Secreto |
|---|---|---|---|---|---|
| `JWT_SECRET` | Base64 de 32 bytes o más. Provisorio: `openssl rand -base64 32` | La validación del token de M1 cambió (#354). Con el valor viejo en texto plano **el servicio no arranca** | Al PO de M6: M1 manda el definitivo por el grupo de POs | **Antes del deploy** | Sí |
| `M6_BOOTSTRAP_ADMIN_USER_IDS` | `user_id` de M1 del primer admin (varios, separados por coma) | Sin él nadie puede asignar roles (#161) | `1` es la cuenta compartida de M1 (`admin@municipio.gob.ar`) y entra como admin solo por esta variable; `10000` y `10001` ya son `M6_ADMIN` por el seed (#488). Se comprueba con login real + `GET /me` | Con el deploy de la base de roles | No |
| `RABBITMQ_URL` | `amqps://module_ambiente:<clave>@core-uade-2026.duckdns.org:5671/core` (clave percent-encoded) | Conecta con el bus del Core. Sin ella la app arranca, pero no publica ni consume | Al PO de M6: ficha privada de M9, usuario `module_ambiente` | Cuando llegue la ficha | **Sí** |
| `CORE_API_URL` | `https://core-uade-2026.duckdns.org` | API REST del Core (token de módulo y registro de suscripciones) | No hace falta pedirla: es un dato conocido | Con la ficha | No |
| `CORE_MODULE_SECRET` | El secret de máquina de M9 | Pide el token de módulo al Core; obligatoria si hay `CORE_API_URL` | Al PO de M6: ficha privada de M9 | Cuando llegue la ficha | **Sí** |
| `M1_BASE_URL` | `https://ciudadanos-m1-backend.onrender.com` | Consultas de identidad a M1 con el module-token del Core (ADR-009); sin ella la validación de cuadrillas no corre | No hace falta pedirla | Con el deploy de #495 | No |
| `R2_*` (las cinco) | Datos de Cloudflare R2 (bucket `m6-evidence`) | Subida de evidencia; sin ellas `POST /evidence` responde 503 | A quien tenga la cuenta de Cloudflare | Si todavía no están | Las dos claves |
| `DATABASE_URL`, `CORS_ORIGINS`, `NODE_ENV=production` | Supabase (puerto 5432, `?schema=public`), URL del frontend, `production` | Ya deberían estar | – | Solo verificar | `DATABASE_URL` |

**Borrar de Render** (overrides viejos que hacen que el broker responda 404): `RABBITMQ_EXCHANGE`, `RABBITMQ_QUEUE`, `RABBITMQ_EXCHANGE_TYPE`, `RABBITMQ_DEAD_LETTER_EXCHANGE`, `KAFKA_*` y `JWT_EXPIRATION`.

**Vercel (frontend):** `M6_SESSION_SECRET` (valor aleatorio propio que genera DevOps), `M6_AUTH_MODE`, `M6_BACKEND_ORIGIN` y `M1_BASE_URL`; borrar `M6_DEV_JWT` y `M6_JWT_SECRET` si quedaron. Valores y significado en el repo [`Frontend-M6-DAPS2`](https://github.com/hllous/Frontend-M6-DAPS2).

**Del lado de M9** (lo coordina el PO): los rangos de salida de Render están habilitados desde el 28/10 (dato de M9). Si Render cambia sus IPs, avisar.

**Orden sugerido**

1. Cargar `JWT_SECRET` y borrar los overrides viejos.
2. Desplegar y mirar en los logs que se apliquen las migraciones (`prisma migrate deploy` corre solo al arrancar).
3. Cargar `M6_BOOTSTRAP_ADMIN_USER_IDS` y comprobarlo con `GET /me` y el log de arranque (dice cuántos admins hay).
4. En Vercel: `M6_AUTH_MODE=real-m1`, `M1_BASE_URL`, y borrar `M6_DEV_JWT` y `M6_JWT_SECRET`. Probar login real + `GET /me` (200) con una cuenta de M1.
5. Cuando llegue la ficha de M9: cargar `RABBITMQ_URL`, `CORE_API_URL` y `CORE_MODULE_SECRET` y reiniciar. Verificar el registro con `GET /api/v1/event-types/map`.

### Registro en el catálogo del Core (#266)

Con `CORE_API_URL`, al arrancar (sin bloquear el arranque) la app consulta `GET /api/v1/subscriptions` y `GET /api/v1/publications` y crea **solo lo que falta**: 8 suscripciones (`ConsumedEvent` menos `weatherAlertIssued`, que nadie publica) con `maxAttempts` 4, y 6 publicaciones (`EventType`). Correrlo de nuevo no duplica nada. Lo que el Core tenga a nombre de M6 y el código ya no declare se loguea como advertencia y **no se borra**. Si el Core falla, la app arranca igual y reintenta con backoff (5 s, 15 s, 45 s... tope 5 min, hasta 6 intentos). Agregar un evento a `ConsumedEvent` o `EventType` lo registra solo.

- **Verificar:** `GET /api/v1/event-types/map` (con el token de módulo) debe mostrar a `ambiente` suscripto a los 8 y publicando los 6; confirmar además que `q.ambiente` existe (el 201 del POST no lo prueba).
- **A mano:** `npm run core:register` (lee `.env`; imprime lo creado y lo sobrante).
- **Simulacro, de solo lectura:** `npm run core:register -- --dry-run` pide el token de módulo y hace solo `GET`; imprime el plan en JSON (`suscripcionesCreadas`/`publicacionesCreadas`, `...YaActivas`, `...Inactivas`, `sobrantes`). No imprime token, secret ni configuración. Sale con 0 si el Core respondió.
- **Dar de baja sobrantes (#414):** `npm run core:unregister -- --type zoneNotServiced` es un **simulacro** (solo `GET`); con `--apply` hace `DELETE /api/v1/subscriptions/{id}`. `--type` se repite y es obligatorio: solo baja lo que se nombra. Rechaza los tipos que M6 declara hoy; un tipo no suscripto se informa como `no-suscripto` (no es error); un error HTTP sale con código 1. Cubre **solo suscripciones** (las publicaciones sobrantes se bajan con `DELETE /api/v1/publications/{id}`) y filtra por `moduleName` exacto. Los flags desconocidos fallan con código 1.
- **`maxAttempts` solo rige al crear:** cambiar `CORE_SUBSCRIPTION_MAX_ATTEMPTS` después no actualiza lo ya registrado.
- **Varias réplicas:** cada una sincroniza al arrancar y pueden pisarse; conviene `CORE_REGISTER_ON_BOOT=false` y correr `npm run core:register` como paso del deploy.
- **Formato de los `GET` (M9, 22/10):** array JSON sin paginar; `/publications` trae las de **todos** los módulos, así que se filtra por `moduleName` y `active`.

### Core de M9 (ambiente real)

Ambiente **único y compartido**, sin testing separado: un evento de prueba puede llegar a otros módulos, coordinar antes de publicar ([m9.md](../integracion/m9.md#guía-común-de-integración-del-core-2010)). La **contraseña de RabbitMQ, el `CORE_MODULE_SECRET`, el acceso al dashboard y la ficha se piden a M9 por privado**: nunca van al repo, a capturas, a logs ni a variables públicas del frontend. El puerto 5671 solo abre para las IP de salida dadas de alta en M9 (rangos de Render, en [referencia.md](referencia.md#urls)); lo que protege la conexión es la autenticación de `module_ambiente`, no el origen.

## Sincronizar zonas y comunas con el catálogo de M9 (#421)

Carga las 15 comunas (`Commune`) y una `Zone` por barrio activo con su `ZoneNeighborhood` (UUID de M9). Orden en una base nueva o existente: **`prisma migrate deploy` → `zones:sync-from-core` → seed**. No corre solo al arrancar: es un paso manual del deploy. El seed (#422) ya llama a `syncZones` con el snapshot, así que el sync previo es opcional: sirve para cargar las zonas con el catálogo vivo del Core antes de sembrar y para el simulacro `--dry-run`.

1. Simulacro (no escribe): `DATABASE_URL=<base> npm run zones:sync-from-core -- --dry-run`. Con Core usa `CORE_API_URL` y `CORE_MODULE_SECRET`; sin Core, agregar `--from-snapshot` (usa `prisma/data/m9-*.json`).
2. Aplicar: el mismo comando sin `--dry-run` (una transacción). Idempotente: la segunda corrida informa todo en `sinCambios`.
3. El reporte lista creadas, actualizadas, desactivadas y sin cambios, además de `conflictos` (zona existente con el `code` de un barrio pero con otros barrios: no se toca), `sinComuna` y las zonas/filas **legacy**. No imprime token ni secret.
4. **Legacy.** Las zonas del seed viejo (`Z-PAL`…) y las filas de `zone_neighborhood` con ids que no están en el catálogo (`caba-…`) solo se **reportan**. `--clean-legacy` es **destructivo**: borra solo las filas cuyo id **no es un UUID** (`caba-…`, `barrio-…`) y no está en el catálogo (nunca zonas; un UUID ausente del catálogo se reporta pero no se borra), y no se combina con `--from-snapshot`, salvo las de zonas con servicios, recorridos, contenedores, árboles u otros datos asociados (marcadas `retenida`). Correr antes con `--dry-run --clean-legacy` y revisar `legacyRows`.
5. **M9 manda.** El sync pisa `name`, `communeId` y `active` de las zonas de M9 y `name`/`active` de las comunas: una edición manual de esos campos se revierte y una zona o comuna desactivada a mano se reactiva si M9 la tiene activa.
6. **Comuna sin formato `comuna-N`.** Cada comuna activa de M9 necesita un `code` `comuna-N` para deducir `Commune.number`. Si M9 activa una que no lo tiene, el sync **aborta** con error antes de escribir. Antes de desplegar la migración `commune_number`, verificar con `SELECT code FROM commune`: si hay un `code` que no es `comuna-N`, la migración falla con un mensaje que lo lista.
7. Un barrio con `activo:false` en M9 desactiva su zona (`active=false`); nunca se borra; si tiene datos asociados se cuenta aparte en `desactivadasConDatos`. No se crean zonas para barrios inactivos.

## Migrar las cuadrillas de usr-… a ids de M1 (#365)

> **Nota (27/10):** en la base desplegada ya no hace falta. Los integrantes de cuadrilla y las asignaciones de rol son numéricos desde el seed nuevo (#422, aplicado el 27/10; verificado en solo lectura), y el mapeo ya no se pide a M1 (decisión del PO). El procedimiento queda como referencia para una base con ids `usr-…`.

**Bloquea el despliegue de la pertenencia de Campo (#365/#394).** La regla compara el `sub` numérico del token de M1 con el líder y los integrantes de la cuadrilla; las filas con ids `usr-…` nunca coinciden, así que activar la regla sin migrar deja a esas cuadrillas sin poder ejecutar servicios. Correr el script **antes** de promover.

1. Pedir a M1 el mapeo `usr-… → user_id` y guardarlo como JSON fuera del repo: `{ "usr-00010": "10", "usr-00011": "11" }` (destinos numéricos).
2. Simulacro (solo lee la base): `DATABASE_URL=<base desplegada> npm run crews:migrate-user-ids -- --map mapeo.json --dry-run`. Imprime cada cambio de `crew_member.user_id` y de `crew.leader_user_id`, los choques de PK que se resuelven fusionando (el destino ya era integrante: se borra la fila vieja) y las filas **SIN MAPEO**.
3. Si quedan filas sin mapeo, pedirle el dato a M1 y repetir. No se tocan; el script sale con código 2 mientras quede alguna.
4. Aplicar: el mismo comando sin `--dry-run` (una sola transacción). Idempotente. Los ids con ceros a la izquierda se normalizan (`007` → `7`).
5. Recién entonces activar el deploy de #365. Quitar un integrante `usr-…` que sobre sigue siendo posible con `DELETE /crews/:id/members/:userId` (no valida el formato).
