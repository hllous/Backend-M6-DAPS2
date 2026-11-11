# 03 · Matriz de trazabilidad

> Versión 2.0 · 10/11/2026. Relaciona **HU → criterio de aceptación → caso de prueba → test automatizado → resultado → defecto**. Las HU y los criterios están en [02-historias-y-criterios.md](02-historias-y-criterios.md) y los casos en [04-especificacion-casos.md](04-especificacion-casos.md).

## Cómo leerla

- **Test automatizado:** archivo y nombre del test (`describe`/`it`) del backend; se muestran hasta dos por criterio. `FE:` es un test del repo del frontend: solo verificamos el nombre del archivo, no su contenido.
- **Resultado:** **Pasó** significa que el test citado existe en el archivo y que la corrida completa no tuvo fallos: R08 (local sobre `1d600d2`: 2746 unitarios y 312 e2e, y 4 de 4 en RabbitMQ real) y, para la suite completa, R09 (local sobre `142e1a3`: 2854 unitarios y 343 e2e, 0 fallos; el cotejo por nombre de cada test se hizo con R08). Los tests saltados no figuran en ninguna fila. «Corregido: ACT-nn» es un criterio que cambió después de la HU (ver más abajo) y cuya corrección tiene CI verde en el commit que la introdujo.
- **Defecto:** «—» si no hay ninguno registrado; si no, el `DEF-xx` de [06-registro-defectos.md](06-registro-defectos.md) o el issue. Los defectos transversales sin criterio propio están en la tabla «Defectos y pruebas sin criterio propio» del final.
- **Marcas:** **HUECO** = el criterio no tiene ningún test automatizado verificado (solo prueba manual o nada). **SOLO FE** = solo tiene un test del frontend, sin verificar.


## HU-01 — Catálogos con tablas filtrables, componentes uniformes y estados de carga

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU01-1** (Feliz) lo abro → puedo ordenar y filtrar con el mismo componente de tabla que Servicios | CP-001 | **SOLO FE**: `catalog-shell.spec.ts`<br>FE: `zones-catalog.spec.ts` | Corregido (ACT-F1); sin ejecutar | — |
| **CA-HU01-2** (Feliz) la pantalla carga → veo un esqueleto con la forma final, no un spinner suelto ni la tabla vacía | CP-002 | **SOLO FE**: `catalog-a-loading.spec.ts`<br>FE: `catalog-b-loading.spec.ts`<br>(+1 más) | Corregido (ACT-F1); sin ejecutar | — |
| **CA-HU01-3** (Alternativo) corre el guard de shadcn en el CI del frontend → no quedan componentes de UI escritos a mano fuera del registro | CP-003 | **HUECO** sin test: Guard de CI del frontend citado por Trello; no se localizó el script en esta pasada. | Corregido (ACT-F1); sin ejecutar | — |
| **CA-HU01-4** (Error) abro un catálogo → la pantalla muestra un mensaje de error con aria-live o role="alert" y no una tabla vacía | CP-004 | **SOLO FE**: `failure-journeys.spec.ts` | No ejecutado (solo test del frontend, sin verificar) | — |

## HU-02 — Alta de zonas operativas y recorridos con paradas

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU02-1** (Feliz) crea una zona con code y name únicos (POST /zones) → recibe 201 y la zona nace con active = true | CP-005 | `zones.service.spec.ts` › «nace activa si el DTO no dice lo contrario»<br>`auth-roles.e2e-spec.ts` › «$grupo: $method $path» | Pasó | — |
| **CA-HU02-2** (Feliz) reemplazo sus paradas con PUT /routes/:id/stops [zonaA, zonaB, zonaC] → las paradas quedan con sequence 1, 2 y 3 en el orden del array y Route.updatedAt se actualiza en la misma transacci… | CP-006, CP-007 | `routes.service.spec.ts` › «asigna sequence por el orden del array, 1-indexed»<br>`routes.service.spec.ts` › «actualiza Route.updatedAt en la misma transaccion»<br>(+2 más) | Pasó (corregido: ACT-16) | Corregido en #283 |
| **CA-HU02-3** (Alternativo) ejecuto DELETE sobre él → recibo 204, el registro sigue existiendo y queda con active = false (baja lógica) | CP-008, CP-009 | `zones.service.spec.ts` › «es baja lógica, no borrado»<br>`routes.service.spec.ts` › «la baja es lógica» | Pasó | — |
| **CA-HU02-4** (Error) intento crear otro con ese code → recibo 409, no un error de Prisma | CP-010, CP-011 | `zones.service.spec.ts` › «un código repetido da 409, no un error de Prisma»<br>`routes.service.spec.ts` › «un código repetido da 409, no un error de Prisma» | Pasó | — |
| **CA-HU02-5** (Error) envío paradas con una zona repetida o con una zona que no existe → recibo 400 (zona repetida) o 404 nombrando las zonas inexistentes, y las paradas actuales no cambian | CP-012, CP-013 | `routes.service.spec.ts` › «rechaza una zona repetida: romperia ServiceZone al copiar el recorrido»<br>`routes.service.spec.ts` › «devuelve 404 nombrando las zonas que no existen» | Pasó | — |
| **CA-HU02-6** (Falla externa) asigno barrios a una zona (POST /zones/:id/neighborhoods) o consulto GET /neighborhoods → la asignación se acepta con un warning (sin catálogo) y GET /neighborhoods responde 503, no una l… | CP-014, CP-015, CP-016 | `zones.service.spec.ts` › «con catálogo, un id que M9 no tiene da 400 y no escribe nada»<br>`zones.service.spec.ts` › «sin catálogo degrada: asigna aunque el id sea desconocido»<br>(+1 más) | Pasó (corregido: ACT-27) | Corregido en #376, #420, #421, #457; DEF-21 (cerrado, #594, PR #597): con `NEIGHBORHOODS_CATALOG_FILE` responde 200 en local y en el CI, sin catálogo sigue 503 (CP-371 y CP-372) |
| **CA-HU02-7** (Alternativo) asigno communeId a la zona (POST o PATCH /zones) o listo las zonas → la zona queda ligada a la comuna (400 si la comuna no existe, null la desasigna) y el listado sale ordenado por número… | CP-285, CP-286, CP-287, CP-288 | `zones.service.spec.ts` › «crea con comuna existente; con una inexistente da 400»<br>`zones.service.spec.ts` › «una comuna inexistente da 400 y no escribe»<br>(+2 más) | Pasó (corregido: ACT-27) | — |

## HU-03 — Administración de tipos de servicio, frecuencias, cuadrillas, vehículos y sitios de disposición

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU03-1** (Feliz) registra un vehículo con patente única (POST /vehicles) → recibe 201 y el vehículo nace activo | CP-017 | `vehicles.service.spec.ts` › «nace activo y sin capacidad si no se la pasan» | Pasó | — |
| **CA-HU03-2** (Feliz) crea una cuadrilla con specialty y un líder con id numérico de M1 (POST /crews) → recibe 201, la cuadrilla nace activa y el id del líder se guarda normalizado (sin ceros a la izquierda) | CP-018, CP-019 | `crews.service.spec.ts` › «nace activa y sin cooperativa si no se la pasan»<br>`crews.service.spec.ts` › «el líder se guarda como id de M1 normalizado (#365)»<br>(+1 más) | Pasó (corregido: ACT-09) | Corregido en #454, #455 |
| **CA-HU03-3** (Alternativo) ejecuto DELETE → recibo 204 y el registro no se borra: queda inactivo (en la frecuencia se cierra la vigencia con validTo = hoy argentino) | CP-020, CP-021, CP-022 | `service-types.service.spec.ts` › «la baja es logica: marca active=false, no borra»<br>`disposal-sites.service.spec.ts` › «la baja es logica para no romper el historico de CollectionRecord»<br>(+1 más) | Pasó | — |
| **CA-HU03-4** (Error) intento crear el recurso o la cuadrilla → recibo 409 por duplicado o 400 por id inválido, sin guardar nada | CP-023, CP-024, CP-025 | `vehicles.service.spec.ts` › «una patente repetida da 409»<br>`service-types.service.spec.ts` › «traduce el codigo duplicado a 409»<br>(+1 más) | Pasó | — |
| **CA-HU03-5** (Error) creo o modifico otra regla que se superpone, o la creo sobre un tipo de servicio de modo POINT → recibo 409 (superposición) o 400 (tipo que no es ROUTE) y no se escribe nada | CP-026, CP-027 | `service-frequencies.service.spec.ts` › «crear con una regla superpuesta da 409 y no escribe»<br>`service-frequencies.service.spec.ts` › «rechaza un tipo de servicio que no es de modo ROUTE» | Pasó | — |
| **CA-HU03-6** (Alternativo) reubico la cuadrilla (POST /crews/:id/zone-assignments) entre validFrom y validTo → queda guardada con el actor del token y fechas sin hora; sin validTo queda abierta; 409 si el período s… | CP-289, CP-290, CP-291, CP-292, CP-293 | `crews.service.spec.ts` › «guarda la reubicación con el actor del token y fechas sin hora»<br>`crews.service.spec.ts` › «un período que se pisa con otro da 409»<br>(+3 más) | Pasó (corregido: ACT-09) | — |

## HU-04 — Suspender un servicio guardando motivo y nota por separado

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU04-1** (Feliz) lo suspendo eligiendo un motivo y escribiendo una nota → el backend guarda reason y note en campos distintos | CP-028 | `services.service.spec.ts` › «suspender guarda el motivo»<br>`services.service.spec.ts` › «suspender guarda la nota opcional» | Pasó (corregido: ACT-15) | — |
| **CA-HU04-2** (Feliz) abro su detalle → veo el motivo y la nota por separado (statusNote) | CP-029 | `services.service.spec.ts` › «suspender guarda la nota opcional»<br>FE: `services.spec.ts` | Pasó (solo la parte backend; la del frontend no se ejecutó) | — |
| **CA-HU04-3** (Alternativo) suspendo (o la nota son solo espacios) → la suspensión se acepta igual y la nota queda null | CP-030 | `services.service.spec.ts` › «suspender con nota de solo espacios la guarda como null» | Pasó (corregido: ACT-15) | — |
| **CA-HU04-4** (Error) intento suspenderlo → recibo 409 nombrando las transiciones válidas desde el estado actual | CP-031, CP-335 | `services.service.spec.ts` › «rechaza una transicion invalida nombrando las validas»<br>`services-lifecycle.e2e-spec.ts` › «rechaza con 409 una transición que la tabla no admite»<br>(+1 más) | Pasó | — |
| **CA-HU04-5** (Error) envío una nota de más de 500 caracteres → recibo 400 y el servicio no cambia de estado | CP-032 | `length-limits.dtos.spec.ts` › «%s: el tope pasa y tope+1 falla» | Pasó | — |
| **CA-HU04-6** (Error) intento suspenderlo → recibo 403 con code NOT_ASSIGNED y el estado no cambia | CP-033 | `services-ownership.spec.ts` › «%s: un usuario ajeno a la cuadrilla recibe 403 NOT_ASSIGNED»<br>`crew-ownership.e2e-spec.ts` › «un ajeno no puede suspender, reanudar, informar zona, registrar residuos ni avisar demora» | Pasó (corregido: ACT-04) | — |

## HU-05 — Programar un servicio sobre un recorrido o un punto

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU05-1** (Feliz) creo un servicio con fecha, ventana horaria y una cuadrilla sin conflictos (POST /services) → recibo 201, el servicio nace SCHEDULED, el modo se copia del tipo y las zonas del recorrido s… | CP-034 | `services.service.spec.ts` › «copia el modo del ServiceType, no lo recibe del DTO»<br>`services.service.spec.ts` › «copia las zonas del recorrido como snapshot, con su sequence»<br>(+1 más) | Pasó | DEF-06 (cerrado, #592, PR #597): `Idempotency-Key` opcional en `POST /services`; casos CP-362 a CP-369. Limitación: el guardado de la respuesta no es atómico (ADR-013) |
| **CA-HU05-2** (Alternativo) creo el servicio indicando targetType y targetId de un bien del inventario, o una zoneId suelta → la zona se deriva del bien o se usa la zona indicada, y el servicio nace SCHEDULED | CP-035, CP-036 | `services.service.spec.ts` › «deriva la zona de un POINT desde el bien del inventario»<br>`services-queries-inventory.spec.ts` › «sin objetivo, se ubica por la zona suelta» | Pasó | — |
| **CA-HU05-3** (Error) creo el servicio sin overrideNote → recibo 409 nombrando los servicios en conflicto, no se crea el servicio ni se encola ningún evento; con overrideNote de 10 a 500 caracteres se crea y l… | CP-037, CP-038, CP-039 | `services.service.spec.ts` › «rechaza con 409 si la cuadrilla se solapa, sin crear ni encolar»<br>`services.service.spec.ts` › «rechaza con 409 si el vehículo se solapa»<br>(+2 más) | Pasó | — |
| **CA-HU05-4** (Error) envío un ROUTE sin routeId, un recorrido sin paradas, un POINT sin objetivo ni zona, una ventana invertida, ticketId con un origen distinto de TICKET o un tipo dado de baja → recibo 400 y… | CP-040, CP-041, CP-042, CP-043, CP-044 | `services.service.spec.ts` › «rechaza un ROUTE sin routeId»<br>`services.service.spec.ts` › «rechaza un recorrido sin paradas cargadas»<br>(+3 más) | Pasó | — |
| **CA-HU05-5** (Falla externa) lo programo → recibo 201 igual, el aviso a M2 queda PENDING en el outbox escrito en la misma transacción y no se publica urbanServiceScheduled | CP-045, CP-046 | `services.service.spec.ts` › «el alta solo encola el aviso a M2, nunca urbanServiceScheduled»<br>`services-lifecycle.e2e-spec.ts` › «programa el servicio y encola solo el aviso a M2 (sin urbanServiceScheduled)»<br>(+2 más) | Pasó (corregido: ACT-23) | Corregido en #346 |
| **CA-HU05-6** (Error) creo o asigno el servicio sin overrideNote → recibo 409 pidiendo overrideNote y no se escribe nada; con overrideNote de 10 a 500 caracteres se asigna y la nota queda con quién y cuándo; s… | CP-294, CP-295, CP-296, CP-297, CP-298 | `services-delay-assignment.spec.ts` › «cuadrilla de otra zona: rebota pidiendo nota y no escribe»<br>`services.service.spec.ts` › «cuadrilla de una zona que el recorrido no toca: pide nota y no crea»<br>(+4 más) | Pasó (corregido: ACT-09) | — |

## HU-06 — Reprogramar o cancelar un servicio con motivo

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU06-1** (Feliz) lo cancelo con motivo (POST /services/:id/cancel) → pasa a CANCELLED y, si estaba suspendido, se limpia statusNote | CP-047 | `services.service.spec.ts` › «se puede cancelar desde %s»<br>`services.service.spec.ts` › «reanudar y cancelar desde SUSPENDED limpian statusNote» | Pasó | — |
| **CA-HU06-2** (Feliz) lo reprogramo (reschedule) y luego confirmo con fecha y ventana nuevas (confirm-reschedule) → pasa a RESCHEDULED y vuelve a SCHEDULED con la fecha nueva; confirmar con la fecha de hoy arg… | CP-048, CP-049, CP-050 | `services.service.spec.ts` › «confirm-reschedule vuelve a SCHEDULED con la fecha nueva»<br>`services.service.spec.ts` › «confirmar con la fecha de hoy (Argentina) es válido»<br>(+1 más) | Pasó | — |
| **CA-HU06-3** (Error) confirmo con una fecha anterior a hoy, cancelo uno IN_PROGRESS, cancelo sin motivo o envío note a cancel/reschedule → recibo 400 (fecha pasada, falta de motivo, note no permitido) o 409 (… | CP-051, CP-052 | `services.service.spec.ts` › «confirmar con una fecha pasada da 400 y no transiciona»<br>`services.service.spec.ts` › «rechaza una transicion invalida nombrando las validas» | Pasó | — |
| **CA-HU06-4** (Alternativo) llega al inbox → los servicios SCHEDULED de esas zonas y fechas pasan a RESCHEDULED; una alerta leve solo avisa y una severa sin ventana se descarta | CP-053, CP-054, CP-055 | `consumers.spec.ts` › «una alerta severa marca los servicios de la zona para reprogramar»<br>`consumers.spec.ts` › «la ventana acota los servicios por scheduledDate»<br>(+2 más) | Pasó | — |
| **CA-HU06-5** (Falla externa) M7 rechaza el corte (streetClosureRejected) → el servicio pasa a RESCHEDULED con el motivo y no se cancela; uno ya iniciado no se toca | CP-056, CP-057 | `consumers.spec.ts` › «el rechazo del corte marca el servicio para reprogramar, no lo cancela»<br>`consumers.spec.ts` › «si el servicio ya no está SCHEDULED, el rechazo no lo reprograma» | Pasó | — |

## HU-07 — Ejecución en campo: iniciar, resultado por zona y cierre

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU07-1** (Feliz) lo inicio, informo SERVICED en cada zona y lo cierro → pasa por IN_PROGRESS y termina COMPLETED | CP-058 | `services-lifecycle.e2e-spec.ts` › «informa el resultado de la zona y cierra el servicio como COMPLETED»<br>`crew-ownership.e2e-spec.ts` › «el integrante y el líder de la cuadrilla sí ejecutan el ciclo completo»<br>(+1 más) | Pasó | — |
| **CA-HU07-2** (Alternativo) lo cierro → el estado final se calcula como PARTIALLY_COMPLETED (no se elige) | CP-059 | `services.service.spec.ts` › «cierra PARTIALLY_COMPLETED si alguna zona no se atendio» | Pasó | — |
| **CA-HU07-3** (Error) cierro sin el resultado de alguna zona, informo una zona sin motivo (si no es SERVICED) o con motivo (si es SERVICED), o repito el resultado de una zona → recibo 409 (falta resultado, zon… | CP-060, CP-061, CP-062, CP-063 | `services.service.spec.ts` › «no deja cerrar si falta el resultado de alguna zona»<br>`services.service.spec.ts` › «exige motivo cuando la zona no quedo SERVICED»<br>(+2 más) | Pasó | — |
| **CA-HU07-4** (Error) intento iniciar, informar zona, registrar residuos o avisar demora → recibo 403 con code NOT_ASSIGNED y no se escribe nada; un servicio inexistente sigue dando 404 | CP-064, CP-065, CP-066 | `crew-ownership.e2e-spec.ts` › «el integrante de otra cuadrilla no puede iniciar el servicio: 403 NOT_ASSIGNED»<br>`services-ownership.spec.ts` › «%s: un usuario ajeno a la cuadrilla recibe 403 NOT_ASSIGNED»<br>(+2 más) | Pasó (corregido: ACT-04) | — |
| **CA-HU07-5** (Error) intento iniciarlo → recibo 409 (sin vehículo) o 403 NOT_ASSIGNED (sin cuadrilla) y el servicio sigue SCHEDULED | CP-067 | `services.service.spec.ts` › «no deja iniciar sin vehiculo si el tipo lo exige»<br>`services-lifecycle.e2e-spec.ts` › «no deja iniciar sin cuadrilla y sí después de asignarla» | Pasó | — |
| **CA-HU07-6** (Alternativo) aviso una demora (POST /services/:id/delay-notices) → el estado no cambia; START solo se acepta antes de arrancar y DURATION solo con la cuadrilla trabajando (la combinación cruzada da 40… | CP-068, CP-069, CP-070, CP-071 | `services-delay-assignment.spec.ts` › «un servicio que no arrancó admite START»<br>`services-delay-assignment.spec.ts` › «no toca el estado del servicio»<br>(+3 más) | Pasó | — |
| **CA-HU07-7** (Error) falla la escritura del contenedor dentro de la transacción de cierre → el cierre se revierte completo: el servicio sigue IN_PROGRESS, el contenedor no cambia y no queda fila en el outbox | CP-072, CP-073, CP-074 | `containers-close.e2e-spec.ts` › «revierte el cierre del servicio si falla la escritura del contenedor dentro de la transacción»<br>`containers-close.e2e-spec.ts` › «no cierra el servicio si falta la ubicación nueva del contenedor en RELOCATING»<br>(+2 más) | Pasó | — |

## HU-08 — Adjuntar evidencia fotográfica con reintento seguro

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU08-1** (Feliz) lo subo con POST /evidence con Idempotency-Key → recibo 201, la evidencia queda asociada al dueño y el objeto almacenado no conserva EXIF ni GPS | CP-075 | `attachments.service.spec.ts` › «sube el archivo y persiste el Attachment cuando el owner existe»<br>`attachments.service.spec.ts` › «sube el archivo sin los metadatos»<br>(+1 más) | Pasó | — |
| **CA-HU08-2** (Alternativo) repito el POST /evidence → recibo el Attachment existente y no se vuelve a subir el archivo | CP-076 | `attachments.service.spec.ts` › «con una Idempotency-Key ya usada, devuelve el attachment existente sin volver a subir»<br>`attachments.service.spec.ts` › «tambien lo borra cuando pierde la carrera de la Idempotency-Key» | Pasó | — |
| **CA-HU08-3** (Error) subo un archivo cuyo contenido no coincide con el tipo declarado, de más de 10 MB, de un tipo no permitido o sin Idempotency-Key → recibo 400 (contenido, tipo o clave), 413 (más de 10 MB)… | CP-077, CP-078, CP-079, CP-080 | `attachments.service.spec.ts` › «rechaza un archivo cuyo contenido no coincide con lo declarado»<br>`attachments.service.spec.ts` › «rechaza un archivo que supera el tamaño máximo»<br>(+2 más) | Pasó (corregido: ACT-F6); parte FE sin ejecutar | Corregido en FE #380, #435, #438 |
| **CA-HU08-4** (Error) subo o listo evidencia → recibo 403 NOT_ASSIGNED (ajeno) o 404 (dueño inexistente) | CP-081, CP-082 | `crew-ownership.e2e-spec.ts` › «SERVICE: el ajeno recibe 403 NOT_ASSIGNED; el integrante y el líder suben (201)»<br>`crew-ownership.e2e-spec.ts` › «un dueño inexistente es 404, no 403» | Pasó (corregido: ACT-04) | — |
| **CA-HU08-5** (Falla externa) subo un archivo válido → recibo 503 (sin R2), no se persiste nada y la Idempotency-Key queda libre; si falla la escritura de la fila, el archivo se borra del bucket | CP-083, CP-084 | `attachments.service.spec.ts` › «el camino válido responde 503 y no persiste nada (la Idempotency-Key queda libre)»<br>`attachments.service.spec.ts` › «borra el archivo del bucket si la fila no se puede escribir» | Pasó | — |
| **CA-HU08-6** (Error) la leo (GET /evidence?ownerType=&ownerId=) → recibo 403 NOT_ASSIGNED (Campo ajeno) o 404 (dueño inexistente); Campo lee lo propio y Oficina, Admin y Auditoría leen cualquiera | CP-299, CP-300, CP-301, CP-302 | `attachments.service.spec.ts` › «Campo sobre un servicio de otra cuadrilla: 403 NOT_ASSIGNED y no consulta evidencia»<br>`attachments.service.spec.ts` › «Campo sobre lo propio lee»<br>(+2 más) | Pasó (corregido: ACT-05) | Corregido en #466 |

## HU-09 — Derivar una reparación de infraestructura o pedir un corte de calle

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU09-1** (Feliz) creo un pedido de reparación (POST /repair-requests) → se crea la solicitud REQUESTED y se encola infrastructureRepairRequested hacia M3 con el ticketId, en la misma transacción | CP-085 | `outbound-requests.service.spec.ts` › «publica infrastructureRepairRequested al crear»<br>`outbound-requests.service.spec.ts` › «si el servicio de origen nacio de un reclamo, el ticketId viaja»<br>(+1 más) | Pasó | — |
| **CA-HU09-2** (Feliz) pido un corte de calle (POST /street-closure-requests) con al menos un tramo y closureType → se crea el pedido REQUESTED y se encola streetClosureRequested hacia M7 con sourceModule "M6" … | CP-086 | `outbound-requests.service.spec.ts` › «intervención AUTHORIZED: se crea y se encola»<br>`outbound-requests.service.spec.ts` › «sourceModule viaja como M6, que es lo que dice la tabla de M7»<br>(+1 más) | Pasó (corregido: ACT-14) | Corregido en #447, #481 |
| **CA-HU09-3** (Error) creo la reparación sobre una inspección sin cerrar, NO_VIOLATION o de un expediente NOISE, o repito un pedido abierto; o creo un corte con requestedTo anterior a requestedFrom o sobre una… | CP-087, CP-088, CP-089, CP-090, CP-091 | `environmental-flow.e2e-spec.ts` › «sin cerrar: 409 y no se crea la solicitud»<br>`environmental-flow.e2e-spec.ts` › «cerrada con NO_VIOLATION: 409 y no se crea la solicitud»<br>(+3 más) | Pasó (corregido: ACT-28) | Corregido en #451 |
| **CA-HU09-4** (Alternativo) M7 lo aprueba, lo rechaza o lo da por terminado (approve, reject, end) → pasa a APPROVED guardando el closureId, REJECTED guardando el motivo, o ENDED (también desde REQUESTED o EXPIRED);… | CP-092, CP-093, CP-094, CP-095, CP-336 | `outbound-requests.service.spec.ts` › «aprobar guarda el identificador de corte de M7»<br>`outbound-requests.service.spec.ts` › «rechazar guarda el motivo para devolverlo en la respuesta»<br>(+3 más) | Pasó | — |
| **CA-HU09-5** (Falla externa) corre el barrido de vencimiento → el corte pasa a EXPIRED y el servicio no iniciado vuelve a reprogramarse; uno ya iniciado no se toca | CP-096, CP-097, CP-098 | `street-closure-expiry.e2e-spec.ts` › «persiste la ventana, vence por el barrido y reprograma el servicio»<br>`street-closure-expiry.sweeper.spec.ts` › «la gracia es de 6 horas»<br>(+2 más) | Pasó (corregido: ACT-22) | — |
| **CA-HU09-6** (Alternativo) consulto el pedido (GET /street-closure-requests/:id) → trae la ventana pedida (closureFrom, closureTo), la autorizada (approvedFrom, approvedTo; null hasta aprobar) y el motivo de rechaz… | CP-303, CP-304, CP-305, CP-306 | `outbound-requests.service.spec.ts` › «la respuesta expone la ventana autorizada y el motivo de rechazo (null si no hay)»<br>`consumers.spec.ts` › «el corte aprobado persiste la ventana autorizada en approvedFrom/approve»<br>(+3 más) | Pasó (corregido: ACT-14) | — |

## HU-10 — Filtrar las intervenciones de arbolado por prioridad

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU10-1** (Feliz) elijo una o más prioridades (GET /tree-interventions?priority=) → solo veo las intervenciones con esa prioridad y la paginación cuenta sobre el total filtrado | CP-099 | `tree-interventions.service.spec.ts` › «filtra por prioridad combinada con tipo y estado»<br>FE: `tree-interventions.spec.ts` | Pasó (solo la parte backend; la del frontend no se ejecutó) | — |
| **CA-HU10-2** (Error) llamo al endpoint → recibo 400 con el error estándar | CP-100 | **HUECO** sin test: La validación del enum la hace el ValidationPipe; no se encontró un test específico del filtro priority en esta pasada. | No ejecutado (sin test automatizado) | — |
| **CA-HU10-3** (Alternativo) recargo → vuelvo a ver todas las intervenciones | CP-101 | `tree-interventions.service.spec.ts` › «filtra por tipo y estado»<br>FE: `tree-interventions.spec.ts` | Pasó (solo la parte backend; la del frontend no se ejecutó) | — |

## HU-11 — Gestión de contenedores (desborde, daño, vaciado, reparación y reubicación)

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU11-1** (Feliz) reporto desborde (report-overflow) y luego lo vacío (empty) → pasa ACTIVE → OVERFLOWED → ACTIVE, y cada transición deja una fila de historial y de auditoría con el actor del token | CP-102 | `containers.service.spec.ts` › «reportOverflow lleva de ACTIVE a OVERFLOWED»<br>`containers.service.spec.ts` › «empty vuelve a ACTIVE y limpia los datos del daño»<br>(+2 más) | Pasó | — |
| **CA-HU11-2** (Feliz) reporto daño (report-damage), inicio y completo la reparación → pasa ACTIVE → DAMAGED → UNDER_REPAIR → ACTIVE, se publica containerDamaged en la misma transacción y al completar se limpia… | CP-103 | `containers.service.spec.ts` › «guarda el daño y publica containerDamaged»<br>`containers.service.spec.ts` › «el evento se encola en la misma transacción que el cambio de estado»<br>(+1 más) | Pasó | — |
| **CA-HU11-3** (Alternativo) lo reubico (relocate → confirm-relocation) o lo retiro (remove) → pasa a RELOCATING y vuelve a ACTIVE con la ubicación nueva, o a REMOVED solo desde DAMAGED; REMOVED no tiene salida | CP-104, CP-105, CP-106 | `containers.service.spec.ts` › «confirmRelocation guarda la ubicación nueva»<br>`containers.service.spec.ts` › «startRepair y remove salen los dos de DAMAGED»<br>(+1 más) | Pasó | — |
| **CA-HU11-4** (Error) la invoco → recibo 409 nombrando las transiciones válidas; un contenedor inexistente da 404 y un código repetido en el alta da 409 | CP-107, CP-108, CP-109, CP-110, CP-111 | `containers.service.spec.ts` › «desde %s, el guard respeta la tabla»<br>`containers.service.spec.ts` › «el 409 nombra las transiciones válidas desde donde está»<br>(+5 más) | Pasó | — |
| **CA-HU11-5** (Error) intento reportar un daño, un desborde o vaciar un contenedor → recibo 403 con code ROLE_REQUIRED | CP-112 | `auth-roles.e2e-spec.ts` › «$grupo: $method $path» | Pasó (corregido: ACT-01) | — |
| **CA-HU11-6** (Falla externa) reporto un daño → el reporte no se pierde (containerDamaged queda en el outbox PENDING); si falla la fila de historial, la acción entera falla y no se publica el evento | CP-113, CP-114 | `containers.service.spec.ts` › «si falla el historial la acción entera falla y no se publica el evento»<br>`containers.service.spec.ts` › «el evento se encola en la misma transacción que el cambio de estado»<br>(+1 más) | Pasó | — |
| **CA-HU11-7** (Alternativo) consulto GET /containers/:id/history o reporto el daño con observations → el historial sale paginado del más reciente al más antiguo (404 si el contenedor no existe) y las observaciones s… | CP-307, CP-308, CP-309, CP-310 | `containers.service.spec.ts` › «lista paginado y del más reciente al más antiguo»<br>`containers.service.spec.ts` › «da 404 si el contenedor no existe»<br>(+2 más) | Pasó (corregido: ACT-30) | — |

## HU-12 — Censo de arbolado, relevamientos de riesgo y podas o extracciones

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU12-1** (Feliz) cargo un relevamiento con riskLevel HIGH o CRITICAL y riskType → se guarda el relevamiento y se publica treeRiskDetected hacia M3 en la misma transacción, con la fecha del relevamiento co… | CP-115 | `tree-surveys.service.spec.ts` › «un riesgo %s publica treeRiskDetected»<br>`tree-surveys.service.spec.ts` › «el evento y el relevamiento van en la misma transacción»<br>(+1 más) | Pasó | — |
| **CA-HU12-2** (Feliz) la autoriza un usuario M6_OFICINA_OPERACIONES y la asocio a un servicio POINT → pasa a AUTHORIZED con fecha de autorización y queda vinculada al servicio | CP-116 | `tree-interventions.service.spec.ts` › «una poda la autoriza quien tiene rol de operaciones, sin M6_ADMIN»<br>`tree-interventions.service.spec.ts` › «asocia el servicio sin encolar eventos»<br>(+1 más) | Pasó (corregido: ACT-08) | — |
| **CA-HU12-3** (Alternativo) la mando a autorizar y la decide un M6_ADMIN → pasa REQUESTED → PENDING_AUTHORIZATION → AUTHORIZED, y la respuesta dice quién la solicitó y quién la autorizó; un M6_ADMIN puede autorizar … | CP-117 | `tree-intervention-authorization.e2e-spec.ts` › «M6_ADMIN autoriza una extracción y la respuesta dice quién la solicitó y quién la autorizó»<br>`tree-intervention-authorization.e2e-spec.ts` › «M6_ADMIN autoriza lo que él mismo solicitó y queda registrado» | Pasó (corregido: ACT-08) | Corregido en #456 |
| **CA-HU12-4** (Error) la autoriza o rechaza M6_OFICINA_OPERACIONES, o se autoriza estando en REQUESTED → recibo 403 ROLE_REQUIRED (rol) o 409 (REQUESTED) y la intervención sigue pendiente | CP-118, CP-119, CP-337 | `tree-intervention-authorization.e2e-spec.ts` › «Operaciones no autoriza una extracción: 403 ROLE_REQUIRED y sigue pendiente»<br>`tree-intervention-authorization.e2e-spec.ts` › «Operaciones no rechaza una extracción: 403 ROLE_REQUIRED»<br>(+2 más) | Pasó (corregido: ACT-08) | Corregido en #456 |
| **CA-HU12-5** (Error) envío riskLevel HIGH sin riskType, surveyedAt posterior a hoy (huso Argentina), un árbol inexistente, una intervención no AUTHORIZED o un servicio que no es POINT o que ya ejecuta otra in… | CP-120, CP-121, CP-122, CP-123, CP-124 | `tree-surveys.service.spec.ts` › «un riesgo %s sin riskType da 400 sin escribir nada»<br>`tree-surveys.service.spec.ts` › «un árbol inexistente da 404 sin escribir nada»<br>(+2 más) | Pasó | — |
| **CA-HU12-6** (Alternativo) lo cargo → se guarda pero no se publica treeRiskDetected | CP-125 | `tree-surveys.service.spec.ts` › «un riesgo %s se guarda pero no publica nada» | Pasó | — |
| **CA-HU12-7** (Falla externa) cargo un relevamiento HIGH → el relevamiento queda guardado y treeRiskDetected queda en el outbox para el reintento del dispatcher | CP-126 | `tree-surveys.service.spec.ts` › «el evento y el relevamiento van en la misma transacción»<br>`outbox-dispatcher.service.spec.ts` › «una falla la deja PENDING para que la proxima barrida reintente» | Pasó | — |

## HU-13 — Administrar espacios verdes y puntos verdes

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU13-1** (Feliz) registro un espacio verde o un punto verde con una zona existente → recibo 201 y el recurso nace activo | CP-127, CP-128 | `green-spaces.service.spec.ts` › «nace activo y sin superficie si no se la pasan»<br>`green-points.service.spec.ts` › «devuelve los tipos de residuo ordenados» | Pasó | — |
| **CA-HU13-2** (Alternativo) lo actualizo con un nuevo array wasteTypes → el array reemplaza el conjunto completo | CP-129 | `green-points.service.spec.ts` › «al actualizar los tipos de residuo reemplaza el conjunto completo» | Pasó | — |
| **CA-HU13-3** (Error) creo o actualizo → recibo 404 (zona o recurso inexistente) o 409 (code repetido) | CP-130, CP-131, CP-132 | `green-spaces.service.spec.ts` › «una zona inexistente da 404»<br>`green-points.service.spec.ts` › «traduce el codigo duplicado a 409»<br>(+1 más) | Pasó | — |
| **CA-HU13-4** (Alternativo) ejecuto DELETE → recibo 204 y queda inactivo (baja lógica) | CP-133 | `green-spaces.service.spec.ts` › «es baja lógica, no borrado»<br>`green-points.service.spec.ts` › «la baja es logica» | Pasó | — |

## HU-14 — Filtrar la cola de denuncias por rango de fechas

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU14-1** (Feliz) elijo "desde" y "hasta" (GET /environmental-reports?from=&to=) → veo solo las denuncias del rango, inclusivo, en día argentino (UTC-3) y meta.total refleja el rango | CP-134 | `environmental-reports.service.spec.ts` › «from/to filtran updatedAt por días argentinos, to inclusivo»<br>FE: `environmental-reports.spec.ts` | Pasó (solo la parte backend; la del frontend no se ejecutó) | — |
| **CA-HU14-2** (Error) filtro → recibo 400 sin consultar la base y el formulario me avisa | CP-135, CP-136 | `environmental-reports.service.spec.ts` › «from posterior a to da 400 y no consulta la base»<br>`query-environmental-reports.dto.spec.ts` | Pasó (corregido: ACT-18) | — |
| **CA-HU14-3** (Alternativo) filtro → el rango queda abierto de ese lado | CP-137 | `environmental-reports.service.spec.ts` › «acepta solo from o solo to» | Pasó (corregido: ACT-18) | — |
| **CA-HU14-4** (Alternativo) filtro por varios estados (status repetido o separado por comas) → veo los expedientes de cualquiera de esos estados (OR), los duplicados se ignoran, meta.total ya viene filtrado y un val… | CP-311, CP-312, CP-313 | `environmental-reports.service.spec.ts` › «status con varios valores filtra con in y count usa el mismo where»<br>`environmental-reports.service.spec.ts` › «sin status el where no trae la clave»<br>(+1 más) | Pasó (corregido: ACT-18) | — |

## HU-15 — Recibir denuncias ambientales y asignarlas a una cuadrilla para inspeccionarlas

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU15-1** (Feliz) lo tomo para análisis (start-review) → pasa a UNDER_REVIEW y, si nació de un reclamo, M2 recibe un updateTicketStatus | CP-138 | `environmental-reports.service.spec.ts` › «startReview lo pone en análisis y le avisa al vecino»<br>`environmental-flow.e2e-spec.ts` › «recibe la denuncia y la toma para análisis» | Pasó | — |
| **CA-HU15-2** (Feliz) programo la inspección (POST /environmental-reports/:reportId/inspections) → el expediente pasa a INSPECTION_SCHEDULED, la inspección se ejecuta como un Service POINT y assignedCrewId ref… | CP-139 | `environmental-flow.e2e-spec.ts` › «programa la inspección y deja el expediente en INSPECTION_SCHEDULED»<br>`environmental-flow.e2e-spec.ts` › «programa el servicio de la inspección y el vínculo queda en la inspección (#218)»<br>(+1 más) | Pasó | — |
| **CA-HU15-3** (Alternativo) abro un expediente de oficio (sin ticketId), o con ticketId → el inspector abre de oficio y recibe 400 si manda ticketId; Oficina Ambiental o Admin pueden enviar ticketId | CP-140, CP-141 | `environmental-reports.service.spec.ts` › «un inspector sí abre expedientes de oficio (sin ticketId)»<br>`environmental-reports.service.spec.ts` › «un expediente de oficio nace en RECEIVED y sin reclamo»<br>(+1 más) | Pasó | — |
| **CA-HU15-4** (Error) invoco una acción que la tabla de estados no permite, o asigno un inspectorId sin M6_CAMPO_INSPECTOR → recibo 409 nombrando las transiciones válidas, o 400 en el inspector, y no se escrib… | CP-142, CP-143, CP-144 | `environmental-reports.service.spec.ts` › «una acción que la tabla no permite no escribe nada»<br>`environmental-reports.service.spec.ts` › «el 409 nombra las transiciones válidas desde donde está»<br>(+3 más) | Pasó | — |
| **CA-HU15-5** (Falla externa) lo proceso → un ROUTED repetido no abre un segundo expediente; uno de otra área no persiste nada; uno que depende de un ROUTED aún no recibido sale failed y el reintento del Core lo aplic… | CP-145, CP-146, CP-147 | `consumers.spec.ts` › «un ROUTED repetido no abre un segundo expediente»<br>`consumers.spec.ts` › «no persiste nada de un ticket que no es nuestro»<br>(+2 más) | Pasó | — |

## HU-16 — Registrar la inspección y emitir el acta de constatación

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU16-1** (Feliz) la cierro con VIOLATION_FOUND y nextStep → el expediente pasa a VIOLATION_FOUND y completedByUserId queda con el usuario del token | CP-148 | `environmental-flow.e2e-spec.ts` › «cierra la inspección con infracción y lleva el expediente a VIOLATION_FOUND»<br>`environmental-inspections.service.spec.ts` › «VIOLATION_FOUND lleva el expediente hasta VIOLATION_FOUND»<br>(+1 más) | Pasó | — |
| **CA-HU16-2** (Feliz) emito el acta (POST /environmental-inspections/:id/violation-notice) → el expediente pasa a NOTICE_ISSUED, se fija el plazo de vencimiento, el número de acta es correlativo por año y se p… | CP-149 | `environmental-flow.e2e-spec.ts` › «emite el acta, la deriva a M4 y cierra el expediente en NOTICE_ISSUED»<br>`environmental-inspections.service.spec.ts` › «publica environmentalViolationDetected cuando hay establecimiento»<br>(+2 más) | Pasó | — |
| **CA-HU16-3** (Alternativo) completo la inspección o emito el acta → NO_VIOLATION lleva el expediente a NO_VIOLATION; INCONCLUSIVE lo deja en INSPECTED; un acta sin establishmentId se registra pero no se deriva a M4… | CP-150, CP-151, CP-152, CP-153 | `environmental-inspections.service.spec.ts` › «NO_VIOLATION lleva el expediente hasta NO_VIOLATION»<br>`environmental-inspections.service.spec.ts` › «INCONCLUSIVE lo deja en INSPECTED, esperando otra inspeccion»<br>(+2 más) | Pasó (corregido: ACT-17) | Corregido en #284 |
| **CA-HU16-4** (Error) emito una segunda acta sobre la misma inspección, emito acta sobre una inspección sin VIOLATION_FOUND o sin cerrar, cierro con inspectedAt futuro, cierro VIOLATION_FOUND sin nextStep o ci… | CP-154, CP-155, CP-156, CP-157, CP-158 | `environmental-flow.e2e-spec.ts` › «no deja emitir una segunda acta sobre la misma inspección»<br>`environmental-inspections.service.spec.ts` › «el acta es inmutable: no se emite una segunda sobre la misma inspe»<br>(+4 más) | Pasó | — |
| **CA-HU16-5** (Error) la intento cerrar → recibo 403 NOT_ASSIGNED, la inspección sigue abierta y el 403 va antes que el 409 de "ya cerrada" | CP-159, CP-160 | `crew-ownership.e2e-spec.ts` › «otro inspector que el asignado: 403 NOT_ASSIGNED y la inspección sigue abierta»<br>`crew-ownership.e2e-spec.ts` › «una inspección ya cerrada: el ajeno ve 403 (no el 409), el asignado ve 409»<br>(+1 más) | Pasó (corregido: ACT-04) | — |
| **CA-HU16-6** (Falla externa) emito el acta → el acta queda registrada y environmentalViolationDetected queda en el outbox para el reintento; con el ticket de M2 en estado terminal no se publica el aviso | CP-161, CP-162 | `environmental-inspections.service.spec.ts` › «publica environmentalViolationDetected cuando hay establecimiento»<br>`outbox-dispatcher.service.spec.ts` › «una falla la deja PENDING para que la proxima barrida reintente»<br>(+1 más) | Pasó | — |
| **CA-HU16-7** (Alternativo) consulto GET /environmental-inspections/:id → trae reportType, address, lat y lng del expediente (null sin coordenadas) y allowedActions (repair, notice, suggestedViolationType); con acta… | CP-314, CP-315, CP-316 | `environmental-inspections.service.spec.ts` › «findOne expone tipo, dirección y coordenadas del expediente (Deci»<br>`environmental-inspections.service.spec.ts` › «findOne devuelve lat y lng null si el expediente no tiene coordena»<br>(+1 más) | Pasó (corregido: ACT-29) | — |
| **CA-HU16-8** (Alternativo) se informa a M2 → sale STARTED si el ticket no pasó por start-review o está en ROUTED, PROGRESS si ya está IN_PROGRESS, y no se publica ni se consulta el estado sin ticketId | CP-317, CP-318, CP-319 | `environmental-notice-ticket.e2e-spec.ts` › «sin startReview previo el acta informa STARTED, no PROGRESS»<br>`environmental-notice-ticket.e2e-spec.ts` › «con startReview previo el acta informa PROGRESS»<br>(+2 más) | Pasó (corregido: ACT-31) | — |

## HU-17 — Registrar la sanción que devuelve M4 y cerrar el expediente

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU17-1** (Feliz) M4 publica commercialFineGenerated con el sourceViolationId del acta → se crea el SanctionOutcome y el expediente pasa a SANCTIONED y se cierra | CP-163 | `environmental-flow.e2e-spec.ts` › «recibe la multa de M4 por el inbox, registra la resolución y cierra el expediente»<br>`consumers.spec.ts` › «la multa crea el SanctionOutcome y cierra el expediente»<br>(+1 más) | Pasó (corregido: ACT-26) | Corregido en #374 |
| **CA-HU17-2** (Alternativo) M4 publica closureUpdate ORDERED o LIFTED → ORDERED registra la clausura como resolución y LIFTED registra el levantamiento y cierra | CP-164, CP-165 | `consumers.spec.ts` › «closureUpdate ORDERED registra la clausura»<br>`consumers.spec.ts` › «closureUpdate LIFTED registra el levantamiento» | Pasó | — |
| **CA-HU17-3** (Error) llega al inbox → por HTTP recibo 400 y no se guarda la fila; un acta ya resuelta no se resuelve dos veces; sin sourceViolationId el consumidor lo descarta | CP-166, CP-167 | `environmental-flow.e2e-spec.ts` › «rechaza con 400 una multa sin sourceViolationId válido y no guarda la fila»<br>`consumers.spec.ts` › «sin sourceViolationId no sabemos que acta resolvieron: se descarta»<br>(+1 más) | Pasó | — |
| **CA-HU17-4** (Falla externa) vence el plazo (deadlineAt, SANCTION_DEADLINE_DAYS) de un expediente NOTICE_ISSUED → el sistema lo cierra solo (NOTICE_ISSUED → CLOSED) y no toca los que no están vencidos | CP-168, CP-169 | `report-deadline.sweeper.spec.ts` › «cierra solo los NOTICE_ISSUED con el plazo vencido»<br>`report-deadline.sweeper.spec.ts` › «si la base no responde al arrancar, no tumba el arranq» | Pasó | — |

## HU-18 — Pedirle información adicional al vecino (INFORMATION_REQUIRED)

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU18-1** (Feliz) pido información (POST /environmental-reports/:id/request-information) con un mensaje de hasta 500 caracteres → queda informationRequestPending en true y se encola INFORMATION_REQUIRED ha… | CP-170 | `information-request.e2e-spec.ts` › «pide información, queda pendiente y avisa a M2»<br>`environmental-reports.service.spec.ts` › «marca la solicitud y encola INFORMATION_REQUIRED en la misma transacción» | Pasó (corregido: ACT-21) | Corregido en #169, #338, #342 |
| **CA-HU18-2** (Alternativo) M2 envía INFORMATION_PROVIDED o un cambio de estado distinto de PENDING_INFORMATION → la solicitud se cierra y se guarda lo que contestó el vecino; una de reclasificación (purpose) se ignora | CP-171, CP-172 | `information-request.e2e-spec.ts` › «la respuesta de M2 cierra la solicitud y guarda lo que contestó el vecino»<br>`consumers.spec.ts` › «INFORMATION_PROVIDED cierra la solicitud pendiente junto con guardar la respuesta»<br>(+1 más) | Pasó (corregido: ACT-21) | Corregido en #169, #338, #342 |
| **CA-HU18-3** (Error) pido información, o envío requiredBy en el pasado → recibo 409 (estado, ticket, duplicada) o 400 (requiredBy pasado) y no se encola nada; mientras hay una pendiente, forward, dismiss y cl… | CP-173, CP-174, CP-175, CP-176, CP-177 | `environmental-reports.service.spec.ts` › «409 si el expediente no nació de un reclamo: no hay a quién preguntarle»<br>`information-request.e2e-spec.ts` › «un segundo pedido es 409 y no encola otro evento»<br>(+3 más) | Pasó (corregido: ACT-21) | Corregido en #169, #338, #342 |
| **CA-HU18-4** (Falla externa) pasa el tiempo sin INFORMATION_PROVIDED → la solicitud sigue pendiente y bloquea forward, dismiss y close hasta que M2 informe un estado distinto de PENDING_INFORMATION | CP-178 | `information-request.e2e-spec.ts` › «con una pendiente, forward es 409; un estado distinto de PENDING_INFORMATION la apaga» | Pasó (corregido: ACT-21) | Corregido en #169, #338, #342 |

## HU-19 — M9 conoce los eventos que publica y consume M6

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU19-1** (Feliz) M6 arranca con CORE_REGISTER_ON_BOOT activo o se ejecuta npm run core:register → quedan registradas 6 publicaciones y 8 suscripciones (weatherAlertIssued es simulado y no se suscribe), co… | CP-179 | `core-registry.service.spec.ts` › «registra lo que sale del código: 8 suscripciones (sin weatherAlertIssued) y 6 publicaciones» | Pasó (corregido: ACT-25) | Corregido en #266, #381, #391 |
| **CA-HU19-2** (Alternativo) se ejecuta el registro → crea solo lo que falta, loguea lo que sobra sin borrarlo y no duplica nada; el modo simulacro no hace ningún POST | CP-180, CP-181 | `core-registry.service.spec.ts` › «crea solo lo que falta y loguea lo que sobra sin borrarlo»<br>`core-registry.service.spec.ts` › «correrlo dos veces no duplica nada»<br>(+1 más) | Pasó (corregido: ACT-25) | Corregido en #266, #381, #391 |
| **CA-HU19-3** (Falla externa) M6 intenta registrarse → el arranque de M6 no se bloquea, el registro se reintenta con backoff y abandona al llegar a los intentos máximos; con una respuesta paginada incompleta no crea n… | CP-182, CP-183, CP-184 | `core-registry.service.spec.ts` › «una falla del Core no tira la app: se reintenta con backoff y se complet»<br>`core-registry.service.spec.ts` › «abandona tras los intentos máximos»<br>(+2 más) | Pasó | — |

## HU-20 — Adaptar M6 al contrato de integración definitivo de M9

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU20-1** (Feliz) el dispatcher lo publica al exchange fanout muni.inbox → el sobre lleva exactamente las claves del Core, el eventId es el id de la fila, occurredAt va en ISO 8601 con offset y la fila que… | CP-185 | `outbox-dispatcher.service.spec.ts` › «envuelve el payload en el sobre del Core»<br>`outbox-dispatcher.service.spec.ts` › «el sobre lleva exactamente las claves del Core, sin extras»<br>(+3 más) | Pasó | Abierto: paraguas BE #257 (adaptación al contrato definitivo de M9) |
| **CA-HU20-2** (Feliz) M6 lo consume → si el inbox responde processed, duplicate o ignored se hace ack, y el sobre llega al inbox con eventId y correlación | CP-186 | `rabbitmq.consumer.spec.ts` › «%s → ack»<br>`rabbitmq.consumer.spec.ts` › «el sobre del Core llega al inbox con eventId y la correlación»<br>(+1 más) | Pasó (corregido: ACT-24) | Abierto: paraguas BE #257 |
| **CA-HU20-3** (Error) se consume → el resultado failed, un cuerpo que no es JSON o un payload inválido producen nack sin reencolar y el Core reintenta con su backoff | CP-187, CP-188, CP-189 | `rabbitmq.consumer.spec.ts` › «failed → nack, para que el Core reintente con backoff»<br>`rabbitmq.consumer.spec.ts` › «un cuerpo que no es JSON → nack»<br>(+1 más) | Pasó | — |
| **CA-HU20-4** (Alternativo) llega al inbox → los handlers tratan un campo ausente igual que null y el inbox lo acepta y procesa | CP-190 | `sobre-reserializado.spec.ts` › «con el ROUTED sin los nulls el snapshot sale igual de completo»<br>`sobre-reserializado.spec.ts` › «el inbox lo acepta y procesa» | Pasó (corregido: ACT-24) | — |
| **CA-HU20-5** (Falla externa) arranca o corre el consumidor → sin la cola loguea y falla el setup para que recovery reintente; si el broker cancela el consumo cierra el canal para reconectar; sin RABBITMQ_URL no insta… | CP-191, CP-192, CP-193, CP-194 | `rabbitmq.consumer.spec.ts` › «sin la cola (falta suscribirse en el Core) loguea y falla el setup para que recovery reintente»<br>`rabbitmq.consumer.spec.ts` › «si el broker cancela el consumo, cierra el canal para reconectar»<br>(+2 más) | Pasó (corregido: ACT-24) | — |

## HU-21 — Ver en M2 la fecha y la franja en que se agendó mi reclamo

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU21-1** (Feliz) se programa → M2 recibe un updateTicketStatus STARTED con la fecha y la franja en es-AR dentro de publicMessage | CP-195, CP-196 | `services.service.spec.ts` › «agendar con el ticket en %s manda STARTED con la programación»<br>`ticket-state.spec.ts` › «fecha y franja, en es-AR»<br>(+1 más) | Pasó (corregido: ACT-19) | Corregido en #303, #309, #396 |
| **CA-HU21-2** (Feliz) cambio la fecha (confirm-reschedule) → M2 recibe un PROGRESS con la fecha nueva y no se repite el STARTED | CP-197 | `services.service.spec.ts` › «confirmar la fecha nueva con el ticket IN_PROGRESS manda PROGRESS»<br>`services.service.spec.ts` › «agendar con el ticket IN_PROGRESS manda PROGRESS» | Pasó (corregido: ACT-19) | Corregido en #303, #309, #396 |
| **CA-HU21-3** (Error) se programa → no se publica ningún aviso (M2 lo rechazaría) y el mensaje nunca incluye cuadrilla ni notas | CP-198, CP-199, CP-200 | `services.service.spec.ts` › «agendar con el ticket en %s no publica (M2 lo rechazaría)»<br>`services.service.spec.ts` › «un servicio sin ticketId no publica nada hacia M2»<br>(+1 más) | Pasó (corregido: ACT-19) | Corregido en #303, #309, #396 |
| **CA-HU21-4** (Falla externa) se agenda el servicio → el servicio se guarda y el aviso queda PENDING en el outbox, que el dispatcher reenvía; el estado del ticket se lee con el cliente de la transacción | CP-201 | `services.service.spec.ts` › «el estado se lee con el cliente de la transacción»<br>`outbox-dispatcher.service.spec.ts` › «una falla la deja PENDING para que la proxima barrida reintente» | Pasó | — |
| **CA-HU21-5** (Alternativo) se publica el aviso → updatedBy.id es el actorId UUID del JWT de M1 o null si no vino; nunca el sub | CP-320, CP-321, CP-322 | `services-delay-assignment.spec.ts` › «updatedBy.id sale del actorId de M1, y es null si no vino»<br>`environmental-reports.service.spec.ts` › «sin actorId en el token, updatedBy.id viaja null y no se usa el sub»<br>(+1 más) | Pasó (corregido: ACT-07) | — |

## HU-22 — M2 reasigna o reclasifica un ticket sin que M6 lo confunda con una respuesta del vecino

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU22-1** (Feliz) llega al inbox → se abre el expediente con el snapshot de details.routing y el escalamiento | CP-202 | `consumers.spec.ts` › «ROUTED lee el snapshot de details.routing y deduce el tipo del texto»<br>`consumers.spec.ts` › «ROUTED toma el escalamiento del snapshot» | Pasó | — |
| **CA-HU22-2** (Alternativo) llega al inbox → se ignora y no se guarda como respuesta del vecino | CP-203 | `consumers.spec.ts` › «INFORMATION_PROVIDED de una reclasificación (purpose) se ignora» | Pasó (corregido: ACT-20) | — |
| **CA-HU22-3** (Error) llega al inbox → no persiste nada del ticket, no publica y no modifica el expediente | CP-204 | `consumers.spec.ts` › «el filtro de responsibleAreaId tambien protege a los updateType que actuan sobre un expediente ya abierto»<br>`consumers.spec.ts` › «un evento de otra área que no es ROUTED no toca el expediente» | Pasó (corregido: ACT-20) | — |
| **CA-HU22-4** (Alternativo) llega CANCELLED → se cancelan los servicios programados del reclamo y solo los que admiten esa transición | CP-205 | `consumers.spec.ts` › «CANCELLED cancela los servicios programados del reclamo»<br>`consumers.spec.ts` › «CANCELLED solo toca los estados desde los que se puede cancelar» | Pasó (corregido: ACT-20) | — |
| **CA-HU22-5** (Falla externa) llega tarde por el bus → no pisa el estado más nuevo, ordenando por data.updatedAt y no por occurredAt del sobre | CP-206 | `inbox.e2e-spec.ts` › «el reintento atrasado de un ESCALATION_CHANGED no pisa al más nuevo»<br>`consumers.spec.ts` › «ordena por data.updatedAt y no por el occurredAt del sobre» | Pasó (corregido: ACT-20) | — |

## HU-23 — Publicar y consumir eventos con outbox/inbox idempotente

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU23-1** (Feliz) corre el dispatcher y el broker acepta el mensaje → la fila pasa a SENT con publishedAt y el cambio de dominio y la fila nacieron juntos | CP-207 | `outbox-dispatcher.service.spec.ts` › «marca SENT con publishedAt cuando la publicacion sale bien»<br>`outbox.service.spec.ts` › «escribe con el cliente de transacción que recibe» | Pasó | — |
| **CA-HU23-2** (Alternativo) llega por segunda vez al inbox → se registra como duplicate, no se vuelve a aplicar el efecto y no hay error | CP-208, CP-209, CP-338 | `inbox.e2e-spec.ts` › «descarta el mismo eventId sin volver a aplicarlo»<br>`inbox.service.spec.ts` › «un messageId ya procesado NO vuelve a aplicar el efecto»<br>(+3 más) | Pasó | — |
| **CA-HU23-3** (Error) llega a POST /events/inbox → recibo 400 diciendo qué corregir, no se aplica ningún efecto y no queda fila en el inbox; el mismo eventId corregido se procesa | CP-210, CP-211, CP-339 | `inbox.e2e-spec.ts` › «rechaza con 400 el payload inválido y no guarda la fila»<br>`inbox-validation.spec.ts` › «%s con %j da 400 y nombra %s»<br>(+2 más) | Pasó | — |
| **CA-HU23-4** (Falla externa) corren el dispatcher o el inbox → la fila del outbox queda FAILED con lastError y deja de barrerse, y M6_ADMIN la reencola con retry (FAILED → PENDING → SENT, auditado); un handler que fa… | CP-212, CP-213, CP-214, CP-215, CP-216 | `outbox-dispatcher.service.spec.ts` › «al agotar los intentos la marca FAILED y deja de tomarla»<br>`outbox-retry.e2e-spec.ts` › «FAILED → retry → PENDING → el dispatcher lo publica → SENT, y queda auditado»<br>(+3 más) | Pasó (corregido: ACT-11) | — |
| **CA-HU23-5** (Error) invoco POST /events/inbox → recibo 403 y no se procesa nada | CP-217, CP-218 | `inbox.e2e-spec.ts` › «un token de ciudadano recibe 403 en lectura, escritura e inbox; el de empleado pasa»<br>`auth-roles.e2e-spec.ts` › «$grupo: $method $path» | Pasó (corregido: ACT-03) | — |

## HU-24 — Probar M6 contra el Core real de M9 antes de la entrega

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU24-1** (Feliz) M6 publica en muni.inbox y consume de q.ambiente → los eventos de ida y vuelta se ven funcionando | CP-219, CP-340 | `rabbitmq-real.e2e-spec.ts` › «procesa un mensaje válido»<br>**Parcial:** cubre el consumo contra un RabbitMQ real (contenedor propio, cola propia). La publicación del outbox a `muni.inbox` y el Core de M9 no tienen test automatizado; esa parte quedó en el historial de integración (#299, #442). | Pasó, parcial: solo el consumo contra RabbitMQ real | Pendiente BE #299 y #442 (no es un defecto registrado) |
| **CA-HU24-2** (Alternativo) ejecuto la prueba pasiva desde Render (BE #442) → se verifica TCP/TLS, autenticación y checkQueue de q.ambiente sin publicar ni consumir, y se documenta el eventId del evento pruebaConexi… | CP-220 | **HUECO** sin test: Prueba manual en el ambiente desplegado; la evidencia está en el historial de integración (#442, cerrado el 05/11; la prueba con el Core real quedó en el historial de integración, sin test automatizado).<br>Nota: el chequeo pasivo de la cola corre contra un RabbitMQ real local en test/rabbitmq-real.e2e-spec.ts (sin TLS ni Render); no reemplaza esta prueba. | No ejecutado (la prueba pasiva desde Render no tiene test automatizado) | #442 cerrado el 05/11; sin test automatizado (no es un defecto registrado) |
| **CA-HU24-3** (Error) M6 arranca el consumidor → loguea el motivo y falla el setup para que recovery reintente, sin declarar colas ni bindings propios | CP-221, CP-341 | `rabbitmq.consumer.spec.ts` › «sin la cola (falta suscribirse en el Core) loguea y falla el setup para que recovery reintente»<br>`rabbitmq.consumer.spec.ts` › «verifica la cola del Core en modo pasivo, sin declarar ni bindear nada»<br>(+1 más) | Pasó | Pendiente BE #299 (no es un defecto registrado) |
| **CA-HU24-4** (Falla externa) M6 intenta publicar → el nack del broker se propaga, la fila queda PENDING y tras 5 intentos FAILED, y se reproduce con retry sin duplicar efecto en el receptor | CP-222, CP-223 | `rabbitmq.publisher.spec.ts` › «el nack del broker se propaga, para que el dispatcher deje la fila PENDING»<br>`rabbitmq.publisher.spec.ts` › «si la conexión falla, un intento posterior vuelve a probar»<br>(+2 más) | Pasó (corregido: ACT-11) | DEF-15 (corregido, #642): el corte al Core pasó de 10 s a 5 s; un usuario lo espera solo al dar de alta o editar una cuadrilla, o al sumarle integrantes, sin token de módulo en caché |

## HU-25 — Un ticket devuelto puede volver a derivarse a M6 y reactiva su expediente

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU25-1** (Feliz) llega al inbox → el expediente vuelve a UNDER_REVIEW con el snapshot nuevo, sin crear otro, y se publica un STARTED una sola vez | CP-224 | `consumers.spec.ts` › «reactiva el expediente devuelto con el snapshot nuevo, sin crear otro»<br>`consumers.spec.ts` › «publica un STARTED, una sola vez, en la misma operación» | Pasó (corregido: ACT-19, ACT-20) | Corregido en #303, #309, #396. Corregido en #170, #307 |
| **CA-HU25-2** (Error) llega al inbox → no se reactiva ni se publica nada | CP-225, CP-226 | `consumers.spec.ts` › «un expediente que no está FORWARDED no publica nada»<br>`consumers.spec.ts` › «un ROUTED más viejo que el último cambio del expediente no lo reactiva» | Pasó (corregido: ACT-20) | Corregido en #170, #307 |
| **CA-HU25-3** (Alternativo) llega al inbox → un ROUTED de otra área cierra el expediente devuelto sin leer su contenido y un CANCELLED lo cierra | CP-227, CP-228 | `consumers.spec.ts` › «un ROUTED de otra área cierra el expediente que habíamos devuelto, sin leer su contenido»<br>`consumers.spec.ts` › «si M2 cancela el ticket que habíamos devuelto, el expediente se cierra» | Pasó (corregido: ACT-20) | Corregido en #170, #307 |
| **CA-HU25-4** (Falla externa) se reentrega el ROUTED → no duplica la reactivación ni el aviso y no falla | CP-229 | `consumers.spec.ts` › «un reintento que ya no encuentra el expediente en FORWARDED no lo duplica» | Pasó | — |

## HU-26 — Fechas legibles y nombres en lugar de UUID en la demo

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU26-1** (Feliz) se muestra una fecha → está en formato argentino dd/mm/aaaa hh:mm y en el día local | CP-230 | **SOLO FE**: `Frontend-M6-DAPS2/src/lib/argentina-date.test.ts`<br>FE: `services-period.spec.ts` | Corregido (ACT-F4); sin ejecutar | — |
| **CA-HU26-2** (Feliz) lo veo → leo el nombre o el código, no el UUID | CP-231 | **SOLO FE**: `service-vehicle-labels.spec.ts` | Corregido (ACT-F4); sin ejecutar | — |
| **CA-HU26-3** (Error) se muestra la fecha → se muestra el día de Argentina (UTC-3), no el de UTC | CP-232 | **SOLO FE**: `Frontend-M6-DAPS2/src/lib/argentina-date.test.ts` | No ejecutado (solo test del frontend, sin verificar) | — |

## HU-27 — Consultar sin login el estado de mi denuncia, cuándo pasa el servicio y dónde están los puntos verdes

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU27-1** (Feliz) consulto GET /public/reports/:ticketId sin token → recibo 200 con la etapa (una de siete), el tipo, la dirección y las fechas, sin identidad del inspector, hallazgos, checklist ni acta | CP-233 | `citizen-portal.service.spec.ts` › «devuelve exactamente los campos públicos, ni uno más»<br>`citizen-portal.service.spec.ts` › «colapsa el estado interno a una etapa que el vecino puede leer»<br>(+2 más) | Pasó (solo la parte backend; la del frontend no se ejecutó) | — |
| **CA-HU27-2** (Alternativo) las hago sin fechas → veo los próximos 30 días desde hoy en Argentina, sin servicios cancelados ni datos de cuadrilla, vehículo o notas; y solo los puntos verdes activos con los residuos … | CP-234, CP-235 | `citizen-portal.service.spec.ts` › «sin fechas mira los próximos 30 días y saltea los cancelados»<br>`citizen-portal.service.spec.ts` › «sin from arranca hoy en Argentina aunque en UTC ya sea mañana»<br>(+2 más) | Pasó | — |
| **CA-HU27-3** (Error) consulto el seguimiento → recibo 404 sin datos y sin confirmar si el ticket existe en M2 | CP-236, CP-237 | `citizen-portal.service.spec.ts` › «un reclamo sin expediente da 404 sin decir si el ticket existe en M2» | Pasó | — |
| **CA-HU27-4** (Error) consulto → recibo 429; con la X-M6-BFF-Key correcta se cuenta la IP del vecino y con una clave incorrecta se ignora X-Forwarded-For | CP-238, CP-239 | `client-tracker.spec.ts` › «con la clave correcta usa la IP del vecino»<br>`client-tracker.spec.ts` › «con clave incorrecta (mismo largo) ignora el X-Forwarded-For» | Pasó (corregido: ACT-06) | Hueco de prueba: sin test de 429 de punta a punta. Corregido en #470; DEF-07 (cerrado, #580) |
| **CA-HU27-5** (Error) la hago → recibo 401, y solo /health y los cuatro /public/* son accesibles sin JWT | CP-240, CP-241 | `services-lifecycle.e2e-spec.ts` › «rechaza con 401 un pedido sin token»<br>`route-roles.spec.ts` › «solo los públicos esperados saltean la autorización»<br>(+1 más) | Pasó | — |

## HU-28 — Tablero de indicadores (cobertura, cumplimiento, incidencias y residuos)

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU28-1** (Feliz) consulto GET /indicators/coverage → la cobertura cuenta pares (servicio, zona), no servicios, y lo programado a futuro va aparte y no cuenta como pendiente | CP-242 | `indicators.service.spec.ts` › «cuenta pares servicio/zona, no servicios»<br>`indicators.service.spec.ts` › «lo programado a futuro no cuenta como programado ni como pendiente» | Pasó | — |
| **CA-HU28-2** (Alternativo) consulto con bucket y compare=previous → la suma de la serie es igual a totals y delta trae la diferencia; sin base en alguno de los períodos la diferencia es null | CP-243, CP-244 | `indicators.service.spec.ts` › «bucket=month corta en el último día de cada mes y recorta los bordes»<br>`indicators.service.spec.ts` › «compare=previous trae el período anterior de igual duración y la diferencia»<br>(+1 más) | Pasó (corregido: ACT-13) | Corregido en #461, #473, #475 |
| **CA-HU28-3** (Error) consulto con from posterior a to o con una serie de más de 90 puntos → recibo 400 con el motivo, antes de consultar la base | CP-245, CP-246 | `indicators.service.spec.ts` › «los cuatro indicadores rechazan from posterior a to»<br>`indicators.service.spec.ts` › «90 puntos entran; 91 responden 400 con el motivo y las dos salidas»<br>(+1 más) | Pasó (corregido: ACT-13) | — |
| **CA-HU28-4** (Alternativo) consulto incidencias → el porcentaje de vencidos y los contenedores dañados pendientes son null, no 0 | CP-247, CP-248 | `indicators.service.spec.ts` › «sin reclamos abiertos el porcentaje de vencidos es null, no 0 %»<br>`indicators.service.spec.ts` › «un contenedor sin filas hasta el fin del período no cuenta» | Pasó (corregido: ACT-13) | — |
| **CA-HU28-5** (Alternativo) consulto GET /indicators/incidents → reports.withinDeadline trae {resolved, withinDeadline, pct} y reports.overdue trae {open, overdue, pct, byZone}, en días hábiles contra INDICATORS_REPORT_DEAD… | CP-323, CP-324, CP-325, CP-326 | `indicators.service.spec.ts` › «vencido: abierto cuyos días hábiles desde el alta hasta hoy superan el plazo»<br>`indicators.service.spec.ts` › «de un viernes al viernes siguiente son 5 hábiles»<br>(+2 más) | Pasó (corregido: ACT-13) | — |
| **CA-HU28-6** (Alternativo) consulto GET /indicators/incidents → los desbordes y daños se cuentan por transición con origen no nulo (no por contenedor), los dañados pendientes salen del último estado conocido y sin … | CP-327, CP-328, CP-329, CP-330 | `indicators.service.spec.ts` › «cuenta un incidente de desborde por transición, no por contenedor»<br>`indicators.service.spec.ts` › «cuenta los incidentes de daño por transición a DAMAGED»<br>(+2 más) | Pasó (corregido: ACT-13) | — |

## HU-29 — Ver y hacer solo lo que mi rol permite, con el rol que viene de M1

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU29-1** (Error) llamo a un endpoint de gestión → recibo 401 | CP-249 | `auth-roles.e2e-spec.ts` › «sin token da 401» | Pasó (corregido: ACT-01) | — |
| **CA-HU29-2** (Error) intento emitir un acta o programar un servicio → recibo 403 con code ROLE_REQUIRED y el cuerpo no revela qué rol faltaba | CP-250 | `auth-roles.e2e-spec.ts` › «$grupo: $method $path»<br>`auth-roles.e2e-spec.ts` › «el 403 por rol no revela qué rol faltaba»<br>(+1 más) | Pasó (corregido: ACT-01) | — |
| **CA-HU29-3** (Feliz) programo un servicio → recibo 2xx; y un GET permitido devuelve 200 también al auditor, que no puede escribir | CP-251, CP-252 | `auth-roles.e2e-spec.ts` › «$grupo: $method $path»<br>`auth-roles.e2e-spec.ts` › «un GET permitido devuelve 200 y el auditor lee pero no escribe»<br>(+1 más) | Pasó (corregido: ACT-01) | — |
| **CA-HU29-4** (Feliz) consulto GET /me → el menú muestra solo las capacidades que devuelve GET /me (roles, cuadrillas e isAssignedInspector) | CP-253 | `demo-personas.e2e-spec.ts` › «GET /me: el líder y el integrante ven su cuadrilla con su rol»<br>FE: `access-roles.spec.ts`<br>(+1 más) | Pasó (solo la parte backend; la del frontend no se ejecutó) | — |
| **CA-HU29-5** (Error) lo uso → 401 para los tokens inválidos, 403 para el ciudadano y para el empleado sin roles (salvo GET /me, que responde) | CP-254, CP-255, CP-256 | `jwt-auth.guard.spec.ts` › «rechaza a un ciudadano con 403 y mensaje claro»<br>`demo-personas.e2e-spec.ts` › «el ciudadano queda afuera, también de GET /me»<br>(+3 más) | Pasó (corregido: ACT-02, ACT-03) | — |
| **CA-HU29-6** (Error) intento cambiar los roles (PUT o DELETE /role-assignments/:userId) → recibo 409 (quitaría el último admin) o 400 (mezcla Oficina y Campo, rol inexistente o repetido) y no cambia nada | CP-257, CP-258, CP-259 | `role-assignments.e2e-spec.ts` › «no deja el sistema sin M6_ADMIN cuando no hay admins de bootstrap»<br>`role-assignments.e2e-spec.ts` › «exclusividad Oficina/Campo: 400 y no cambia nada»<br>(+1 más) | Pasó | — |
| **CA-HU29-7** (Falla externa) llega un JWT de M1 → un rol desconocido no autoriza (nunca roles de M6); un rol de M6 asignado que el rol de M1 ya no permite queda dormido; los roles se leen de la base en cada request | CP-260, CP-261 | `m1-role.adapter.spec.ts` › «valor desconocido %p: ninguno y warn»<br>`jwt.strategy.spec.ts` › «sin filas en la tabla no hay roles efectivos (el rol de M1 solo no autoriza)»<br>(+2 más) | Pasó | — |

## HU-30 — Activar la autenticación real de M1 con sesión sellada en el BFF

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU30-1** (Feliz) inicio sesión por el BFF (POST {M1}/auth/usuario/login) y consulto GET /me → recibo 200 con mis roles de M6; el JWT de M1 va en una cookie sellada httpOnly y nunca llega al navegador | CP-262 | FE: `real-m1-login.spec.ts`<br>`jwt.strategy.spec.ts` › «acepta un access token de M1 y lo mapea a roles de M6» | Pasó (solo la parte backend; la del frontend no se ejecutó) | Pendiente BE #488 y FE #800 (no es un defecto registrado) |
| **CA-HU30-2** (Error) llamo a un endpoint protegido → recibo 401 (hoy sucede en Render hasta que se cargue el secreto vigente de M1) | CP-263 | `jwt.strategy.spec.ts` › «rechaza: %s» | Pasó | Al 03/11, pendiente BE #488: Render rechazaba el token con 401 hasta cargar el secreto vigente de M1. #488 se cerró el 03/11 y el login real se verificó ese día (no se repitió en esta pasada) |
| **CA-HU30-3** (Error) navego → el BFF reintenta una vez con refresh y, si falla, redirige al login con el aviso de sesión vencida | CP-264 | **SOLO FE**: `failure-journeys.spec.ts`<br>FE: `entry-and-roles.spec.ts` | Corregido (ACT-F7); sin ejecutar | — |
| **CA-HU30-4** (Falla externa) inicio sesión → el BFF corta a los 15 s con un mensaje de error; un build deployado en un modo distinto de real-m1 falla al arrancar (fail closed, FE #800) | CP-265 | **SOLO FE**: `real-m1-login.spec.ts` | No ejecutado (solo test del frontend, sin verificar) | Pendiente FE #800 |

## HU-31 — Seguridad de la Clase 11 (SEC-W01 a W06, SEC-I01, SEC-I02, SEC-D01, SEC-D02)

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU31-1** (Error) se invoca sin token, con token vencido, con firma de otro secreto o con alg "none" → los cuatro casos responden 401 con el formato de error estándar y sin datos del recurso | CP-266 | `jwt.strategy.spec.ts` › «rechaza: %s»<br>`services-lifecycle.e2e-spec.ts` › «rechaza con 401 un pedido sin token» | Pasó (corregido: ACT-02) | Corregido en #354, #448 |
| **CA-HU31-2** (Error) envía POST /services con un body válido → recibe 403 y no se crea ningún servicio | CP-267 | `auth-roles.e2e-spec.ts` › «$grupo: $method $path»<br>`roles.guard.spec.ts` › «rechaza con ROLE_REQUIRED si no tiene ninguno» | Pasó (corregido: ACT-01) | Corregido en #161, #235 |
| **CA-HU31-3** (Error) consulta con el publicId, con un ticketId válido o más de 20 veces por minuto → 404 sin datos, solo etapa, tipo, dirección y fechas, y 429 respectivamente | CP-268, CP-342 | `citizen-portal.service.spec.ts` › «devuelve exactamente los campos públicos, ni uno más»<br>`citizen-portal.service.spec.ts` › «un reclamo sin expediente da 404 sin decir si el ticket existe en M2»<br>(+1 más) | Pasó | DEF-07 (cerrado, #580): ahora hay e2e del 429 |
| **CA-HU31-4** (Error) envía PATCH /services/:id con status "COMPLETED" u otro campo fuera del DTO → recibe 400 y el estado en la base no cambia | CP-269, CP-343 | `services-lifecycle.e2e-spec.ts` › «rechaza con 400 un body con propiedades que el DTO no declara»<br>`security-input.e2e-spec.ts` › «PATCH /services/:id rechaza %j con 400 y no persiste»<br>(+1 más) | Pasó | — |
| **CA-HU31-5** (Error) se invoca el endpoint → responde 500 con mensaje genérico, sin stack ni SQL; el id de correlación en el log no está implementado (limitación conocida) | CP-270 | `http-exception.filter.spec.ts` › «deja en 500 cualquier error no contemplado»<br>`http-exception.filter.spec.ts` › «traduce P2025 a 404 en vez de dejarlo salir como 500» | Pasó | Limitación conocida: sin id de correlación en el 500. DEF-10 (cerrado, #590, PR #597): el formato de error ahora es RFC 9457 (CP-349 a CP-353) |
| **CA-HU31-6** (Error) se sube a POST /evidence → 400, 413 y 201 sin EXIF respectivamente | CP-271, CP-344 | `attachments.service.spec.ts` › «rechaza un archivo cuyo contenido no coincide con lo declarado»<br>`attachments.service.spec.ts` › «rechaza un archivo que supera el tamaño máximo»<br>(+2 más) | Pasó | — |
| **CA-HU31-7** (Alternativo) llega por segunda vez → se registra como duplicate, sin volver a aplicar el efecto | CP-272 | `inbox.e2e-spec.ts` › «descarta el mismo eventId sin volver a aplicarlo» | Pasó | — |
| **CA-HU31-8** (Error) llega al inbox → 400 con qué corregir, sin efecto ni fila; la DLQ es del Core (decisión documentada) | CP-273 | `inbox.e2e-spec.ts` › «rechaza con 400 el payload inválido y no guarda la fila»<br>`inbox-validation.spec.ts` › «el 400 no vuelca el contenido recibido» | Pasó | — |
| **CA-HU31-9** (Error) se procesa con éxito o falla → ningún log contiene el token, secretos ni datos personales en claro; el LoggingInterceptor registra solo método, URL, estado y duración | CP-274, CP-347 | `logging.interceptor.spec.ts` › «deja pasar la respuesta y loguea método, url y status»<br>`roles.guard.spec.ts` › «loguea la denegación con usuario, ruta y roles requeridos, sin token»<br>(+2 más) | Pasó | DEF-22 (cerrado, #581): los logs registraban el `access_token` de la query |
| **CA-HU31-10** (Error) las lee → se registra quién, cuándo y qué recurso consultó, sin copiar el contenido | CP-275 | **HUECO** sin test: NO CUMPLE: la tabla de auditoría (GET /audit) registra escrituras y transiciones; no audita lecturas (docs/api/endpoints.md, sección audit). Requerimiento de producción en ADR-005. | No ejecutado (sin test automatizado) | Limitación conocida: no se auditan las lecturas de datos Tier 2 (Trello SEC-D02, ADR-005); DEF-09 (abierto) |
| **CA-HU31-11** (Falla externa) corre el dispatcher → la fila queda FAILED con lastError y deja de barrerse, y solo M6_ADMIN la reencola con retry, con auditoría del actor; la DLQ y el backoff del reintento de entrada s… | CP-276 | `outbox-dispatcher.service.spec.ts` › «al agotar los intentos la marca FAILED y deja de tomarla»<br>`outbox-retry.e2e-spec.ts` › «FAILED → retry → PENDING → el dispatcher lo publica → SENT, y queda auditado» | Pasó (corregido: ACT-11) | — |
| **CA-HU31-12** (Alternativo) se ejecuta → queda una fila de auditoría de solo agregado con el actor del token, el estado de origen y destino y el motivo que el flujo ya pedía, en la misma transacción; una transición … | CP-331, CP-332, CP-333, CP-334 | `audit.e2e-spec.ts` › «cada transición del contenedor deja una fila con el actor del token»<br>`audit.service.spec.ts` › «record guarda estados y recorta la nota»<br>(+3 más) | Pasó (corregido: ACT-12) | — |

## HU-32 — Release hardening (Fase 8): observabilidad, promoción y rollback, WCAG 2.2 AA, privacidad y GA

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU32-1** (Feliz) corre axe con las etiquetas WCAG en el CI → no hay violaciones críticas de accesibilidad | CP-277 | **SOLO FE**: `accessibility.spec.ts` | No ejecutado (solo test del frontend, sin verificar) | — |
| **CA-HU32-2** (Alternativo) consulto GET /health y GET /health/ready → liveness responde 200 sin consultar la base y readiness responde 200 con la base arriba | CP-278 | `health.controller.spec.ts` › «liveness devuelve ok sin tocar la base»<br>`health.controller.spec.ts` › «ready devuelve 200 con la base arriba» | Pasó | — |
| **CA-HU32-3** (Error) consulto GET /health/ready → recibo 503 sin filtrar el error de la base | CP-279 | `health.controller.spec.ts` › «ready responde 503 sin filtrar el error de la base»<br>`health.controller.spec.ts` › «ready responde 503 si la base no contesta a tiempo» | Pasó | — |
| **CA-HU32-4** (Error) se inspeccionan los headers de seguridad (CSP, X-Frame-Options, HSTS, Referrer-Policy) → están presentes (hoy no lo están en el frontend: limitación conocida; en el backend hay nosniff, X… | CP-280, CP-345, CP-346 | `security-headers.middleware.spec.ts` › «pone las cabeceras base y sigue la cadena»<br>`security-headers.middleware.spec.ts` › «agrega HSTS solo en producción»<br>(+2 más) | Pasó | Limitación conocida: el frontend no define CSP ni headers de seguridad; DEF-19 (abierto): `/api/docs` sin CSP |

## HU-33 — e2e con datos deterministas y shards balanceados

| Criterio | Casos | Test automatizado | Resultado | Defecto |
|---|---|---|---|---|
| **CA-HU33-1** (Feliz) corre npm run test:e2e → migra la base local y ejecuta las suites de test/ contra Postgres real | CP-281 | **HUECO** sin test automatizado (no hay un test que pruebe la ejecución de los e2e)<br>Es la propia ejecución del job `e2e` del CI (`.github/workflows/ci.yml`, Postgres 16); el 08/11 se midió a mano. | Medición manual: `npm run test:e2e` migró la base local y pasó 19 suites / 312 tests contra Postgres 16 en 3 corridas idénticas; en el CI corre en el job `e2e`. No es un test automatizado | DEF-14 (abierto): el job `e2e` no es check obligatorio |
| **CA-HU33-2** (Error) arrancan los e2e → el guard aborta antes de migrar y no toca la base desplegada | CP-282 | `guard-database-url.e2e-spec.ts` › «tira con un host remoto»<br>`guard-database-url.e2e-spec.ts` › «tira si no hay DATABASE_URL»<br>(+1 más) | Pasó | — |
| **CA-HU33-3** (Alternativo) corro el script → la segunda corrida no cambia nada y el simulacro no toca la base | CP-283 | `crew-user-id-migration.e2e-spec.ts` › «es idempotente: la segunda corrida no cambia nada»<br>`crew-user-id-migration.e2e-spec.ts` › «el simulacro imprime el plan, reporta lo que no tiene mapeo y no toca nada» | Pasó | — |
| **CA-HU33-4** (Error) comparo los resultados → son idénticos (0 tests inestables) | CP-284 | **HUECO** sin test automatizado (es una medición, no un test)<br>Se corrió 3 veces seguidas `npm test` y `npm run test:e2e`, y la repetición también se hizo en el CI. | Medición manual: 3 corridas seguidas de `npm test` (2746 pasan en las tres) y de `npm run test:e2e` (312 pasan en las tres). Repetidas también en el CI. Reserva: [#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554) (e2e intermitente; DEF-24 cerrado por decisión del equipo el 09/11, sin causa confirmada) | 3 corridas idénticas (ver `05`, sección 2.1); DEF-24 / [#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554) (cerrado por decisión del equipo el 09/11, sin causa confirmada) |

## Resumen de cobertura de la matriz

Contado con un script que lee las filas de esta matriz (un criterio cuenta como «con test del backend» si cita al menos una ruta `src/` o `test/`; «solo FE» si solo cita el frontend; «hueco» si no cita ninguno).

- HU con criterios: 33. Criterios: 175. Casos: 372 (334 iniciales, CP-335 a CP-348 y CP-349 a CP-372, estos últimos sin criterio propio; ver [04-especificacion-casos.md](04-especificacion-casos.md)). Los 348 anteriores cubren los 175 criterios; los 24 nuevos no cambian ese conteo.
- Todas las HU y todos los criterios tienen al menos un caso (175 de 175).
- Criterios con al menos un test automatizado del backend verificado: **160** (91,4 %). Dos de ellos son **parciales** (CA-HU24-1, solo el consumo contra RabbitMQ real; ver «Cobertura parcial declarada»).
- Criterios cubiertos solo por un test del frontend (sin verificar su contenido): **9** (5,1 %).
- Criterios sin test automatizado (**huecos**): **6** (3,4 %): CA-HU01-3, CA-HU10-2, CA-HU24-2, CA-HU31-10, CA-HU33-1 y CA-HU33-4. Los dos últimos se midieron a mano (ver su resultado) pero no son un test.
- **Resultado:** de los 160 criterios con test del backend, los 160 tienen el resultado **Pasó** (los tests citados existen por nombre y la corrida completa no tuvo ningún fallo). No hay criterios fallados ni bloqueados. Los 9 «solo FE» y los 6 huecos no se ejecutaron en esta corrida.

| HU | Criterios | Con test del backend | Solo FE | Huecos |
|---|---|---|---|---|
| HU-01 | 4 | 0 | 3 | 1 |
| HU-02 | 7 | 7 | 0 | 0 |
| HU-03 | 6 | 6 | 0 | 0 |
| HU-04 | 6 | 6 | 0 | 0 |
| HU-05 | 6 | 6 | 0 | 0 |
| HU-06 | 5 | 5 | 0 | 0 |
| HU-07 | 7 | 7 | 0 | 0 |
| HU-08 | 6 | 6 | 0 | 0 |
| HU-09 | 6 | 6 | 0 | 0 |
| HU-10 | 3 | 2 | 0 | 1 |
| HU-11 | 7 | 7 | 0 | 0 |
| HU-12 | 7 | 7 | 0 | 0 |
| HU-13 | 4 | 4 | 0 | 0 |
| HU-14 | 4 | 4 | 0 | 0 |
| HU-15 | 5 | 5 | 0 | 0 |
| HU-16 | 8 | 8 | 0 | 0 |
| HU-17 | 4 | 4 | 0 | 0 |
| HU-18 | 4 | 4 | 0 | 0 |
| HU-19 | 3 | 3 | 0 | 0 |
| HU-20 | 5 | 5 | 0 | 0 |
| HU-21 | 5 | 5 | 0 | 0 |
| HU-22 | 5 | 5 | 0 | 0 |
| HU-23 | 5 | 5 | 0 | 0 |
| HU-24 | 4 | 3 | 0 | 1 |
| HU-25 | 4 | 4 | 0 | 0 |
| HU-26 | 3 | 0 | 3 | 0 |
| HU-27 | 5 | 5 | 0 | 0 |
| HU-28 | 6 | 6 | 0 | 0 |
| HU-29 | 7 | 7 | 0 | 0 |
| HU-30 | 4 | 2 | 2 | 0 |
| HU-31 | 12 | 11 | 0 | 1 |
| HU-32 | 4 | 3 | 1 | 0 |
| HU-33 | 4 | 2 | 0 | 2 |
| **Total** | **175** | **160** | **9** | **6** |

## Correcciones posteriores a las HU

Relevamiento de lo corregido o agregado después del volcado de Trello y de la matriz SEC: issues cerrados en backend y frontend, PR mergeados y CI de develop. El detalle de cada cambio está en las subsecciones "Actualizaciones posteriores a la HU" de [02-historias-y-criterios.md](02-historias-y-criterios.md).

- Correcciones relevadas: **39** (31 de backend con test, 7 de frontend y 1 aclaración).
- Criterios con corrección posterior: **78** de 175 (44,6 %), de los cuales **50** son criterios nuevos agregados por la corrección y 28 ya existían en la HU.
- **Con evidencia de CI (Pasó): 71** criterios.
- **Sin evidencia de CI: 7** criterios: 7 corregidos solo en el frontend (sin test verificado) y 0 de backend sin CI confirmado.
- Casos marcados como Corregido: **116** de 334, con evidencia de CI: 111.

| ID | Issues y PR | Criterios | Estado |
|---|---|---|---|---|
| ACT-01 | #161, #235; PR #366, #369 | CA-HU31-2 (corregido), CA-HU29-1 (agregado), CA-HU29-2 (agregado), CA-HU29-3 (agregado), CA-HU11-5 (agregado) | Pasó |
| ACT-02 | #354, #448; PR #358, #450 | CA-HU31-1 (corregido), CA-HU29-5 (agregado) | Pasó |
| ACT-03 | #359; PR #362 | CA-HU29-5 (agregado), CA-HU23-5 (agregado) | Pasó |
| ACT-04 | #365, #394; PR #395 | CA-HU07-4 (agregado), CA-HU04-6 (agregado), CA-HU16-5 (agregado), CA-HU08-4 (agregado) | Pasó |
| ACT-05 | #466; PR #468 | CA-HU08-6 (corregido) | Pasó |
| ACT-06 | #470; PR #480 | CA-HU27-4 (corregido) | Pasó |
| ACT-07 | #314, #485; PR #318, #489 | CA-HU21-5 (agregado) | Pasó |
| ACT-08 | #456; PR #464 | CA-HU12-3 (corregido), CA-HU12-4 (corregido), CA-HU12-2 (agregado) | Pasó |
| ACT-09 | #454, #455; PR #465 | CA-HU03-2 (corregido), CA-HU03-6 (agregado), CA-HU05-6 (agregado) | Pasó |
| ACT-10 | #458; PR #469 | CA-HU29-4 (agregado) | Pasó |
| ACT-11 | #459; PR #463 | CA-HU23-4 (agregado), CA-HU24-4 (agregado), CA-HU31-11 (agregado) | Pasó |
| ACT-12 | #460; PR #483 | CA-HU31-12 (agregado) | Pasó |
| ACT-13 | #461, #473, #475; PR #474, #476 | CA-HU28-2 (corregido), CA-HU28-3 (agregado), CA-HU28-4 (agregado), CA-HU28-5 (agregado), CA-HU28-6 (agregado) | Pasó |
| ACT-14 | #447, #481; PR #478, #487 | CA-HU09-2 (corregido), CA-HU09-6 (agregado) | Pasó |
| ACT-15 | #282; PR #290 | CA-HU04-1 (agregado), CA-HU04-2 (agregado), CA-HU04-3 (agregado) | Pasó |
| ACT-16 | #283; PR #288 | CA-HU02-2 (corregido) | Pasó |
| ACT-17 | #284; PR #289 | CA-HU16-3 (corregido) | Pasó |
| ACT-18 | #293, #294, #340; PR #315, #316, #357 | CA-HU10-1 (agregado), CA-HU14-1 (agregado), CA-HU14-2 (agregado), CA-HU14-3 (agregado), CA-HU14-4 (agregado) | Pasó |
| ACT-19 | #303, #309, #396; PR #319, #320, #399 | CA-HU21-1 (corregido), CA-HU21-2 (corregido), CA-HU21-3 (corregido), CA-HU25-1 (corregido) | Pasó |
| ACT-20 | #170, #307; PR #304, #308 | CA-HU25-1 (corregido), CA-HU25-2 (corregido), CA-HU25-3 (corregido), CA-HU22-2 (agregado), CA-HU22-3 (agregado), CA-HU22-4 (agregado), CA-HU22-5 (agregado) | Pasó |
| ACT-21 | #169, #338, #342; PR #335, #339, #343 | CA-HU18-1 (corregido), CA-HU18-2 (corregido), CA-HU18-3 (corregido), CA-HU18-4 (corregido) | Pasó |
| ACT-22 | #321; PR #323 | CA-HU09-5 (agregado) | Pasó |
| ACT-23 | #346; PR #346 | CA-HU05-5 (corregido) | Pasó |
| ACT-24 | #296, #295, #413; PR #317, #356, #432 | CA-HU20-4 (agregado), CA-HU20-5 (agregado), CA-HU20-2 (agregado) | Pasó |
| ACT-25 | #266, #381, #391; PR #356, #382, #392 | CA-HU19-1 (corregido), CA-HU19-2 (corregido) | Pasó |
| ACT-26 | #374; PR #375 | CA-HU17-1 (corregido) | Pasó |
| ACT-27 | #376, #420, #421, #457; PR #419, #425, #426, #464 | CA-HU02-6 (corregido), CA-HU02-7 (agregado) | Pasó |
| ACT-28 | #451; PR #462 | CA-HU09-3 (corregido) | Pasó |
| ACT-29 | #452; PR #462 (donde entran los tests de este cambio) | CA-HU16-7 (agregado) | Pasó |
| ACT-30 | #453; PR #482 | CA-HU11-7 (agregado) | Pasó |
| ACT-31 | #325; PR #330 | CA-HU16-8 (agregado) | Pasó |
| ACT-F1 | FE #528, #520, #525 | CA-HU01-1 (agregado), CA-HU01-2 (agregado), CA-HU01-3 (agregado) | Sin ejecutar (frontend) |
| ACT-F2 | FE #617 | CA-HU04-2 (agregado) | Sin ejecutar (frontend) |
| ACT-F3 | FE #621, #622 | CA-HU10-1 (agregado), CA-HU14-1 (agregado) | Sin ejecutar (frontend) |
| ACT-F4 | FE #321 | CA-HU26-1 (agregado), CA-HU26-2 (agregado) | Sin ejecutar (frontend) |
| ACT-F5 | FE #469 | CA-HU29-4 (agregado) | Sin ejecutar (frontend) |
| ACT-F6 | FE #380, #435, #438 | CA-HU08-3 (corregido) | Sin ejecutar (frontend) |
| ACT-F7 | FE #379, #381, #437 | CA-HU30-3 (agregado) | Sin ejecutar (frontend) |
| ACT-N1 | BE #285, FE #413 | aclaración | No aplica |

### Correcciones sin evidencia de CI

Las de frontend (ACT-F1 a ACT-F7): sus issues están cerrados, pero no ejecutamos ni leímos el test que las cubre, así que no se escribe «Pasó». Los 31 cambios de backend tienen evidencia: el test existe en `develop` y el CI fue verde en el commit que lo introdujo y en el HEAD.

### Cobertura parcial declarada

Criterios contados como cubiertos por tener al menos un test del backend, pero con algún caso que se prueba a mano, que se prueba solo en parte o que no tiene test:

- **CA-HU12-5**: CP-121 (La regla de fecha futura figura en docs/api/endpoints.md; no se localizó un test específico en esta pasada.)
- **CA-HU24-1**: CP-219 y CP-340. El e2e `rabbitmq-real` prueba el **consumo** contra un RabbitMQ real (contenedor propio, cola propia, no `q.ambiente`). La **publicación** del outbox a `muni.inbox` contra un broker real y el Core de M9 no tienen test automatizado; esa parte quedó en el historial de integración ([`../integracion/historial.md`](../integracion/historial.md)).
- **CA-HU27-3**: CP-236 (Regla documentada (docs/api/endpoints.md, #145); no se localizó un test específico.)
- **CA-HU27-4**: CP-238. Existe un e2e del 429 (`test/throttler.e2e-spec.ts`), pero prueba el límite **global** sobre `GET /zones` con `THROTTLE_LIMIT=3`; el límite propio del portal (20 por minuto en seguimiento) sigue sin e2e de 429. El test de cuenta por IP del BFF es `client-tracker.spec.ts`.
- **CA-HU30-1**: CP-262 (la verificación en el ambiente desplegado esperó a cargar el secreto vigente, BE #488, ya cerrado)
- **CA-HU31-3**: CP-268 y CP-342. El 429 está probado en el límite global, no en el del portal.
- **CA-HU31-4**: CP-343. El caso exacto de la tarjeta (`PATCH /services/:id` con `status`) ahora tiene test propio (`security-input.e2e-spec.ts`).

### Listado de huecos y criterios solo con test del frontend

| Criterio | Estado | Detalle | Plan |
|---|---|---|---|
| CA-HU01-1 | Solo FE | puedo ordenar y filtrar con el mismo componente de tabla que Servicios | Verificar el contenido del test del frontend o sumar uno de backend |
| CA-HU01-2 | Solo FE | veo un esqueleto con la forma final, no un spinner suelto ni la tabla vacía | Verificar el contenido del test del frontend o sumar uno de backend |
| CA-HU01-3 | Hueco | Guard de CI del frontend citado por Trello; no se localizó el script en esta pasada. | Sumar un test automatizado o ejecutar la prueba manual y adjuntar evidencia |
| CA-HU01-4 | Solo FE | la pantalla muestra un mensaje de error con aria-live o role="alert" y no una tabla vacía | Verificar el contenido del test del frontend o sumar uno de backend |
| CA-HU10-2 | Hueco | La validación del enum la hace el ValidationPipe; no se encontró un test específico del filtro priority en esta pasada. | Sumar un test automatizado o ejecutar la prueba manual y adjuntar evidencia |
| CA-HU24-2 | Hueco | La prueba pasiva desde Render (TCP/TLS, autenticación y `checkQueue` de `q.ambiente`) no tiene test automatizado; #442 cerrado el 05/11 con la prueba en el historial de integración. El `rabbitmq-real` corre contra un broker local, sin TLS ni Render, y no la reemplaza | Dejar la prueba manual con su evidencia del historial |
| CA-HU26-1 | Solo FE | está en formato argentino dd/mm/aaaa hh:mm y en el día local | Verificar el contenido del test del frontend o sumar uno de backend |
| CA-HU26-2 | Solo FE | leo el nombre o el código, no el UUID | Verificar el contenido del test del frontend o sumar uno de backend |
| CA-HU26-3 | Solo FE | se muestra el día de Argentina (UTC-3), no el de UTC | Verificar el contenido del test del frontend o sumar uno de backend |
| CA-HU30-3 | Solo FE | el BFF reintenta una vez con refresh y, si falla, redirige al login con el aviso de sesión vencida | Verificar el contenido del test del frontend o sumar uno de backend |
| CA-HU30-4 | Solo FE | Fail closed de FE #800 pendiente. | Verificar el contenido del test del frontend o sumar uno de backend |
| CA-HU31-10 | Hueco | NO CUMPLE: la tabla de auditoría (GET /audit) registra escrituras y transiciones; no audita lecturas (docs/api/endpoints.md, sección audit). Requerimiento de producción en ADR-005. DEF-09 abierto | Documentar como limitación conocida en el registro de defectos |
| CA-HU32-1 | Solo FE | no hay violaciones críticas de accesibilidad | Verificar el contenido del test del frontend o sumar uno de backend |
| CA-HU33-1 | Hueco, medido a mano | Es la propia ejecución del job `e2e` del CI. Se corrió `npm run test:e2e` en local (312 tests pasan, 3 corridas). No es un test | Aceptar como medición manual con evidencia |
| CA-HU33-4 | Hueco, medido a mano | Tres corridas seguidas idénticas de `npm test` y `npm run test:e2e`, en local y repetidas en el CI (ver [05-informe-ejecucion.md](05-informe-ejecucion.md), sección 2.1). El DEF-24 ([#554](https://github.com/hllous/Backend-M6-DAPS2/issues/554), e2e intermitente) se cerró por decisión del equipo sin causa confirmada, y tres corridas iguales no prueban que no exista | Reabrir DEF-24 si vuelve a aparecer |

## Defectos y pruebas sin criterio propio

Defectos del [registro](06-registro-defectos.md) que no cuelgan de un criterio concreto de las HU, y pruebas que no corresponden a ninguno. No se inventó un criterio para encajarlos.

| Qué | Referencia | Estado |
|---|---|---|
| Sin control de concurrencia optimista (`ETag` / `If-Match`) | DEF-05; CP-354 a CP-361; `src/common/etag.spec.ts`, `src/modules/services/services-if-match.spec.ts`, `test/etag-if-match.e2e-spec.ts` (12 tests) | **Cerrado** (#591, PR #597), en el alcance de [ADR-012](../decisiones/adr-012-concurrencia-optimista-etag.md): transiciones de contenedores, servicios, intervenciones y expedientes, y `PATCH` de contenedores y servicios. Pasó en R09 |
| `Idempotency-Key` solo en `POST /evidence` | DEF-06; CP-362 a CP-369; `src/common/idempotency/idempotency.interceptor.spec.ts`, `test/idempotency.e2e-spec.ts` (8 tests) | **Cerrado** (#592, PR #597) en 21 `POST` de creación, con la limitación de [ADR-013](../decisiones/adr-013-idempotency-key.md) (guardado no atómico). Pasó en R09 |
| Errores sin formato Problem Details | DEF-10 (también colgado de CA-HU31-5); CP-349 a CP-353; `src/common/filters/http-exception.filter.spec.ts`, `test/problem-details.e2e-spec.ts` (9 tests) | **Cerrado** (#590, PR #597), [ADR-011](../decisiones/adr-011-errores-problem-details-rfc-9457.md). Sigue sin id de correlación en el 500. Pasó en R09 |
| Hallazgo H-1 de Schemathesis: los `GET` con entrada no declaran el 400 | DEF-20; CP-370; `src/openapi-contract.spec.ts` | **Cerrado** (#593, PR #597). `status_code_conformance` es bloqueante en el CI. Pasó en R09 |
| Hallazgo H-2 de Schemathesis: `GET /neighborhoods` da 503 sin M9 | DEF-21; CP-371 y CP-372; `test/neighborhoods-catalog.e2e-spec.ts` | **Cerrado** (#594, PR #597). Pasó en R09 |
| Dependencias de producción con vulnerabilidades (tras #619: 0 críticas, 0 altas, 8 moderadas; tras #628: 0) | DEF-08 | Cerrado (#619, #628) |
| Sin ZAP ni Trivy; SCA en el CI (gate desde #628), Dependabot, CodeQL y gitleaks sí | DEF-13 | Abierto, parcial |
| `CORS_ORIGINS` opcional; desde #642 obligatoria en producción | DEF-18 | Cerrado (#642) |
| Primer `docker compose up` en frío fallaba por `rabbitmq-setup` | DEF-23 | Cerrado (#584) |
| Inyección SQL y XSS almacenado en campos de texto | CP-348, `test/security-input.e2e-spec.ts` (9 tests: 3 payloads × zona, expediente y servicio). La API guarda los payloads como texto y los devuelve idénticos; no los rechaza ni los escapa | Pasó en R08 |
| Colección Newman (455 requests ejecutados, 435 definidos, 763 assertions, 0 fallidas) y Schemathesis (4388 casos en el paso de esquema y 4384 en `status_code_conformance`, solo `GET`) | `test/api/`, `.github/workflows/api-tests.yml`; ver [05-informe-ejecucion.md](05-informe-ejecucion.md) | Corren en el CI; no están mapeadas criterio por criterio |
| Prueba de carga con k6 (50 usuarios, 5 min, `GET /services`, `/containers` y `/zones`) | `test/perf/k6-criticos.js` y `test/perf/resultados/2026-11-09/`; ver [05-informe-ejecucion.md](05-informe-ejecucion.md) sección 2.2 | Hecha en local con lecturas (p(95) 32,84 ms, 0,00 % de error); no corre en el CI. También se corrió contra el despliegue y con escrituras |
