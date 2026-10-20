# Riesgos de la cohorte y plan B

> Reubicado el 20/10/2026 (#312) sin cambios de contenido. Lo abierto del día a día está en [`bloqueantes.md`](../bloqueantes.md#tablero).

## Riesgos de la cohorte que nos salpican

**Tormenta de eventos técnicos.** Todos los módulos publicamos `eventProcessingFailed` **y** todos lo consumimos. Si falla el procesamiento de un `eventProcessingFailed`, se publica otro: un ciclo que ninguna DLQ frena, porque el problema no es el reintento. Propuesta: que los eventos técnicos —`eventProcessingFailed` y `eventRejected`— vayan solo hacia M9, que tiene el tablero de DLQ, y queden excluidos de la ruta que dispara una publicación de falla. **Resuelto el 20/10:** M9 está de acuerdo, los dos son suyos, nunca circularon y los da de baja; el reemplazo es su DLQ y su auditoría ([#297](https://github.com/hllous/Backend-M6-DAPS2/issues/297)).

**Colisión de nombres con M4.** Ellos publican `inspectionScheduled` / `inspectionCompleted` / `inspectionFailed` sin prefijo; son inspecciones *comerciales*. Los nuestros van prefijados (`environmental…`), así que de nuestro lado está bien, pero M2 es destinatario de los dos. Conviene que el catálogo del Core registre el módulo de origen, o que M4 prefije los suyos.

**El sobre común: cerrado el 7/10/2026.** El sobre es el del Core, adoptado por toda la cohorte: `eventId`, `eventType`, `eventVersion` (default `"1.0"`), `occurredAt`, `sourceModule`, `correlationId?`, `causationId?` y `data`, sin campos extra. Reemplaza al de M2 (`specVersion`, `producer`, `subject`), que es histórico y también migra. Nuestro inbox sigue aceptando el viejo mientras dure la migración ([ADR-007](../decisiones/adr-007-contrato-de-integracion-del-core.md)).

**Los adjuntos se llaman distinto.** M2 usa `attachment { fileName, contentType, url, sizeBytes }` —sin `attachmentId` desde la v1.6—; nosotros veníamos con `{ url, mimeType, description }`. Nos alineamos al suyo en lo que va hacia M2; conviene unificarlo en toda la cohorte antes de implementar.

**Dónde viven los archivos: resuelto internamente el 02/09, implementado el mismo día (Issue #64).** El equipo eligió **Cloudflare R2**, con el backend subiendo al bucket y guardando en `Attachment` la URL pública que devuelve, más el nombre del archivo. `POST /evidence` y `GET /evidence` ya existen, genéricos por `ownerType`/`ownerId` (Container, Service, ZoneResult, Inspection). Es lo que hace que el `url` del contrato sea un enlace que se pueda abrir sin pedirnos nada.

**Hacia M4 ya viaja (04/09).** `environmentalViolationDetected` lleva `evidence[]` con los adjuntos de la inspección, en la forma `{url, mimeType}` que define `_shared.schema.json`.

**Hacia M2 sigue pendiente**, y no es el mismo trabajo: `updateTicketStatus.attachments[]` usa el shape de ellos —`{fileName, contentType, url, sizeBytes?}`— y antes de mandarlo hay que decidir **qué adjuntos ve el vecino**. Las fotos de una inspección son internas, por el mismo criterio que deja afuera `findings` y el contenido del acta.

**Huérfanos ajenos** (alguien los espera y nadie los publica): el par `paymentRegistered` / `debtSettled` es el más caro — rompe el cierre financiero de M4 y M7 con Rentas, porque M5 los publica como `paymentRecorded` y `debtCancelled`. La lista completa está en [`Cruce-Eventos-M6.md`](../Cruce-Eventos-M6.md) Parte 3; no la duplicamos acá porque no nos toca mantenerla.

## Plan B si M2 no resuelve

El riesgo no es que M2 diga que no: es que la reunión pase y el evento de derivación siga sin aparecer.

**Hay una segunda entrada que no depende de nadie: la detección de oficio.** El inspector detecta la infracción, el supervisor releva el árbol, el operario reporta el contenedor desbordado. La primera entrega se puede demostrar entera por ese camino — programación, ejecución, resultado por zona, censo de arbolado, acta y derivación a M4. Lo que queda afuera es el circuito reclamo → servicio → vecino, que es de integración y corresponde a la segunda entrega.
