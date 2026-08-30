# Cruce de Eventos M6

**Grupo 04 — Módulo 6, Ambiente, Higiene y Servicios Urbanos**
Fecha: 17 de agosto de 2026
Fuente: listas de eventos publicados y consumidos de M1–M8 (`Eventos.txt`)
Contraste: Documento de Alcance M6 + las siete fichas por módulo
Alcance del cruce: nombres y direcciones de evento. Los campos de payload no son visibles en esta ronda.

---

## Resumen

| Métrica | Valor |
|---|---|
| Eventos que publicamos con consumidor confirmado | 8 / 8 |
| Eventos que consumimos con publicador confirmado | 9 / 10 |
| Bloqueantes abiertos | 3 |
| Pedidos nuestros que esta ronda cierra | 6 |
| Eventos huérfanos o con choque de nombre en la cohorte | 17 |
| **Equivalencias de nombre que hay que resolver de nuestro lado** | **11** |

**El titular.** M3, M4 y M7 encajan casi perfecto: aceptaron todo lo que les mandamos y publican casi todo lo que pedimos. M2 publicó un contrato completo (v1.2, y desde el 24/08 v1.5) que resuelve casi todo lo que le pedíamos; la v1.5 cerró los dos campos bloqueantes del snapshot de derivación pero abrió uno nuevo en `updateTicketStatus`. M9 sigue sin estar en la recopilación.

---

# Parte 1 — Equivalencias de nombre

Esta es la parte que la primera pasada trató por encima. **Casi ningún nombre nuestro coincide literalmente con el de la cohorte**, y las diferencias no son de un solo tipo: hay cambio de sustantivo, cambio de verbo, cambio de convención de escritura, y un caso donde directamente no hay equivalente.

## 1.1 Los cuatro tipos de desajuste

| Tipo | Ejemplo | Cuántos casos |
|---|---|---|
| **Sustantivo distinto** | `complaint` → `ticket` | 5 eventos + 8 payloads + 2 entidades + 1 enum |
| **Verbo distinto** | `Forwarded` → `Routed`; `Issued` → `Generated` | 3 |
| **Convención de escritura** | `UrbanServiceScheduled` → `urbanServiceScheduled` | 27 (todos) |
| **Equivalencia parcial aceptada** | `ViolationDismissed` → `closureLifted` | 1 |

## 1.2 El caso grande: `complaint` → `ticket`

Nuestro módulo llamó **`complaint`** a lo que M2 —que es el dueño del dato— llama **`ticket`**. Lo confirman M1, M3, M5, M7 y M8, que ya consumen `ticket*`. **Migramos nosotros.**

Lo que la primera pasada no dijo: **el renombre no termina en los cinco eventos que consumimos.** `complaintId` es un campo que viaja en la mayoría de nuestros payloads, y además es columna de dos entidades y valor de una enumeración.

### Eventos consumidos — renombre directo

| Nuestro nombre | Nombre de la cohorte | Tipo de desajuste |
|---|---|---|
| `ComplaintForwarded` | `ticketRouted` | sustantivo **+ verbo** |
| `ComplaintEscalated` | `ticketEscalated` | sustantivo |
| `ComplaintResolved` | `ticketResolved` | sustantivo |
| `ComplaintClosed` | `ticketClosed` | sustantivo |
| `ComplaintReopened` | `ticketReopened` | sustantivo |
| — | `ticketCancelled` | existe como `ticketUpdated / CANCELLED`; lo consumimos por ahí |

### El campo `complaintId` — 8 payloads

`UrbanServiceScheduled` · `UrbanServiceCompleted` · `ContainerOverflowed` · `ContainerDamaged` · `EnvironmentalInspectionScheduled` · `EnvironmentalInspectionCompleted` · `EnvironmentalViolationDetected` · `InfrastructureRepairRequested`

En los 8 pasa a `ticketId`.

### Lo que arrastra además

| Dónde | Qué cambia |
|---|---|
| Entidad `Service` | campo `complaintId` → `ticketId` |
| Entidad `EnvironmentalReport` | campo `complaintId` → `ticketId` |
| Enum `ServiceOrigin` | valor `COMPLAINT` → `TICKET` |
| Glosario del alcance | la entrada "Denuncia" define el término por `complaint` |
| Prose del alcance | "denuncia" y "reclamo" usados como sinónimos de ticket |

> **Consecuencia práctica.** Esto no es buscar-y-reemplazar en un documento: es esquema de base de datos, DTOs y contratos. Conviene decidirlo **ahora**, antes de la primera entrega, no en la segunda cuando ya haya datos.

### El sub-problema del verbo

`ComplaintForwarded` no falla solo por el sustantivo. La cohorte usa **`Routed`**, no `Forwarded`. Y hay un tercer nombre en circulación:

| Quién | Cómo lo llama |
|---|---|
| M6 (nosotros) | `complaintForwarded` |
| M3 | `ticketRouted` *(en su lista actualizada; antes `complaintRouted`)* |
| M1, M5, M8 | `ticketRouted` |
| M2 (dueño) | **`ticketUpdated` con `updateType = ROUTED`** |

Tres nombres para el mismo hecho, y el dueño no publica ninguno de los tres: publica un evento genérico con un discriminador adentro. Aunque la cohorte hubiera conservado "complaint", nuestro nombre igual no habría coincidido.

## 1.3 Verbos que no coinciden

Independientes del caso anterior. El enunciado en español es el origen de casi todos: cada grupo tradujo por su cuenta.

| Concepto | Enunciado | M6 | M3 | M7 (dueño) | Resolución |
|---|---|---|---|---|---|
| Corte de calle autorizado | `CorteCalleAutorizado` | `StreetClosureApproved` | ~~`streetClosureAuthorized`~~ → `streetClosureApproved` | **`streetClosureApproved`** | ✅ Los tres coincidimos: M3 lo corrigió |
| Corte de calle terminado | `CorteCalleFinalizado` | `StreetClosureEnded` | ~~`streetClosureFinished`~~ → `streetClosureEnded` | **`streetClousureEnded`** *(typo)* | M3 lo corrigió. Queda el typo de M7 |
| Multa comercial | `MultaComercialGenerada` | `CommercialFineIssued` | — | M4: **`commercialFineGenerated`** | **Cambiamos nosotros** |
| Reclamo derivado | `ReclamoDerivado` | `ComplaintForwarded` | `ticketRouted` | M2: **`ticketUpdated / ROUTED`** | No es un evento sino una variante. Nos suscribimos a `ticketUpdated` |
| Alerta meteorológica | `AlertaMeteorologicaRecibida` | `WeatherAlertIssued` | — | nadie | Lo simulamos internamente; sin impacto |

## 1.4 Convención de escritura — nos afecta los 27 eventos

**Todos los documentos de M6 escriben los eventos en PascalCase** (`UrbanServiceScheduled`). **Toda la recopilación de la cohorte usa camelCase** (`urbanServiceScheduled`), incluida la sección que escribimos nosotros mismos en `Eventos.txt`.

Si el Core matchea el tipo de evento como string literal, `UrbanServiceScheduled` y `urbanServiceScheduled` son dos eventos distintos y ninguno llega. **Adoptamos camelCase** y corregimos el alcance, las siete fichas por módulo y el diagrama.

## 1.5 Los alias que M3 tiene por duplicado

Aquí la equivalencia existe pero está declarada dos veces, y eso es peor que no estarlo: son dos suscripciones esperando el mismo hecho.

| M3 consume | Lo publica | Verdadero equivalente |
|---|---|---|
| `infrastructureRepairRequested` | M6 ✓ | — |
| `urbanServiceRepairRequested` | **nadie** | ✅ resuelto: M3 lo borró de su lista actualizada |
| `treeRiskDetected` | M6 ✓ | — |
| `urbanRiskDetected` | **nadie** | ✅ resuelto: M3 lo borró de su lista actualizada |

> **El desajuste es heredado, no lo inventó nadie.** El enunciado dice que M6 publica `RiesgoArboladoDetectado` y, dos páginas después, que M3 consume `RiesgoUrbanoDetectado`. Son dos nombres para el mismo evento en el mismo documento. Vale la pena decirlo en la reunión: no es que M3 se haya equivocado.
>
> **Efecto secundario bueno:** como M3 igual listó `treeRiskDetected`, nuestra pregunta abierta #2 con ellos —"¿consumen el nuestro o publicamos uno genérico con `hazardType`?"— se resuelve por el primero. **El evento genérico queda descartado.** Solo falta que borren los dos alias.

## 1.6 El caso resuelto por decisión: `closureLifted`

**Decisión tomada: adoptamos `closureLifted` como la tercera señal de cierre de M4.** No se le pide a M4 un evento nuevo de desestimación.

Conviene tener claro qué cubre y qué no, porque no son sinónimos exactos:

| M4 decide | Evento | ¿Nos llega? |
|---|---|---|
| Multa | `commercialFineGenerated` | ✅ |
| Clausura | `closureOrdered` | ✅ |
| Levantar una clausura ya dispuesta | `closureLifted` | ✅ |
| No hacer nada | *ningún evento* | ❌ |

`closureLifted` cierra el expediente cuando M4 termina una clausura. **El caso "M4 decide que no corresponde castigo" no lo cubre ningún evento**, porque simplemente no se dispara nada.

> 🔄 **Actualización 24/08.** `closureOrdered` y `closureLifted` (fila por fila en la tabla de arriba) se fusionaron en un solo evento de M4, `closureUpdate`, con `status: ORDERED | LIFTED`. El razonamiento de esta sección no cambia, solo el nombre del evento.

**Ese caso queda cubierto por el cierre por vencimiento de plazo configurable**, que ya estaba en el alcance: pasado el plazo sin respuesta de M4, el expediente pasa a `CLOSED` sin `SanctionOutcome`. Es menos preciso que un evento —una desestimación y una demora de M4 se ven igual— pero evita el expediente eterno y no depende de que otro grupo agregue nada.

Con esto **M4 deja de ser bloqueante**: quedan tres.

## 1.7 Una colisión de espacio de nombres a vigilar

M4 publica `inspectionScheduled`, `inspectionCompleted` e `inspectionFailed` **sin prefijo**. Nosotros publicamos `environmentalInspectionScheduled` y `environmentalInspectionCompleted`.

Son eventos distintos con nombres confundibles, y M2 es destinatario de los dos. Nuestros nombres están bien —van prefijados—; los de M4 son en realidad *inspecciones comerciales*. Conviene que el catálogo del Core registre el módulo de origen, o que M4 prefije los suyos.

Nota menor del mismo tipo: llamamos "expediente ambiental" a nuestro `EnvironmentalReport`, y M1 es el dueño del "expediente digital" (`caseFile`). En prosa se confunden. En código no, porque los nombres técnicos son distintos.

## 1.8 Tabla maestra de equivalencias

### Lo que consumimos

| Nuestro nombre | Nombre real de la cohorte | Origen | Estado |
|---|---|---|---|
| `ComplaintForwarded` | `ticketRouted` | M2 | 🔴 M2 no lo declara |
| `ComplaintEscalated` | `ticketEscalated` | M2 | 🔴 M2 no lo declara |
| `ComplaintResolved` | `ticketResolved` | M2 | 🔴 M2 no lo declara |
| `ComplaintClosed` | `ticketClosed` | M2 | 🔴 M2 no lo declara |
| `ComplaintReopened` | `ticketReopened` | M2 | 🔴 M2 no lo declara |
| `WorkOrderCompleted` | `workOrderCompleted` | M3 | ✅ exacto |
| `CommercialFineIssued` | `commercialFineGenerated` | M4 | ⚠️ renombramos nosotros |
| `ClosureOrdered` | `closureOrdered` → 🔄 `closureUpdate / ORDERED` (24/08) | M4 | ✅ exacto en su momento; ver actualización |
| `ViolationDismissed` | `closureLifted` → 🔄 `closureUpdate / LIFTED` (24/08) | M4 | ✅ adoptado por decisión (§1.6); ver actualización |
| `StreetClosureApproved` | `streetClosureApproved` | M7 | ✅ exacto |
| `StreetClosureRejected` | `streetClosureRejected` | M7 | ✅ exacto |
| `StreetClosureEnded` | `streetClousureEnded` | M7 | ⚠️ typo de ambos lados |
| `NotificationSent` | `notificationSent` | M9 | 🔴 M9 ausente; nadie lo publica |
| `WeatherAlertIssued` | — | — | simulado internamente |

### Lo que publicamos

| Nuestro nombre | Cómo lo llama el consumidor | Consumidor | Estado |
|---|---|---|---|
| `InfrastructureRepairRequested` | `infrastructureRepairRequested` | M3 | ✅ + alias duplicado a borrar |
| `ContainerDamaged` | `containerDamaged` | M3 | ✅ exacto |
| `TreeRiskDetected` | `treeRiskDetected` | M3, M7 | ✅ + alias duplicado a borrar |
| `StreetClosureRequested` | `streetClosureRequested` | M7 | ✅ exacto |
| `UrbanServiceScheduled` | `urbanServiceScheduled` | M7 | ✅ para M7 · 🔴 M2 no lo consume |
| `TreePruningScheduled` | `treePruningScheduled` | M7 | ✅ para M7 · 🔴 M2 no lo consume |
| `EnvironmentalViolationDetected` | `environmentalViolationDetected` | M4 | ✅ exacto |
| `UrbanServiceStarted` | — | — | 🔴 sin consumidor |
| `UrbanServiceDelayed` | — | — | 🔴 sin consumidor |
| `UrbanServiceCompleted` | — | — | 🔴 sin consumidor |
| `ZoneNotServiced` | — | — | 🔴 sin consumidor |
| `ContainerOverflowed` | — | — | 🔴 sin consumidor |
| `EnvironmentalInspectionScheduled` | — | — | 🔴 sin consumidor |
| `EnvironmentalInspectionCompleted` | — | — | 🔴 sin consumidor |

Los siete sin consumidor son, todos, los que dirigíamos exclusivamente a M2. **Los sacamos del contrato publicado:** los hechos siguen en nuestro modelo y disparan cada `updateTicketStatus`, pero no salen al bus. Publicamos ocho eventos y los ocho tienen consumidor.

## 1.9 Errores de tipeo en nuestra propia sección de `Eventos.txt`

Ninguno es de diseño, pero un nombre mal escrito en un topic es un evento que no llega.

| Como quedó escrito | Como va | Nota |
|---|---|---|
| `containerOverflow` | `containerOverflowed` | participio, como el resto de la familia |
| `enviromentalInspectionScheduled` | `environmentalInspectionScheduled` | falta la `n` |
| `enviromentalInspectionCompleted` | `environmentalInspectionCompleted` | ídem |
| `envirometnalViolationDetected` | `environmentalViolationDetected` | M4 ya lo escribió bien |
| `complaintFowarded` | `ticketRouted` | se corrige y se renombra en un solo paso |
| `streetClousureEnded` | `streetClosureEnded` | el mismo typo está en la lista de M7 |
| `commercialFineIssued` | `commercialFineGenerated` | nombre de M4, ya consumido por M5 |
| `violationDismissed = closureLifted` | `closureLifted` | adoptamos el nombre de M4 (§1.6) |

Dos ausencias a confirmar, no a corregir: `weatherAlertIssued` no está porque lo simulamos internamente, y `notificationSent` quedó fuera aunque el alcance lo declara — puede terminar cayéndose solo según lo que resuelva M9.

---

# Parte 2 — Resultado por contraparte

## M2 — Atención ciudadana 🔴 BLOQUEANTE

Publicaron una **guía de integración con contrato v1.2**: sobre común, JSON Schema, matriz de transiciones, reglas de idempotencia y DLQ. Es, por lejos, el documento de integración más completo de la cohorte, y es el único que define un envelope.

> 🔄 **Actualización 24/08.** M2 publicó la **v1.5**, que reemplaza la v1.2 de esta sección. Cambió el payload de `updateTicketStatus` y se resolvieron los dos bloqueantes de `ROUTED` (más el menor de `citizenId`). El detalle está en las notas de esta sección y en la ficha [M6-para-M2.md](M6-por-modulo/M6-para-M2.md).

Publica `ticketCreated` —solo hacia M1, con el registro mínimo del ciudadano— y `ticketUpdated`. Consume `updateTicketStatus`. La riqueza no está en la cantidad de eventos sino en el discriminador: **`updateType` es lo que hace el trabajo**, en las dos direcciones.

### Lo que enviamos ✅ Resuelto

Un solo evento, `updateTicketStatus`, con el payload que ellos definieron y que adoptamos sin cambios. No mandamos estado: informamos el hecho con `updateType` y M2 decide la transición. El mapeo hecho nuestro → `updateType` está en el acuerdo, 1.2.

Tres cosas que su contrato nos resolvió y que teníamos anotadas como problema:

- **`detail` ya no es todo el canal.** `resolution.type` + `publicMessage` da un texto de cierre propio, y `attachments[]` permite mandar la foto del trabajo. Era nuestra objeción principal — la única parte sin resolver es la fecha agendada, ver nota de actualización abajo.
- **`INFORMATION_REQUIRED` nos devuelve el canal de pedirle un dato al vecino.** El ejemplo del propio contrato usa M6 como productor.
- **`RETURNED` es distinto de `REJECTED`.** Devolver el reclamo a M2 para que lo re-derive no es lo mismo que cancelárselo al vecino. Antes teníamos un solo verbo para las dos cosas.

Nos impone dos cambios de implementación: persistir `ticketVersion` para poder devolver `expectedTicketVersion`, y **dejar de mandar `sourceRef`**, porque el contrato prohíbe transportar IDs de entidades internas de otros módulos.

> 🔄 **Actualización 24/08.** La v1.5 sacó `publicId` y `expectedTicketVersion` del contrato: ya no hay que persistir `ticketVersion` ni devolver nada. También partió `message` en `publicMessage`/`internalMessage` y renombró `updatedAt` a `statusChangedAt`. Y apareció un problema nuevo: el campo común `progress` es un `Int` (porcentaje), no la fecha agendada que necesitamos mandar — no hay `details` definido para `STARTED`/`PROGRESS`.

Queda el problema para la cohorte: M1, M4, M5 y M8 publican el conjunto de cuatro (`ticketInProgress`, `ticketUpdate`, `ticketCompleted`, `ticketRejected`), que M2 no consume.

### Lo que recibimos 🔴 Bloqueante

**Un solo evento: `ticketUpdated`.** `ticketCreated` va hacia M1 y no nos sirve para abrir nada. Lo que necesitábamos no desapareció: son variantes.

| Lo que necesitábamos | Lo buscábamos como | Existe como |
|---|---|---|
| Que nos deriven el reclamo | `ticketCreated` + `targetArea` | `ticketUpdated / ROUTED`, con snapshot |
| El vecino agrega una foto o un dato | `ticketInfoProvided` | `ticketUpdated / INFORMATION_PROVIDED` |
| El vecino da de baja el reclamo | `ticketCancelled` | `ticketUpdated / CANCELLED` |
| El vecino rechaza la solución | *no lo teníamos* | `ticketUpdated / REOPENED` |

Lo que sigue bloqueado son dos campos del snapshot de `ROUTED`:

- **No dice a qué módulo va.** Ni módulo, ni área, ni nada equivalente. `requestTypeId` es un entero de su catálogo. Si el ruteo es por contenido y no por cola dedicada, necesitamos el campo o el catálogo de `requestTypeId` que nos corresponden. Es el mismo problema que llamábamos `targetArea`, con otro nombre.
- **`location` es texto libre.** En el ejemplo, `{"address": "Lima y Chile"}`. Asignamos zona operativa y cuadrilla a partir del barrio: necesitamos `neighborhoodId` del catálogo de M9, más calle y número.

Menor: `citizenId` no viaja en el snapshot, solo `isAnonymous`. Lo pedimos, y si no lo transportan lo resolvemos por REST contra M1.

> 🔄 **Actualización 24/08 — los tres quedan cerrados.** La v1.5 agregó `responsibleAreaId`, `citizenId` e `isAnonymous` como campos comunes de todo `ticketUpdated` (no solo del snapshot de `ROUTED`), y `location` ahora trae `addressLine, street, streetNumber, neighborhoodId, latitude, longitude, reference`. Ya no hace falta ni el catálogo de `requestTypeId` ni la consulta REST de respaldo a M1.

### El canal de información adicional no se cerró: se movió

`additionalInfoRequired` es hoy `updateTicketStatus / INFORMATION_REQUIRED`, y `ticketInfoProvided` es `ticketUpdated / INFORMATION_PROVIDED`. Se correlacionan con un `informationRequestId` que genera el módulo que pregunta. **Conviene que M1 lo sepa**: publican un evento cuyo nombre ya no existe, cuando lo que tienen que publicar es una variante.

> 🔄 **Actualización 24/08.** La v1.5 aclaró que **no existe `informationRequestId`** en el contrato: la correlación es por invariante, como máximo una solicitud de información activa por ticket. Lo que M1 tiene que saber es lo mismo (publicar la variante, no el evento viejo), pero sin esperar ningún ID.

## M3 — Obras públicas ✅ ENCAJA

Consumen los tres que les mandamos y nos publican `workOrderCompleted`. **Aceptaron `treeRiskDetected`.**

- ✅ Borraron `urbanRiskDetected` y `urbanServiceRepairRequested` en su lista actualizada.
- ✅ `workOrderValidated` desapareció: la solicitud la cierra `workOrderCompleted` y no hay ambigüedad.
- **A definir:** `workOrderCreated` fue reemplazado por `workOrderScheduled`. "Creada" y "programada" no son lo mismo: hay que confirmar si sale al abrir la orden o recién al darle fecha.
- ✅ **Resuelto.** `sourceRequestId` ya viaja en `workOrderScheduled` y `workOrderCompleted`.

## M4 — Habilitaciones ⚠️ ENCAJA CON RESERVA

Consumen `environmentalViolationDetected` y publican `commercialFineGenerated` hacia Rentas. **Nuestros dos primeros bloqueantes con M4 quedan cerrados**: el acta llega, y llega convertida en cargo. También publican `closureOrdered`, que consumimos tal cual.

- Renombre nuestro: `commercialFineIssued` → `commercialFineGenerated`.
- Adoptamos `closureLifted` como tercera señal de cierre (§1.6). No les pedimos evento nuevo.
- Su `commercialFineGenerated` está rotulado "(rentas)": confirmar que también nos lo rutean, y que trae `sourceViolationId`.

> **🔄 Actualización 24/08, contra `Modulo_4_Eventos.docx`.** `closureOrdered` y `closureLifted` (abajo, y en §1.6/§1.8) se fusionaron en un solo evento, `closureUpdate`, con `status: ORDERED | LIFTED`. `sourceViolationId` ya viaja en `commercialFineGenerated` y `closureUpdate` — bloqueante cerrado. M4 confirmó además que reincorpora `decidedAt` y `externalRef`, que había sacado del payload. Sigue sin confirmarse el ruteo de `commercialFineGenerated` hacia nosotros. Detalle en [M6-por-modulo/M6-para-M4.md](M6-por-modulo/M6-para-M4.md).

## M7 — Tránsito ✅ ENCAJA

El cruce más limpio. Reciben los cuatro que les mandamos y publican los tres que necesitamos. Además **pidieron por su cuenta el campo de módulo de origen** en la solicitud de corte, que era exactamente nuestro pedido.

- ✅ Resuelto: M3 adoptó `streetClosureApproved` / `streetClosureRejected` / `streetClosureEnded`, que son los de M7. Los tres módulos coincidimos.
- Sigue abierto `sourceRequestId` + `sourceModule` en las tres respuestas.

> 🔄 **Actualización 25/08.** M7 publicó el documento "TPO - Desarrollo de Apps II - Modulo 7" con el payload completo. Cierra el typo (`streetClosureEnded`, ya sin la `u` de más) y el pedido de `sourceRequestId`/`sourceModule` —aunque con nombres distintos a los tentativos: `closureRequestId` + `requestingModule` (`"Obras"`/`"Ambiente"`), presentes en `streetClosureApproved` y `streetClosureRejected` pero no en `streetClosureEnded`, que solo trae `streetClosureId`. Detalle en [M6-por-modulo/M6-para-M7.md](M6-por-modulo/M6-para-M7.md). También confirmó con payload el `roadAccidentRegistered` que esperaba M3 (ver huérfanos, más abajo).

## M1 — Ciudadanos ⚪ SIN EVENTOS, COMO ESTABA PREVISTO

Coherente con lo acordado. Nuestros dos pedidos son REST —consulta de ciudadano por `citizenId` y de organización por `organizationId`— y no se ven en una lista de eventos, así que **siguen abiertos y hay que reclamarlos aparte**.

**A decidir:** M1 consume las actuaciones de todas las áreas para el expediente digital —inspecciones de M4, beneficios de M8, infracciones apeladas de M7— **menos las nuestras**. Nuestra acta de constatación es un acto administrativo formal; o confirmamos explícitamente que queda fuera del expediente, o les publicamos `environmentalViolationDetected` a ellos también.

No necesitamos `citizenDeceased`, `addressUpdated` ni `citizenBlocked`: no replicamos el registro de ciudadanos.

## M5 — Rentas ✅ CONFIRMADO SIN INTEGRACIÓN

Consumen `commercialFineGenerated` de Habilitaciones, que es como nuestra acta les llega convertida en cargo. **Ninguna acción de nuestro lado.**

## M8 — Desarrollo social ✅ CONFIRMADO SIN INTEGRACIÓN

Ninguna acción. Se confirma también que las cooperativas nos llegan como organizaciones de M1, no como beneficiarias de un programa.

## M9 — Core 🔴 AUSENTE

**No hay sección de M9 en la recopilación.** Sin la lista del Core no se puede validar nada, y es el módulo del que depende el resto.

- El claim set del JWT sigue sin definirse. Es el bloqueante principal del proyecto.
- El catálogo de barrios con `neighborhoodId` estable sigue sin exponerse.
- `notificationSent` y `notificationFailed` los consumen M8 y nosotros, y **en esta lista no los publica nadie**. Peor: M7 menciona un `notificationRequest` de M2 que nadie más declaró. Si solo M2 puede pedir notificaciones, estaríamos recibiendo acuses de mensajes que nunca pedimos: en ese caso **conviene sacar `notificationSent` de nuestra lista de consumo**.
- Sigue abierta la discusión zona operativa (nuestra) contra barrio (de ellos).

---

# Parte 3 — Huérfanos y choques en el resto de la cohorte

No nos afectan directamente, pero el ruteo del Core los va a chocar de frente. Un huérfano es un evento que alguien espera y nadie publica.

| Evento | Lo espera | Lo publica | Diagnóstico |
|---|---|---|---|
| `paymentRegistered`, `debtSettled` | M4, M7 | nadie | 🔴 M5 los publica como `paymentRecorded` y `debtCancelled`. Rompe el cierre financiero de infracciones y habilitaciones |
| `caseFileResolved` | M3, M7 | nadie | 🔴 M1 no publica ningún evento de expediente |
| `registeredCitizen`, `registeredOrganization` | M5 | nadie | M1 los publica invertidos: `citizenRegistered`, `organizationRegistered` |
| `enablingFeeGenerated`, `enablingSuspended` | M5 | nadie | Alias viejos de `permitFeeGenerated` y `permitSuspended`. M5 ya consume el primero por duplicado bajo los dos nombres |
| `licenseRequestInitiated`, `licenseApproved` | M1 | nadie | M4 usa `permitApplicationStarted` y `permitApproved`. M1 tiene ambos vocabularios en su misma lista |
| `constructionApproved` | M1 | nadie | M3 lo llama `publicWorksProjectApproved` |
| `workScheduled`, `workFinished` | M7 | nadie | M3 ya los publica hacia M7 como `workOrderScheduled` y `workOrderCompleted`; falta que M7 los renombre |
| `roadAccidentRegistered` | M3 | ~~nadie~~ **M7** | ✅ **Resuelto (25/08).** M7 confirmó el payload completo en su documento de referencia. Antes M3 lo llamaba `trafficIncidentRegistered`: cambió el nombre, no el problema, y ahora el evento existe |
| `ticketRouted`, `ticketEscalated`, `ticketResolved`, `ticketClosed`, `ticketReopened`, `ticketCancelled`, `ticketInfoProvided` | M1, M3, M5, M7, M8 | nadie | **Ya tiene solución escrita:** los siete existen como `updateType` de `ticketUpdated` en el contrato de M2 (v1.5). Hay que suscribirse y ramificar |
| `publicWorksProjectApproved`, `publicWorksProjectCompleted` | nadie | M3 | Los dirige a M1, que consume `constructionApproved`. Eran doce, quedaron dos |
| `socialProgramCreated`, `socialVisitScheduled`, `municipalHealthAppointmentGranted`, resto de M8 hacia M2 | nadie | M8 | 🔴 Mismo problema que el nuestro: M2 no consume nada de M8 |
| `workOrderScheduled`, `workOrderAssigned`, `workOrderStarted`, resto de M3 hacia M2 | nadie | M3 | 🔴 Ídem |
| `additionalInfoRequired` | nadie | M1 | El contrato de M2 (v1.5) lo reemplazó por `updateTicketStatus / INFORMATION_REQUIRED` |
| `representationExpired`, `citizenBlocked`, `citizenDeceased` | nadie | M1 | Sin consumidor declarado. Puede ser correcto, pero conviene confirmarlo |
| `eventRejected` | nadie | todos | Todos lo publican y nadie lo consume. Debería consumirlo M9 |

## Riesgo técnico en el bloque común

Todos los módulos publicamos `eventProcessingFailed` **y** todos lo consumimos. Si el procesamiento de un `eventProcessingFailed` falla, se publica otro: una tormenta de eventos técnicos que se retroalimenta y que ninguna DLQ frena, porque el problema no es el reintento sino el ciclo.

**Propuesta:** los eventos técnicos —`eventProcessingFailed` y `eventRejected`— van solo hacia M9, que tiene el tablero de DLQ, y quedan excluidos de la ruta que dispara una publicación de falla. Ningún módulo de negocio necesita enterarse de que otro no pudo procesar algo; necesita que se lo reenvíen.

---

# Parte 4 — Qué llevamos a la reunión

Ordenado por lo que nos bloquea, no por módulo.

| Para | Pedido |
|---|---|
| **M2** ✅ | **Resuelto por su contrato, actualizado a v1.5 (24/08).** `ticketUpdated / ROUTED` ya dice a qué módulo va (`responsibleAreaId`) y trae `location` estructurada con `neighborhoodId`. Era la entrada única de todo nuestro flujo de reclamos |
| **M2** ✅ | **Resuelto por su contrato (v1.5):** `updateTicketStatus` es un evento único con `updateType`, la cancelación llega como `ticketUpdated / CANCELLED`. Adoptamos su payload tal cual |
| **M2** 🔴 | **Nuevo (24/08): la fecha agendada del servicio no tiene campo.** El `progress` común de la v1.5 es un `Int` (porcentaje), no una fecha, y no hay `details` definido para `STARTED`/`PROGRESS` |
| **M9** 🔴 | **Presentar la lista del Core, el claim set del JWT y el catálogo de barrios.** Nada se rutea ni se autentica sin esto, y es lo único que no avanzó en esta ronda |
| **M4** | **Confirmar que nos rutean `commercialFineGenerated`,** que hoy está rotulado solo hacia Rentas. Les avisamos además que adoptamos `closureLifted` (hoy `closureUpdate / LIFTED`) como señal de cierre y que no les pedimos ningún evento nuevo |
| **M3 · M4 · M7** ✅ M3 · ✅ M4 · ✅ M7 | **Devolver el identificador de origen.** `sourceRequestId` en `workOrderCompleted` y en las tres de corte; `sourceViolationId` en `commercialFineGenerated` y `closureOrdered` — **los tres ya lo devuelven.** M3 confirmó `sourceRequestId` en `workOrderScheduled` y `workOrderCompleted`; M4 confirmó `sourceViolationId` en `commercialFineGenerated` y en el evento fusionado `closureUpdate` (24/08); M7 confirmó el 25/08, como `closureRequestId` + `requestingModule` en `streetClosureApproved`/`Rejected` — no en `streetClosureEnded`, que solo trae `streetClosureId` |
| **M3** | ✅ Lista actualizada: borraron los dos nombres viejos y `workOrderValidated`. **Queda definir cuándo se dispara `workOrderScheduled`** |
| **Cohorte** | **Fijar una convención de escritura de nombres de evento.** camelCase, que es lo que usa toda la recopilación. Nuestros documentos están en PascalCase y los vamos a corregir |
| **Cohorte** | **Fijar el vocabulario de corte de calle en los nombres de M7:** `streetClosureApproved` / `streetClosureRejected` / `streetClosureEnded` |
| **Cohorte** | **Repasar la tabla de huérfanos.** El más caro es el par `paymentRegistered` / `debtSettled`, que rompe el cierre financiero de M4 y M7 con Rentas |
| **M1** | **Confirmar las dos consultas REST, y decidir si el acta ambiental va al expediente digital** |

---

# Parte 5 — Trabajo interno de M6

Lo que cambiamos de nuestro lado, independientemente de la reunión.

| # | Cambio | Alcance | Cuándo |
|---|---|---|---|
| 1 | ✅ **Hecho.** `complaint` → `ticket` en eventos, payloads, entidades y enum | 413 reemplazos sobre alcance, 7 fichas, diagrama y recopilación | — |
| 2 | ✅ **Hecho.** PascalCase → camelCase en todos los nombres de evento | Ídem | — |
| 3 | ✅ **Hecho.** Corregidos los 6 typos de `Eventos.txt` | Sección M6 de la recopilación | — |
| 4 | ✅ **Hecho.** `commercialFineIssued` → `commercialFineGenerated` | 1 evento consumido | — |
| 5 | ✅ **Hecho.** `violationDismissed` → `closureLifted`, adoptado como señal de cierre | Recopilación + alcance + fichas | — |
| 6 | Agregar los 4 eventos de proyección de ticket | Nuevo publisher delgado | Tras confirmar con M2 |
| 7 | Consumir `workOrderScheduled` de M3 | 1 evento consumido nuevo | Tras confirmar cuándo se dispara |
| 8 | Evaluar quitar `notificationSent` de lo consumido | 1 evento consumido | Tras la respuesta de M9 |
| 9 | ✅ Resuelto: la baja llega como `ticketUpdated / CANCELLED` | — | Cerrado |
| 10 | ✅ **Hecho (24/08).** Adaptamos el consumo de `closureOrdered`/`closureLifted` al evento fusionado `closureUpdate` (`status: ORDERED | LIFTED`) de M4 | 1 evento consumido, renombrado | — |
| 11 | **Nuevo (24/08).** M2 publicó la v1.5: dejar de persistir `publicId`/`ticketVersion`, partir el `message` que mandábamos en `publicMessage`/`internalMessage`, y renombrar `updatedAt` a `statusChangedAt` en el publisher de `updateTicketStatus` | 1 evento publicado, payload | Antes de implementar el publisher |
| 12 | **Nuevo (25/08).** M7 publicó el payload real de `streetClosureApproved`/`Rejected`/`Ended`: usar los nombres reales (`closureRequestId`, `requestingModule`, `startDate`/`endDate`) en vez del diseño tentativo, y persistir `streetClosureId` para poder correlacionar `streetClosureEnded`, que no trae el origen | 3 eventos consumidos, payload | Antes de implementar el consumer |
| 13 | ✅ **Hecho (30/08).** M7 actualizó `streetClosureEnded`: ya trae `closureRequestId`, cierra la asimetría del ítem 12. Además propuso unificar `streetClosureRequested` con el payload de M3 y lo aceptamos: renombrar `requestId→closureRequestId`, `streets[]→affectedSections`, `from`/`to`→`requestedFrom`/`requestedTo` | 1 evento consumido (payload) + 1 publicado (rename) | Antes de implementar publisher/consumer |

Los PDF de `fuentes/` y de `M6-por-modulo/` quedaron **desactualizados**: hay que reimprimirlos desde los HTML ya corregidos.

---

# Parte 6 — Decisiones de diseño y contingencias

## 6.1 Decisiones que tenemos que tomar nosotros

**El contrato publicado quedó en 8 eventos, todos con consumidor.** Los que consumen M2, M3, M4 y M7 siguen con la misma forma. Los siete que dirigíamos solo a M2 salieron del contrato cuando quedó claro que `updateTicketStatus` es el único canal: los hechos siguen en nuestro modelo y son los que lo disparan, pero publicarlos sin suscriptor era schema, publisher, test y documentación para nadie.

**La proyección solo aplica cuando hay ticket.** Un servicio con `origin = PLANNED` —la recolección de todos los martes— no tiene `ticketId` y no proyecta nada. La regla es: proyectamos si y solo si el `Service` o el `EnvironmentalReport` tiene `ticketId`. Sin esta regla, M2 recibe eventos de tickets que no existen.

**Un hecho, dos eventos, un solo efecto.** Cuando cerramos un servicio nacido de un reclamo publicamos `urbanServiceCompleted` **y** `ticketCompleted`. Como M2 solo consume el segundo, no hay doble efecto — pero hay que dejarlo asentado, porque la regla 1 del enunciado exige que un evento ya procesado no genere efectos duplicados y esto se parece a una violación sin serlo.

**Versionado.** Renombrar `complaintId` a `ticketId` después de la primera entrega es un cambio incompatible de contrato, y M9 es dueño del catálogo de versiones. Hacerlo antes de la entrega evita una migración de datos y una versión nueva de ocho contratos.

## 6.2 Contingencia si M2 no resuelve

El riesgo real no es que M2 diga que no: es que la reunión pase y el evento de derivación siga sin aparecer. **Nuestro módulo tiene una segunda entrada que no depende de nadie: la detección de oficio.** El inspector detecta la infracción, el supervisor releva el árbol, el operario reporta el contenedor desbordado.

Consecuencia práctica: **la primera entrega se puede demostrar entera por el camino de oficio.** Programación, ejecución, resultado por zona, censo de arbolado, acta y derivación a M4. No queda bloqueada. Lo que queda afuera es el circuito reclamo → servicio → vecino, que es de integración y corresponde a la segunda entrega.

Conviene decirlo así en la reunión: no es un ultimátum, es que sabemos cuál es nuestro plan B y ellos deberían saber que el suyo depende de nosotros más que al revés.

## 6.3 El hueco que deja `closureLifted`

Decidido que no le pedimos a M4 un evento de desestimación (§1.6), el caso "M4 decide que no corresponde castigo" no genera ningún evento. Lo cubre lo que ya estaba en el alcance: **cierre por vencimiento de un plazo configurable**, asentado como `CLOSED` sin `SanctionOutcome`.

Es menos preciso que un evento —una desestimación y una demora de M4 se ven igual— pero evita el expediente eterno y, sobre todo, **no depende de que otro grupo agregue nada.** Ese es el argumento a favor: una dependencia menos.

## 6.4 Lo que conviene pedirle a M9 para que esto no se repita

El catálogo de eventos documentado, con nombre exacto, módulo productor y consumidores registrados, es una funcionalidad mínima que el enunciado ya les asigna. **Si existe y es la fuente de verdad, ninguno de los 17 huérfanos de la Parte 3 habría llegado hasta acá.** Vale la pena pedirlo como primer entregable del Core, antes que el ruteo.

## 6.5 Orden sugerido

| Momento | Qué |
|---|---|
| **Antes de la reunión** | Typos, `commercialFineGenerated`, sacar la equivalencia falsa. Decidir internamente `ticket` y camelCase |
| **En la reunión** | Los cuatro bloqueantes: derivación de M2, protocolo de vuelta de M2, lista de M9, desestimación de M4. Convención de escritura y vocabulario de corte |
| **Después de la reunión** | Renombre completo `complaint`→`ticket` en esquema y contratos. Proyección de ticket. Los tres "evaluar" |
| **Sin depender de nada** | Todo el camino de oficio, que es lo que se demuestra en la primera entrega |
