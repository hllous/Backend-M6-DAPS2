# `streetClosureEnded` ← M7

El corte de calle terminó.

> ✅ **Payload actualizado (30/08).** M7 ahora incluye `closureRequestId`, cerrando la asimetría que tenía este evento frente a `streetClosureApproved` y `streetClosureRejected`.

## Qué hace M6 al recibirlo

Libera la dependencia de la [`StreetClosureRequest`](../../entidades/derivaciones.md#streetclosurerequest--m7) y habilita la reprogramación de lo que hubiera quedado esperando.

## Payload confirmado

```
streetClosureEnded
  streetClosureId, closureRequestId, completionDateTime, notes
```

| Campo | Nota |
|---|---|
| `streetClosureId` | El identificador propio de M7 para el corte |
| ✅ `closureRequestId` | El `closureRequestId` que mandamos en [`streetClosureRequested`](../publicados/streetClosureRequested.md), de ida y vuelta. Ya no hace falta correlacionar por otra vía |
| `completionDateTime` | Cuándo terminó. Según el documento de M7; el consumer no lo lee |
| `requestingModule` | El código no lo lee ni lo valida en ninguno de los tres eventos de corte. Para nosotros M7 confirmó el 20/10 que viaja `"ambiente"`, en minúscula, y que el sobre trae `sourceModule: "transito"` |

**Qué lee el código** (`OutboundResponsesConsumer`): `closureRequestId` es **obligatorio y debe ser uuid** — sin él el inbox responde 400 (`sourceRequestId` se acepta como alias de entrada, no es el contrato de M7). Además toma `streetClosureId` (o `closureId`) y lo guarda como `closureId` solo si el corte no tenía uno. No hay mapeo `streetClosureId → closureRequestId` propio: si M7 manda este evento sin `closureRequestId`, se rechaza, no se correlaciona por otra vía.

## La asimetría, ya resuelta

**Hasta el 25/08, este evento no traía el origen de la solicitud** — a diferencia de [`streetClosureApproved`](streetClosureApproved.md) y [`streetClosureRejected`](streetClosureRejected.md), que sí lo traían. La idea era persistir el mapeo `streetClosureId → closureRequestId` desde el `streetClosureApproved` anterior; nunca se implementó.

**El documento de referencia nuevo de M7 (30/08) agrega `closureRequestId` directamente en `streetClosureEnded`.** La correlación depende exclusivamente de ese campo: no hay mapeo propio de respaldo.

## Corte aprobado que expira: M7 no publica nada (M7, 19/10)

M7 solo publica `streetClosureEnded` cuando un corte `ACTIVE` vence su `endDate`. **Un corte `APPROVED` que nunca se activó pasa a `EXPIRED` sin publicar finalización.** Entonces, tras un `streetClosureApproved`, **puede no llegar nunca un `streetClosureEnded`**: nuestra `StreetClosureRequest` queda en `APPROVED` y lo que dependía del corte sigue habilitado sin que nadie lo libere. Hoy no hay ningún mecanismo nuestro que lo detecte (el consumer no mira `endDate` y no hay vencimiento por tiempo); la salida manual es el endpoint que pasa el corte a `ENDED`. Es un gap a resolver, a llevar a M7: confirmar si van a publicar algo al expirar, o si nosotros cerramos por `endDate`. Estado en [bloqueantes.md](../../bloqueantes.md#m7--tránsito-).

## El typo, ya resuelto

**En la lista anterior de M7 figuraba como `streetClousureEnded`**, con una `u` de más. El documento de referencia (25/08) ya lo escribe bien: **`streetClosureEnded`**, coincidiendo con lo que usamos nosotros y M3.

⚠️ **Riesgo abierto (M3 v0.6, 20/10):** M3 anota que el Core todavía debe corregir o confirmar la **declaración histórica `streetClousureEnded`** (con el typo) en su catálogo y en `q.obras`. Nos suscribimos a `streetClosureEnded`: si el Core registró el nombre con typo, la suscripción no recibiría el evento. Se verifica con el Core local ([#266](https://github.com/hllous/Backend-M6-DAPS2/issues/266), [#298](https://github.com/hllous/Backend-M6-DAPS2/issues/298), [#299](https://github.com/hllous/Backend-M6-DAPS2/issues/299)).

## Evento tardío o repetido

Se acepta desde `APPROVED` y también desde `REQUESTED`: el Core no garantiza el orden entre eventos (y un reintento vuelve después de lo publicado más tarde), así que `streetClosureEnded` puede adelantarse a `streetClosureApproved`. En ese caso se guarda el `streetClosureId` como `closureId` si no lo teníamos, y el `streetClosureApproved` que llegue después se descarta (`ENDED` es terminal). Desde `REJECTED` o `ENDED` se descarta con un `warn`, sin error: el inbox responde `processed`.
