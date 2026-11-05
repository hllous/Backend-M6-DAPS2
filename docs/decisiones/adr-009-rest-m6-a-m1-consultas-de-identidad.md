# ADR-009: REST de M6 a M1 solo para consultas de identidad, con el module-token del Core

## Estado

**Aceptado** — 2026-11-05 (issue [#495](https://github.com/hllous/Backend-M6-DAPS2/issues/495)). Excepción acotada a [ADR-006](adr-006-rabbitmq-como-bus.md).

## Contexto

[ADR-006](adr-006-rabbitmq-como-bus.md) fija que M6 se comunica con otros módulos solo por eventos. Pero los eventos no responden "¿existe este empleado y cuál es su `actorId`?": validar líder e integrantes de las cuadrillas ([#454](https://github.com/hllous/Backend-M6-DAPS2/issues/454)) y resolver nombres necesita una consulta síncrona a M1. M1 la ofrece (acordado el 3/11 y confirmado el 5/11, ver [`integracion/m1.md`](../integracion/m1.md)): valida el module-token RS256 de M9 con la clave pública, solo en `/integraciones/v1/**`.

## Decisión

M6 puede hacer **REST a M1 únicamente para consultas de identidad de solo lectura** (actores, ciudadanos por UUID, organizaciones por UUID o CUIT). Todo lo demás sigue siendo por eventos.

1. **Autenticación:** el module-token que ya pide `CoreClient.getToken()` (`kind=module`, `sub=module:ambiente`) va directo como `Authorization: Bearer`. No se usa el JWT de usuario ni otro encabezado.
2. **Puerto + adaptador** ([ADR-004](adr-004-jwt-m1-y-puerto-identidad.md)): `IdentityPort` (`src/identity/identity.port.ts`) y `M1IdentityClient`. El resto del código depende del puerto.
3. **Contrato:** 200 devuelve el registro con su `estado` real (un inactivo vuelve 200 y lo decide quien llama); 404 devuelve `null`; 401, 5xx, timeout (10 s) o red lanzan `IdentityUnavailableError`, sin token ni body en el mensaje. Sin reintento: M1 no está en el camino crítico de ninguna escritura.
4. **Seguridad del token:** `redirect: 'error'` y URL solo desde `M1_BASE_URL` (https obligatorio en producción).
5. **Config:** `M1_BASE_URL` opcional; sin ella el cliente queda deshabilitado y la app arranca igual.
6. `sub` sigue siendo la clave interna; `actorId` (UUID) es el que va en `updatedBy.id`.

## Alternativas consideradas

- **Pedir una consulta y respuesta por evento a M1:** descartada. Agrega un patrón request/reply sobre el bus que ni M1 ni M9 ofrecen.
- **Copiar el directorio de M1 a una tabla local:** descartada. Se desactualiza y duplica datos de otro módulo.
- **Usar el JWT del usuario:** descartada. M1 acordó el module-token y las consultas no son de un usuario.
- **Excepción acotada con module-token:** elegida.

## Consecuencias

### Positivas

- Validación de identidad real sin duplicar el directorio.
- Acotado y fácil de auditar: un solo módulo (`src/identity`).

### Negativas

- Dependencia síncrona de M1 y de que el Core emita tokens: con M1 caído falla la operación que consulte.
- M9 no tiene JWKS: tiene que avisar a M1 antes de rotar la clave.

### Neutras

- M1 desplegado y probado el 5/11: 200 con `actorId` UUID para `sub=1`; 404 «Empleado inexistente» para uno inexistente; organizaciones y ciudadanos inexistentes devuelven 404 con el prefijo `/integraciones/v1` (sin prefijo, 401). El cliente todavía no se usa: el cableado en cuadrillas es #521.

### Riesgos aceptados

- El mismo module-token sirve para Core y M1: un M1 comprometido obtiene un Bearer válido contra el Core hasta que expire (~15 min).
- Un 401 de M1 no invalida el token cacheado del Core: la consulta falla hasta que expire.
