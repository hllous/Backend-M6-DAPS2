# Eventos que consume M6

**Estos son todos.** Si un módulo publica algo que no está en esta lista, no lo estamos leyendo.

| Evento | De quién | Qué hacemos con él |
|---|---|---|
| [`ticketUpdated`](ticketUpdated.md) | **M2** | El único suyo que escuchamos. `ROUTED` abre el expediente o el servicio; el resto lo hace avanzar |
| [`workOrderScheduled`](workOrderScheduled.md) | **M3** | Pasamos la solicitud de reparación a en curso |
| [`workOrderCompleted`](workOrderCompleted.md) | **M3** | Cerramos la solicitud de reparación |
| [`commercialFineGenerated`](commercialFineGenerated.md) | **M4** | Registramos la resolución del acta, pasamos a `SANCTIONED` y cerramos |
| [`closureUpdate`](closureUpdate.md) | **M4** | `status: ORDERED` → ídem con la clausura como resolución. `status: LIFTED` → registramos el levantamiento y cerramos |
| [`streetClosureApproved`](streetClosureApproved.md) | **M7** | Habilitamos la ejecución del servicio bloqueado |
| [`streetClosureRejected`](streetClosureRejected.md) | **M7** | Reprogramamos o cancelamos el servicio dependiente |
| [`streetClosureEnded`](streetClosureEnded.md) | **M7** | Liberamos la dependencia |
| [`notificationSent`](notificationSent.md) | **M9** | Registramos el acuse. 🔴 Puede que lo saquemos |
| [`weatherAlertIssued`](weatherAlertIssued.md) | *nadie* | **Simulado internamente.** Dispara la reprogramación masiva por zona |

Nueve de la cohorte, de cinco módulos, más uno simulado (`closureOrdered` + `closureLifted` se fusionaron en `closureUpdate`, 24/08). **De M1, M5 y M8 no consumimos ningún evento.**

## No llevan schema

El payload lo define el módulo que publica. Acá documentamos **solo los campos que necesitamos**: cualquier campo extra que ya publiquen lo aprovechamos, pero sin los marcados 🔴 el flujo no funciona.

## Lo que falta

| Origen | Campo | Estado |
|---|---|---|
| M9 | Que alguien publique algo que origine una notificación | 🔴 Sin publicador |
| M2 | `progress` de `updateTicketStatus` (lo que publicamos, no lo que consumimos) no sirve para la fecha agendada | 🔴 Bloqueante — ver [`updateTicketStatus`](../publicados/updateTicketStatus.md) |
| M4 | Confirmar ruteo de `commercialFineGenerated`, `decidedAt`/`externalRef` pendientes de publicar, pregunta sobre `actId` | ⚠️ Abierto |
| M3 | Cuándo se dispara `workOrderScheduled`, nombre `evidence` vs `attachments[]` a confirmar | ⚠️ Abierto (no bloqueante) |
| M7 | ~~Asimetría: `streetClosureEnded` no traía el origen de la solicitud~~ | ✅ Resuelto (30/08): ya trae `closureRequestId` |

Detalle en [bloqueantes.md](../../bloqueantes.md).

## Lo que no consumimos, y por qué

| Evento | Por qué no |
|---|---|
| `ticketCreated` (M2) | Va hacia M1 con los datos mínimos del registro del ciudadano. No sirve para abrir un servicio |
| `workOrderUpdated` (M3) | Va solo hacia M2. Nuestra solicitud tiene tres estados y con los otros dos alcanza |
| `notificationFailed` (M9) | Mismo problema que `notificationSent`, sin el beneficio del acuse |
| `citizenDeceased`, `addressUpdated`, `citizenBlocked` (M1) | No replicamos el registro de ciudadanos |
| `ticketRouted`, `ticketEscalated`, `ticketResolved`, `ticketClosed`, `ticketReopened`, `ticketCancelled`, `ticketInfoProvided` | **No existen.** Son `updateType` de `ticketUpdated`, no eventos. Es el huérfano más grande de la cohorte |
