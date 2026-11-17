# Documentación funcional. Módulo 6: Ambiente, Higiene y Servicios Urbanos

> Versión 1.0 · 17/11/2026 · Grupo 04 · Módulo 6

Describe qué hace el sistema, quién lo hace, con qué reglas y qué responde ante un error. Complementa el [BRD](BRD.md).

## 1. Introducción y glosario

### 1.1 Glosario

| Término | Significado en M6 |
|---|---|
| Zona operativa (`Zone`) | Agrupación propia de barrios; hoy una por barrio. No es la zona de M9 |
| Comuna | Agrupación administrativa de M9 (15); agrupa zonas |
| Recorrido (`Route`) | Secuencia ordenada de zonas (paradas) |
| Servicio (`Service`) | Unidad de trabajo programable: tipo, fecha, cuadrilla, estado |
| Modo `ROUTE` | Servicio sobre un recorrido; un resultado por zona |
| Modo `POINT` | Servicio sobre un bien o ubicación; un único resultado |
| Frecuencia | Regla semanal de programación de un recorrido; no genera servicios |
| Cuadrilla (`Crew`) | Equipo con líder e integrantes que ejecuta servicios |
| Resultado de zona (`ZoneResult`) | Resultado de la atención de una zona dentro de un servicio |
| Evidencia | Archivo adjunto (foto o documento) de un servicio, zona, inspección o contenedor |
| Ticket | Reclamo del vecino en M2, dueño del registro |
| Expediente (`EnvironmentalReport`) | La denuncia ambiental tal como la tramita M6 |
| Inspección | Visita del inspector; se ejecuta como un servicio `POINT` |
| Acta (`ViolationNotice`) | Constatación formal de una infracción; inmutable |
| Sanción (`SanctionOutcome`) | Resolución de M4 espejada en M6 |
| Outbox / Inbox | Tablas para enviar y recibir eventos sin pérdida ni duplicado |
| Oficina / Campo | Lados excluyentes de los roles: programa y decide / ejecuta y verifica |
| Baja lógica | `active = false`; el registro sigue existiendo |

## 2. Visión general funcional

### 2.1 Mapa de capacidades

| Cap. | Capacidad | Actor principal | Capítulo |
|---|---|---|---|
| C1 | Servicios urbanos, frecuencias y ejecución | Oficina de Operaciones, Cuadrilla | 4.1 |
| C2 | Contenedores, puntos verdes y evidencia | Oficina, Cuadrilla | 4.2 |
| C3 | Arbolado, podas y espacios verdes | Oficina, Cuadrilla | 4.3 |
| C4 | Control ambiental: expedientes, inspecciones, actas | Oficina Ambiental, Inspector | 4.4 |
| C5 | Denuncias y seguimiento del vecino | Vecino, Oficina Ambiental | 4.5 |
| C6 | Cuadrillas y asignación de zonas | Admin | 4.6 |
| C7 | Indicadores y tableros | Todos los roles | 4.7 |
| C8 | Auditoría | Admin, Auditor | 4.8 |
| C9 | Derivaciones: reparaciones y cortes de calle | Oficina, Admin | 4.9 |

## 3. Roles y permisos

El rol sale del JWT que emite M1 (ADR-004), con un solo rol por usuario y sin área. M6 lo adapta (ADR-008): los roles efectivos son los que asigna un `M6_ADMIN`, dentro de lo que el rol de M1 permite. Se calculan en cada request, así que un cambio rige de inmediato. `GET /me` los devuelve junto con las cuadrillas propias.

### 3.1 Roles

| Rol | Lado | Rol de M1 requerido |
|---|---|---|
| `M6_ADMIN` | Oficina | `RESPONSABLE_AREA` |
| `M6_OFICINA_OPERACIONES` | Oficina | `ADMINISTRATIVO` o `RESPONSABLE_AREA` |
| `M6_OFICINA_AMBIENTAL` | Oficina | `ADMINISTRATIVO` o `RESPONSABLE_AREA` |
| `M6_CAMPO_CUADRILLA` | Campo | `ADMINISTRATIVO` o `RESPONSABLE_AREA` |
| `M6_CAMPO_INSPECTOR` | Campo | `ADMINISTRATIVO` o `RESPONSABLE_AREA` |
| `M6_AUDITOR` | Lectura | `AUDITOR` |

Reglas: Oficina y Campo no se combinan (400); los dos de Campo juntos o `M6_AUDITOR` con cualquiera sí. No se puede quitar el último `M6_ADMIN` (409). Un token de ciudadano recibe 403 en todo endpoint no público. Un rol de M1 desconocido no autoriza nada.

### 3.2 Matriz rol × capacidad

Leyenda: E escribe, L lee y — indica sin acceso. Adm = `M6_ADMIN`, Ope = Operaciones, Amb = Ambiental, Cua = Cuadrilla, Ins = Inspector, Aud = Auditor.

| Capacidad | Adm | Ope | Amb | Cua | Ins | Aud |
|---|---|---|---|---|---|---|
| Catálogos (zonas, recorridos, tipos, frecuencias, vehículos, sitios) | E | L | L | L | L | L |
| Cuadrillas y miembros | E | L | L | L | L | L |
| Asignar cuadrilla a zona | E | E | L | L | L | L |
| Programar, asignar, reprogramar y cancelar servicios | E | E | L | L | L | L |
| Iniciar, suspender, reanudar y cerrar servicios | — | — | — | E | — | — |
| Resultados de zona, residuos y avisos de demora | — | — | — | E | — | — |
| Evidencia: subir | — | — | — | E | E | — |
| Evidencia: leer | L | L | L | L | L | L |
| Contenedores: alta, edición, reparación, reubicación, retiro | E | E | L | L | L | L |
| Contenedores: reportar desborde y daño, vaciar | — | — | — | E | — | — |
| Árboles e intervenciones | E | E | L | L | L | L |
| Relevamientos de arbolado | — | — | — | E | — | — |
| Espacios verdes y puntos verdes | E | E | L | L | L | L |
| Abrir expediente | E | — | E | — | E | — |
| Tramitar expediente: tomar, derivar, desestimar, cerrar, pedir información | E | — | E | — | — | — |
| Programar inspección y emitir acta | E | — | E | — | — | — |
| Cerrar inspección | — | — | — | — | E | — |
| Leer acta | L | — | L | — | L | L |
| Historial del expediente | L | — | L | — | — | L |
| Pedir reparación o corte de calle | E | E | L | L | L | L |
| Iniciar y cerrar reparación; aprobar, rechazar o terminar corte | E | — | — | — | — | — |
| Indicadores | L | L | L | L | L | L |
| Auditoría (`GET /audit`) | L | — | — | — | — | L |
| Eventos: consultar outbox e inbox | L | — | — | — | — | L |
| Eventos: reintentar, inyectar | E | — | — | — | — | — |
| Roles (`/role-assignments`) | E | — | — | — | — | — |

Nota sobre la extracción de arbolado: los endpoints `authorize` y `reject` admiten Admin y Operaciones, pero para una extracción (`REMOVAL`) solo decide un `M6_ADMIN` (403 `ROLE_REQUIRED` para Operaciones).

### 3.3 Pertenencia de Campo

Tener el rol de Campo no alcanza: hay que ser parte del objeto. Si no, 403 con `code: NOT_ASSIGNED`, que se evalúa después del 404 y antes de cualquier regla de estado.

| Rol | Endpoints | Pertenece si |
|---|---|---|
| Cuadrilla | `start`, `suspend`, `resume`, `complete`, `zone-results`, `collection-records`, `delay-notices` | Es líder o integrante de la cuadrilla del servicio |
| Inspector | `POST /environmental-inspections/:id/complete` | Es el inspector asignado; sin asignado, cualquiera |
| Campo | `POST` y `GET /evidence` | Según el dueño: servicio y zona, la cuadrilla; inspección, el inspector asignado |

Campo sigue viendo todos los listados; la pertenencia es solo de ejecución. Oficina no tiene esta restricción.

### 3.4 Endpoints públicos

Sin token: `GET /health`, `GET /health/ready`, `GET /public/reports/:ticketId`, `GET /public/services`, `GET /public/zones`, `GET /public/green-points`. Cualquier otro endpoint sin token da 401.

## 4. Capacidades funcionales

En las tablas de transición, «Sistema» indica que la transición la dispara un evento o un barrido, sin intervención de una persona. Una transición inválida devuelve 409 con el mensaje «No se puede pasar de 'X' a 'Y'. Transiciones válidas desde 'X': [...]» (verificado en `ConflictException` de los servicios de contenedores, expedientes y servicios; el detalle general está en la sección 7).

### 4.1 Servicios urbanos, frecuencias y ejecución

**Propósito.** Planificar y ejecutar servicios de recolección, limpieza viaria, residuos, riego y corte, con trazabilidad por zona.

**Actores.** `M6_OFICINA_OPERACIONES` y `M6_ADMIN` programan; `M6_CAMPO_CUADRILLA` ejecuta; M2, M7 y la alerta climática pueden reprogramar.

**Precondiciones.**

- Existen tipo de servicio, y recorrido con paradas (modo `ROUTE`) o bien/zona (modo `POINT`).
- La cuadrilla tiene líder o integrantes con ids numéricos de M1.
- El tipo que exige vehículo tiene uno asignado antes de iniciar.

**Flujo principal.**

1. Oficina crea el servicio (`POST /services`) con fecha, ventana y cuadrilla. Nace `SCHEDULED`; el modo se copia del tipo y las zonas del recorrido se copian como instantánea.
2. Oficina consulta los choques antes de enviar (`GET /services/:id/assignment-conflicts`) y asigna cuadrilla (`POST /services/:id/assign-crew`).
3. El día programado, el líder inicia (`POST /services/:id/start`).
4. La cuadrilla registra resultado por zona (`POST /services/:id/zone-results`), residuos (`POST /services/:id/collection-records`) y evidencia (`POST /evidence`).
5. El líder cierra (`POST /services/:id/complete`). El sistema calcula `COMPLETED` o `PARTIALLY_COMPLETED`.
6. Si nació de un reclamo, M2 recibe el avance en cada paso relevante.

**Flujos alternativos.**

- Suspender (`suspend`, con motivo y nota opcional por separado) y reanudar (`resume`).
- Avisar demora (`POST /services/:id/delay-notices`): `START` solo antes de arrancar, `DURATION` solo en curso; el aviso nuevo reemplaza al vigente.
- Reprogramar (`reschedule`) y confirmar fecha nueva (`confirm-reschedule`), o cancelar (`cancel`), siempre con motivo.
- Servicio `POINT` sobre un bien (`targetType` y `targetId`) o una zona suelta.
- Asignar sobre un choque o un aviso de encaje con `overrideNote` de 10 a 500 caracteres.
- Alerta climática `HIGH` o `CRITICAL` o corte rechazado por M7: el servicio pasa a `RESCHEDULED` solo.
- Editar (`PATCH /services/:id`) solo en `SCHEDULED` o `RESCHEDULED`.

**Flujos de error.**

| Situación | Respuesta |
|---|---|
| Cuadrilla o vehículo ocupados sin `overrideNote` | 409 nombrando los servicios en conflicto |
| Cuadrilla de otra zona o especialidad sin `overrideNote` | 409 pidiendo la nota |
| Tipo `ROUTE` sin `routeId`, recorrido sin paradas, `POINT` sin objetivo, ventana invertida | 400 |
| Campo ajeno a la cuadrilla, o servicio sin cuadrilla | 403 `NOT_ASSIGNED` |
| Iniciar un servicio que exige vehículo y no lo tiene | 409 |
| Cerrar sin resultado de alguna zona o con zona repetida | 409 |
| Zona no atendida sin motivo, o atendida con motivo | 400 |
| Cancelar uno en curso | 409 |
| Fecha de confirmación anterior a hoy o `note` en cancelar o reprogramar | 400 |
| `status` u otro campo fuera del DTO en `PATCH` | 400 |
| Editar un servicio fuera de `SCHEDULED` o `RESCHEDULED` | 409 |
| Frecuencia superpuesta | 409; tipo que no es `ROUTE`: 400 |

**Reglas de validación.**

- Fechas en el día argentino (UTC-3); la confirmación con la fecha de hoy es válida.
- Franja horaria ausente equivale a todo el día.
- `overrideNote` se guarda solo si hubo choque o aviso; queda registrado quién y cuándo.
- `suspend`: nota de hasta 500 caracteres; solo espacios se guarda como `null`.
- `notes` del servicio hasta 2000 caracteres.
- Cada zona informada lleva motivo (`NotServicedReason`) si no es `SERVICED`.
- Si falla la escritura del contenedor, cerrar el servicio que lo atiende revierte todo.

**Estados y transiciones.**

| Estado actual | Acción | Estado nuevo | Rol |
|---|---|---|---|
| (alta) | `POST /services` | `SCHEDULED` | Adm, Ope |
| `SCHEDULED` | `start` | `IN_PROGRESS` | Cua |
| `SCHEDULED` | `reschedule` | `RESCHEDULED` | Adm, Ope |
| `SCHEDULED` | `cancel` | `CANCELLED` | Adm, Ope |
| `SCHEDULED` | Alerta climática o corte rechazado | `RESCHEDULED` | Sistema |
| `RESCHEDULED` | `confirm-reschedule` | `SCHEDULED` | Adm, Ope |
| `RESCHEDULED` | `cancel` | `CANCELLED` | Adm, Ope |
| `IN_PROGRESS` | `suspend` | `SUSPENDED` | Cua |
| `IN_PROGRESS` | `complete`, todo atendido | `COMPLETED` | Cua |
| `IN_PROGRESS` | `complete`, alguna zona `PARTIAL` o `NOT_SERVICED` | `PARTIALLY_COMPLETED` | Cua |
| `SUSPENDED` | `resume` | `IN_PROGRESS` | Cua |
| `SUSPENDED` | `cancel` | `CANCELLED` | Adm, Ope |
| `COMPLETED`, `PARTIALLY_COMPLETED`, `CANCELLED` | cualquiera | Ninguno: 409 | — |

Fuente de la tabla: `VALID_TRANSITIONS` de `services.service.ts`. Un `ticketUpdated` con `CANCELLED` también cancela los servicios que nacieron de ese ticket, solo si admiten la transición.

**Eventos.**

| Dirección | Evento | Cuándo |
|---|---|---|
| Publica a M2 | `updateTicketStatus` | Servicio con `ticketId`: programación, reprogramación, demora, cierre, cancelación |
| Publica a M7 | `streetClosureRequested` | Solo si se pide el corte aparte (capítulo 4.9) |
| Consume de M2 | `ticketUpdated` (`CANCELLED`) | Cancela los servicios programados del reclamo |
| Consume de M7 | `streetClosureRejected`, `streetClosureApproved`, `streetClosureEnded` | Reprograma, habilita o libera el servicio dependiente |
| Consume (simulado) | `weatherAlertIssued` | Reprogramación masiva por zona |

`urbanServiceScheduled` ya no se emite. Un servicio sin `ticketId` no genera nada hacia M2.

**Frecuencias y tipos.** `POST /service-frequencies` guarda una regla semanal (días, turno, vigencia) de un recorrido y tipo `ROUTE`. No genera servicios: cada servicio se crea con `POST /services`. Los tipos (`/service-types`) llevan categoría, modo y `requiresVehicle`.


### 4.2 Contenedores, puntos verdes y evidencia

**Propósito.** Atender los contenedores desbordados o dañados y respaldar el trabajo con evidencia.

**Actores.** `M6_CAMPO_CUADRILLA` reporta y vacía; `M6_OFICINA_OPERACIONES` y `M6_ADMIN` gestionan; los seis roles consultan.

**Precondiciones.** El contenedor existe con código único, tipo, ubicación, capacidad y zona.

**Flujo principal.**

1. La cuadrilla reporta un desborde (`report-overflow`) de un contenedor `ACTIVE`.
2. Se programa un vaciado como servicio `POINT` con `targetType = CONTAINER`; al cerrarlo, el contenedor vuelve a `ACTIVE`. La cuadrilla también puede registrar el vaciado (`empty`).
3. Ante un daño, la cuadrilla reporta (`report-damage`) con tipo, severidad, `requiresPublicWorks` y observaciones internas.
4. Se publica `containerDamaged` a M3 en la misma transacción.
5. Oficina inicia (`start-repair`) y completa (`complete-repair`) la reparación; los datos del daño se limpian.

**Flujos alternativos.**

- Reubicar: `relocate` y `confirm-relocation` con la ubicación nueva.
- Retirar (`remove`) un contenedor `DAMAGED` que no admite reparación.
- Vaciado o lavado preventivo con el contenedor `ACTIVE`: el servicio se cierra y el contenedor no cambia.
- Cierre `PARTIALLY_COMPLETED` del servicio: el contenedor no transiciona.
- Consultar el historial de estados (`GET /containers/:id/history`), del más reciente al más antiguo.
- Puntos verdes (`/green-points`): alta, edición y baja lógica; `wasteTypes` reemplaza el conjunto completo.

**Flujos de error.**

| Situación | Respuesta |
|---|---|
| Acción no admitida en el estado actual | 409 con las transiciones válidas |
| Código de contenedor repetido | 409 |
| Contenedor inexistente | 404 |
| Oficina reporta daño, desborde o vacía | 403 `ROLE_REQUIRED` |
| `If-Match` con ETag viejo | 412 |
| Evidencia con contenido distinto al tipo declarado, tipo no permitido o sin `Idempotency-Key` | 400 |
| Evidencia de más de 10 MB | 413 |
| Evidencia sin almacenamiento configurado | 503 |
| Evidencia de dueño ajeno | 403 `NOT_ASSIGNED`; dueño inexistente: 404 |
| Falla de escritura del historial | La acción entera falla y no se publica el evento |

**Reglas de validación.**

- Los campos de daño se llenan solo con `DAMAGED` y se limpian al volver a `ACTIVE`.
- `observations` hasta 500 caracteres; es interna y no viaja a M3.
- No hay pertenencia: cualquier cuadrilla reporta o vacía cualquier contenedor.
- Cada alta y transición escribe historial y auditoría en la misma transacción.
- Evidencia: JPEG, PNG, WebP o PDF; hasta 10 MB; firma de bytes verificada; las imágenes se guardan sin EXIF ni GPS.
- Tipos de dueño de evidencia: `SERVICE`, `ZONE_RESULT`, `INSPECTION`, `CONTAINER`.

**Estados y transiciones.**

| Estado actual | Acción | Estado nuevo | Rol |
|---|---|---|---|
| `ACTIVE` | `report-overflow` | `OVERFLOWED` | Cua |
| `ACTIVE` | `report-damage` | `DAMAGED` | Cua |
| `ACTIVE` | `relocate` | `RELOCATING` | Adm, Ope |
| `OVERFLOWED` | `empty` o cierre del servicio de vaciado | `ACTIVE` | Cua o Sistema |
| `DAMAGED` | `start-repair` | `UNDER_REPAIR` | Adm, Ope |
| `DAMAGED` | `remove` | `REMOVED` | Adm, Ope |
| `UNDER_REPAIR` | `complete-repair` o cierre del servicio | `ACTIVE` | Adm, Ope o Sistema |
| `RELOCATING` | `confirm-relocation` o cierre del servicio con ubicación | `ACTIVE` | Adm, Ope o Sistema |
| `REMOVED` | cualquiera | Ninguno: 409 | — |

Fuente: `CONTAINER_TRANSITIONS` de `containers.service.ts`.

**Eventos.** Publica `containerDamaged` a M3 al pasar a `DAMAGED`. El desborde no publica nada. Con `ticketId` sale un `updateTicketStatus` a M2.


### 4.3 Arbolado, podas y espacios verdes

**Propósito.** Gestionar el riesgo del arbolado urbano con historial y las intervenciones sobre él.

**Actores.** `M6_CAMPO_CUADRILLA` carga relevamientos; `M6_OFICINA_OPERACIONES` solicita y programa; `M6_ADMIN` autoriza extracciones.

**Precondiciones.** El árbol está en el censo (`/trees`) con código de relevamiento único.

**Flujo principal.**

1. La cuadrilla carga un relevamiento (`POST /trees/:treeId/surveys`) con estado sanitario y riesgo.
2. Con riesgo `HIGH` o `CRITICAL` y `riskType`, se publica `treeRiskDetected` a M3 en la misma transacción.
3. Oficina solicita una intervención (`POST /tree-interventions`): poda de formación, poda de seguridad, extracción, plantación o tratamiento.
4. Las podas, plantaciones y tratamientos se autorizan directo (`authorize`).
5. Se asocia la intervención autorizada a un servicio `POINT` (`assign-service`) que la ejecuta.

**Flujos alternativos.**

- Extracción: `submit-for-authorization` con justificación y decisión de un `M6_ADMIN` (`authorize` o `reject`).
- Riesgo `LOW` o `MEDIUM`: se guarda sin publicar.
- Si requiere cortar la calle: se pide el corte aparte (capítulo 4.9).
- Filtrar intervenciones por prioridad (`?priority=`).
- Espacios verdes (`/green-spaces`): alta, edición y baja lógica; el riego y el corte se programan como servicios.

**Flujos de error.**

| Situación | Respuesta |
|---|---|
| Riesgo `HIGH` o `CRITICAL` sin `riskType` | 400 |
| `surveyedAt` posterior a hoy (huso Argentina) | 400 |
| Árbol inexistente | 404 |
| Asociar una intervención no `AUTHORIZED`, servicio que no es `POINT` o que ya ejecuta otra | 400, 404 o 409 |
| Autorizar una extracción en `REQUESTED` | 409 |
| Autorizar o rechazar una extracción siendo Operaciones | 403 `ROLE_REQUIRED` |
| Prioridad inválida en el filtro | 400 |
| M3 o el bus no disponibles | El relevamiento se guarda; el evento queda en el outbox |

**Reglas de validación.**

- `justification` es obligatoria para `REMOVAL`.
- Quien solicita queda en `requestedByUserId`; al autorizar, en `authorizedByUserId` y `authorizedAt`.
- Un `M6_ADMIN` puede autorizar lo que él mismo solicitó y queda registrado.
- `lat` entre -90 y 90, `lng` entre -180 y 180, hasta 7 decimales.

**Estados y transiciones (intervención).**

| Estado actual | Acción | Estado nuevo | Rol |
|---|---|---|---|
| (alta) | `POST /tree-interventions` | `REQUESTED` | Adm, Ope |
| `REQUESTED` | `submit-for-authorization` (solo `REMOVAL`) | `PENDING_AUTHORIZATION` | Adm, Ope |
| `REQUESTED` | `authorize` (poda, plantación, tratamiento) | `AUTHORIZED` | Adm, Ope |
| `PENDING_AUTHORIZATION` | `authorize` | `AUTHORIZED` | Adm |
| `PENDING_AUTHORIZATION` | `reject` | `REJECTED` | Adm |
| `AUTHORIZED` | `assign-service` | `AUTHORIZED` con `serviceId` | Adm, Ope |
| `AUTHORIZED`, `REJECTED` | cualquier transición de estado | Ninguno: 409 | — |

Fuente: `VALID_TRANSITIONS` de `tree-interventions.service.ts`. El estado terminal operativo es tener `serviceId`; a partir de ahí se sigue el servicio.

**Eventos.** Publica `treeRiskDetected` a M3. No emite nada al programar la poda (`treePruningScheduled` ya no se emite). El corte se pide con `streetClosureRequested` a M7.


### 4.4 Control ambiental: expedientes, inspecciones y actas

**Propósito.** Llevar la denuncia ambiental hasta el acta de constatación y registrar la resolución sancionatoria de M4.

**Actores.** `M6_OFICINA_AMBIENTAL` y `M6_ADMIN` tramitan; `M6_CAMPO_INSPECTOR` abre de oficio e inspecciona; M2 y M4 intervienen por evento.

**Precondiciones.**

- Un `ROUTED` de M2 dirigido a M6, o una detección de oficio.
- Para inspeccionar: una cuadrilla con servicio `POINT`.
- Para derivar el acta a M4: un `establishmentId`.

**Flujo principal.**

1. Se abre el expediente (`RECEIVED`): por `ticketUpdated ROUTED` o `POST /environmental-reports`.
2. Oficina Ambiental lo toma (`start-review`), pasa a `UNDER_REVIEW`.
3. Programa la inspección (`POST /environmental-reports/:reportId/inspections`): `INSPECTION_SCHEDULED`.
4. El inspector asignado la cierra (`POST /environmental-inspections/:id/complete`) con resultado y `nextStep`.
5. Con infracción, el expediente queda `VIOLATION_FOUND`; Oficina Ambiental emite el acta (`POST /environmental-inspections/:id/violation-notice`): `NOTICE_ISSUED`, con número correlativo por año y plazo de vencimiento.
6. Con establecimiento, se publica `environmentalViolationDetected` a M4.
7. M4 devuelve la multa o la clausura: el expediente pasa a `SANCTIONED` y, en la misma transacción, a `CLOSED`.

**Flujos alternativos.**

- Derivar a otra área (`forward`) o desestimar (`dismiss`), con motivo.
- Resultado `NO_VIOLATION`: expediente `NO_VIOLATION`. Resultado `INCONCLUSIVE`: queda `INSPECTED`.
- Acta sin `establishmentId`: se registra y no se deriva.
- M4 no responde: el expediente `NOTICE_ISSUED` se cierra al vencer `deadlineAt` (barrido horario y al arrancar).
- Cierre manual (`close`) con `reason` opcional de hasta 500 caracteres.
- `closureUpdate` de M4: `ORDERED` registra la clausura; `LIFTED` registra el levantamiento y cierra.
- Pedir información al vecino (capítulo 4.5).
- Consultar el acta (`GET .../violation-notice`, `null` si no hay) y el historial del expediente (`GET /environmental-reports/:id/history`).

**Flujos de error.**

| Situación | Respuesta |
|---|---|
| Acción que la tabla de estados no permite | 409 con las transiciones válidas |
| Inspector asignado sin `M6_CAMPO_INSPECTOR` | 400 |
| Inspector manda `ticketId` al abrir de oficio | 400 |
| Cerrar la inspección de otro inspector | 403 `NOT_ASSIGNED` (antes que el 409 de «ya cerrada») |
| Cerrar una inspección ya cerrada, segunda acta, acta sin `VIOLATION_FOUND` | 409 |
| `inspectedAt` futuro o `VIOLATION_FOUND` sin `nextStep` | 400 |
| Evento de M4 sin `sourceViolationId` válido | 400 por HTTP; el consumidor lo descarta |
| Con solicitud de información pendiente: `forward`, `dismiss`, `close` | 409 |
| Bus caído al emitir el acta | El acta se registra; el evento queda en el outbox |
| Fallo al escribir la auditoría de lectura del acta | 500 y no se entrega |

**Reglas de validación.**

- El acta es inmutable; `suggestedAction` no es vinculante.
- `checklist`, `findings`, `conclusion` e `inspectorId` nunca salen hacia M2.
- Con inspector asignado, solo él cierra o adjunta evidencia a la inspección.
- `description` hasta 2000 caracteres; puede tener datos personales y no sale por ningún evento ni por el portal.
- `deadlineAt` se calcula con `SANCTION_DEADLINE_DAYS` (30 por defecto).
- Con ticket en estado terminal en M2, no se publica el aviso.

**Estados y transiciones.**

| Estado actual | Acción | Estado nuevo | Rol |
|---|---|---|---|
| (alta) | `POST /environmental-reports` o `ROUTED` | `RECEIVED` | Adm, Amb, Ins o Sistema |
| `RECEIVED` | `start-review` | `UNDER_REVIEW` | Adm, Amb |
| `UNDER_REVIEW` | `forward` | `FORWARDED` | Adm, Amb |
| `UNDER_REVIEW` | `dismiss` | `DISMISSED` | Adm, Amb |
| `UNDER_REVIEW` | Programar inspección | `INSPECTION_SCHEDULED` | Adm, Amb |
| `INSPECTION_SCHEDULED` | Cerrar inspección | `INSPECTED`, y de ahí `NO_VIOLATION` o `VIOLATION_FOUND` | Ins |
| `VIOLATION_FOUND` | Emitir acta | `NOTICE_ISSUED` | Adm, Amb |
| `NOTICE_ISSUED` | `commercialFineGenerated` o `closureUpdate` | `SANCTIONED` y de ahí `CLOSED`, en la misma transacción | Sistema |
| `NOTICE_ISSUED` | Vence el plazo | `CLOSED` | Sistema |
| `FORWARDED`, `DISMISSED`, `NO_VIOLATION`, `SANCTIONED` | `close` | `CLOSED` | Adm, Amb |
| `FORWARDED`, `DISMISSED`, `NO_VIOLATION`, `CLOSED` | `ticketUpdated REOPENED` | `UNDER_REVIEW` | Sistema |
| `FORWARDED` | Nuevo `ROUTED` del mismo ticket | `UNDER_REVIEW` | Sistema |
| `FORWARDED` | `ROUTED` de otra área o `CANCELLED` | `CLOSED` | Sistema |
| `UNDER_REVIEW` | `ticketUpdated CANCELLED` | `DISMISSED` | Sistema |
| `SANCTIONED` | Reapertura | Ninguna: solo admite `CLOSED` | — |

Fuente: `REPORT_TRANSITIONS` de `environmental-reports.service.ts` y la tabla de `ticketUpdated`. Cualquier otra combinación devuelve 409.

**Eventos.**

| Dirección | Evento | Cuándo |
|---|---|---|
| Publica a M4 | `environmentalViolationDetected` | Al emitir el acta, solo con `establishmentId` |
| Publica a M2 | `updateTicketStatus` | Cada tramo de un expediente con `ticketId` |
| Consume de M2 | `ticketUpdated` | `ROUTED` abre; `REOPENED`, `CANCELLED`, `PRIORITY_CHANGED`, `ESCALATION_CHANGED`, `INFORMATION_PROVIDED` |
| Consume de M4 | `commercialFineGenerated`, `closureUpdate` | Registra la sanción y cierra |

`INSPECTION_SCHEDULED` e `INSPECTED` no se publican.


### 4.5 Denuncias y seguimiento del vecino por ticket

**Propósito.** Informar al vecino por el canal oficial (M2) y ofrecer una consulta pública complementaria.

**Actores.** El vecino (anónimo, sin cuenta en M6); M2; `M6_OFICINA_AMBIENTAL`.

**Precondiciones.** El expediente nació de un reclamo (tiene `ticketId`). Sin `ticketId`, M6 no publica nada a M2.

**Flujo principal.**

1. El vecino presenta el reclamo en M2; no hay alta en M6.
2. M2 lo deriva a M6 y se abre el expediente.
3. M6 publica el avance a M2 con `updateTicketStatus`: `STARTED` o `PROGRESS` al analizar o programar, `REJECTED` al desestimar, `RETURNED` si no es de nuestra área, `RESOLVED` al cerrar.
4. El vecino consulta sin login `GET /public/reports/:ticketId`: ve una de siete etapas, el tipo, la dirección y las fechas.
5. También puede ver cuándo pasa el servicio (`GET /public/services`), las zonas (`GET /public/zones`) y los puntos verdes activos (`GET /public/green-points`).

**Flujos alternativos.**

- Pedir información: con el expediente `UNDER_REVIEW` y `ticketId`, Oficina Ambiental envía `request-information` (hasta 500 caracteres, `requiredBy` opcional). Sale `INFORMATION_REQUIRED` a M2 y el expediente sigue en `UNDER_REVIEW`.
- La respuesta del vecino llega como `INFORMATION_PROVIDED` y cierra la solicitud; `citizenResponse` guarda el mensaje.
- M2 cancela el ticket por falta de respuesta: llega `CANCELLED` y se desestima el expediente en revisión.
- Reclasificación (`purpose`): se ignora.
- Programar un servicio de un reclamo informa fecha y franja como texto en `publicMessage`: `STARTED` si el ticket está en `ROUTED` o se desconoce; `PROGRESS` si ya está en curso.
- Reapertura: M2 envía `REOPENED` si el vecino rechaza la solución.

**Flujos de error.**

| Situación | Respuesta |
|---|---|
| Consulta pública con identificador correlativo `TK-…` o ticket sin expediente | 404 sin confirmar si el ticket existe en M2 |
| Más de 20 consultas por minuto al seguimiento, o 60 al resto, desde una IP | 429 |
| Pedir información sin `ticketId`, fuera de `UNDER_REVIEW`, con solicitud pendiente o ticket en estado terminal | 409 |
| `requiredBy` en el pasado | 400 |
| `ticketUpdated` que depende de un `ROUTED` aún no recibido | Falla y el Core reintenta |
| Evento atrasado respecto de uno más nuevo | No pisa el estado más nuevo |

**Reglas de validación.**

- Las siete etapas son `RECIBIDA`, `EN_ANALISIS`, `INSPECCION_PROGRAMADA`, `INSPECCIONADA`, `EN_TRAMITE_SANCIONATORIO`, `DERIVADA` y `CERRADA` (`citizen-portal.service.ts`).
- La proyección pública no incluye identidad del inspector, hallazgos, checklist ni acta.
- El mensaje a M2 nunca incluye cuadrilla ni notas internas.
- Los servicios públicos muestran por defecto los próximos 30 días, sin cancelados ni datos de cuadrilla, vehículo o notas.
- `updatedBy.id` es el `actorId` del JWT de M1, o `null`.
- No se estima SLA: el plazo con el vecino lo fija M2.

**Estados y transiciones.** Las del expediente (capítulo 4.4) y su proyección pública:

| Estado interno | Etapa pública |
|---|---|
| `RECEIVED` | `RECIBIDA` |
| `UNDER_REVIEW` | `EN_ANALISIS` |
| `INSPECTION_SCHEDULED` | `INSPECCION_PROGRAMADA` |
| `INSPECTED` | `INSPECCIONADA` |
| `VIOLATION_FOUND`, `NOTICE_ISSUED`, `SANCTIONED` | `EN_TRAMITE_SANCIONATORIO` |
| `FORWARDED` | `DERIVADA` |
| `DISMISSED`, `NO_VIOLATION`, `CLOSED` | `CERRADA` |



### 4.6 Cuadrillas y asignación de zonas

**Propósito.** Mantener los equipos que ejecutan servicios, validar su identidad contra M1 y ubicarlos en zonas.

**Actores.** `M6_ADMIN` administra cuadrillas; Admin y Operaciones reasignan zona; los seis roles consultan.

**Precondiciones.** Los ids de líder e integrantes son ids numéricos de M1.

**Flujo principal.**

1. El Admin crea la cuadrilla (`POST /crews`) con tipo (`MUNICIPAL`, `COOPERATIVE` o `CONTRACTOR`), especialidad, turno y líder.
2. El sistema valida el líder contra M1 y completa el nombre si no vino.
3. El Admin suma integrantes (`POST /crews/:id/members`); se validan los nuevos.
4. Admin u Operaciones reubica la cuadrilla en una zona por período (`POST /crews/:id/zone-assignments`).
5. Al programar, el sistema compara la zona efectiva y la especialidad.

**Flujos alternativos.**

- Quitar un integrante (`DELETE /crews/:id/members/:userId`), sin validar formato para poder limpiar ids heredados.
- Sin `validTo`, la asignación queda abierta.
- Baja lógica de cuadrilla (`DELETE /crews/:id`), vehículo, zona, recorrido, tipo y sitio.
- Asignar roles (`PUT /role-assignments/:userId`) para que la persona opere (capítulo 3).

**Flujos de error.**

| Situación | Respuesta |
|---|---|
| Id de personal no numérico | 400 |
| Líder o integrante inexistente o inactivo en M1 | 422 con todos los fallidos juntos |
| M1 no responde (4 s) | 503 y no se guarda nada |
| Patente o código repetido | 409 |
| Período de asignación que se pisa | 409 |
| `validTo` anterior a `validFrom`, o zona de baja | 400 |
| Quitar el último `M6_ADMIN`, o mezclar Oficina y Campo | 409 o 400 |

**Reglas de validación.**

- Ids de personal: solo dígitos, hasta 19, sin ceros a la izquierda (`007` equivale a `7`).
- Sin `M1_BASE_URL` configurada, la validación contra M1 se omite con un aviso y la cuadrilla se guarda.
- Los nombres de personal son una copia cargada a mano y los ve cualquier rol de M6.
- Las fechas de asignación van sin hora; el actor sale del token.




### 4.7 Indicadores y tableros

**Propósito.** Medir la operación con cuatro familias de indicadores.

**Actores.** Los seis roles, solo lectura.

**Precondiciones.** Servicios con resultados por zona, historial de contenedores y expedientes.

**Flujo principal.** El usuario consulta con filtros de período, zona y tipo:

| Familia | Endpoint | Qué mide |
|---|---|---|
| Cobertura | `GET /indicators/coverage` | Objetivos atendidos sobre programados |
| Cumplimiento | `GET /indicators/compliance` | Servicios en término, demorados, zonas no atendidas con motivo |
| Incidencias | `GET /indicators/incidents` | Contenedores desbordados y dañados, árboles por riesgo, denuncias por tipo y estado, tiempo de resolución |
| Residuos | `GET /indicators/waste` | Kilos y metros cúbicos por tipo y destino, y porcentaje reciclado |

**Flujos alternativos.**

- Comparar con el período anterior de igual duración (`compare=previous`) y agrupar por intervalo (`bucket`).
- Exportar el detalle de Cobertura como CSV desde la pantalla de Tableros.

**Flujos de error.**

| Situación | Respuesta |
|---|---|
| `from` posterior a `to`, o serie de más de 90 puntos | 400 antes de consultar la base |
| Sin base de cálculo | El indicador es `null`, no 0 |

**Reglas de validación.**

- El objetivo es el par (servicio, zona), no el servicio.
- Lo programado a futuro va aparte y no cuenta como pendiente.
- Desbordes y daños se cuentan por transición de estado con origen no nulo; `trackingSince` indica desde cuándo hay datos.
- Reclamo abierto vencido: más de 5 días hábiles (`INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS`).




### 4.8 Auditoría

**Propósito.** Registrar quién hizo qué y cuándo sobre los datos de dominio.

**Actores.** `M6_ADMIN` y `M6_AUDITOR` consultan; la escribe el sistema.

**Precondiciones.** Ninguna: se escribe sola con cada cambio.

**Flujo principal.**

1. Cada alta o transición de contenedores, expedientes, inspecciones, actas, derivaciones, intervenciones, servicios y catálogos deja una fila con actor, roles, estado de origen y destino, y motivo.
2. La fila se escribe en la misma transacción que el cambio.
3. El Admin o el Auditor la consultan (`GET /audit`).

**Flujos alternativos.**

- Cambios de rol quedan en un registro propio.
- Leer un acta o una resolución de M4 deja una fila `READ`.
- Oficina Ambiental ve el historial de un expediente (`GET /environmental-reports/:id/history`), sin actor.
- Los reintentos manuales de eventos salientes se auditan con el estado anterior.

**Flujos de error.**

| Situación | Respuesta |
|---|---|
| Transición rechazada (409) | No deja fila |
| No se puede escribir la fila `READ` | 500 y no se entrega el dato |
| Rol sin acceso a `GET /audit` | 403 |

**Reglas de validación.**

- Solo agregado: un trigger de la base rechaza `UPDATE`, `DELETE` y `TRUNCATE`; no se purga.
- El actor sale del token, nunca del cuerpo.
- El motivo es texto libre de hasta 500 caracteres; no debe llevar datos personales (convención, no validada).
- No se copian payloads, contenido del acta ni mensajes al vecino.




### 4.9 Derivaciones: reparaciones y cortes de calle

**Propósito.** Resolver lo que M6 no puede hacer por sí mismo: reparaciones de infraestructura (M3) y cortes de calle (M7).

**Actores.** Oficina de Operaciones y Admin piden; `M6_ADMIN` opera el ciclo; M3 y M7 responden por evento.

**Precondiciones.**

- Reparación: un origen que lo justifique (un servicio de reclamo o una inspección cerrada con infracción).
- Corte: una intervención `AUTHORIZED` o un servicio, con al menos un tramo y `closureType`.

**Flujo principal (reparación).**

1. Oficina crea el pedido (`POST /repair-requests`): `REQUESTED`.
2. Se publica `infrastructureRepairRequested` a M3, con `ticketId` si hay.
3. M3 informa `workOrderScheduled`: `IN_PROGRESS`.
4. M3 informa `workOrderCompleted`: `CLOSED`.

**Flujo principal (corte de calle).**

1. Oficina crea el pedido (`POST /street-closure-requests`): `REQUESTED`.
2. Se publica `streetClosureRequested` a M7 con `sourceModule` M6 y tramos `{street, from, to, direction}`.
3. M7 aprueba, rechaza o termina; el estado cambia en consecuencia y el servicio dependiente se habilita o se reprograma.

**Flujos alternativos.**

- `streetClosureEnded` puede llegar antes que `streetClosureApproved`.
- Corte `APPROVED` con ventana vencida hace más de 6 horas sin aviso: `EXPIRED`; si M7 avisa el fin después, pasa a `ENDED`.
- Un corte rechazado guarda el motivo y reprograma el servicio.
- `GET /street-closure-requests/:id` trae ventana pedida, autorizada y motivo de rechazo.

**Flujos de error.**

| Situación | Respuesta |
|---|---|
| Reparación sobre inspección sin cerrar, `NO_VIOLATION` o expediente `NOISE`, o pedido abierto repetido | 409 |
| Corte con `requestedTo` anterior a `requestedFrom` | 400 |
| Corte sobre intervención no `AUTHORIZED` | 409 |
| Transición inválida | 409 nombrando las válidas |
| `closureRequestId` o `sourceRequestId` mal formado | 400 por HTTP; uno bien formado que no es nuestro se descarta con log |

**Reglas de validación.** Un evento tardío no reabre un estado terminal. Una reparación puede cerrarse directo desde `REQUESTED`.

**Estados y transiciones (reparación).**

| Estado actual | Acción | Estado nuevo | Rol |
|---|---|---|---|
| (alta) | `POST /repair-requests` | `REQUESTED` | Adm, Ope |
| `REQUESTED` | `start` o `workOrderScheduled` | `IN_PROGRESS` | Adm o Sistema |
| `REQUESTED`, `IN_PROGRESS` | `close` o `workOrderCompleted` | `CLOSED` | Adm o Sistema |
| `CLOSED` | cualquiera | Ninguno: 409 | — |

**Estados y transiciones (corte de calle).**

| Estado actual | Acción | Estado nuevo | Rol |
|---|---|---|---|
| (alta) | `POST /street-closure-requests` | `REQUESTED` | Adm, Ope |
| `REQUESTED` | `approve` o `streetClosureApproved` | `APPROVED` | Adm o Sistema |
| `REQUESTED` | `reject` o `streetClosureRejected` | `REJECTED` | Adm o Sistema |
| `REQUESTED`, `APPROVED`, `EXPIRED` | `end` o `streetClosureEnded` | `ENDED` | Adm o Sistema |
| `APPROVED` | Vence la ventana más 6 horas | `EXPIRED` | Sistema |
| `REJECTED`, `ENDED` | cualquiera | Ninguno: 409 | — |

Fuente: `REPAIR_TRANSITIONS` y `CLOSURE_TRANSITIONS` de `outbound-requests.transitions.ts`.

**Eventos.** Publica `infrastructureRepairRequested` (M3) y `streetClosureRequested` (M7). Consume `workOrderScheduled`, `workOrderCompleted`, `streetClosureApproved`, `streetClosureRejected` y `streetClosureEnded`.


## 5. Catálogo de estados por entidad

| Entidad | Estados | Terminales |
|---|---|---|
| Servicio | `SCHEDULED`, `RESCHEDULED`, `IN_PROGRESS`, `SUSPENDED`, `COMPLETED`, `PARTIALLY_COMPLETED`, `CANCELLED` | `COMPLETED`, `PARTIALLY_COMPLETED`, `CANCELLED` |
| Resultado de zona | `SERVICED`, `PARTIAL`, `NOT_SERVICED` | No aplica |
| Contenedor | `ACTIVE`, `OVERFLOWED`, `DAMAGED`, `UNDER_REPAIR`, `RELOCATING`, `REMOVED` | `REMOVED` |
| Intervención de arbolado | `REQUESTED`, `PENDING_AUTHORIZATION`, `AUTHORIZED`, `REJECTED` | `AUTHORIZED`, `REJECTED` |
| Expediente ambiental | `RECEIVED`, `UNDER_REVIEW`, `FORWARDED`, `DISMISSED`, `INSPECTION_SCHEDULED`, `INSPECTED`, `NO_VIOLATION`, `VIOLATION_FOUND`, `NOTICE_ISSUED`, `SANCTIONED`, `CLOSED` | `CLOSED` (reabrible, salvo desde `SANCTIONED`) |
| Resultado de inspección | `NO_VIOLATION`, `VIOLATION_FOUND`, `INCONCLUSIVE` | No aplica |
| Siguiente paso de inspección | `NOTICE_TO_BE_ISSUED`, `REINSPECTION`, `CASE_CLOSED` | No aplica |
| Decisión de sanción (M4) | `FINE_ISSUED`, `CLOSURE_ORDERED`, `FORMAL_NOTICE_ISSUED`, `DISMISSED` | No aplica |
| Pedido de reparación | `REQUESTED`, `IN_PROGRESS`, `CLOSED` | `CLOSED` |
| Pedido de corte de calle | `REQUESTED`, `APPROVED`, `REJECTED`, `ENDED`, `EXPIRED` | `REJECTED`, `ENDED` |
| Evento saliente (outbox) | `PENDING`, `SENT`, `FAILED` | `SENT` |
| Etapa pública de la denuncia | `RECIBIDA`, `EN_ANALISIS`, `INSPECCION_PROGRAMADA`, `INSPECCIONADA`, `EN_TRAMITE_SANCIONATORIO`, `DERIVADA`, `CERRADA` | `CERRADA` |
| Catálogos (zona, recorrido, vehículo, cuadrilla, tipo, sitio, punto y espacio verde) | Activo e inactivo | No aplica |

Otros valores cerrados relevantes (`docs/enumeraciones.md`):

| Enumeración | Valores |
|---|---|
| `ServiceOrigin` | `PLANNED`, `TICKET`, `WEATHER_ALERT`, `INSPECTION`, `MANUAL` |
| `NotServicedReason` | `VEHICLE_BREAKDOWN`, `CREW_UNAVAILABLE`, `BLOCKED_ACCESS`, `STREET_CLOSURE`, `WEATHER`, `EXCESS_VOLUME`, `SECURITY_INCIDENT`, `OTHER` |
| `DelayType` | `START`, `DURATION` |
| `Severity` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `RiskLevel` | `NONE`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `TreeHealthStatus` | `HEALTHY`, `WEAKENED`, `DISEASED`, `DEAD` |
| `TreeInterventionType` | `FORMATION_PRUNING`, `SAFETY_PRUNING`, `REMOVAL`, `PLANTING`, `TREATMENT` |
| `EnvironmentalReportType` | `NOISE`, `DUMPING`, `ILLEGAL_DUMPSITE`, `WATER_DISCHARGE`, `AIR_EMISSION`, `ODOR`, `PEST_INFESTATION`, `OTHER` |
| `SuggestedAction` | `WARNING`, `FORMAL_NOTICE`, `FINE`, `CLOSURE` |
| `CrewType` | `MUNICIPAL`, `COOPERATIVE`, `CONTRACTOR` |

## 6. Catálogo de eventos

El sobre es el del Core de M9: `eventId`, `eventType`, `eventVersion` (`"1.0"`), `occurredAt`, `sourceModule` (`ambiente`), `correlationId`, `causationId` y `data`, sin campos extra. Los eventos se escriben en el outbox en la misma transacción que el cambio y los publica un dispatcher al exchange `muni.inbox`.

### 6.1 Publicados por M6 (6)

| Evento | Receptor | Cuándo se emite |
|---|---|---|
| `updateTicketStatus` | M2 | Cambia el estado de un servicio o expediente con `ticketId` |
| `containerDamaged` | M3 | Un contenedor pasa a `DAMAGED` |
| `treeRiskDetected` | M3 | Un relevamiento con riesgo `HIGH` o `CRITICAL` |
| `environmentalViolationDetected` | M4 | Se emite un acta con `establishmentId` |
| `infrastructureRepairRequested` | M3 | Se crea un pedido de reparación |
| `streetClosureRequested` | M7 | Se crea un pedido de corte de calle |

Emisor de todos: M6 (`sourceModule: ambiente`). Cada uno tiene un `.schema.json` en `docs/eventos/publicados/`. Los nueve eventos descartados están en `descartados.md`; `urbanServiceScheduled` y `treePruningScheduled` se dejaron de emitir el 21/10.

### 6.2 Consumidos por M6 (10 documentados)

| Evento | Emisor | Qué hace M6 |
|---|---|---|
| `ticketUpdated` | M2 | `ROUTED` abre el expediente; `REOPENED`, `CANCELLED`, `PRIORITY_CHANGED`, `ESCALATION_CHANGED` e `INFORMATION_PROVIDED` lo actualizan; los otros siete tipos se ignoran |
| `workOrderScheduled` | M3 | El pedido de reparación pasa a `IN_PROGRESS` |
| `workOrderCompleted` | M3 | Cierra el pedido de reparación |
| `commercialFineGenerated` | M4 | Registra la sanción y cierra el expediente |
| `closureUpdate` | M4 | `ORDERED` registra la clausura; `LIFTED` el levantamiento |
| `streetClosureApproved` | M7 | Habilita el servicio dependiente |
| `streetClosureRejected` | M7 | Reprograma el servicio dependiente |
| `streetClosureEnded` | M7 | Libera la dependencia |
| `weatherAlertIssued` | Simulado en M6 | Reprogramación masiva por zona |
| `notificationSent` | M9 | Sin handler ni suscripción: nadie lo publica |

Nueve tienen handler y ocho están suscriptos en el Core (`weatherAlertIssued` se simula adentro). Entran por `POST /events/inbox` (`M6_ADMIN`) y por la cola `q.ambiente`. De M1, M5 y M8 no se consume ningún evento.

## 7. Mensajes y errores

Todo error se devuelve como Problem Details (RFC 9457, `application/problem+json`, ADR-011) con `type`, `title`, `status`, `detail` e `instance`. Se conservan como extensiones `statusCode`, `message`, `error`, `timestamp` y `path`; `code` aparece solo en algunos errores (`ROLE_REQUIRED`, `NOT_ASSIGNED`); `traceId` coincide con el header `X-Request-Id` y con el log del servidor. `path` e `instance` no incluyen la query. El 500 es genérico, sin stack ni SQL.

| Código | Cuándo ocurre |
|---|---|
| 400 | Cuerpo o query inválidos: campo requerido ausente, fuera de rango o con formato incorrecto; propiedad no declarada; booleano inválido; carácter nulo; `sort` u `order` fuera de la lista; fechas incoherentes; `Idempotency-Key` mal formada; inbox con payload inválido; evidencia con contenido o tipo no permitido |
| 401 | Sin token, vencido, con firma de otro secreto, `alg=none`, emisor o `typ` incorrectos |
| 403 | `ROLE_REQUIRED` por falta de rol; `NOT_ASSIGNED` por cuadrilla o inspector ajeno; token de ciudadano; empleado sin roles de M6 |
| 404 | Recurso inexistente; consulta pública sin expediente |
| 409 | Transición de estado inválida; código o patente repetidos; choque de asignación sin justificación; período de asignación superpuesto; frecuencia superpuesta; solicitud de información pendiente; `Idempotency-Key` con la primera en curso; quitar el último admin; editar un servicio fuera de `SCHEDULED` o `RESCHEDULED` |
| 412 | `If-Match` que no coincide con el ETag actual; no se escribe nada |
| 413 | Evidencia de más de 10 MB; cuerpo sobre el límite |
| 422 | Misma `Idempotency-Key` con otro cuerpo; líder o integrante inexistente o inactivo en M1 |
| 429 | Límite de tasa superado |
| 503 | M1 no responde al validar personal; evidencia sin almacenamiento configurado; catálogo de barrios aún no leído; base de datos no disponible en `GET /health/ready` |

Orden de evaluación relevante: el 412 se evalúa antes que el 409 de transición inválida; el 404 y el 403 `NOT_ASSIGNED` van antes que cualquier regla de estado, y el 403 antes que el 409 de «ya cerrada».

Un 409 de transición inválida nombra el estado actual y los estados válidos, por ejemplo «No se puede pasar de 'X' a 'Y'. Transiciones válidas desde 'X': [...]», y «ninguna, es un estado final» cuando no hay salida.

## 8. Integraciones y comportamiento ante falla del sistema externo


| Falla | Comportamiento |
|---|---|
| M1 caído al validar personal de una cuadrilla | 503 a los 4 s (`M1_TIMEOUT_MS`), sin reintento y sin guardar nada; menor que los 5 s del BFF, para que llegue el 503 |
| M1 caído en una request con JWT | Sin efecto: el token se valida localmente con el secreto compartido |
| M1 sin configurar (`M1_BASE_URL`) | No se valida personal; se guarda con un aviso |
| Secreto de M1 distinto al cargado | 401 en todo endpoint protegido |
| Broker o Core caídos al publicar | El cambio de dominio se confirma; el evento queda `PENDING` en el outbox y el dispatcher reintenta |
| Falla de publicación persistente | A los 5 intentos la fila queda `FAILED` con `lastError`; un `M6_ADMIN` la reencola (`POST /events/outbox/:id/retry` o `retry-failed`), con el mismo `eventId` y auditoría |
| Sin `RABBITMQ_URL` | No hay bus: el adaptador solo registra en el log; el outbox queda como evidencia |
| Core sin responder al registrar suscripciones | El arranque no se bloquea; el registro se reintenta con backoff |
| Falta la cola `q.ambiente` | El consumidor loguea y falla el setup para que se reintente; no declara colas |
| Evento entrante duplicado | `duplicate` con ack; no se reaplica |
| Handler entrante que falla | `nack` sin reencolar; el Core reintenta con su backoff (5 s, 30 s, 2 min) y luego su DLQ |
| Evento entrante inválido | 400 por HTTP; por el bus, `nack` y llega a la DLQ del Core con el payload crudo |
| Eventos fuera de orden | Se ordenan por `data.updatedAt`; el viejo no pisa al nuevo |
| M2 sin responder al pedido de información | La solicitud sigue pendiente y bloquea `forward`, `dismiss` y `close` |
| M3 sin responder | El pedido queda `REQUESTED`; el relevamiento o daño ya está guardado |
| M7 sin avisar el fin de un corte | A las 6 horas de vencida la ventana, el corte pasa a `EXPIRED` |
| M4 sin respuesta | El expediente `NOTICE_ISSUED` se cierra por vencimiento de plazo |
| M4 sin búsqueda de establecimientos | El acta sin `establishmentId` no se deriva; plan B: carga manual |
| Catálogo de barrios no leído | Asignar barrios se acepta con aviso; `GET /neighborhoods` da 503 |
| Almacenamiento de evidencia no configurado | 503, sin persistir nada y con la `Idempotency-Key` libre |
| Base de datos caída | `GET /health/ready` da 503 a los 3 s; `GET /health` sigue en 200 |
| Servicio dormido en Render | La primera respuesta puede tardar; despertar `/health` antes de la demo |

El cliente del Core espera 5 s y no tiene circuit breaker (riesgo R2 del plan de pruebas). El estado del broker figura en `/health/ready` como informativo: un bus caído no da 503.

## 9. Restricciones no funcionales visibles para el usuario

| Tema | Comportamiento |
|---|---|
| Concurrencia optimista | `GET /:id` de contenedores, servicios, intervenciones y expedientes devuelve `ETag` débil. Las transiciones y los `PATCH` de contenedores y servicios aceptan `If-Match`; si no coincide, 412. Sin el header o con `*`, se aplica |
| Idempotencia | `Idempotency-Key` opcional (1 a 255 caracteres) en los POST de creación: misma clave y cuerpo devuelve la misma respuesta con `Idempotency-Replayed: true`; otro cuerpo, 422; primera en curso, 409. Vale 24 horas, por usuario, método y ruta |
| Idempotencia de evidencia | `Idempotency-Key` obligatoria en `POST /evidence` |
| Acciones de estado | No llevan clave: la máquina de estados las hace seguras (un repetido da 409) |
| Eventos entrantes | Idempotentes por `eventId` |
| Paginación | `?page` (1 por defecto) y `?pageSize` (20 por defecto, máximo 100); respuesta `{ data, meta: { total, page, pageSize, totalPages } }` |
| Orden | `?sort=<campo>&order=asc` o `desc` en vehículos, contenedores, árboles, cuadrillas, recorridos, puntos verdes y espacios verdes; desempata por id |
| Límite de tasa | 600 pedidos por minuto por IP y endpoint (`THROTTLE_LIMIT`); `POST /events/inbox` 300; `POST /evidence` 30; seguimiento público 20; resto del portal 60; `/health` exento |
| Balde compartido | Las rutas autenticadas del BFF comparten el balde por la IP de salida del BFF (decisión del 16/11/2026) |
| Tamaños | `search` hasta 100 caracteres; ids externos hasta 100; arrays hasta 100 elementos; `notes` y `description` hasta 2000 |
| Rangos numéricos | `lat` -90 a 90 y `lng` -180 a 180, hasta 7 decimales; pesos y capacidades no negativos |
| Textos | Los códigos y nombres se recortan antes de validar; vacío da 400 |
| Zona horaria | Las fechas de negocio son del día argentino (UTC-3) |
| Baja | Lógica en catálogos e inventarios; `DELETE` devuelve 204 |
| Sesión | El JWT vive 15 minutos; los roles se leen en cada request |
| Evidencia | Hasta 10 MB; JPEG, PNG, WebP o PDF; sin EXIF ni GPS en las imágenes |
| Auditoría de lectura | Leer actas y resoluciones deja rastro |
| CORS | Orígenes permitidos por configuración; obligatorio en producción |


## 10. Trazabilidad capacidad → HU → endpoints

| Capacidad | HU | Endpoints principales |
|---|---|---|
| C1 Servicios y frecuencias | HU-03, HU-04, HU-05, HU-06, HU-07 | `/services`, `/service-types`, `/service-frequencies`, `/routes`, `/vehicles`, `/disposal-sites` |
| C1 Catálogos y zonas | HU-01, HU-02, HU-03, HU-26 | `/zones`, `/routes/:id/stops`, `/communes`, `/neighborhoods` |
| C2 Contenedores | HU-11 | `/containers` y sus acciones |
| C2 Evidencia | HU-08 | `/evidence` |
| C2 y C3 Puntos y espacios verdes | HU-13 | `/green-points`, `/green-spaces` |
| C3 Arbolado | HU-10, HU-12 | `/trees`, `/trees/:treeId/surveys`, `/tree-interventions` |
| C4 Control ambiental | HU-14, HU-15, HU-16, HU-17, HU-18 | `/environmental-reports`, `/environmental-inspections` |
| C5 Seguimiento del vecino | HU-21, HU-22, HU-25, HU-27 | `/public/*`, `request-information` |
| C6 Cuadrillas y roles | HU-03, HU-29, HU-30 | `/crews`, `/role-assignments`, `/me` |
| C7 Indicadores | HU-28 | `/indicators/*` |
| C8 Auditoría | HU-31 | `/audit` |
| C9 Derivaciones | HU-09 | `/repair-requests`, `/street-closure-requests` |
| Integración | HU-19, HU-20, HU-23, HU-24 | `/events/inbox`, `/events/outbox`, `/events/handlers` |
| Seguridad y calidad | HU-31, HU-32, HU-33 | `/health`, `/health/ready` |

Las 33 HU aparecen al menos una vez. HU-34 a HU-36 son Won't y no tienen funcionalidad.

## Fuentes

| Tema | Archivo |
|---|---|
| Qué hace el módulo, glosario, indicadores | `docs/README.md` |
| Estados, campos y reglas por entidad | `docs/entidades/service.md`, `container.md`, `tree-intervention.md`, `environmental-report.md`, `control-ambiental.md`, `derivaciones.md`, `configuracion-y-recursos.md`, `auditoria.md`, `inventario-urbano.md` |
| Valores cerrados | `docs/enumeraciones.md` |
| Eventos publicados | `docs/eventos/publicados/README.md` y una ficha por evento |
| Eventos consumidos | `docs/eventos/consumidos/README.md`, `ticketUpdated.md` |
| Endpoints, roles y convenciones | `docs/api/endpoints.md` |
| Decisiones | `docs/decisiones/adr-004`, `adr-006`, `adr-008`, `adr-009`, `adr-010`, `adr-011`, `adr-012`, `adr-013`, `adr-015` |
| Historias de usuario y criterios | `docs/QA/02-historias-y-criterios.md` |
| Cifras | `docs/QA/05-informe-ejecucion.md` |
| Manual de usuario | `docs/QA/manual-de-usuario.md` |
| Integración | `docs/integracion/` |
| Tablas de transición | `src/modules/services/services.service.ts`, `src/modules/containers/containers.service.ts`, `src/modules/environmental-reports/environmental-reports.service.ts`, `src/modules/trees/interventions/tree-interventions.service.ts`, `src/modules/outbound-requests/outbound-requests.transitions.ts`, `src/events/outbox/outbox-admin.service.ts` |
| Etapas públicas y límites del portal | `src/modules/citizen-portal/citizen-portal.service.ts`, `src/modules/citizen-portal/rate-limits.ts` |
| Valores por defecto | `src/config/env.validation.ts`, `src/common/rate-limits.ts` |
| Errores 422 y 503 | `src/common/idempotency/idempotency.interceptor.ts`, `src/modules/crews/crews.service.ts`, `src/modules/attachments/storage/r2-evidence.storage.ts`, `src/modules/neighborhoods/neighborhoods.service.ts`, `src/health/health.controller.ts` |
