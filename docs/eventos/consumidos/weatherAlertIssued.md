# `weatherAlertIssued` — simulado internamente

> ⚠️ **No lo publica nadie.** No es un evento de otro módulo: **ningún grupo de la cohorte lo publica**, y no se lo pedimos a nadie. M6 lo simula internamente.
>
> Está documentado acá y no en [publicados/](../publicados/) porque desde el punto de vista del módulo se consume igual que los demás: hay un handler que reacciona a un evento entrante. La diferencia es de dónde sale.

## Qué hace M6 al recibirlo

Marca las zonas afectadas y **dispara la reprogramación masiva** de los [`Service`](../../entidades/service.md) agendados en ellas.

Los servicios reprogramados por este camino llevan `origin = WEATHER_ALERT`.

## Campos que necesita el simulador

Al no haber contraparte, la forma la definimos nosotros. Lo mínimo para que la reprogramación funcione:

| Campo | Para qué |
|---|---|
| `alertType` | Qué fenómeno |
| `severity` | Decide si se reprograma o solo se avisa |
| `zoneIds[]` o `neighborhoodIds[]` | Qué zonas se ven afectadas |
| `from`, `to` | Ventana de la alerta: qué servicios caen adentro |

## Por qué queda así

En el enunciado figura como `AlertaMeteorologicaRecibida` y este módulo lo tenía como `weatherAlertIssued`, pero **ningún módulo de la cohorte publica nada equivalente**. No es un huérfano que haya que resolver en una reunión: es una entrada que decidimos cubrir nosotros, sin impacto para nadie más.

Si más adelante M9 expone una integración meteorológica real, se reemplaza el simulador por una suscripción y el handler no cambia.
