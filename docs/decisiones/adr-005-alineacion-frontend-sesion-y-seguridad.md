# ADR-005: Alineación de arquitectura de sesión BFF, separación de actores y postura de seguridad con el Frontend

## Estado

**Aceptado** — 2026-09-03

## Contexto

Durante la etapa de diseño de arquitectura y mapa de Wayfinder del Frontend (Issue hllous/Frontend-M6-DAPS2#6 y sus tickets hijos #8, #10, #16, #18, #37, #38), el equipo de Frontend consolidó decisiones clave que interactúan directamente con los contratos y la seguridad del Backend:

1. **Arquitectura de sesión y custodia del JWT (Frontend ADR-0004):** M1 autentica a las personas y emite el JWT. Para proteger el token en el cliente (evitar exposición a XSS en localStorage), el frontend adopta un **Next.js BFF (Backend for Frontend)**. La sesión vive en una cookie sellada httpOnly (JWE) en el servidor Next.js. El navegador nunca accede al JWT de M1; el BFF desempaqueta el token y lo reenvía como encabezado Authorization: Bearer <token> a cada llamada hacia el Backend de M6.
2. **Separación estricta de actores (Frontend ADR-0002):** Se definió que los roles de **Oficina** (Office) y **Campo** (Field) son mutuamente excluyentes para garantizar segregación de funciones. Oficina programa, asigna, reprograma, cancela servicios, autoriza intervenciones de arbolado y emite actas de infracción. Campo (Líder de Cuadrilla y Miembros) ejecuta en calle, inicia/suspende/completa servicios, registra ZoneResult e inspecciona.
3. **Seguridad en profundidad y autoridad de validación (Frontend ADR-0006 e Issue Backend #90):** El frontend trata sus propios controles (re-encoding de fotos a JPEG, despojo de EXIF, ocultamiento de botones por capacidades, listas blancas de columnas en exportación) como **defensa en profundidad (UX/privacidad)**, nunca como barrera de seguridad autoritativa. Exige que el Backend sea la **única autoridad de validación y auditoría**.
4. **Convenciones de coordinación operativa (CONTRACTS.md):** Clarificaciones sobre cómo el frontend invoca endpoints del backend para flujos compuestos (autorización universal de intervenciones de arbolado con POST /tree-interventions/:id/authorize, transición transaccional de contenedor al cerrar servicio POINT, y subida de evidencia vía POST /evidence con Idempotency-Key).

## Decisión

1. **Recepción de tokens vía BFF:** El Backend continúa recibiendo y validando el Bearer token en cada request protegido. Durante la fase de auth provisoria ([ADR-002](adr-002-auth-provisoria.md)), el BFF firmará o inyectará el token HS256 compatible con JWT_SECRET. Cuando M1 entregue su contrato definitivo ([ADR-004](adr-004-jwt-m1-y-puerto-identidad.md)), el Backend cambiará la estrategia de validación sin alterar la interfaz con el BFF.
2. **Segregación de funciones Office / Field:** Backend adopta la distinción Office vs Field como regla de diseño. Cuando M1 publique su catálogo de roles/claims, Backend implementará @Roles() y decoradores de capacidades para rechazar con 403 Forbidden cualquier intento de un usuario de campo de autorizar intervenciones o emitir actas, y viceversa.
3. **Autoridad de validación y auditoría (Issue #90):**
   - **Validación autoritativa en /evidence:** El endpoint genérico implementado en Fase 7 debe verificar en el servidor el MIME type real por magic bytes (no confiar ciegamente en Content-Type), mantener el límite de 10 MB, sanitizar metadatos EXIF antes de guardar en Cloudflare R2 y contemplar escaneo de malware.
   - **Auditoría de datos Tier 2:** Backend es el único registro de auditoría (udit-of-record). Para datos de Nivel de Sensibilidad 2 (identidad de denunciantes en EnvironmentalReport, actas ViolationNotice, resoluciones SanctionOutcome), el backend registrará auditoría tanto para modificaciones como para consultas/lecturas (GET), preservando la privacidad del vecino.
   - **Allowlist server-side:** Cualquier endpoint de exportación o reporte debe filtrar los campos permitidos en la respuesta del servidor y no delegar el filtrado de columnas confidenciales al frontend.
4. **Cierre transaccional de Contenedores:** Se confirma el diseño implementado en Backend (services.service.ts / Issue #63): al completar un Service con 	argetType = CONTAINER en estado COMPLETED, el contenedor transiciona automáticamente en la misma transacción (OVERFLOWED/UNDER_REPAIR → ACTIVE, y RELOCATING → ACTIVE si se proveyó containerLocation), garantizando consistencia atómica sin depender de una segunda llamada del cliente.

## Alternativas consideradas

- **Permitir que el navegador gestione directamente el JWT de M1:** Descartada por riesgo de robo de token ante vulnerabilidades XSS en el navegador.
- **Delegar la validación de archivos exclusivamente al frontend:** Descartada. Un cliente web no es un perímetro de seguridad; cualquier script o llamada externa a la API podría vulnerar el storage con archivos maliciosos.
- **Mantener auditorías paralelas en frontend y backend:** Descartada. Genera deriva de registros; el backend, al recibir siempre la identidad autenticada, es el único punto centralizado confiable.

## Consecuencias

### Positivas

- Alineación completa entre contratos del frontend y endpoints de backend.
- Modelo de seguridad robusto con defensa en profundidad en el cliente y validación estricta en el servidor.
- La transición de contenedor al cerrar servicio POINT es atómica y segura en base de datos.
- Quedan especificados los requerimientos no funcionales de auditoría y exportación para la fase de endurecimiento hacia producción.

### Negativas

- El backend debe incorporar validación de magic bytes y stripping de EXIF en el servicio de R2 cuando se pase a producción.
- La auditoría de lecturas (GET sobre datos Tier 2) requerirá interceptores o middleware dedicado de logging en NestJS.

### Neutras

- El frontend continuará modelando sus formularios y vistas asumiendo que el backend responderá 401/403 según corresponda.

## Referencias

- Frontend Wayfinder Map: hllous/Frontend-M6-DAPS2#6
- Frontend ADR-0002: *Office and Field actors are mutually exclusive*
- Frontend ADR-0004: *M6 owns a server-side BFF session; the M1 JWT never reaches the browser*
- Frontend ADR-0005: *M6 Backend is the sole authorization authority*
- Frontend ADR-0006: *Frontend security controls are defense-in-depth only; Backend validates and audits authoritatively*
- Backend Issue #90: *M6 frontend security review: authoritative upload validation, Tier-2 read audit, server-side export allowlists*
- Backend Issue #64: *feat: evidence/attachment upload endpoint (Service + Container)*
- Backend Issue #63: *question(containers): does completing a POINT Service update its target Container's status*
- [ADR-002](adr-002-auth-provisoria.md): Autenticación provisoria HS256
- [ADR-004](adr-004-jwt-m1-y-puerto-identidad.md): JWT de usuario emitido por M1
