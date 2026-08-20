# Eventos que consume M6

**Estos son todos.** Si un módulo publica algo que no está en esta lista, no lo estamos leyendo.

| Evento | De quién | Qué hacemos con él |
|---|---|---|
| [`ticketUpdated`](ticketUpdated.md) | **M2** | El único suyo que escuchamos. `ROUTED` abre el expediente o el servicio; el resto lo hace avanzar |
| [`workOrderScheduled`](workOrderScheduled.md) | **M3** | Pasamos la solicitud de reparación a en curso |
| [`workOrderCompleted`](workOrderCompleted.md) | **M3** | Cerramos la solicitud de reparación |
| [`commercialFineGenerated`](commercialFineGenerated.md) | **M4** | Registramos la resolución del acta, pasamos a `SANCTIONED` y cerramos |
| [`closureOrdered`](closureOrdered.md) | **M4** | Ídem, con la clausura como resolución |
| [`closureLifted`](closureLifted.md) | **M4** | Registramos el levantamiento de la clausura y cerramos |
| [`streetClosureApproved`](streetClosureApproved.md) | **M7** | Habilitamos la ejecución del servicio bloqueado |
| [`streetClosureRejected`](streetClosureRejected.md) | **M7** | Reprogramamos o cancelamos el servicio dependiente |
| [`streetClosureEnded`](streetClosureEnded.md) | **M7** | Liberamos la dependencia |
| [`notificationSent`](notificationSent.md) | **M9** | Registramos el acuse. 🔴 Puede que lo saquemos |
| [`weatherAlertIssued`](weatherAlertIssued.md) | *nadie* | **Simulado internamente.** Dispara la reprogramación masiva por zona |

Diez de la cohorte, de cinco módulos, más uno simulado. **De M1, M5 y M8 no consumimos ningún evento.**

## No llevan schema

El payload lo define el módulo que publica. Acá documentamos **solo los campos que necesitamos**: cualquier campo extra que ya publiquen lo aprovechamos, pero sin los marcados 🔴 el flujo no funciona.

## Lo que falta

| Origen | Campo | Estado |
|---|---|---|
| M2 | El módulo responsable en `ROUTED`, y `location` con `neighborhoodId` | 🔴 Bloqueante |
| M3 | `sourceRequestId` en los dos eventos, y cuándo se dispara `workOrderScheduled` | ⚠️ Abierto |
| M4 | `sourceViolationId` en los tres, y confirmar el ruteo de `commercialFineGenerated` | ⚠️ Abierto |
| M7 | `sourceRequestId` + `sourceModule` en las tres respuestas | ⚠️ Abierto |
| M9 | Que alguien publique algo que origine una notificación | 🔴 Sin publicador |

Detalle en [bloqueantes.md](../../bloqueantes.md).

## Lo que no consumimos, y por qué

| Evento | Por qué no |
|---|---|
| `ticketCreated` (M2) | Va hacia M1 con los datos mínimos del registro del ciudadano. No sirve para abrir un servicio |
| `workOrderUpdated` (M3) | Va solo hacia M2. Nuestra solicitud tiene tres estados y con los otros dos alcanza |
| `notificationFailed` (M9) | Mismo problema que `notificationSent`, sin el beneficio del acuse |
| `citizenDeceased`, `addressUpdated`, `citizenBlocked` (M1) | No replicamos el registro de ciudadanos |
| `ticketRouted`, `ticketEscalated`, `ticketResolved`, `ticketClosed`, `ticketReopened`, `ticketCancelled`, `ticketInfoProvided` | **No existen.** Son `updateType` de `ticketUpdated`, no eventos. Es el huérfano más grande de la cohorte |
