# Semántica de entrega de los eventos

Página interna que **reúne** lo ya decidido sobre cómo viajan los eventos; no decide nada nuevo. Lo que no está decidido está al final, en [No definido](#no-definido). Las citas son al [ADR-007](../decisiones/adr-007-contrato-de-integracion-del-core.md) (`ADR-007 Lnn` = línea del archivo; el ADR no numera secciones, se cita la viñeta) y al código (`archivo:línea`, verificado contra `develop` al 2026-11-07). El [ADR-006](../decisiones/adr-006-rabbitmq-como-bus.md) quedó reemplazado en ack, topología y reintentos: ver su encabezado (L7).

## Resumen

| Tema | Regla | Fuente |
|---|---|---|
| Entrega | At-least-once: un evento puede llegar más de una vez | [Publicar](#publicar-outbox), [Consumir](#consumir-inbox-y-ack) |
| Idempotencia | Por `eventId` en el inbox y por estado en cada handler | ADR-007 L21, L58 |
| Ack / nack | `ack` si `processed`, `duplicate` o `ignored`; todo lo demás `nack` **sin reencolar** | ADR-007 L20 |
| Reintentos y DLQ | Los hace el Core, no M6 | ADR-007 L20, L71, L73 |
| Orden | No garantizado | ADR-007 L23 |
| `eventVersion` | `"1.0"` fijo al emitir | `src/events/envelope.ts:92` |

## Publicar (outbox)

- **El evento nace en la transacción del dominio.** `OutboxService.enqueue` exige el cliente de transacción y escribe la fila ahí mismo (`src/events/outbox/outbox.service.ts:43-45`). Si el dominio hace rollback, no hay evento.
- **Un dispatcher publica las filas `PENDING`**, de a 50, por `occurredAt` ascendente, cada 10 s (`src/events/outbox/outbox-dispatcher.service.ts:10`, `:42-47`).
- **La publicación espera el confirm del broker** y que el mensaje se haya enrutado a una cola (`persistent` y `mandatory`, `src/events/publishers/rabbitmq.publisher.ts:38-51`). Confirma la entrega al broker, **no** que el consumidor lo haya procesado (`:38-43`).
- **`eventId` = id de la fila del outbox.** Si el proceso se corta entre el envío y el `update` a `SENT`, la fila se vuelve a publicar con el mismo `eventId` y el consumidor la deduplica (`outbox-dispatcher.service.ts:62-64`). Por eso la entrega es at-least-once.
- **Fallos:** cada intento fallido suma `attempts` y deja la fila en `PENDING`; al quinto pasa a `FAILED` y el barrido la deja (`outbox-dispatcher.service.ts:18`, `:84-101`). Un admin la reencola con `POST /events/outbox/:id/retry` (ver [publicados](publicados/README.md)).

## Consumir (inbox y ack)

- **Dos vías, un solo camino:** `POST /events/inbox` y la cola `q.ambiente` pasan por `InboxService.ingest()` (ADR-007 L19; [consumidos](consumidos/README.md#qué-se-consume-hoy)).
- **Idempotencia por `eventId`.** `inbox_event.messageId` es `@unique`; el insert que falla con `P2002` marca el duplicado, sin consultar antes (`src/events/inbox/inbox.service.ts:153-168`).
- **Resultados posibles:** `processed`, `duplicate`, `ignored` (sin handler registrado) y `failed` (`inbox.service.ts:74`, `:218`, `:225`, `:236`).
- **Un handler que falló se vuelve a correr.** La fila fallida (sin `processedAt`, con `error`) se retoma con un `updateMany` condicional; de dos entregas solapadas corre una y la otra sale `duplicate`. El handler usa el payload **guardado** la primera vez (ADR-007 L21; `inbox.service.ts:171-195`).
- **Idempotencia por estado.** Como el reintento llega tras cualquier `failed` (incluso con el efecto ya escrito), los handlers tienen que tolerar correr de nuevo con un guard por estado o un unique (ADR-007 L21, L58; `inbox.service.ts:13-16`).
- **Ack/nack** (`src/events/consumers/rabbitmq.consumer.ts`):

| Resultado | Disposición | Línea |
|---|---|---|
| `processed`, `duplicate`, `ignored` | `ack` | `:169` |
| `failed` (el handler tiró) | `nack` sin reencolar | `:169` |
| JSON roto, sobre o payload inválido | `nack` | `:171-174` |
| Más de 100 kB | `nack` | `:159-162` (tope en `:20`) |
| Error inesperado | `nack` | `:176-178` |

  El `nack` es siempre `channel.nack(msg, false, false)`, nunca `requeue=true` (`:138-139`; ADR-007 L20, L43). Si el canal se cierra antes de confirmar, el broker reentrega y el inbox deduplica (`:140-145`).
- **Un inválido no se descarta:** agota los reintentos del Core y termina en su DLQ con el payload crudo (ADR-007 L20; `rabbitmq.consumer.ts:152-155`). El payload inválido por HTTP se rechaza con 400 y **no se guarda**, así que no ocupa el `eventId` ([consumidos](consumidos/README.md#validación-del-payload)).

## Reintentos y DLQ (los hace el Core)

- M6 no declara DLX ni backoff: la cola `q.ambiente` y la DLQ son del Core (ADR-007 L19, L34). M6 solo verifica la cola en modo pasivo (`rabbitmq.consumer.ts:103`).
- Cadena vigente: `maxAttempts=4` = un intento inicial y hasta tres reintentos con esperas de 5 s, 30 s y 120 s (155 s nominales); agotados, queda una entrega fallida y una dead letter en el Core (ADR-007 L71, L73; [m9.md](../integracion/m9.md)). El intento viaja en `x-core-attempt`, desde 1, y el consumidor lo loguea (`rabbitmq.consumer.ts:127-133`).
- La DLQ se consulta en `GET /api/v1/dlq?targetModule=ambiente` ([consumidos](consumidos/README.md#qué-se-consume-hoy)).

## Orden

El Core no garantiza orden y los reintentos lo rompen: un evento atrasado puede llegar después de uno más nuevo; no se simula orden (ADR-007 L23, L46). El handler decide con `occurredAt` y los datos. Hoy solo `ticketUpdated` lo hace, para los `updateType` que escriben "gana el último" (`src/events/consumers/tickets.consumer.ts:73`, `:102-110`; #270). El resto de los handlers no está auditado en este punto: ver [No definido](#no-definido).

## `eventVersion`

- Al emitir, M6 manda siempre `"1.0"` (`src/events/envelope.ts:92`); el comentario del tipo lo acota a "mientras ningún payload cambie de forma" (`:15`).
- Al consumir es opcional, hasta 20 caracteres, y el Core asume `"1.0"` si falta (`src/events/inbox/ingest-event.dto.ts:95-102`). M6 **no lo usa para decidir nada**: solo `eventId`, `eventType` y `data` (ADR-007 L18).
- El Core valida `data` con **un único schema por nombre de evento, no por `eventVersion`** ([m9.md](../integracion/m9.md) L107). Un `eventVersion` distinto no habilita un segundo schema para el mismo `eventType`.
- El sobre no admite campos extra: el Core los rechaza (ADR-007 L17; `envelope.ts:6`). Los extra sí se toleran dentro de `data` al consumir ([consumidos](consumidos/README.md#validación-del-payload)).

Lo que se desprende de esas reglas, sin que haya una política escrita:

| Cambio en `data` de un evento publicado | Efecto con las reglas de hoy |
|---|---|
| Agregar un campo opcional | Los consumidores que toleran extras lo ignoran; el schema del Core igual se actualiza (un solo schema por nombre) |
| Agregar un campo obligatorio, quitar o renombrar uno, cambiar un tipo o un enum | Rompe a quien valide contra el schema viejo. No hay carril de versión: se coordina con el consumidor |

Cuál de estos cambios se considera compatible es una convención que **no está acordada**: ver [No definido](#no-definido).

## Evento sin consumidor o descartado

- **M6 no publica lo que nadie escucha.** Los 6 publicados tienen consumidor declarado ([publicados](publicados/README.md)). Los demás se cayeron del contrato y quedan documentados, sin schema ni emisión, en [descartados.md](publicados/descartados.md); si hace falta alguno, se pide y se publica.
- **Un tipo publicado sin suscriptor en el Core** no tiene cola que lo reciba: con `mandatory` y `core.inbox` siempre bindeada no vuelve como `basic.return` (ADR-007 L19, L33). Qué hace el Core con un tipo sin suscripción **no está documentado** en estas fuentes.
- **Del lado entrante,** un evento sin handler sale `ignored` (`ack`, 200, sin validar `data`; `inbox.service.ts:218`). Los descartados a propósito (siete `updateType` de `ticketUpdated`; `notificationSent`, sin handler ni suscripción) están en [consumidos](consumidos/README.md). Si un módulo publica algo que no está en esa lista, no lo leemos.

## No definido

Puntos que las fuentes no resuelven; los decide el equipo (y, donde corresponda, se consulta a M9).

| # | Qué falta | Por qué importa |
|---|---|---|
| 1 | **Política de compatibilidad de `eventVersion`**: qué cambios son compatibles (¿campo opcional nuevo?), cuándo se sube a `2.0`, y cómo se avisa a los consumidores | Hoy el Core tiene un schema por nombre; no hay carril para convivir dos versiones |
| 2 | **Qué hace el Core ante un `eventType` publicado sin suscriptores**, y si lo ve el emisor | No se sabe si el evento se pierde en silencio o queda auditado |
| 3 | **Orden en los demás handlers**: solo `ticketUpdated` compara `occurredAt`; falta decidir y auditar si los de M3, M4 y M7 lo necesitan. El ADR-007 (L23, L59) sigue marcando #270 como pendiente aunque `tickets.consumer.ts` ya lo implementa: falta la nota fechada | Un evento atrasado podría pisar estado más nuevo |
| 4 | **Fila del inbox trabada por caída del proceso** a mitad del handler: ningún reenvío la retoma (ADR-007 L22) | Pide una columna de lease y una migración; no se hizo |
| 5 | **Qué se hace con una fila `FAILED` del outbox** más allá del reintento manual: no hay un plazo de revisión definido | Un broker caído varios minutos puede dejar eventos sin salir hasta que alguien los reencole |
| 6 | **Reconciliación entre el outbox y el Core** (`GET /api/v1/events/{eventId}`): quién la hace y cada cuánto | Permitiría contrastar un evento marcado `SENT` con lo que el Core registró; hoy el consumidor solo lo usa para cruzar fallos |
| 7 | **Retención del inbox**: `INBOX_RETENTION_DAYS` en 0 (default) guarda el payload de por vida; falta fijar un valor para producción (`src/events/inbox/inbox-retention.sweeper.ts:10`, `:30-31`) | Crecimiento de la tabla sin plazo |
| 8 | **Comentario desactualizado en el código**: `rabbitmq.consumer.ts:136-137` aún dice escalones de 5 s, 30 s, 2 min y 10 min; el ADR-007 L73 precisó que el de 10 min no se usa. Es del implementador, no de la documentación | Evitar que alguien lea el comentario como contrato |
