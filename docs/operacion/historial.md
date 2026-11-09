# Historial del despliegue

Fotos fechadas del estado. **No son el estado actual**: para eso, los `curl` de [desplegar.md](desplegar.md#cómo-verificar-que-está-todo-ok). Las entradas se agregan arriba y no se reescriben.

## Snapshot del 08/10/2026 (con notas hasta el 02/11): componentes

> Snapshot, no es el estado actual.

| Componente | Plataforma | Estado en esa fecha | URL |
|---|---|---|---|
| Backend (NestJS) | Render (Web Service, free) | ✅ `/health` 200 y `/health/ready` 200 con `"database":"up"` el 08/10 12:09 UTC | `https://m6-backend-m64k.onrender.com` |
| PostgreSQL | Supabase (Managed, free) | ✅ Available | URI directa, puerto `5432` |
| Frontend (Next.js) | Vercel (free) | ✅ `/api/health` 200 el 02/11 | `https://m6-ambiente-higiene.vercel.app` |

- El deploy quedó enlazado a `main`: el frontend siempre estuvo en `main`; el backend pasó de `develop` a `main` el 22/10.
- La URL anterior del frontend, `frontend-m6-daps2-grupo4-modulo6.vercel.app`, respondía `308` hacia la vigente (verificado el 02/11).

## Snapshot del 06/11/2026: estado de la app end-to-end

> Snapshot, no es el estado actual. Conteos contrastados con el código el 04/10/2026 y revisados el 06/11/2026 (135 rutas en 23 tags Swagger al 04/10; al 06/11, 152 operaciones sobre 103 rutas en 29 tags). El conteo vigente está en [endpoints.md](../api/endpoints.md).

| # | Qué | Estado en esa fecha |
|---|---|---|
| 1 | **Migraciones de Prisma** | ✅ Resuelto (PR #49). El `CMD` del Dockerfile corre `npx prisma migrate deploy` antes de arrancar. Si la migración falla, el contenedor no levanta |
| 2 | **Services de dominio** | ✅ Fases 1 a 7 completas (152 endpoints en 29 tags al 06/11): catálogos, recursos (cuadrillas, vehículos), contenedores, arbolado, espacios verdes, `Service` (máquina de estados, ZoneResults, CollectionRecords), control ambiental (expedientes, inspecciones, actas, sanciones), derivaciones (M3 reparaciones, M7 cortes), tablero de indicadores (`/indicators`) y portal ciudadano (`/public`) |
| 3 | **Autenticación** | ✅ Todo endpoint exige JWT (guard global) y la verificación sigue el contrato de M1 (`JWT_SECRET` en base64, `iss`, `typ=access`, `rol`). `RolesGuard` es global y falla cerrado: toda escritura declara su rol ([ADR-008](../decisiones/adr-008-roles-m6-adaptados-desde-m1.md), tabla en [endpoints](../api/endpoints.md)). Login real de M1 verificado en el backend desplegado el 3/11 (ver [resueltos](../integracion/resueltos.md)). [ADR-002](../decisiones/adr-002-auth-provisoria.md) quedó superado en esto |
| 4 | **Eventos** | ✅ Outbox transaccional (Fase 3), Inbox con handlers (Fase 6) y adaptador/consumidor de RabbitMQ (#234) implementados. El Core de M9 ya estaba desplegado en AWS (ambiente único y compartido, guía común del 20/10); la ficha privada y el alta de la IP ya estaban y la prueba AMQP con M3 pasó por el Core el 5/11 (ver [historial de integración](../integracion/historial.md)). `npm run core:register -- --dry-run` del 6/11 no encontró nada por crear (8 suscripciones y 6 publicaciones activas). Sin `RABBITMQ_URL`, los eventos se encolan en el outbox y se registran en log; con ella, la app publica al exchange `muni.inbox` y consume `q.ambiente` |
| 5 | **Evidencia y adjuntos** | ✅ Resuelto (Fase 7). `POST /evidence` genérico sobre Cloudflare R2 con `Idempotency-Key` obligatoria respaldada por constraint único en DB (`SERVICE`, `ZONE_RESULT`, `INSPECTION`, `CONTAINER`) |
| 6 | **Frontend (Next.js)** | ⏳ En desarrollo en esa fecha. Etapa de mapa de Wayfinder completada: diseño (DESIGN.md con paleta Azul Institucional y WCAG 2.2 AA), contratos (CONTRACTS.md), BFF session (ADR-0004) y prototipos interactivos validados |

**Contradicción resuelta (07/11/2026):** el snapshot del 08/10 marcaba el frontend como ✅ (desplegado) y este snapshot lo marcaba ⏳. No se contradicen: el frontend **está desplegado** y responde (`/api/health` 200 verificado el 07/11), y "en desarrollo" se refería a su avance funcional. El estado del desarrollo del frontend vive en su repo, [`hllous/Frontend-M6-DAPS2`](https://github.com/hllous/Frontend-M6-DAPS2), no acá.
