# Mensaje a M9 — datos del broker RabbitMQ

> Texto listo para que el PO lo envíe a M9. Copiar el bloque de abajo tal cual.

```text
Hola M9. M6 ya tiene implementado el outbox/inbox completo y el adaptador
RabbitMQ listo para enchufar (reemplazamos Kafka cuando anunciaron el cambio).
Para dejarlo conectado y correcto necesitamos de ustedes estos datos:

1. URL del broker: host, puerto y vhost, y si es TLS (amqps) o no.
2. Credenciales AMQP de M6 (usuario y clave), y cómo nos las pasan sin que
   vayan por el repo.
3. Exchange: nombre y tipo (topic o direct), y si hay uno común a toda la
   cohorte o uno por módulo.
4. Routing key: ¿es el nombre del evento a secas (ej. urbanServiceScheduled)
   o va prefijado (ej. M6.urbanServiceScheduled o modulo.entidad.accion)?
   Esto nos define si hay que tocar código.
5. Nombre de cola: ¿cada módulo declara la suya (y con qué convención) o las
   crean centralizadamente ustedes?
6. Dead-letter exchange y política de reintentos/TTL: ¿existe una DLX común?
   ¿Con qué TTL se reintenta?
7. Tipo de cola (clásica o quorum) y permisos del usuario de M6
   (configure/write/read).

Además, en lo posible, nos vendría bien confirmar:
- Formato exacto del mensaje (¿el sobre común de M2 tal cual en el body?,
  ¿headers obligatorios?, ¿content-type?).
- Si hay un usuario AMQP por módulo para validar qué módulo publica cada
  routing key (y cómo se controla que nadie publique un evento ajeno).
- Si hay alternate exchange para mensajes sin cola bindeada.
- Un ambiente de prueba compartido y una fecha estimada de disponibilidad.

Mientras no tengamos esto, M6 arranca igual (queda en outbox + log y la ingesta
manual por POST /events/inbox), pero para enchufar el bus real necesitamos
esos datos. Gracias!
```

---

## Fase 3 — checklist para cuando M9 responda

| # | Dato de M9 | Dónde se aplica |
|---|---|---|
| 1 | URL (host, puerto, vhost, TLS) | `RABBITMQ_URL` (`.env` local; Render para prod, `amqps://`) |
| 2 | Credenciales AMQP de M6 | dentro de `RABBITMQ_URL`; como secreto, nunca en el repo |
| 3 | Exchange (nombre + tipo) | `RABBITMQ_EXCHANGE`, `RABBITMQ_EXCHANGE_TYPE` |
| 4 | Routing key | ⚠️ si cambia, toca `rabbitmq.publisher.ts` / `rabbitmq.consumer.ts` |
| 5 | Nombre de cola | `RABBITMQ_QUEUE` |
| 6 | DLX + TTL | `RABBITMQ_DEAD_LETTER_EXCHANGE` |
| 7 | Tipo de cola + permisos | verificar al declarar la cola / crear el usuario |

**Acciones al recibir los datos:**
1. Cargar `RABBITMQ_*` en `.env` (local) y en Render (producción, `amqps://`).
2. Descomentar el servicio `rabbitmq` en `docker-compose.yml` (solo desarrollo local).
3. Si la routing key o el exchange cambian de convención, coordinar el cambio de código con el backend (punto 4/3).
4. Re-testear publicando un evento y verificando la cola de M6.

## Estado actual (mientras M9 no responde)

- Backend en `develop`: migración Kafka → RabbitMQ ya mergeada (PR #234/#239, ADR-006).
- DevOps local: `docker-compose.yml` y `.env` con RabbitMQ comentado y defaults provisorios
  (`exchange municipalidad.events`, `topic`, cola `m6.ambiente`, prefetch `1`).
- Sin `RABBITMQ_URL` la app arranca igual: outbox + log, y lo entrante por `POST /events/inbox`.
