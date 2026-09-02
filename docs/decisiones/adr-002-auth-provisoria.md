# ADR-002: Autenticación provisoria mientras M9 no define el claim set

## Estado

**Propuesto** — 2026-09-02

## Contexto

M9 (Core) es el módulo al que el enunciado le asigna la identidad, pero todavía no publicó cómo emite los JWT ni qué claims traen. Es el bloqueante principal del proyecto y está abierto desde el 17/08 (ver [bloqueantes.md](../bloqueantes.md)).

Mientras tanto, el backend acumuló 48 endpoints en seis módulos de dominio. Todos declaran `@ApiBearerAuth('JWT-auth')` y documentan respuestas 401 y 403 en Swagger, pero **ninguno tiene un guard aplicado**: `@UseGuards` no aparecía en ningún controller y no había `APP_GUARD` registrado. La API desplegada en Render estaba completamente abierta y el Swagger prometía una seguridad inexistente.

[AGENTS.md](../../AGENTS.md) marca "Auth/JWT prioritario antes de tocar módulos de dominio". Se hizo al revés, así que la pregunta ya no es en qué orden construir sino cómo cerrar el agujero sin poder hablar con M9.

La observación que destraba el problema: de todo lo que falta, **lo único que realmente depende de M9 es cómo se verifica el token y qué trae adentro**. Colgar el guard de los 48 endpoints, marcar los públicos y decidir la forma de `request.user` no depende de ellos, y es justamente la parte cara de retrofitear después.

## Decisión

Implementamos ya la verificación de JWT con una estrategia HS256 contra el `JWT_SECRET` local, registrada como `APP_GUARD` global, y aislamos toda la dependencia de M9 en un único archivo ([`src/auth/jwt.strategy.ts`](../../src/auth/jwt.strategy.ts)).

Los endpoints sin token se marcan explícitamente con `@Public()`. **Diferimos los `@Roles()`** hasta que M9 publique su taxonomía de roles.

## Alternativas consideradas

- **Esperar a M9 y dejar la API abierta**: es lo que veníamos haciendo por default. Deja el backend desplegado sin ninguna protección por tiempo indefinido, con un Swagger que documenta 401 y 403 que nunca ocurren. Descartada: el costo de esperar es una API pública, no una funcionalidad faltante.
- **Inventar nuestro propio módulo de identidad** (usuarios, login, emisión de tokens): resuelve el problema pero construye algo que M9 va a reemplazar entero, y el enunciado le asigna la identidad a ellos. Es trabajo garantizado a la basura.
- **Guard con API key compartida** en vez de JWT: más simple, pero no da identidad de usuario, así que ni `CurrentUser` ni los roles futuros tendrían de dónde salir, y el cambio a JWT después toca todos los controllers.
- **Stopgap HS256 con el claim mínimo estándar (la elegida)**: `sub` como identidad y `roles` como array de strings. Es el mínimo que cubre cualquier forma razonable que M9 elija. `passport-jwt` y `@nestjs/jwt` ya estaban en `package.json`, así que no suma dependencias. Cuando M9 confirme, cambia `secretOrKey` (o pasa a `secretOrKeyProvider` si usan JWKS) y el mapeo de claims: un archivo.

## Consecuencias

### Positivas

- La API deja de estar abierta, y el Swagger deja de mentir con sus 401.
- El frontend y QA pueden trabajar ya: firman tokens locales con el mismo `JWT_SECRET`.
- La deuda con M9 queda contenida en `validate()` y `secretOrKey`. Ni los guards, ni los controllers, ni los DTOs se tocan cuando llegue la definición real.
- Se cierra el criterio del DoD sobre endpoints protegidos, sin depender de un tercero.

### Negativas

- Los tokens que aceptamos hoy no son los de producción: hasta que M9 publique, cualquiera con el `JWT_SECRET` puede firmar un token válido con los roles que quiera. Es aceptable porque hoy ese secreto es de desarrollo y en Render es una variable de entorno del servicio, pero **no es la autenticación final**.
- La autorización por rol sigue sin existir: cualquier usuario autenticado puede hacer cualquier cosa. `RolesGuard` ya devuelve `true` cuando no hay `@Roles()`, así que agregarlos después es un decorador por endpoint y cero refactor — pero mientras tanto no hay separación de permisos.

### Neutras

- Hay que marcar `@Public()` en cada endpoint que no requiera token: hoy solo `/health`, más adelante los del portal del ciudadano.
- Queda una fila abierta en [bloqueantes.md](../bloqueantes.md) y una excepción del DoD registrada, hasta que M9 conteste.

## Referencias

- [bloqueantes.md — M9 Core](../bloqueantes.md#m9--core-): el claim set sin definir, bloqueante desde el 17/08.
- [AGENTS.md](../../AGENTS.md): "Auth/JWT prioritario antes de tocar módulos de dominio".
- [docs/api/estandar-swagger.md](../api/estandar-swagger.md) §6: convención de endpoints públicos y autenticados.
- [ADR-001](adr-001-stack-tecnologico.md): stack que ya incluía `passport-jwt` y `@nestjs/jwt`.
