# ADR-002: Autenticación provisoria mientras M1 no publica su contrato de JWT

## Estado

**Aceptado** — 2026-09-02

> Corregido el 2026-09-02: la versión original de este ADR atribuía la identidad a **M9 (Core)**. Es **M1** quien gestiona los usuarios y emite el JWT, como ya establece [ADR-004](adr-004-jwt-m1-y-puerto-identidad.md). La decisión técnica no cambia —era y sigue siendo una estrategia HS256 provisoria aislada en un archivo—; lo que cambia es a quién hay que reclamarle el contrato. M9 sigue siendo el dueño del bus de eventos y del catálogo de barrios, y esas menciones no se tocaron.

## Contexto

El enunciado de la cátedra deja la identidad ambigua entre el Core y M1, y la cohorte tardó en cerrarlo. Hoy está cerrado: **M1 autentica a las personas y emite el JWT de usuario**, y M6 lo valida. Lo que sigue faltando es el contrato técnico —algoritmo de firma, `iss`, `aud`, claves o JWKS, claims y TTL— sin el cual no se puede verificar un token real. Es el bloqueante principal del proyecto y está abierto desde el 17/08 (ver [bloqueantes.md](../bloqueantes.md)).

Mientras tanto, el backend acumuló 48 endpoints en seis módulos de dominio. Todos declaran `@ApiBearerAuth('JWT-auth')` y documentan respuestas 401 y 403 en Swagger, pero **ninguno tenía un guard aplicado**: `@UseGuards` no aparecía en ningún controller y no había `APP_GUARD` registrado. La API desplegada en Render estaba completamente abierta y el Swagger prometía una seguridad inexistente.

[AGENTS.md](../../AGENTS.md) marca "Auth/JWT prioritario antes de tocar módulos de dominio". Se hizo al revés, así que la pregunta ya no es en qué orden construir sino cómo cerrar el agujero sin poder hablar con M1.

La observación que destraba el problema: de todo lo que falta, **lo único que realmente depende de M1 es cómo se verifica el token y qué trae adentro**. Colgar el guard de los 48 endpoints, marcar los públicos y decidir la forma de `request.user` no depende de ellos, y es justamente la parte cara de retrofitear después.

## Decisión

Implementamos ya la verificación de JWT con una estrategia HS256 contra el `JWT_SECRET` local, registrada como `APP_GUARD` global, y aislamos toda la dependencia de M1 en un único archivo ([`src/auth/jwt.strategy.ts`](../../src/auth/jwt.strategy.ts)).

Los endpoints sin token se marcan explícitamente con `@Public()`. **Diferimos los `@Roles()`** hasta que M1 publique su taxonomía de roles.

## Alternativas consideradas

- **Esperar a M1 y dejar la API abierta**: es lo que veníamos haciendo por default. Deja el backend desplegado sin ninguna protección por tiempo indefinido, con un Swagger que documenta 401 y 403 que nunca ocurren. Descartada: el costo de esperar es una API pública, no una funcionalidad faltante.
- **Inventar nuestro propio módulo de identidad** (usuarios, login, emisión de tokens): resuelve el problema pero construye algo que M1 va a reemplazar entero, y el acuerdo de la cohorte le asigna la identidad a ellos. Es trabajo garantizado a la basura, y además duplicaría la autoridad de identidad — el mismo motivo por el que [ADR-004](adr-004-jwt-m1-y-puerto-identidad.md) lo descarta.
- **Guard con API key compartida** en vez de JWT: más simple, pero no da identidad de usuario, así que ni `CurrentUser` ni los roles futuros tendrían de dónde salir, y el cambio a JWT después toca todos los controllers.
- **Stopgap HS256 con el claim mínimo estándar (la elegida)**: `sub` como identidad y `roles` como array de strings. Es el mínimo que cubre cualquier forma razonable que M1 elija. `passport-jwt` y `@nestjs/jwt` ya estaban en `package.json`, así que no suma dependencias. Cuando M1 confirme, cambia `secretOrKey` (o pasa a `secretOrKeyProvider` si usan JWKS) y el mapeo de claims: un archivo.

## Consecuencias

### Positivas

- La API deja de estar abierta, y el Swagger deja de mentir con sus 401.
- El frontend y QA pueden trabajar ya: firman tokens locales con el mismo `JWT_SECRET`.
- La deuda con M1 queda contenida en `validate()` y `secretOrKey`. Ni los guards, ni los controllers, ni los DTOs se tocan cuando llegue la definición real.
- Se cierra el criterio del DoD sobre endpoints protegidos, sin depender de un tercero.

### Negativas

- Los tokens que aceptamos hoy no son los de producción: hasta que M1 publique, cualquiera con el `JWT_SECRET` puede firmar un token válido con los roles que quiera. Es aceptable porque hoy ese secreto es de desarrollo y en Render es una variable de entorno del servicio, pero **no es la autenticación final**.
- La autorización por rol sigue sin existir: cualquier usuario autenticado puede hacer cualquier cosa. `RolesGuard` ya devuelve `true` cuando no hay `@Roles()`, así que agregarlos después es un decorador por endpoint y cero refactor — pero mientras tanto no hay separación de permisos.

### Neutras

- Hay que marcar `@Public()` en cada endpoint que no requiera token: `/health` y los cuatro del portal del ciudadano bajo `/public`.
- Queda una fila abierta en [bloqueantes.md](../bloqueantes.md) y una excepción del DoD registrada, hasta que M1 conteste.

## Referencias

- [ADR-004](adr-004-jwt-m1-y-puerto-identidad.md): M1 como emisor del JWT y el puerto de identidad diferido. Este ADR resuelve el *mientras tanto*; aquel resuelve el *quién*.
- [bloqueantes.md — M1](../bloqueantes.md): el contrato técnico del JWT, bloqueante desde el 17/08.
- [AGENTS.md](../../AGENTS.md): "Auth/JWT prioritario antes de tocar módulos de dominio".
- [docs/api/estandar-swagger.md](../api/estandar-swagger.md) §6: convención de endpoints públicos y autenticados.
- [ADR-001](adr-001-stack-tecnologico.md): stack que ya incluía `passport-jwt` y `@nestjs/jwt`.
