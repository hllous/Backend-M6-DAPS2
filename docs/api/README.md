# API REST del backend M6

Documentación técnica de la API que expone el backend, para uso del equipo interno.

## Qué hay acá

- [`estandar-swagger.md`](estandar-swagger.md) — convenciones que **todo endpoint debe cumplir** (tags, formato de respuestas, códigos HTTP, autenticación, DTOs). De lectura obligatoria antes de escribir el primer endpoint.
- [`endpoints.md`](endpoints.md) — resumen de los endpoints REST expuestos por M6, con sus filtros y su semántica de baja.

## URL pública del Swagger

> `https://m6-backend-m64k.onrender.com/api/docs`

Ver [`docs/deploy.md`](../deploy.md) para el estado del despliegue.

## Convención general

La comunicación entre módulos es **por eventos asincrónicos** — no REST (ver [`docs/eventos/`](../eventos/)). REST se usa solo para:

1. Comunicación frontend M6 → backend M6 (uso interno).
2. Casos justificados de consulta síncrona a otros módulos (por ejemplo, consulta de establecimiento a M4 antes de emitir un acta).

## Identidad e integraciones futuras con M1

El JWT de usuario lo emite M1 y este backend lo valida; no se emiten JWT propios desde M6. El detalle verificable del token sigue pendiente en M1 y se documenta en [`bloqueantes.md`](../bloqueantes.md#m1--ciudadanos--jwt-confirmado-sin-integración-de-dominio-actual).

M6 no consume actualmente los eventos ni endpoints de ciudadanos u organizaciones de M1. Si un caso de uso futuro lo requiere, el caso de uso depende de un puerto de aplicación y el adaptador de infraestructura resuelve el transporte (REST o Kafka request/response). Así no se acopla el dominio a una decisión de integración aún no necesaria.
