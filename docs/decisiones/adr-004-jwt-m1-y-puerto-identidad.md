# ADR-004: JWT de usuario emitido por M1 y consulta a identidad desacoplada por puerto

## Estado

**Aceptado** — 2026-09-01

## Contexto

El acuerdo con M1 establece que ese módulo autentica a las personas y emite el JWT de usuario, mientras que M6 debe validar el token al proteger sus recursos. M1 todavía no publicó el contrato criptográfico verificable ni M6 necesita, en sus casos de uso actuales, consultar ciudadanos u organizaciones de M1.

El transporte futuro de una eventual consulta de identidad tampoco es necesario para implementar el dominio: M1 documentó alternativas REST y eventos, y la cohorte todavía debe cerrar cuándo aplica cada una.

## Decisión

M6 no emite JWT propios. Valida los JWT emitidos por M1 mediante una configuración basada en el contrato que M1 publique. Mientras falten sus parámetros técnicos, las claves de desarrollo son locales, configurables y no representan un contrato de integración.

Cuando un caso de uso necesite datos de identidad de M1, dependerá de un puerto de aplicación; un adaptador de infraestructura implementará REST o request/response por el bus. No se agrega ese adaptador ni se consumen eventos de M1 hasta que exista un caso de uso de M6 que lo requiera.

## Alternativas consideradas

- **Que M6 emita un JWT propio**: descartada. Duplica la autoridad de identidad y contradice el acuerdo con M1.
- **Acoplar el dominio ya a endpoints o eventos de M1**: descartada. No hay consumidor actual y el transporte todavía no hace falta decidirlo.
- **JWT de M1 + puerto de identidad diferido**: elegida. Permite implementar autenticación y dominio de M6 sin inventar contratos ajenos.

## Consecuencias

### Positivas

- Una sola autoridad para la identidad de usuarios.
- La lógica de dominio no cambia si una consulta futura usa REST o el bus.

### Negativas

- No se puede activar validación JWT real fuera de desarrollo hasta que M1 publique firma, claves, claims, emisor, audiencia y TTL.
- Una integración futura requerirá un adaptador y pruebas de contrato adicionales.

### Neutras

- El token de servicio del Core/M9, si se usa para comunicación máquina-a-máquina, se trata como una credencial distinta del JWT de usuario.

## Nota de corrección — 2026-10-21

M1 entregó el contrato real del JWT ([#353](https://github.com/hllous/Backend-M6-DAPS2/issues/353); detalle en [`../integracion/m1.md`](../integracion/m1.md#acordado-el-2110)). La decisión no cambia (M1 emite, M6 valida); cambia lo que dábamos por provisorio:

- **HS256 con secreto compartido en base64** (`APP_JWT_SECRET` de M1, mínimo 256 bits), no JWKS ni clave pública. El valor se pide a M1 por privado. «Sin firma, claves ni emisor» deja de ser un bloqueo salvo por el secreto.
- **Claims:** `iss` = `modulo1-ciudadanos` (verificar), `sub` (id numérico), `sub_type`, `rol` (un solo string, no `roles[]`), `typ` = `access` (rechazar si no), `iat`, `exp`. TTL de 15 min y sin `aud`.
- **Rol único y sin área:** el rol de M1 no alcanza para autorizar en M6; sigue el modelo híbrido (adaptador + tabla local de asignaciones, #161).
- **Código (hecho en [#354](https://github.com/hllous/Backend-M6-DAPS2/issues/354)):** `src/auth/jwt.strategy.ts` decodifica el secreto de base64, fija `HS256`, exige `iss` y `exp`, rechaza `typ` distinto de `access` y lee `rol` (queda en `request.user` como `roles: [rol]` más `subType`). Variables: `JWT_SECRET` (base64, ≥ 32 bytes) y `JWT_ISSUER`; `JWT_EXPIRATION` se eliminó, no se usaba (M1 fija el TTL).

## Referencias

- [`../bloqueantes.md`](../bloqueantes.md)
- Catálogo M1 v2 compartido el 2026-09-01.
