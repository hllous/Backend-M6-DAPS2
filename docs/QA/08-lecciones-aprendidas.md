# 08 · Lecciones aprendidas: defectos que descubrimos tarde

> Versión 2.2 · 16/11/2026

Tres defectos que pasaron la revisión y los tests, y que encontró alguien o algo ajeno a la suite del backend. Los hechos (issues, archivos) salen de GitHub y del código; el «por qué no se detectó» es una interpretación del equipo a partir de los tests que existían.

| # | Defecto | Quién o qué lo encontró |
|---|---|---|
| 1 | [#466](https://github.com/hllous/Backend-M6-DAPS2/issues/466): `GET /evidence` sin rol ni pertenencia | La revisión del frontend (FE #732), no un test |
| 2 | [#314](https://github.com/hllous/Backend-M6-DAPS2/issues/314) y [#485](https://github.com/hllous/Backend-M6-DAPS2/issues/485): `updatedBy.id` que no era UUID | Un cambio de contrato de M2 (v1.78) y luego M1 |
| 3 | [#470](https://github.com/hllous/Backend-M6-DAPS2/issues/470): el límite de tasa contaba la IP del BFF | La integración del portal ciudadano en el frontend (FE #743) |

## 1. `GET /evidence`: cualquier token válido leía la evidencia de cualquier dueño (#466)

**Qué pasó.** `GET /evidence?ownerType=&ownerId=` no tenía `@Roles` y `AttachmentsService.findByOwner` hacía solo un `findMany` por dueño; la pertenencia (`assertOwnerAccess`) se aplicaba solo al alta. Cualquier JWT válido leía la evidencia de cualquier servicio, y un integrante de una cuadrilla leía la de otra. Corregido en el PR #468: `@Roles` explícito y, para Campo, `403 NOT_ASSIGNED`.

**Por qué no se detectó.**

- La pertenencia se pensó como regla de las acciones de Campo y se probó así: la matriz propio, ajeno y sin cuadrilla de `test/crew-ownership.e2e-spec.ts` recorre solo las que escriben.
- `src/auth/route-roles.spec.ts` garantiza `@Roles` en toda escritura; para los `GET` asume «cualquier rol de M6».
- SEC-W02 se centró en las acciones de gestión.
- El BFF ya hacía el mismo chequeo del lado del cliente: nada fallaba en la demo.

**Qué lo habría atrapado.** Un e2e de BOLA sobre cada lectura que recibe un identificador de recurso con dueño (hoy: `attachments.service.spec.ts` y `test/security-live.e2e-spec.ts`, «B lee la evidencia del servicio de A: 403 y sin URLs») y que `route-roles.spec.ts` exija `@Roles` explícito en esos `GET`.

**Lección.** Un control aplicado en una puerta de un recurso hay que probarlo en todas, la lectura incluida. Las defensas del cliente no reemplazan el control del backend.

## 2. `updateTicketStatus` mandaba un `updatedBy.id` que M2 rechazaba (#314 y #485)

**Qué pasó.** Desde la v1.78 de M2, `data.updatedBy.id` tiene que ser un UUID o `null`. M6 mandaba el `sub` numérico del JWT; si no era UUID, M2 o el Core rechazaban el evento y el vecino no se enteraba. Se corrigió mandando `null` si no es UUID (#314, PR #318) y después usando el `actorId` UUID del token de M1 (#485, PR #489).

**Por qué no se detectó.**

- El schema del repo describía el campo solo en la descripción; no exigía `format: uuid`.
- Los tests que validaban el payload contra el paquete de contratos de M2 no corrían en el CI: el paquete no se versiona y esos tests se salteaban con un `console.warn`.
- `payloads.spec.ts` armaba el evento con `updatedById: 'user-001'` y no comprobaba el formato.

**Qué lo habría atrapado.** Un test de contrato dentro del CI que valide cada payload contra schemas versionados (con `format: uuid`) y un test parametrizado de `updateTicketStatus` con los formatos reales de `sub` (entero, `USR-1`, vacío, UUID) que afirme «UUID o `null`». Hoy el schema exige UUID o `null` y los ejemplos de M2 están en `test/fixtures/m2/`.

**Lección.** Un contrato que solo se valida en la máquina de quien tiene el archivo no está probado. Lo que el CI valida tiene que viajar con el repo.

## 3. El límite de tasa del portal contaba la IP del BFF, no la del vecino (#470)

**Qué pasó.** El frontend consulta `/public/*` desde su BFF en Vercel. `@nestjs/throttler` cuenta por `req.ip`, así que todas las consultas de todos los vecinos compartían un contador: 20 por minuto en `GET /public/reports/:ticketId` para toda la ciudad. Corregido en el PR #480: la IP real se toma de `X-Forwarded-For` solo si el pedido trae la clave `X-M6-BFF-Key`.

**Por qué no se detectó.**

- Ningún test disparaba el 429: los specs del portal comprobaban qué datos devuelve, no que el límite funcione.
- Los tests de integración llaman a la app con `supertest`, sin proxy delante; el problema nace de la topología Vercel → Render.
- Un caso parecido (#158, `trust proxy` de Render) se arregló en la primera capa de proxy y se asumió que no había otra.

**Qué lo habría atrapado.** Un test del throttler con dos IP distintas en `X-Forwarded-For` y la clave del BFF (dos contadores independientes) y otro sin la clave (se ignora el encabezado): hoy `src/modules/citizen-portal/client-tracker.spec.ts`; el 429 global lo dispara `test/throttler.e2e-spec.ts`.

**Lección.** Los límites, las IP y los encabezados dependen de lo que hay entre el cliente y la app: se prueban con la misma cadena de proxies que producción, no solo en la capa HTTP de Nest.

## 4. Otros defectos de la semana de testing

| # | Defecto | Cómo se encontró | Qué lo atrapa hoy |
|---|---|---|---|
| 4 | [#567](https://github.com/hllous/Backend-M6-DAPS2/issues/567) / DEF-23: `rabbitmq-setup` salía con `exit 7` en el primer `docker compose up` en frío (el `healthcheck` daba `healthy` antes de que la consola de RabbitMQ escuchara) | Correr `docker compose up` desde cero con volúmenes nuevos | `g1-arranque.yml` levanta el compose en frío y falla si del comando al login pasan más de 15 minutos |
| 5 | [#569](https://github.com/hllous/Backend-M6-DAPS2/issues/569) / DEF-22: los logs registraban el `access_token` de la query | El PR de los tests de seguridad (#581) | `redact-url.spec.ts` y `logging.interceptor.spec.ts` con el dato prohibido adentro; `security-live` |
| 6 | Secreto de juguete literal en `api-tests.yml` (#572 / P-1) | gitleaks en el CI, antes de mergear | Jobs `secrets` y `secrets-default` sobre todo el historial |
| 7 | El informe decía que la colección Newman tenía caso de error en las 152 operaciones; eran 149 (`GET /health`, `GET /health/ready` y `GET /public/zones` no tienen un error provocable). La cifra se había contado a mano y copiado de un documento a otro | El chequeo automático de cobertura de la colección (#702) | `npm run api:coverage` dentro de `npm test`; excepciones justificadas en `test/api/PENDIENTES.md` |
| 8 | Tres criterios no describían el comportamiento real: CA-HU30-4 decía que el login corta a los 15 s (corta a los 90 s, `LOGIN_TIMEOUT_MS`), CA-HU26-1 omitía la coma del formato («06/09/2026, 14:05») y CA-HU31-5 declaraba como limitación la falta de id de correlación. Figuraban como «solo FE» con un test citado por nombre de archivo que nadie había leído contra el criterio | Automatizar los criterios solo-FE (Eje A, FE #979) y las pruebas de seguridad en vivo (#701) | Un test por criterio, leído contra el Dado/Cuando/Entonces y ejecutado. En los dos primeros se corrigió el criterio, no el código |
| 9 | `src/app/api/vehicles/[id]/route.ts` del frontend devolvía 500 en vez de 503 con el backend caído: `return forward(...)` sin `await` dentro del `try` deja escapar el rechazo del `catch` (DEF-40) | Los tests escritos para subir la cobertura del frontend (#975) | Tests de cada ruta del BFF con el backend caído; corregido en FE #985. La regla `@typescript-eslint/return-await` en modo `in-try-catch` lo atraparía en el lint |

## 5. Patrón común y reglas que adoptamos

| Patrón | Regla |
|---|---|
| Los tres los encontró alguien ajeno a la suite del backend | Antes de cerrar una HU que toca un recurso con dueño, un contrato externo o la red, agregar el test de la frontera (lectura, contrato, proxy) y no solo el del camino feliz |
| Cada control se probó por un solo lado (la escritura, el schema local, la capa HTTP) | Listar las puertas del mismo recurso y probar cada una |
| Los tests que habrían servido se saltaban en el CI o existían en forma parcial | Un test no depende de un archivo que el CI no tiene |
| Las propiedades negativas y el arranque limpio no tenían prueba | Probar con el dato prohibido adentro y correr desde cero lo que se entrega |
| Una cifra o un criterio citados sin medir ni ejecutar resultaron falsos (casos 7 y 8) | Una cifra del informe sale de una herramienta, y un criterio cuenta como verificado solo si su test se leyó y se ejecutó |
