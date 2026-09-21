# `weatherAlertIssued` — simulado internamente

> ⚠️ **No lo publica nadie.** No es un evento de otro módulo: **ningún grupo de la cohorte lo publica**, y no se lo pedimos a nadie. M6 lo simula internamente.
>
> Está documentado acá y no en [publicados/](../publicados/) porque desde el punto de vista del módulo se consume igual que los demás: hay un handler que reacciona a un evento entrante. La diferencia es de dónde sale.

## Qué hace M6 al recibirlo

Si la severidad es `HIGH` o `CRITICAL`, **marca para reprogramar** (`SCHEDULED → RESCHEDULED`) los [`Service`](../../entidades/service.md) de las zonas afectadas cuya `scheduledDate` cae dentro de la ventana `from`–`to`, comparando por día. El motivo queda en `statusReason`; la fecha nueva la pone después el operador. Con severidad menor solo se loguea.

No se marca nada sobre las zonas en sí, y el `origin` de los servicios no cambia: sigue siendo el que tenían.

## Campos que necesita el simulador

Al no haber contraparte, la forma la definimos nosotros. Lo mínimo para que la reprogramación funcione:

| Campo | Para qué |
|---|---|
| `alertType` | Qué fenómeno |
| `severity` | Decide si se reprograma o solo se avisa |
| `zoneIds[]` | Qué zonas se ven afectadas. `neighborhoodIds[]` no se lee |
| `from`, `to` | **Obligatorios para `HIGH`/`CRITICAL`.** Ventana de la alerta (ISO 8601): qué servicios caen adentro |

**Validación (400 en `POST /events/inbox`):** `severity` y `zoneIds` no vacío siempre; con `HIGH`/`CRITICAL`, cada elemento de `zoneIds` debe ser uuid y `from`/`to` fechas ISO 8601. Decisión: el uuid se exige solo donde el handler usa las zonas en el `updateMany`; el catálogo de zonas de M9 sigue abierto (bloqueantes.md) y una alerta leve nunca toca `zoneId`, así que no se la rechaza por el formato del id.

Una alerta `HIGH`/`CRITICAL` sin `from` o sin `to` (o con fechas que no se pueden leer) **se descarta con un warn** y no reprograma nada: sin ventana, el filtro por zona movería todos los servicios agendados de esas zonas, en cualquier fecha. Las alertas de severidad menor no reprograman, así que para ellas la ventana no se valida.

## Por qué queda así

En el enunciado figura como `AlertaMeteorologicaRecibida` y este módulo lo tenía como `weatherAlertIssued`, pero **ningún módulo de la cohorte publica nada equivalente**. No es un huérfano que haya que resolver en una reunión: es una entrada que decidimos cubrir nosotros, sin impacto para nadie más.

Si más adelante M9 expone una integración meteorológica real, se reemplaza el simulador por una suscripción y el handler no cambia.
