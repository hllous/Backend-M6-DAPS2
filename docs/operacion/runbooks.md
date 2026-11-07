# Runbooks

Qué hacer cuando algo falla en producción. Cada uno sigue el mismo orden: síntoma, diagnóstico, acción, verificación, rollback y escalamiento. Variables, URLs y workflows: [referencia.md](referencia.md); cómo se despliega: [desplegar.md](desplegar.md).

Criterio de verificación de cada paso, contra el código del 07/11/2026 o contra el servicio vivo:

- **Verificado en código**: el comportamiento descripto está en el archivo citado (rutas y funciones al lado).
- **Verificado en vivo**: se ejecutó contra el backend desplegado el 07/11/2026 (solo los `curl` de [desplegar.md](desplegar.md#cómo-verificar-que-está-todo-ok)).
- **Confirmado por el equipo (07/11/2026)**: acciones en paneles (Render, Supabase, Vercel, GitHub) y contra el Core que no se ejecutaron al escribir este documento y que el equipo confirmó que existen y funcionan como se describen.
- **Abierto**: lo que todavía no está resuelto, hoy solo el backup de la base (ver el [runbook 2](#2-base-caída-y-healthready-503)).

Ningún runbook usa valores reales: los secretos se cargan solo en el panel de Render.

| # | Runbook |
|---|---|
| 1 | [Render dormido o cold start](#1-render-dormido-o-cold-start) |
| 2 | [Base caída y `/health/ready` 503](#2-base-caída-y-healthready-503) |
| 3 | [Bus desconectado u outbox atascado](#3-bus-desconectado-u-outbox-atascado) |
| 4 | [Evento rechazado por el Core](#4-evento-rechazado-por-el-core) |
| 5 | [`JWT_SECRET` incorrecto o rotación](#5-jwt_secret-incorrecto-o-rotación) |
| 6 | [Rollback de un deploy fallido](#6-rollback-de-un-deploy-fallido) |

Notas generales que aplican a varios (los antiguos "gotchas"):

- **Bind `0.0.0.0`**: el backend escucha en `0.0.0.0:PORT`, no `localhost`; es lo que Render espera. No cambiarlo.
- **Health Check Path de Render**: dejarlo **vacío**. Un path mal puesto produce `==> Timed Out` en el deploy aunque la app arranque bien.
- **`PORT`**: no setearlo en Render (lo inyecta, `10000` en free tier).
- **Supabase free**: 500 MB y sin el vencimiento de 30 días de Render, pero el proyecto se **pausa** tras ~1 semana sin actividad; se reactiva desde el dashboard y no pierde datos.
- **Retención del inbox**: un job diario (03:00) borra las filas de `inbox_event` procesadas con más de `INBOX_RETENTION_DAYS` (default 180, `0` = no purgar); las pendientes y fallidas no se tocan. Pasado el plazo, un reenvío del mismo `eventId` ya no se detectaría como duplicado (riesgo aceptado, ver [riesgos](../integracion/riesgos.md)).
- **Sin alerta por cola**: no hay aviso por mensajes pendientes en `q.ambiente` sin consumidores; lo ve el Core y no tenemos acceso a su API de management (se mira en su panel).

---

## 1. Render dormido o cold start

**Síntoma.** El primer request tarda 30-60 s o más (a veces el `keepalive` queda rojo con timeout); después responde normal. El frontend (Vercel) carga pero sus llamadas al backend tardan.

**Diagnóstico.**
1. `curl -m 180 -w '%{http_code} %{time_total}s\n' https://m6-backend-m64k.onrender.com/health`. Un 200 lento es cold start; con el servicio despierto responde en menos de 1 s (07/11: 0,3 s, verificado en vivo).
2. En el panel de Render, los logs del arranque en frío muestran `prisma migrate deploy` antes de escuchar (verificado en código: el `CMD` del `Dockerfile`). Si la base free también estaba dormida, suma tiempo.
3. Un 502/503 de Render durante unos minutos tras un deploy es el arranque, no una falla. Un `Timed Out` en el deploy apunta al Health Check Path (debe estar vacío).

**Qué implica estar dormido.** No corren los procesos de fondo:

| Proceso | Qué hace | Dormido |
|---|---|---|
| `@Interval(10s)` (`OutboxDispatcher`) | Despacha el outbox | Los eventos quedan `PENDING`; se recupera solo al despertar |
| `@Cron(EVERY_HOUR)` (`ReportDeadlineSweeper`) | Cierra expedientes vencidos | Se atrasa hasta despertar; **también barre al arrancar** (`onModuleInit`) y es idempotente, así que se pone al día solo |

`ReportDeadlineSweeper` es el único camino por el que un expediente pasa de `NOTICE_ISSUED` a `CLOSED` cuando M4 nunca contesta: dormirse retrasa el cierre pero no lo pierde. (Verificado en código: `outbox-dispatcher.service.ts`; el sweeper se describe en [endpoints.md](../api/endpoints.md); no se re-ejecutó.)

**Acción.**
1. Esperar hasta 3 minutos y repetir el `curl`. Antes de una demo, despertarlo a mano: GitHub › Actions › `keepalive` › Run workflow, o el `curl` de arriba.
2. Si `RENDER_HEALTH_URL` no existe, el `keepalive` avisa y sale sin fallar: cargarla en Settings › Secrets and variables › Actions › Variables con `https://m6-backend-m64k.onrender.com/health` (confirmado por el equipo el 07/11/2026).
3. Recordar que el `keepalive` **no evita el spin-down**: pide el cron cada 10 min pero GitHub lo corre cada 2-3 horas. Lo que mantiene tibio el servicio es el pinger externo (cron-job.org, monitor HTTP cada 5 min sobre `RENDER_HEALTH_URL`; cuenta anotada en `keepalive.yml`). El `--max-time` del ping es 180 s porque con 90 s fallaba por timeout sin que nada estuviera roto.

**Verificación.** `/health` 200 y `/health/ready` 200 con `"database":"up"`. Que el outbox se vació: `GET /events/outbox?status=PENDING` (rol `M6_ADMIN` o `M6_AUDITOR`) sin filas viejas.

**Rollback.** No aplica: no hubo cambio.

**Escalamiento.** Si pasa de 5 minutos sin responder, ir al [runbook 2](#2-base-caída-y-healthready-503) (puede ser la base) y revisar el estado de Render (status page de la plataforma).

---

## 2. Base caída y `/health/ready` 503

**Síntoma.** `/health/ready` responde 503 `Base de datos no disponible`, o el servicio ni arranca y Render muestra el deploy en falla. La API devuelve 500 en los endpoints de dominio.

**Diagnóstico.** (Verificado en código: `src/health/health.controller.ts`.)
1. `curl -i https://m6-backend-m64k.onrender.com/health` → 200 aunque la base esté caída: es solo liveness. **Un `/health` verde no prueba la base.**
2. `curl -i https://m6-backend-m64k.onrender.com/health/ready` → hace `SELECT 1` con timeout de 3 s; 503 si no contesta o tarda más. El error no trae detalle a propósito (podría traer host o usuario): el motivo está en los logs de Render.
3. Con la base inalcanzable **al arrancar**, el servidor ni empieza a escuchar (Prisma falla en `onModuleInit`): `/health/ready` solo detecta una base que se cae con el proceso ya arriba. En ese caso el síntoma es que ni `/health` responde.
4. Causas probables, en orden: proyecto de Supabase **pausado** por inactividad (~1 semana), `DATABASE_URL` mal cargada o rotada, límite de conexiones (el `SELECT 1` colgado no se cancela y sigue ocupando una conexión del pool; con la base caída y un monitor consultando seguido pueden acumularse). Los chequeos del panel de Supabase (pausa y reactivación) están confirmados por el equipo (07/11/2026).

**Acción.**
1. Supabase pausado: reactivar desde el dashboard (no pierde datos). Esperar a que quede `Available`.
2. `DATABASE_URL`: confirmar en Render que es la URI directa, puerto `5432`, con `?schema=public`. Corregirla en el panel (es secreta; no pegarla en el chat).
3. Pool agotado: reiniciar el servicio (Render › Manual Deploy › Restart) o limitar el pool con `connection_limit`/`pool_timeout` en `DATABASE_URL`.
4. Si la base volvió pero el servicio no arrancó, redesplegar el último commit (ver [desplegar.md](desplegar.md#manual-cuando-hace-falta-forzarlo)).

**Verificación.** `/health/ready` 200 con `"database":"up"`; `curl https://m6-backend-m64k.onrender.com/public/zones` 200 con datos; `/zones` sin token 401.

**Rollback.** Si el cambio fue un `DATABASE_URL` nuevo, volver al valor anterior en el panel y redesplegar. No tocar datos ni correr migraciones a mano: el contenedor ya aplica `prisma migrate deploy` al arrancar y no levanta si falla.

**Escalamiento.** Si la base está `Available` y el servicio igual da 503, pasar a quien tenga la cuenta de Supabase/Render (DevOps). Los datos son de demo: **no hay backup acordado**; es una decisión pendiente del equipo.

---

## 3. Bus desconectado u outbox atascado

**Síntoma.** `/health/ready` informa `"broker":"reconnecting"` (o `disabled`); los módulos receptores no reciben nuestros eventos; el outbox acumula filas `PENDING` o `FAILED`; no llegan eventos de otros módulos.

**Diagnóstico.** (Verificado en código: `src/events/consumers/rabbitmq.consumer.ts`, `src/events/outbox/outbox-dispatcher.service.ts`, `src/events/bus-status.ts`.)
1. `curl https://m6-backend-m64k.onrender.com/health/ready` y mirar `broker`: `connected` (cola verificada y consumiendo), `reconnecting` (todavía no conectó o se cayó) o `disabled` (**sin `RABBITMQ_URL`**). El estado del bus nunca cambia el código HTTP: un bus caído no da 503. Hoy (07/11, verificado en vivo) está `connected`.
2. Logs de Render:
   - `RabbitMQ no disponible (...): reintento N en X ms` → el broker no responde; reconecta solo con backoff exponencial hasta 30 s.
   - `La cola q.ambiente no está disponible (...): ¿están registradas las suscripciones de M6 en el Core?` → `checkQueue` dio 404: la cola la crea el Core al registrar las suscripciones. También ocurre con overrides viejos `RABBITMQ_EXCHANGE`/`RABBITMQ_QUEUE` en Render (ver [referencia.md](referencia.md#bus-rabbitmq-del-core)).
   - `El broker canceló el consumo de q.ambiente` → la cola se borró; reconecta y da 404 hasta que el Core la recree.
   - `<evento> (<id>) falló en el intento N/5` → el dispatcher no pudo publicar.
3. Cola de salida: `GET /events/outbox?status=PENDING` y `?status=FAILED` (rol `M6_ADMIN` o `M6_AUDITOR`; el listado no trae el `payload`). El dispatcher barre cada 10 s, toma hasta 50 `PENDING` por pasada y reintenta solo: tras **5 intentos** la fila queda `FAILED` y deja de tomarse; `lastError` guarda el motivo (500 caracteres).
4. Con el servicio dormido el dispatcher no corre: ver [runbook 1](#1-render-dormido-o-cold-start).
5. Firewall: el puerto 5671 del Core solo abre para las IP de salida dadas de alta en M9 (rangos de Render en [referencia.md](referencia.md#urls)). Si Render cambió los rangos, la conexión se corta (el cambio de IP de salida en M9 está confirmado por el equipo, 07/11/2026).

**Acción.**
1. `disabled`: cargar `RABBITMQ_URL` (`amqps://`, usuario `module_ambiente`, clave percent-encoded; la entrega M9 por privado) y reiniciar.
2. `reconnecting` con 404 de cola: correr `npm run core:register -- --dry-run` (solo lectura) y, si faltan suscripciones, `npm run core:register`; confirmar con `GET /api/v1/event-types/map` en el Core que `ambiente` figura suscripto a los 8 y publicando los 6 (confirmado por el equipo, 07/11/2026). Ver [registro en el catálogo](desplegar.md#registro-en-el-catálogo-del-core-266).
3. `reconnecting` sin 404: avisar a M9 (broker o IP de salida).
4. `FAILED` por transporte (broker caído, red): una vez recuperado el bus, `POST /events/outbox/:id/retry` o, en lote, `POST /events/outbox/retry-failed` con `{ "confirm": true, "limit": 20 }` (rol `M6_ADMIN`; deja auditoría en `outbox_retry_audit`; republica con el mismo `eventId`, los receptores deduplican). Si el motivo fue un payload rechazado, el reintento no lo arregla: [runbook 4](#4-evento-rechazado-por-el-core).
5. No hay alerta por mensajes pendientes en `q.ambiente`: se mira en el panel del Core.

**Verificación.** `/health/ready` con `"broker":"connected"`; `GET /events/outbox?status=PENDING` vacío o decreciente en 10-30 s; el log muestra `Consumiendo q.ambiente desde <host>`.

**Rollback.** Si el problema empezó con un cambio de variables, restaurar las anteriores. Sin `RABBITMQ_URL` la app sigue sirviendo y los eventos quedan en el outbox sin perderse (se publican al volver a configurarla).

**Escalamiento.** M9 para: 404 de cola que persiste con las suscripciones registradas, IP no habilitada, credenciales. Ver [m9.md](../integracion/m9.md) y [mensajes.md](../integracion/mensajes.md).

---

## 4. Evento rechazado por el Core

**Síntoma.** El evento figura `SENT` en nuestro outbox (o `FAILED` tras 5 intentos) pero el receptor nunca lo ve; o el Core lo marca `REJECTED`; un `POST` HTTP de prueba al Core da 422 o 403.

**Diagnóstico.** (Contrato en [m9.md](../integracion/m9.md); no se ejecutó contra el Core.)
1. Por AMQP el publisher confirm solo prueba que **RabbitMQ** recibió el mensaje, no que el Core lo aceptó: un `SENT` no garantiza distribución.
2. `REJECTED` en el Core: sobre válido con `data` fuera del schema del evento. Se ve en la auditoría del Core (`GET /api/v1/events/{eventId}`, con token de módulo). El `eventId` es el `id` de la fila del outbox.
3. Sobre inválido (campo de más, falta un obligatorio, `occurredAt` sin zona): por HTTP da 422 al instante; por AMQP se **descarta** sin rastro.
4. 403 por HTTP: `sourceModule` no coincide con el módulo del token; revisar `CORE_MODULE_ID` (`ambiente`).
5. Comparar el payload con el contrato publicado: `docs/eventos/publicados/<evento>.schema.json` y `src/events/payloads.ts`.
6. Un reenvío del mismo `eventId` **no** se redistribuye si el Core ya lo registró, y uno `REJECTED` tampoco se revalida.

**Acción.**
1. Corregir la causa en el código o el payload (tarea del implementador, no del operador): el schema es la fuente.
2. Para volver a emitir, un `eventId` ya registrado no sirve: coordinar con M9 el reproceso del evento rechazado.
3. Si fue un fallo de transporte (no de contenido), reintentar con `POST /events/outbox/:id/retry` como en el [runbook 3](#3-bus-desconectado-u-outbox-atascado).
4. Para probar sin ruido, publicar por HTTP y ver el error en el acto. El Core es un **ambiente único y compartido**: un evento de prueba puede llegar a otros módulos, coordinar antes.

**Verificación.** El evento aparece distribuido en la auditoría del Core y el receptor lo procesa; `GET /events/outbox/:id` (rol `M6_ADMIN`) muestra `SENT` sin `lastError`.

**Rollback.** No se puede "des-publicar". Si el evento mal emitido ya llegó a un consumidor, avisar al módulo para que lo ignore o corrija.

**Escalamiento.** M9 (reproceso de `REJECTED`, DLQ) y el módulo consumidor; registrar la coordinación en [historial de integración](../integracion/historial.md) y, si queda abierto, en [bloqueantes.md](../bloqueantes.md).

---

## 5. JWT_SECRET incorrecto o rotación

**Síntoma.** Dos casos distintos:
- **El servicio no arranca** tras cargar el secreto: el log de Render lista `JWT_SECRET ...` (no es base64 estándar, largo inválido, menos de 32 bytes, o en producción es el valor de ejemplo o de un byte repetido).
- **Arranca pero todos los endpoints protegidos dan 401** (login funciona en M1 pero el token no vale en M6): el secreto no coincide con el `APP_JWT_SECRET` de M1, o el `iss` no es el esperado.

**Diagnóstico.** (Verificado en código: `src/config/env.validation.ts`, `src/auth/jwt.strategy.ts`.)
1. Sin token: `curl -i https://m6-backend-m64k.onrender.com/zones` → 401 es lo normal y **no** prueba nada sobre el secreto.
2. Con un token real de M1 (login `POST https://ciudadanos-m1-backend.onrender.com/auth/usuario/login`, vale 15 min): `GET /me`. 401 = firma, `iss` o `typ` mal. 200 = el secreto está bien.
3. El token se verifica con HS256/384/512, el `iss` configurado (`JWT_ISSUER`, default `modulo1-ciudadanos`), `typ=access`, `exp`, `rol` y un `sub` numérico: cualquier faltante da 401 sin detalle. Un token de refresh también da 401.
4. El `JWT_SECRET` es la clave de M1 en **base64**, no el texto plano (con el valor viejo en texto plano el servicio no arranca).

**Acción.**
1. Pedir a M1 el `APP_JWT_SECRET` vigente por el grupo de POs (nunca por el repo ni el chat) y cargarlo **solo en el panel de Render**. Provisorio, solo para arrancar: `openssl rand -base64 32` (no valida tokens reales de M1).
2. **Rotación**: M1 y M6 deben cambiar el secreto en la misma ventana; los tokens emitidos con el anterior dejan de valer en M6 al reiniciar (duran 15 min, los usuarios vuelven a loguearse). Coordinar con M1 el momento, cargar el nuevo en Render y reiniciar. No hay soporte para dos secretos a la vez (verificado en código: un solo `secretOrKey`).
3. Si el `iss` cambió en M1, ajustar `JWT_ISSUER` (no se toca en Render salvo que M1 lo cambie).

**Verificación.** Login real en M1, `GET /me` con ese token → 200 y los roles esperados. Al arrancar, el log dice cuántos admins hay (`M6_BOOTSTRAP_ADMIN_USER_IDS`).

**Rollback.** Volver al valor anterior de `JWT_SECRET` en el panel y reiniciar (Render conserva el historial de variables, confirmado por el equipo el 07/11/2026; igual, guardar el valor viejo en el gestor de secretos del equipo antes de cambiar).

**Escalamiento.** M1 si el login funciona en M1 y `GET /me` sigue en 401 con el secreto confirmado igual. Ver [m1.md](../integracion/m1.md).

---

## 6. Rollback de un deploy fallido

**Síntoma.** Tras promover a `main` el servicio no arranca (`Timed Out`, contenedor en bucle), los endpoints dan 500, o una migración nueva rompió algo.

**Diagnóstico.**
1. GitHub › Actions › CI en `main`: si `build` o `test` fallaron, el job `deploy` **no** corrió y no hay nada que revertir en Render (verificado en código: `ci.yml`, `needs: [build, test]`).
2. Render › Deploys: estado del último deploy y logs. Una migración que falla impide que el contenedor levante a propósito (el `CMD` corre `prisma migrate deploy && node dist/main.js`); el deploy anterior sigue sirviendo hasta que el nuevo pasa el health check (comportamiento de Render, confirmado por el equipo el 07/11/2026).
3. `Timed Out` con la app arrancando bien: revisar que el Health Check Path esté vacío y que `PORT` no esté seteado.
4. Doble deploy: Auto-Deploy de Render tiene que estar apagado; el único disparador es el Deploy Hook del job `deploy`.

**Acción.**
1. Rollback de código: Render › servicio › **Deploys** › elegir el deploy previo que anduvo › **Rollback** (o *Redeploy* de ese commit). Confirmado por el equipo (07/11/2026).
2. Rollback por git: revertir el merge en `main` con un PR de `revert` por Git Flow (nunca commit directo); el CI vuelve a correr y el hook redespliega.
3. Si la causa es una variable nueva, restaurar la anterior ([referencia.md](referencia.md#variables-de-entorno-del-backend)) y reiniciar.
4. **Migraciones**: Prisma no tiene rollback automático. Si la migración ya se aplicó, el código viejo corre contra el esquema nuevo: sólo es seguro si la migración fue aditiva. Una migración destructiva exige un fix hacia adelante (nueva migración) coordinado con el implementador; **no** editar la base a mano ni borrar filas de `_prisma_migrations`.
5. Frontend (Vercel): Deployments › deploy previo › **Promote to Production** (confirmado por el equipo, 07/11/2026).

**Verificación.** Los `curl` de [desplegar.md](desplegar.md#cómo-verificar-que-está-todo-ok): `/health` 200, `/health/ready` 200 con `"database":"up"`, `/public/zones` 200, `/zones` sin token 401; y `/api/health` del frontend 200.

**Rollback del rollback.** *Redeploy* del commit que se quería promover una vez corregido; mientras tanto, `develop` sigue sin desplegarse.

**Escalamiento.** DevOps (cuenta de Render y Supabase) si el panel no deja revertir; implementador si hace falta una migración correctiva; avisar al PO si el servicio queda caído más de unos minutos durante una demo o entrega.
