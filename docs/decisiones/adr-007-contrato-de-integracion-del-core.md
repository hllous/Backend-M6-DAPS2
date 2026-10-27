# ADR-007: Contrato de integración del Core (sobre, topología, reintentos, catálogo y token)

## Estado

**Aceptado** — 2026-10-07

## Contexto

[ADR-006](adr-006-rabbitmq-como-bus.md) se escribió el 27/09 contra defaults provisorios porque M9 solo había anunciado el cambio a RabbitMQ: exchange `topic` propio, cola y bindings declarados por M6, DLX opcional, reencolado en la primera entrega y el sobre de M2 (`specVersion`, `producer`, `subject`) porque era el único escrito.

El 7/10/2026 M9 fijó el contrato de integración **para toda la cohorte**: un exchange `fanout` común (`muni.inbox`), una cola por módulo creada por el Core (`q.ambiente` para nosotros), un sobre propio, reintentos y DLQ a cargo del Core, orden no garantizado, un catálogo de tipos de evento que cada módulo administra por su cuenta y un token de módulo para hablar con su API. Casi todo lo que ADR-006 asumía queda reemplazado. M2 también migra, así que no hay un choque de sobres que coordinar entre grupos. El código se adaptó en #271 (padre #257).

## Decisión

M6 adopta el contrato del Core tal cual, sin extensiones propias.

- **Sobre del Core.** Al publicar: `{ eventId, eventType, eventVersion: "1.0", occurredAt, sourceModule: "ambiente", data }`, más `correlationId` y `causationId` opcionales (al aceptarse no se mandaban; desde #267 sí, ver Correlación). Sin campos extra: el Core rechaza un campo de más. `occurredAt` es ISO 8601 con offset (la `Z` de `toISOString()` cuenta) y se escribe con doble r: el `occuredAt` de la tabla de M9 es un typo, su ejemplo usa `occurredAt`. `sourceModule` sale de `CORE_MODULE_ID` (`ambiente`, alineado con `q.ambiente`) y tiene que coincidir con el módulo del token. `subjectFor` desaparece: `updateTicketStatus` correlaciona con M2 por `data.ticketId`. Código en `src/events/envelope.ts`.
- **Al consumir se tolera el sobre de M2.** El inbox (`IngestEventDto`) acepta `sourceModule`, `correlationId` y `causationId` (este puede venir `null`), y sigue aceptando `specVersion`, `producer` (string u objeto) y `subject`, marcados como deprecados. Solo se usan `eventId`, `eventType` y `data` (desde #267 también `correlationId` para la traza, y el inbox persiste `correlationId` y `sourceModule`). Mientras la cohorte migra, rechazar un evento de negocio por la forma de un campo que ni leemos sería perder información por nada. Somos estrictos al publicar y tolerantes al recibir.
- **Topología pasiva y del Core.** Se publica a `muni.inbox` (`fanout`: la routing key no cuenta) y se consume `q.ambiente`. M6 no declara ni bindea nada: al conectar hace `checkExchange` y `checkQueue`, en cada reconexión. Si no existen, el broker cierra el canal con 404 y el modo `recovery` de amqplib reintenta sin tirar la app. Se eliminan `RABBITMQ_EXCHANGE_TYPE` y `RABBITMQ_DEAD_LETTER_EXCHANGE`; `RABBITMQ_EXCHANGE` y `RABBITMQ_QUEUE` quedan con `muni.inbox` y `q.ambiente` por default. Se mantiene `mandatory: true` al publicar: M9 confirmó el 20/10 que el fanout siempre tiene `core.inbox` bindeada.
- **Política de ack nueva.** Nunca `requeue=true`: todo lo que no es `ack` es `nack` sin reencolar y **los reintentos los hace el Core** (15 s → 1 m → 5 m → 15 m → DLQ; **reemplazada, ver la nota del 20/10**). Resultado del inbox: `processed`, `duplicate` o `ignored` → `ack`; `failed`, mensaje inválido (JSON, sobre o payload), más de 100 kB o error inesperado → `nack`. Un evento inválido agota los reintentos y termina en la DLQ del Core con el payload crudo, que es donde alguien lo ve.
- **El inbox re-corre un evento cuyo handler falló.** Antes un reenvío con el mismo `eventId` salía `duplicate` aunque el handler hubiera tirado. Ahora la fila fallida (sin `processedAt`, con `error`) se toma con un `updateMany` condicional (`processedAt` null, `error` no null, mismo `eventType`) que limpia el error; de dos entregas solapadas corre una, porque la otra ve la fila en curso y sale `duplicate`. El handler corre con el payload **guardado** la primera vez, no con el del reenvío: un reenvío por HTTP no puede cambiarle el contenido a un evento fallido. Si el payload se guardó redactado, no hay nada que reproducir y va el `data` del reenvío, ya validado. Los handlers tienen que tolerar correr de nuevo (guard por estado o unique): el reintento llega tras cualquier `failed`, también cuando el efecto ya quedó escrito y lo que falló fue marcar la fila.
- **Límite conocido.** Si el proceso se cae a mitad del handler, la fila queda sin `processedAt` ni `error`, y ningún reenvío la retoma (se ve como "en curso"). Destrabarlo pide una columna de lease, es decir una migración; no se hizo.
- **Orden no garantizado.** El Core no ofrece garantía de orden entre mensajes y los reintentos con backoff lo rompen: un evento atrasado puede llegar después de uno más nuevo. No se simula un orden. Los handlers tienen que decidir con `occurredAt` y los datos del evento para no pisar estado más nuevo (#270, pendiente).
- **Catálogo autoadministrado.** El Core no rutea por nombre: cada módulo registra en su API qué tipos de evento publica y a cuáles se suscribe, y recién entonces el Core crea `q.ambiente` y sus bindings (#266). Hasta que eso exista el consumidor reintenta contra un 404 y no llega nada. Depende de la URL del Core (ambientes, aprox. 13/10). *Actualizado 2026-10-13:* la guía de M2 v1.75 (§12) cuenta cómo se registra: una suscripción por `eventType` con `POST /api/v1/subscriptions`, las publicaciones con `POST /api/v1/publications` y, opcional, el schema del `data` con `PUT /api/v1/event-types/{name}/schema`. Es de segunda mano: lo tiene que confirmar M9 (ver [bloqueantes.md](../bloqueantes.md)).
- **Token de módulo.** `src/core/CoreClient` pide `POST /api/v1/auth/module-token` con `CORE_MODULE_ID` y `CORE_MODULE_SECRET`, cachea el token y lo renueva un minuto antes de que venza. El token dura 15 minutos y no tiene refresh; las llamadas concurrentes comparten un solo pedido y ante un 401 se reintenta una vez. Endurecido: los paths tienen que quedar en el mismo origin, `redirect: 'error'` y `expiresIn` queda acotado. Variables: `CORE_API_URL` (https en producción) y `CORE_MODULE_SECRET` (solo en el panel de Render). Todavía no tiene callers; lo va a usar #266.
- **Correlación (#267).** Al aceptarse este ADR el sobre admitía `correlationId` y `causationId`, pero M6 no los propagaba. *Actualizado 2026-10-08 (#267):* implementada. `correlationId` va siempre; `causationId` solo si el evento sale de consumir otro, y si no se omite. El contexto viaja en un `AsyncLocalStorage` (`src/events/event-context.ts`): el handler de un evento consumido hereda su `correlationId` (o su `eventId` abre el hilo) y cita su `eventId` como causa; cada request HTTP abre un hilo propio que comparte todo lo que encola (`EventTraceInterceptor`); un barrido `@Interval`/`@Cron` abre uno por `enqueue`. Solo se propaga lo que tiene la forma de UUID 8-4-4-4-12 en hex. *Actualizado 2026-10-20 (#296):* antes se exigía RFC estricto (versión 1-8, variante `10xx`, sin el nulo ni el máximo) por temor a que el Core rechazara el evento derivado, pero M9 confirmó que su validador es `uuid.UUID` de Python (acepta v1/v7, el nulo y variantes inválidas, y lo entrega siempre normalizado), así que exigir más cortaba la correlación con un módulo cuyo valor el Core sí acepta. Lo que **generamos** nosotros sigue siendo un v4. Lo único que se relajó en el inbox es el formato de `correlationId` y `causationId` del sobre: `@IsUUID()` rechazaba la variante inválida y la versión 0 (el evento entero iba a la DLQ), así que pasaron a `@Matches` con la misma forma 8-4-4-4-12. Si el valor heredado no tiene la forma, el hilo arranca en M6 sin causa y el evento consumido se procesa igual. El inbox persiste `correlationId` y `sourceModule`, y un reintento usa el `correlationId` guardado.

## Aclaraciones de M9 (2026-10-20)

Respuesta a #258, punto por punto en [bloqueantes.md](../bloqueantes.md). No cambia ninguna decisión de este ADR; precisa lo siguiente:

- **Identidad por AMQP.** Hoy no se valida: publicando a `muni.inbox` no hay autenticación de `sourceModule` (el 403 es solo del endpoint HTTP). M9 lo va a cerrar con un usuario AMQP por módulo y verificando el `user-id` del mensaje contra el `sourceModule`, cuando haya broker. M6 va a publicar con `userId` igual a su usuario de `RABBITMQ_URL` (#295).
- **Dos errores distintos al publicar.** `basic.return`: el exchange existe y no tiene cola bindeada (`core.inbox` siempre lo está, no debería pasar). 404 de canal: el Core nunca declaró la topología en ese broker. El `mandatory: true` se mantiene.
- **Cola de M6.** `q.ambiente` es clásica y durable, con `x-dead-letter-exchange: muni.dlx`. Un 404 en el `checkQueue` pasivo significa que la suscripción no está activa.
- **Reintentos.** *(Reemplazado el 20/10, ver la nota al pie.)* La cadena `RETRY_DELAYS=15,60,300,900` era global y `maxAttempts` es por suscripción: con 4 coinciden; con más repite el último paso y con menos usa solo los primeros.
- **El sobre se re-serializa.** Sin campos agregados (lo del Core va en headers `x-core-*`), pero los `null` se caen y `occurredAt` se normaliza con el mismo offset (#296). El validador de UUID del Core es laxo (`uuid.UUID` de Python): cambia el motivo para ser estrictos al propagar `correlationId` (#296).
- ~~**Todavía no hay ambientes** (sin deploy ni fecha): se prueba contra el Core local (#299).~~ *Actualizado el 20/10 con la guía común:* el Core ya está desplegado (ambiente único y compartido); falta la ficha privada. Ver [m9.md](../integracion/m9.md).

## Alternativas consideradas

- **Mantener el sobre de M2 y pedirle al Core que lo adopte**: descartada. M9 ya fijó el suyo para toda la cohorte y el Core rechaza campos extra; sostener el de M2 habría dejado a M6 fuera del contrato.
- **Seguir declarando exchange, cola y bindings desde M6**: descartada. La topología es del Core; con otros argumentos nuestro declare daría `PRECONDITION_FAILED`, y una cola sin suscripciones registradas no sirve.
- **Mantener `requeue=true` en la primera entrega**: descartada por pedido de M9. Reencolado, el mensaje gira en nuestra cola sin demora ni auditoría; con `nack` sin reencolar el Core aplica backoff y DLQ.
- **`ack` ante un `failed`, como en ADR-006**: descartada. Perdía el evento ante una falla transitoria (la base caída un minuto). Con el re-run del inbox, la falla se recupera en el reenvío del Core.
- **Rechazar sobres de M2 al consumir**: descartada mientras la cohorte migra, por lo dicho arriba. Se puede endurecer cuando todos hayan migrado.
- **Simular orden (cola única, `prefetch` 1)**: no resuelve nada, porque los reintentos del Core ya desordenan. Se resuelve en el handler.

## Consecuencias

### Positivas

- M6 usa el mismo sobre, la misma topología y los mismos reintentos que el resto de la cohorte, sin código propio de DLX ni de backoff.
- Una falla transitoria del handler se recupera sola: el Core reenvía y el inbox vuelve a correr el handler.
- El sobre de M2 deja de ser un riesgo de integración: se publica el del Core y se acepta el viejo.

### Negativas

- Los handlers tienen que ser idempotentes por estado, no solo por `eventId`. Uno que no lo sea duplica efectos al reintentarse.
- El orden no está garantizado y todavía no está resuelto del lado de los handlers (#270).
- Sin #266 (registrar suscripciones y publicaciones) `q.ambiente` no existe y no llega nada; y #266 depende de la URL del Core.
- La fila trabada por una caída del proceso a mitad del handler queda sin retomar.
- `mandatory: true` supone una cola bindeada en `muni.inbox`; si el Core no la tiene, cada publicación cuenta como fallo y la fila del outbox llega a `FAILED` al quinto intento.
- Las preguntas de #258 se respondieron el 20/10 (ver «Aclaraciones de M9» abajo). Lo que queda abierto está en #300.

### Neutras

- `docs/eventos/**`, `deploy.md`, `endpoints.md` y `testing.md` se actualizaron en #271; el estado de integración vive en [bloqueantes.md](../bloqueantes.md).
- En `streetClosureRequested` el sobre dice `sourceModule: "ambiente"` y `data.sourceModule` sigue siendo `"M6"`, porque lo exige el schema acordado con M7. Falta confirmar con M7 cuál lee.
- En Render hay que borrar los overrides viejos de `RABBITMQ_EXCHANGE`/`RABBITMQ_QUEUE` y las variables eliminadas antes de cargar `RABBITMQ_URL`.

**Nota del 20/10 (actualizado el 20/10 con la decisión del PO).** La cadena de reintentos vigente es la de la guía común de M9: escalones de 5 s, 30 s, 2 min y 10 min según el intento, y `maxAttempts=4` como cuatro intentos totales, incluido el inicial (tres reintentos); agotados, queda una entrega fallida y una dead letter en el Core. La cadena 15 s → 1 m → 5 m → 15 m (`RETRY_DELAYS=15,60,300,900`) que M9 había informado antes quedó **reemplazada** y se conserva arriba solo como registro histórico. La guía no detalla qué escalón usa cada intento, así que los docs no dan un total. No cambia nada del código (`nack` sin reencolar). Ver [m9.md](../integracion/m9.md).

**Nota de corrección del 22/10.** M9 precisó que con `maxAttempts=4` hay un intento inicial y hasta tres reintentos con esperas de 5 s, 30 s y 120 s (155 s nominales): el escalón de 10 min de la nota anterior no se usa.

## Referencias

- [ADR-006](adr-006-rabbitmq-como-bus.md) — reemplazado parcialmente por este ADR.
- [bloqueantes.md](../bloqueantes.md) — qué cerró M9 y qué sigue abierto.
- Issues #257 (padre), #258, #260 a #265 (implementados en el PR #271), #266, #267, #268, #270 y, desde la respuesta de M9 del 20/10, #295 a #300.
- Código: `src/events/envelope.ts`, `src/events/event-context.ts`, `src/events/inbox/inbox.service.ts`, `src/events/consumers/rabbitmq.consumer.ts`, `src/events/publishers/rabbitmq.publisher.ts`, `src/core/core.client.ts`.
