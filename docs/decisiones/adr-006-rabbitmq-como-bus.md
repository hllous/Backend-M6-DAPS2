# ADR-006: RabbitMQ como bus de eventos (reemplaza a Kafka)

## Estado

**Aceptado** — 2026-09-27

## Contexto

[ADR-001](adr-001-stack-tecnologico.md) eligió Kafka como broker "confirmado por M9". Nunca hubo broker expuesto: el circuito de outbox/inbox se implementó completo (Fases 3 y 6) contra esa promesa, sin nada del otro lado para enchufar (ver [bloqueantes.md](../bloqueantes.md)).

El 27/09/2026 M9 anunció que el bus de la cohorte pasa de Kafka a **RabbitMQ**. El anuncio es solo eso: no incluye host, puerto, vhost, credenciales, convención de exchange/routing key ni de nombre de cola. M6 necesita poder conectarse en cuanto M9 publique esos datos, sin bloquear el resto del desarrollo mientras tanto.

A diferencia de Kafka, con RabbitMQ M6 pasa a tener **consumidor propio**: hasta ahora la única entrada de eventos externos era `POST /events/inbox` manual. Con un broker real, M6 declara su cola, la bindea a las routing keys de los eventos que consume, y cada mensaje entra por el mismo camino que el inbox manual (misma validación, misma idempotencia por `eventId`).

## Decisión

Se reemplaza Kafka por **RabbitMQ** como broker de eventos, detrás de los mismos puertos de aplicación que ya aislaban esa decisión (`EventPublisher` para publicar, un consumidor de infraestructura para recibir). Todo el circuito es configurable por variables de entorno y no requiere un broker corriendo para que la app arranque:

- Publicación (`RabbitMqEventPublisher`): al exchange configurado, con routing key = nombre del evento a secas (`urbanServiceScheduled`). Mensaje persistente (`persistent: true`) en JSON con el sobre común; propiedades `contentType: application/json`, `messageId` = `eventId`, `type` = `eventType`, `appId` = `M6`, y headers `eventId`, `eventType` y `producer` (el `moduleId` plano). Se publica por un confirm channel con `mandatory: true`: **la publicación cuenta como hecha solo si el broker la confirmó y la enrutó a al menos una cola**. Un nack, un cierre del canal o un `basic.return` (no había cola bindeada) rechazan la publicación; el dispatcher del outbox cuenta el intento, deja la fila `PENDING` y a los 5 intentos la pasa a `FAILED`, sin cambios respecto al comportamiento ya implementado. No se garantiza que el consumidor la haya procesado. La conexión es perezosa (un broker caído no impide arrancar) con un timeout de handshake de 10 s. Sin `RABBITMQ_URL`, el publisher solo loguea, como pasaba sin `KAFKA_BROKERS`.
- Consumo (`RabbitMqConsumer`, nuevo respecto a Kafka): M6 declara su cola (clásica, durable, con la DLX si está configurada), la bindea con una routing key por cada evento de `ConsumedEvent` y consume con `prefetch` 1. Cada mensaje entra por el mismo camino que `POST /events/inbox`: los mismos pipes globales sobre `IngestEventDto` y el mismo `InboxService.ingest()`, con idempotencia por `eventId`. **Única diferencia con el HTTP**: en el bus un campo de sobre desconocido (un `traceId` de M9) se descarta en vez de rechazar el mensaje (`forbidNonWhitelisted` apagado), porque por HTTP un 400 le avisa al emisor y por el bus el mensaje se perdería en silencio. Un mensaje de más de 100 kB (el tope del body HTTP) se rechaza antes de parsearlo. La reconexión con backoff exponencial (hasta 30 s) la hace el modo `recovery` de amqplib, que vuelve a declarar la topología en cada conexión. `POST /events/inbox` se mantiene como vía manual, para poder ejercitar los handlers sin broker.
- Política de ack:

  | Resultado | Qué se hace |
  |---|---|
  | `processed`, `duplicate`, `ignored` o `failed` | `ack` |
  | JSON inválido, sobre inválido, payload inválido para el handler o mensaje de más de 100 kB (lo que por HTTP es 400) | `nack` sin reencolar (a la DLX si hay; sin DLX se descarta) |
  | Error inesperado (base caída, error de Prisma) en la **primera** entrega | `nack` reencolando |
  | Error inesperado en la **reentrega** (`redelivered`) | `nack` sin reencolar: se asume determinista (p. ej. un texto que jsonb rechaza) y se corta el loop |

  `failed` también hace `ack` porque la fila del inbox ya quedó con el error: **un error de handler no se reintenta**, ni por HTTP ni por el bus, porque un reenvío con el mismo `eventId` sale `duplicate`. Por el mismo motivo, si `ingest()` ya insertó la fila y falló después, el reencolado no vuelve a correr el handler. El costo del corte en la reentrega es que una caída de la base que dure dos entregas manda el mensaje a la DLX en vez de esperar; la mejora es reintento con demora (DLX + TTL) cuando M9 defina la topología.
- Variables nuevas, con default provisorio hasta que M9 publique su convención: `RABBITMQ_URL` (opcional; `amqp[s]://usuario:clave@host:5672/vhost`, clave percent-encoded, `amqps://` obligatorio con `NODE_ENV=production`; se loguea solo el host), `RABBITMQ_EXCHANGE` (`municipalidad.events`), `RABBITMQ_EXCHANGE_TYPE` (`topic`; solo `topic` o `direct`, porque con `fanout` o `headers` los bindings no filtran), `RABBITMQ_QUEUE` (`m6.ambiente`), `RABBITMQ_DEAD_LETTER_EXCHANGE` (opcional), `RABBITMQ_PREFETCH` (`1`).
- Se elimina `kafkajs` de `package.json` y las variables `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, `KAFKA_GROUP_ID`.

## Alternativas consideradas

- **Esperar a que M9 confirme los parámetros antes de tocar código**: descartada. Ya se perdió tiempo así con Kafka (ADR-001 confirmado en agosto, cero broker en septiembre). El adaptador configurable no necesita esos parámetros para existir, solo para conectarse.
- **RabbitMQ con particionado o consumer groups al estilo Kafka**: no existe en RabbitMQ. Se descarta simular ese comportamiento; ver la limitación de orden anotada abajo.
- **Adaptador configurable detrás de `EventPublisher` + consumidor hacia el inbox (la elegida)**: mismo patrón que ya aislaba la decisión de Kafka en ADR-001, extendido con el consumidor que Kafka no tenía. No fuerza ninguna decisión que dependa de M9.

## Consecuencias

### Positivas

- El circuito de outbox/inbox no cambia: seguía funcionando sin broker, sigue funcionando sin broker.
- El dominio no distingue Kafka de RabbitMQ ni de ningún otro transporte: la decisión queda en el adaptador de infraestructura.
- Se gana un consumidor real (bindeado por cola), algo que con Kafka nunca se llegó a construir porque nunca hubo broker contra el cual hacerlo.

### Negativas

- Los defaults de exchange, tipo, cola y DLX son propios de M6 y **provisorios**. Si M9 define otro nombre de exchange común, otro tipo (`topic`/`direct`), otra cola o una DLX, se ajusta configuración. **Si define una routing key distinta del nombre del evento a secas, o un exchange por módulo, hay que tocar código**: la routing key es el `eventType` fijo (al publicar y al bindear) y el consumidor lee de un solo exchange. No se hizo configurable a propósito, hasta que M9 hable.
- **RabbitMQ no particiona.** Kafka garantizaba orden dentro de una partición; acá el orden de lo que consumimos depende de una sola cola con `prefetch` 1: un mensaje a la vez, en el orden en que llegaron a la cola. Subir `RABBITMQ_PREFETCH` o escalar a más de una instancia pierde ese orden (por ejemplo, `workOrderCompleted` antes que `workOrderScheduled`), y un reencolado también puede reordenar. Entre eventos de módulos distintos no hay orden garantizado en ningún caso. Es una pregunta abierta a M9, registrada en [bloqueantes.md](../bloqueantes.md).
- Se pierde replay de mensajes al estilo Kafka (no hay retención configurable por offset); mitigado en parte por el outbox, que sí persiste lo publicado.

### Neutras

- `kafkajs` sale de `package.json`; NestJS no necesita `@nestjs/microservices` con `KafkaModule` como preveía ADR-001.
- Las menciones a Kafka como decisión histórica en ADR-001 no se reescriben; quedan con una nota de corrección fechada, como corresponde a un ADR aceptado.

## Qué queda pendiente de M9

- URL/host/puerto/vhost del broker y si es TLS (`amqps`).
- Credenciales por módulo, y cómo se entregan sin pasar por el repositorio.
- Un usuario AMQP por módulo, para validar el `userId` del mensaje contra un allowlist de productor por evento; y quién controla qué módulo puede publicar cada routing key (un `weatherAlertIssued` o un `ticketUpdated` falso tiene efecto real).
- Permisos configure/write/read del usuario de M6 y tipo de cola (clásica o quorum).
- Si las colas de los consumidores existen antes de publicar, y si hay alternate exchange para mensajes sin cola bindeada (hoy `mandatory` los devuelve y la fila del outbox queda para reintento).
- Nombre y tipo de exchange: ¿uno común a toda la cohorte o uno por módulo?
- Convención de routing key: ¿nombre del evento a secas, `M6.urbanServiceScheduled`, `modulo.entidad.accion`?
- Si cada módulo declara su propia cola y bindings, o si M9 los crea centralizadamente; convención de nombre de cola.
- Dead-letter exchange/cola, política de reintentos y TTL.
- Formato exacto del mensaje: ¿el sobre común de M2 tal cual en el body?, ¿headers obligatorios?, `content-type`.
- Garantías de orden por agregado (ver Negativas).
- Publisher confirms, durabilidad y persistencia de mensajes como requisito o como buena práctica local.
- Límites de tamaño de mensaje.
- Ambiente de prueba compartido, y fecha en que va a estar disponible.
- Qué pasa con `eventProcessingFailed`/`eventRejected` en un broker real (ver el riesgo "Tormenta de eventos técnicos" en [bloqueantes.md](../bloqueantes.md)).
- Los pendientes viejos que siguen abiertos: lista de eventos del Core, catálogo de barrios, token de servicio, `notificationSent`.

## Referencias

- [ADR-001](adr-001-stack-tecnologico.md) — decisión original de Kafka, con nota de corrección agregada por este ADR.
- [bloqueantes.md](../bloqueantes.md) — fila de M9 sobre el broker, y la subsección de qué falta para enchufar RabbitMQ.
- Issue #234.
- Nota: el issue #161 propone un ADR de roles propios de M6 y sugiere numerarlo ADR-006; como este documento se escribió primero, se queda con el número 006. El de roles tomará el siguiente correlativo disponible cuando se escriba.
