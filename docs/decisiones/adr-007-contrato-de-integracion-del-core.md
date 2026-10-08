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
- **Topología pasiva y del Core.** Se publica a `muni.inbox` (`fanout`: la routing key no cuenta) y se consume `q.ambiente`. M6 no declara ni bindea nada: al conectar hace `checkExchange` y `checkQueue`, en cada reconexión. Si no existen, el broker cierra el canal con 404 y el modo `recovery` de amqplib reintenta sin tirar la app. Se eliminan `RABBITMQ_EXCHANGE_TYPE` y `RABBITMQ_DEAD_LETTER_EXCHANGE`; `RABBITMQ_EXCHANGE` y `RABBITMQ_QUEUE` quedan con `muni.inbox` y `q.ambiente` por default. Se mantiene `mandatory: true` al publicar, suponiendo que el fanout siempre tiene una cola bindeada del Core (pregunta abierta en #258).
- **Política de ack nueva.** Nunca `requeue=true`: todo lo que no es `ack` es `nack` sin reencolar y **los reintentos los hace el Core** (15 s → 1 m → 5 m → 15 m → DLQ). Resultado del inbox: `processed`, `duplicate` o `ignored` → `ack`; `failed`, mensaje inválido (JSON, sobre o payload), más de 100 kB o error inesperado → `nack`. Un evento inválido agota los reintentos y termina en la DLQ del Core con el payload crudo, que es donde alguien lo ve.
- **El inbox re-corre un evento cuyo handler falló.** Antes un reenvío con el mismo `eventId` salía `duplicate` aunque el handler hubiera tirado. Ahora la fila fallida (sin `processedAt`, con `error`) se toma con un `updateMany` condicional (`processedAt` null, `error` no null, mismo `eventType`) que limpia el error; de dos entregas solapadas corre una, porque la otra ve la fila en curso y sale `duplicate`. El handler corre con el payload **guardado** la primera vez, no con el del reenvío: un reenvío por HTTP no puede cambiarle el contenido a un evento fallido. Si el payload se guardó redactado, no hay nada que reproducir y va el `data` del reenvío, ya validado. Los handlers tienen que tolerar correr de nuevo (guard por estado o unique): el reintento llega tras cualquier `failed`, también cuando el efecto ya quedó escrito y lo que falló fue marcar la fila.
- **Límite conocido.** Si el proceso se cae a mitad del handler, la fila queda sin `processedAt` ni `error`, y ningún reenvío la retoma (se ve como "en curso"). Destrabarlo pide una columna de lease, es decir una migración; no se hizo.
- **Orden no garantizado.** El Core no ofrece garantía de orden entre mensajes y los reintentos con backoff lo rompen: un evento atrasado puede llegar después de uno más nuevo. No se simula un orden. Los handlers tienen que decidir con `occurredAt` y los datos del evento para no pisar estado más nuevo (#270, pendiente).
- **Catálogo autoadministrado.** El Core no rutea por nombre: cada módulo registra en su API qué tipos de evento publica y a cuáles se suscribe, y recién entonces el Core crea `q.ambiente` y sus bindings (#266). Hasta que eso exista el consumidor reintenta contra un 404 y no llega nada. Depende de la URL del Core (ambientes, aprox. 13/10).
- **Token de módulo.** `src/core/CoreClient` pide `POST /api/v1/auth/module-token` con `CORE_MODULE_ID` y `CORE_MODULE_SECRET`, cachea el token y lo renueva un minuto antes de que venza. El token dura 15 minutos y no tiene refresh; las llamadas concurrentes comparten un solo pedido y ante un 401 se reintenta una vez. Endurecido: los paths tienen que quedar en el mismo origin, `redirect: 'error'` y `expiresIn` queda acotado. Variables: `CORE_API_URL` (https en producción) y `CORE_MODULE_SECRET` (solo en el panel de Render). Todavía no tiene callers; lo va a usar #266.
- **Correlación (#267).** Al aceptarse este ADR el sobre admitía `correlationId` y `causationId`, pero M6 no los propagaba. *Actualizado 2026-10-08 (#267):* implementada. `correlationId` va siempre; `causationId` solo si el evento sale de consumir otro, y si no se omite. El contexto viaja en un `AsyncLocalStorage` (`src/events/event-context.ts`): el handler de un evento consumido hereda su `correlationId` (o su `eventId` abre el hilo) y cita su `eventId` como causa; cada request HTTP abre un hilo propio que comparte todo lo que encola (`EventTraceInterceptor`); un barrido `@Interval`/`@Cron` abre uno por `enqueue`. Solo se propaga un UUID RFC estricto (versión 1-8, variante `10xx`, sin el nulo ni el máximo); si no lo es, el hilo arranca en M6 sin causa y el evento consumido se procesa igual. El inbox persiste `correlationId` y `sourceModule`, y un reintento usa el `correlationId` guardado.

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
- Siguen abiertas las preguntas de #258 (validación de `sourceModule` por AMQP, usuario por módulo y permisos, `maxAttempts`, campos agregados por el Core, tipo de cola).

### Neutras

- `docs/eventos/**`, `deploy.md`, `endpoints.md` y `testing.md` se actualizaron en #271; el estado de integración vive en [bloqueantes.md](../bloqueantes.md).
- En `streetClosureRequested` el sobre dice `sourceModule: "ambiente"` y `data.sourceModule` sigue siendo `"M6"`, porque lo exige el schema acordado con M7. Falta confirmar con M7 cuál lee.
- En Render hay que borrar los overrides viejos de `RABBITMQ_EXCHANGE`/`RABBITMQ_QUEUE` y las variables eliminadas antes de cargar `RABBITMQ_URL`.

## Referencias

- [ADR-006](adr-006-rabbitmq-como-bus.md) — reemplazado parcialmente por este ADR.
- [bloqueantes.md](../bloqueantes.md) — qué cerró M9 y qué sigue abierto.
- Issues #257 (padre), #258, #260 a #265 (implementados en el PR #271), #266, #267, #268 y #270.
- Código: `src/events/envelope.ts`, `src/events/event-context.ts`, `src/events/inbox/inbox.service.ts`, `src/events/consumers/rabbitmq.consumer.ts`, `src/events/publishers/rabbitmq.publisher.ts`, `src/core/core.client.ts`.
