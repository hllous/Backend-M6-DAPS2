# Mensajes a otros módulos

> Textos redactados para el canal de la cohorte, con la fecha en que se enviaron. Enviarlos y anotar la fecha es trabajo de una persona, no del repo. Reubicado el 20/10/2026 (#312).

El 20/10 a las 07:45 se mandaron a M1, M2, M7 y M9 los avisos de esta sección (el seguimiento a M9 de #300, que se redactó después, se mandó ese mismo día). Respondieron M9, M7 y M2; M1 no. Las filas ⚠️ de arriba que dicen "aviso pendiente" son los que siguen sin enviar. El texto está escrito para copiar y pegar en el canal de la cohorte; **enviarlos y anotar la fecha en la fila correspondiente es trabajo de una persona, no del repo.**

**→ M2 (Atención Ciudadana)** — *enviado el 20 oct 2026 a las 07:45; M2 respondió el mismo día (ver la sección de M2). Se deja el texto como registro.*

> Cruzamos la v1.75 y no cambia nada de lo que implementamos: el sobre del Core, `updateTicketStatus` y `ticketUpdated` coinciden con lo que ya enviamos y consumimos. `publicId` ya viaja en nuestro modelo como referencia humana y respetamos que no es credencial (no lo usamos para autorizar ni lo aceptamos en el seguimiento público). Nos queda un pedido que ya va por la sexta versión (v1.75): **necesitamos mandarles la fecha y la franja horaria agendadas de un servicio**, y hoy no hay campo. `progress` es un `Int` de porcentaje y §8.2 de la v1.75 mantiene "details obligatorio: Ninguno" para `STARTED`/`PROGRESS`. ¿Lo mandamos como texto dentro de `publicMessage`, o definen algo tipo `details.schedule { scheduledDate, windowFrom, windowTo }`? Con cualquiera de las dos respuestas cerramos el tema; lo que no podemos es seguir sin lugar donde ponerlo.

> Y una confirmación: en el paquete de schemas, el ejemplo `PROGRESS_programacion` manda la fecha y la franja como texto en `publicMessage`. ¿Es la forma oficial de informar la programación? Si lo es, cerramos el pedido. ¿Esperan un `STARTED` antes, aunque el área todavía no haya empezado el trabajo? Y gracias por el paquete: contrastamos nuestros `updateTicketStatus` con su validador y no hay diferencias.

> *(Sobre `occurredAt`: ya no hace falta consultarlo. El sobre del Core que M2 también adopta fija ISO 8601 con offset.)*

**→ M7 (Obras / Espacio público)** — *enviado el 20/10 a las 07:45; M7 respondió el 20/10 (ver la sección de M7). Se deja el texto como registro.*

> Tres diferencias de enums entre su documento y nuestro catálogo, que mandan nuestros valores (ADR-003): `ServiceOrigin` tiene cinco valores (`PLANNED`, `TICKET`, `WEATHER_ALERT`, `INSPECTION`, `MANUAL`), no `SCHEDULED`/`INTERNAL`; `TreeHealthStatus` conserva `WEAKENED` y `DISEASED` separados, no los colapsa en `DECLINING`; y `TreeInterventionType` distingue `FORMATION_PRUNING` de `SAFETY_PRUNING` y usa `REMOVAL`, no `FELLING`. Además, en `streetClosureRequested` mandamos `sourceModule: "M6"`, siguiendo su tabla de campos: su prosa decía `requestingModule` y nos quedamos con la tabla. Si prefieren al revés, avisen y lo cambiamos.

> Y una precisión sobre el sobre nuevo del Core (el que fijó M9 el 7/10 para toda la cohorte): en `streetClosureRequested` el sobre va a traer `sourceModule: "ambiente"` y `data.sourceModule` sigue siendo `"M6"`, porque así lo exige el schema que acordamos. ¿Cuál de los dos leen para rutear la respuesta? Los tres eventos de respuesta nos siguen llegando con `closureRequestId`.

**→ M3 (Infraestructura)** — *enviado el 5 oct 2026, dentro del cierre del contrato*

> En `treeRiskDetected`, `TreeHealthStatus` conserva `WEAKENED` y `DISEASED` como valores separados; no existe `DECLINING` de nuestro lado (ADR-003).

**→ M3 y M7, juntos** — *a M3 enviado el 5 oct 2026; a M7 enviado el 20 oct a las 07:45, respondió el mismo día*

> Aviso operativo: `location.neighborhoodId` les va a llegar **vacío** hasta que M9 publique el catálogo de barrios. El campo pasó a opcional y viaja ausente. Mientras tanto, `location.street` lleva la dirección completa sin partir en calle y número, porque así la guarda nuestro modelo.

**→ Interno**

> Regenerar el PDF del acuerdo publicado (`Acuerdo-Eventos-M6.md` → PDF) y volver a circularlo a la cohorte. El `.md` ya tiene los enums corregidos por ADR-003 (5 oct 2026); el PDF que las contrapartes tienen en la mano todavía muestra los valores viejos.

**→ M9 (Core)** — *enviado el 20/10 a las 07:45; M9 respondió el 20/10 (ver la sección de M9). Se deja el texto como registro de lo que se preguntó.*

> Gracias por el contrato del 7/10: ya adaptamos M6 (exchange `muni.inbox` y cola `q.ambiente` en modo pasivo, sobre del Core, `nack` sin requeue, cliente del token de módulo). Dos cosas las asumimos nosotros y no hace falta que contesten: usamos `occurredAt` (el `occuredAt` de la tabla es un typo, su ejemplo lo escribe bien) y nuestro `sourceModule` es `"ambiente"`, como la cola. Nos quedan estas dudas, que cambian código según cómo se respondan:
>
> 1. Si publicamos por AMQP a `muni.inbox`, ¿dónde se valida que `sourceModule` coincida con el módulo del token? El 403 que describen es una respuesta HTTP. ¿Se valida por el usuario AMQP, va el token en un header, o hay un endpoint HTTP para publicar?
> 2. ¿Hay un usuario AMQP por módulo, con qué permisos (configure/write/read), vhost, y se usa `amqps`?
> 3. ¿`maxAttempts` es el largo de la cadena 15 s → 1 m → 5 m → 15 m? ¿Qué pasa si es otro valor?
> 4. Cuando entregan en `q.ambiente`, ¿mandan el sobre tal cual se publicó o agregan campos (por ejemplo `receivedAt`)?
> 5. ¿`muni.inbox` siempre tiene al menos una cola bindeada? Publicamos con `mandatory: true` y contamos un `basic.return` como fallo.
> 6. ¿`q.ambiente` es clásica o quorum, y con qué argumentos? La verificamos en modo pasivo y queremos evitar sorpresas.
> 7. Con la DLQ y la auditoría del Core, ¿siguen haciendo falta `eventProcessingFailed` y `eventRejected`? Proponemos sacarlos.
> 8. Para `correlationId` y `causationId`, ¿qué validador de UUID usan: RFC estricto (versión y variante) o cualquier 8-4-4-4-12? ¿Y prefieren `causationId` omitido o en `null` cuando no hay causa? Hoy lo omitimos.
> 9. Siguen sin respuesta desde agosto y septiembre: el catálogo de barrios con `neighborhoodId` estable, si "zona" de ustedes es lo mismo que nuestra zona operativa (que agrupa barrios), si alguien publica `notificationSent`, y la lista de eventos propios del Core.
>
> Y para poder probar: ¿se confirma la fecha de las URLs de los ambientes (aprox. 13/10) y cómo nos entregan las credenciales?

**→ M9 (Core), seguimiento ([#300](https://github.com/hllous/Backend-M6-DAPS2/issues/300))** — *enviado el 20 oct 2026; sin respuesta todavía*

> Hola M9, gracias por la respuesta, muy clara. Ya abrimos los issues de nuestro lado: publicar con `userId`, los ajustes por el re-serializado del sobre (`null`, `occurredAt`, UUID) y la prueba contra su Core local. Dos puntos en los que el enunciado no coincide con lo que nos cuentan, y que conviene resolver entre todos:
>
> 1. **Barrios y zonas.** El TPO, §9 Core, dice que el Core administra «Barrios, zonas y catálogos globales», y §11 que cada dato tiene un único módulo propietario. Ustedes responden que no tienen datos maestros y que podría ser de Ciudadanos, pero hasta donde vemos nadie más lo tiene asignado. Sin ese catálogo, M3, M6 y M7 mandamos los eventos sin barrio. ¿Lo pueden revisar? Si lo consideran de otro módulo, ¿de cuál y quién lo confirma? Si no nos ponemos de acuerdo, se lo llevamos a la cátedra. Sobre «zona»: tienen razón en que no hay choque, M6 administra sus zonas operativas (§6) y agrupan barrios.
> 2. **`NotificacionEnviada` / `NotificacionFallida`.** El TPO pone las notificaciones en el Core (§9) y esos eventos figuran como consumidos por varios módulos, el nuestro incluido. Entendemos que hoy no existen en su catálogo. ¿Piensan publicarlos, o hay que sacarlos de todos los módulos? Mientras tanto no tenemos handler.
>
> Y dos preguntas técnicas:
>
> 3. ¿`exclude_none` también quita los `null` dentro de `data`? Si sí, un schema que exija un campo en `null` lo va a ver ausente.
> 4. Sobre el usuario AMQP: ¿se va a llamar `ambiente`, como la cola y nuestro `sourceModule`? ¿Cuándo se activa la validación del `user-id`? Queremos tener listo el publisher.
>
> Sobre el despliegue: M3 y M7 esperan lo mismo que nosotros. ¿Hay un plazo aproximado para decidir dónde se despliega? Entretanto probamos contra el Core local. Y las credenciales, cuando existan, que lleguen por privado al PO. ¡Gracias! — M6 Ambiente

**→ M1 (Ciudadanos), Issue #161** — *enviado el 20 oct 2026 a las 07:45; sin respuesta todavía*

> Gracias por la lista de roles y por confirmar que el id es el `citizenId`. Para poder autorizar en M6 nos quedan estas dudas: **1)** El JWT: el login que tenemos documentado devuelve `{ user_id, dni, role, auth }` y no trae token. ¿Dónde viaja (en la respuesta, en un header, en una cookie)? ¿Con qué algoritmo está firmado y cómo obtenemos la clave para validarlo (JWKS o clave pública)? ¿Qué claims trae (`sub`, `role`, `exp`, `iss`, `aud`) y cuánto dura? Si pueden pasarnos un token de ejemplo, mejor. **2)** ¿El usuario tiene un área o módulo asociado? Un `RESPONSABLE_AREA` de Rentas y uno de Ambiente tienen el mismo rol: si el token no dice el área, no podemos darle permisos en M6 solo por ese rol. **3)** ¿El `user_id` del login es el mismo número que el `citizenId`? ¿Y el `USR-M1-14` que usan en `updatedBy.id` de los eventos? ¿Pueden mandarlo como string? Como `bigint`, en JSON pierde precisión por encima de 2^53. **4)** ¿Un usuario puede tener más de un rol? **5)** ¿Qué significa `auth: false`? ¿Un login fallido responde 401 o 200 con `auth: false`? **6)** ¿Quién tiene el rol `SERVICIO`? ¿Es lo mismo que el token de servicio que definió M9? Y aparte: en el catálogo v2 estaban `/refresh` y `/logout`, que no aparecen en este documento. ¿Siguen vigentes?

> Sobre los eventos del mismo documento: **1)** `citizenInfoDelivered` y `organizationInfoDelivered` responden a una consulta de M6, pero no vemos qué evento la dispara ni con qué payload. Hoy no los consumimos; si algún día los necesitamos, ¿cómo se piden? **2)** Siguen en el sobre viejo de M2 (`producer`, `subject`, `eventId` `M1-EVT-…`). El Core fijó el suyo el 7/10 para toda la cohorte (`eventId`, `eventType`, `eventVersion`, `occurredAt`, `sourceModule`, `correlationId`, `causationId`, `data`; sin campos extra). Nuestro inbox rechaza un `correlationId` que no es UUID, como el `M6-REQ-000045` de sus ejemplos. **3)** Sus ejemplos de `updateTicketStatus` de M2 (`COMPLETED`, `UPDATED`, `ADDITIONAL_INFO_REQUIRED`, `statusChangedAt`, `AREA_USER`) son del contrato viejo: vale el de M2 v1.75 (`STARTED`, `PROGRESS`, `INFORMATION_REQUIRED`, `RETURNED`, `RESOLVED`, `REJECTED`; `updatedBy` `EXTERNAL_USER` o `SYSTEM`). **4)** `organizationInfoDelivered` sigue con `cuit: 3311` (parece el `organizationId`) y `status: "ACTIVA"`, mientras `organizationRegistered` dice `ACTIVE`.

**→ M2 (Atención Ciudadana), Issue #170** — *enviado el 20 oct 2026 a las 07:45; M2 respondió el mismo día. Se deja el texto como registro.*

> ¿Un ticket puede derivarse dos veces al mismo módulo, con el mismo `ticketId`, después de una devolución (`RETURNED` → `IN_REVIEW` → `ROUTED`)? Si es así, ¿cómo distinguimos ese segundo `ROUTED` de un reintento del primero?
>
> Y relacionado (#275): ¿una re-derivación de otro módulo a M6 siempre emite un `ROUTED` nuevo? Si un ticket pasa, por ejemplo, de M3 a M6 sin `ROUTED`, no abrimos expediente y los cambios posteriores de ese ticket terminan en la DLQ del Core.

## Enviados el 21/10

> Redactados el 21/10 y enviados ese mismo día por el PO (#345, #347). Cuando respondan, mover la respuesta a la ficha (`m2.md`, `m7.md`, `m9.md`).

**→ M7 (Tránsito)** — respuesta a sus dos mensajes del 20/10 — *enviado el 21 oct 2026, sin respuesta todavía*

> Gracias por las respuestas, nos ordenan mucho. Sí, estamos de acuerdo: a partir de ahora **dejamos de emitir `urbanServiceScheduled` y `treePruningScheduled`**, y `treeRiskDetected` va solo a M3. Lo único que les mandamos es `streetClosureRequested`. Cuando un servicio o una poda necesita cortar la calle, la solicitud la pedimos siempre con ese evento, con `sourceRef` apuntando al servicio o a la poda que origina el corte. No cambia nada de su lado ni del payload que ya tienen.
>
> Y gracias por contestar los cuatro puntos: (1) los cortes `ACTIVE` vencidos los cierran ustedes y siempre publican `streetClosureEnded`; (2) los `APPROVED` que nunca se activan vencen sin evento y nuestro margen de 6 horas es el mecanismo correcto; (3) el nombre que se publica es `streetClosureEnded` y el `streetClousureEnded` del catálogo es un error de carga que coordinan con M9; (4) no necesitan cuadrilla en el corte, solo la franja completa `requestedFrom` / `requestedTo`. Con eso cerramos de nuestro lado.

**→ M9 (Core)** — corrección al registro — *enviado el 21 oct 2026, sin respuesta todavía*

> Una corrección a lo que les contamos para el registro de publicaciones: **M6 publica 6 eventos, no 8**. Quedan `updateTicketStatus`, `containerDamaged`, `treeRiskDetected`, `environmentalViolationDetected`, `infrastructureRepairRequested` y `streetClosureRequested`. **No registren `urbanServiceScheduled` ni `treePruningScheduled`**: M7 no los consume y dejamos de emitirlos. Las suscripciones no cambian.

**→ M2 (Atención Ciudadana)** — emitimos `INFORMATION_REQUIRED` — *enviado el 21 oct 2026, sin respuesta todavía*

> Les avisamos que M6 pasa a ser productor real de `updateTicketStatus` con `updateType: INFORMATION_REQUIRED`. Lo emitimos cuando el operador le pide más información al vecino durante la revisión de la denuncia: lleva `publicMessage` con lo que se le pide y `requiredBy` (fecha límite, siempre futura); solo sale si el ticket está `IN_PROGRESS` o `ROUTED`, o si todavía no conocemos su estado. Dos confirmaciones: (1) cuando la solicitud vence o se cancela, ¿M2 emite un `ticketUpdated` con el estado al que vuelve el ticket? Nosotros cerramos la solicitud al recibir cualquier `ticketUpdated` de cambio de estado cuyo `currentStatus` ya no sea `PENDING_INFORMATION`. (2) Si mandamos `STARTED` con el ticket ya `IN_PROGRESS`, ¿lo registran y confirman sin aplicar, sin `nack`?
>
> Además, en el contrato nuevo (el Acuerdo y los Sobres del 21/10) M6 publica 6 eventos; los dos que dejamos de emitir (`urbanServiceScheduled` y `treePruningScheduled`) no los consumía M2, así que no cambia nada de su lado.

## Pendientes de enviar (20/10)


> Redactados el 20/10 para que el PO los envíe. **Al enviarlos, anotar la fecha acá y mover la respuesta de cada uno a su ficha (`mX.md`).** Dos de ellos suponen decisiones del equipo, marcadas con ⚠️.

**→ M3 (Obras)**

> Recibimos su contrato v0.6, gracias. Sobre sus tres pedidos: (1) **aceptamos** `workOrderId` como UUID técnico y `workOrderNumber` como referencia humana opcional ⚠️ (decisión del equipo: nuestro consumidor ya tolera ambos). (2) Todavía **no nos llegaron los archivos de schema** de `workOrderScheduled` y `workOrderCompleted`, solo los ejemplos del PDF: ¿nos los pasan para validarlos? Pedimos `sourceRequestId` con `format: "uuid"`. (3) La prueba `requestId → sourceRequestId` la hacemos apenas tengan el adaptador RabbitMQ/Core; nos avisan. Además: ustedes mencionan que el Core tiene registrada `streetClousureEnded` con el error de tipeo en `q.obras`; lo vamos a verificar contra el Core local. Del lado nuestro no cambia ningún evento que les mandamos.

**→ M7 (Tránsito)** — *respondido el 20/10; superado por la sección del 21/10 (#345)*

> Cuatro puntos del documento «Payloads actualizados Core v4»: (1) Su lista de eventos que reciben de Obras y Ambiente incluye solo `streetClosureRequested`: no figuran `urbanServiceScheduled`, `treePruningScheduled` ni `treeRiskDetected`, que nosotros les enviamos. ¿Los van a consumir? Si no, los sacamos de nuestros destinatarios. (2) Un corte `APPROVED` que nunca se activa pasa a `EXPIRED` **sin publicar nada** de su lado. Lo resolvimos por tiempo: pasados `endDate` + **6 horas de gracia** sin recibir `streetClosureEnded`, lo damos por vencido y dejamos para reprogramar el servicio que dependía. ¿Les sirve esa gracia? ¿Un corte `ACTIVE` publica siempre su `Ended` al vencer `endDate`? (3) Confirmen que publican `streetClosureEnded` bien escrito, porque M3 dice que el catálogo del Core tiene `streetClousureEnded`. (4) `treePruningScheduled` lo emitimos solo cuando el servicio ya tiene cuadrilla y franja, que ustedes exigen.

**→ M1 (Ciudadanos)** — sigue siendo nuestro bloqueante principal

> Seguimos esperando el JWT. Para integrar necesitamos: dónde viaja (header), `alg`, claves o JWKS, claims, `iss`/`aud`, TTL, y si `RESPONSABLE_AREA` lleva un área asociada. Además, M2 v1.78 exige que `updatedBy.id` sea **UUID**, y su login devuelve `user_id` como `bigint`: ¿qué identificador viaja en el token? Hoy mandamos el `sub` si tiene forma de UUID y `null` si no. Por último, su documento sigue con el sobre viejo (`producer`, `subject`, `eventId` tipo `M1-EVT-…`): hay que pasar al sobre del Core, que además exige `correlationId` en forma UUID.

**→ M4 (Habilitaciones)**

> Cuatro confirmaciones sobre su contrato de octubre: (1) en `environmentalViolationDetected` mandamos `suggestedAction` con cuatro valores: `WARNING`, `FORMAL_NOTICE`, `FINE`, `CLOSURE`. Su documento lista tres; ¿toleran `FORMAL_NOTICE`? El campo no es vinculante. (2) ¿`commercialFineGenerated` también nos lo rutean a nosotros, o solo `closureUpdate`? (3) ¿`actId` y `externalRef` son el mismo dato? (4) ¿Dejaron de publicar `ticketInProgress`? Aclaración: `sourceViolationId` reproduce exactamente el `violationId` UUID que les mandamos.

**→ M9 (Core)** — seguimiento de [#300](https://github.com/hllous/Backend-M6-DAPS2/issues/300) y respuesta a la guía común del 20/10 ([#328](https://github.com/hllous/Backend-M6-DAPS2/issues/328)) — *lista para enviar*

> Gracias por la guía común. Lo que nos pide su §2:
>
> 1. **Módulo:** `ambiente` (Ambiente, Higiene y Servicios Urbanos). Responsables técnicos y canal de contacto: **Facu Iriarte** (+54 9 11 5139-3059, Discord `gordito12`) y **Benjamin Martinez** (+54 9 298 344-9923, Discord `taki9`).
> 2. **IP pública de salida** del backend (Render): son dos rangos: `74.220.48.0/24` y `74.220.56.0/24` (los de salida de Render para nuestra región). Un solo origen, producción. Si Render los cambia, les avisamos antes de volver a probar.
> 3. **Publicamos** (6; *corregido el 21/10, ver el mensaje de arriba*): `updateTicketStatus`, `containerDamaged`, `treeRiskDetected`, `environmentalViolationDetected`, `infrastructureRepairRequested`, `streetClosureRequested`; `sourceModule` `ambiente`, `eventVersion` 1.0, con sus schemas JSON.
> 4. **Consumimos** (8, `maxAttempts` 4): `ticketUpdated`, `workOrderScheduled`, `workOrderCompleted`, `commercialFineGenerated`, `closureUpdate`, `streetClosureApproved`, `streetClosureRejected`, `streetClosureEnded`.
> 5. **Prueba coordinada:** **Les pedimos que nos pasen ustedes los horarios que tengan disponibles**; como el ambiente es compartido, ¿qué tipo de evento ficticio podemos usar en la primera prueba para que no llegue a otros módulos?
> 6. **Dashboard:** sí, para tres personas: `benmartinez@uade.edu.ar`, `fairiarte@uade.edu.ar` y `nico.llousas@gmail.com`.
>
> Pedimos la **ficha privada** con `module_ambiente`, el secret de máquina y el acceso al dashboard, por privado y de a uno.
>
> Preguntas:
>
> - **(a)** `streetClousureEnded` o `streetClosureEnded`: nosotros nos suscribimos a `streetClosureEnded`; si M7 publica el otro nombre no recibiríamos el evento. ¿Qué queda en el registro y siguen ambos alias?
> - **(b)** `streetClosureActivated`: no lo publicamos ni consumimos; ¿alguien lo espera de nosotros?
> - **(c)** Registro: vamos a consultar `GET /subscriptions` y `GET /publications` y crear solo lo que falte, sin repetir los POST. ¿Hay algo nuestro ya cargado? En el catálogo figuraba `zoneNotServiced` con owner `ambiente`, que descartamos: ¿pueden darlo de baja?
> - **(d)** Siguen abiertos del 20/10: ¿el Core acepta el UUID nulo y el máximo como `correlationId`?, ¿`exclude_none` quita también los `null` dentro de `data`?, y lo de barrios y zonas y `notificationSent` frente al TPO §9.

**→ M2 (Atención Ciudadana)** — informativo y dos confirmaciones

> Ya implementamos la forma (a): al agendar un servicio publicamos `STARTED` con la fecha y franja como texto en `publicMessage`, y `PROGRESS` al reprogramar, según el estado del ticket que llevamos nosotros; también `updatedBy.id` UUID o `null`. Dos confirmaciones: (1) si mandamos `STARTED` con el ticket ya `IN_PROGRESS` (por ejemplo tickets anteriores al deploy), ¿M2 lo registra y lo confirma sin aplicar, sin `nack`? (2) Guardamos `currentStatus` solo si es uno de los 9 estados de §3 (`REGISTERED`, `IN_REVIEW`, `ROUTED`, `IN_PROGRESS`, `PENDING_INFORMATION`, `DUPLICATE`, `RESOLVED`, `CLOSED`, `CANCELLED`); ¿hay otros?

**Decisiones internas que el PO tiene que tomar**

1. **#294:** *resuelto el 20/10:* el filtro de fechas va por `updatedAt` (la columna «Actualizado»).
2. **#169:** *resuelto el 20/10:* M6 **sí** puede pedirle información al vecino (`INFORMATION_REQUIRED`) durante la revisión del expediente; **implementado** (`POST /environmental-reports/:id/request-information`, ver el [historial](historial.md)).
3. **M3:** *resuelto el 20/10:* aceptada la propuesta de `workOrderId` UUID y `workOrderNumber`; falta avisarle a M3 (el mensaje a M3 ya está redactado arriba).
