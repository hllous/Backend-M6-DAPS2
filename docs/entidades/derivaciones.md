# Derivaciones salientes

Las dos entidades que representan un pedido a otro módulo. Existen para poder **seguir el pedido**: publicar el evento no alcanza, porque la respuesta vuelve asincrónica y hay que saber a qué solicitud contesta.

| Entidad | Campos principales |
|---|---|
| `RepairRequest` | Hacia **M3**. `damageType`, `location`, `severity`, `detectedIn`, `status` |
| `StreetClosureRequest` | Hacia **M7**. `reason`, `sourceRef`, `affectedSections[]`, `requestedFrom`, `requestedTo`, `status` |

Enums: `damageType` es `RepairDamageType`, `severity` es `Severity` — ver [enumeraciones.md](../enumeraciones.md).

## `RepairRequest` → M3

Un daño de infraestructura que detectamos pero que no nos corresponde arreglar: pavimento roto, vereda hundida, luminaria caída, sumidero tapado. `detectedIn` guarda el `serviceId` o el `inspectionId` que lo originó.

**Tres estados, no una máquina:** pedida, en curso, cerrada. Alcanza con eso, y por eso no consumimos `workOrderUpdated` de M3.

| Momento | Qué pasa |
|---|---|
| Se crea | Publicamos [`infrastructureRepairRequested`](../eventos/publicados/infrastructureRepairRequested.md) |
| Llega [`workOrderScheduled`](../eventos/consumidos/workOrderScheduled.md) | Pasa a en curso |
| Llega [`workOrderCompleted`](../eventos/consumidos/workOrderCompleted.md) | Se cierra |

Las dos respuestas dependen de que M3 devuelva nuestro `requestId` como `sourceRequestId`; sin ese campo hay que correlacionar por dirección, que es frágil. Y sigue sin confirmarse **cuándo** dispara M3 su `workOrderScheduled`: ver [bloqueantes.md](../bloqueantes.md#m3--obras-públicas--con-una-pregunta).

Un [`Container`](container.md) con `requiresPublicWorks = true` también le llega a M3, pero por otra vía: el evento `containerDamaged`, no una `RepairRequest`.

## `StreetClosureRequest` → M7

El corte de calle que necesita un servicio o una poda. `sourceRef` apunta al [`Service`](service.md) o a la [`TreeIntervention`](tree-intervention.md) que lo origina, y es lo que hace que la respuesta de M7 se pueda aplicar sobre el trabajo correcto.

| Momento | Qué pasa |
|---|---|
| Se crea | Publicamos [`streetClosureRequested`](../eventos/publicados/streetClosureRequested.md), con `sourceModule = M6` |
| Llega [`streetClosureApproved`](../eventos/consumidos/streetClosureApproved.md) | Se habilita la ejecución del servicio bloqueado |
| Llega [`streetClosureRejected`](../eventos/consumidos/streetClosureRejected.md) | Se reprograma o se cancela el servicio dependiente |
| Llega [`streetClosureEnded`](../eventos/consumidos/streetClosureEnded.md) | Se libera la dependencia |

Las tres respuestas traen `closureRequestId` y `requestingModule` (nombres de M7, no los que pedimos, pero el mismo dato) — confirmado desde el 25/08, y desde el 30/08 también en `streetClosureEnded`, que antes era la excepción.
