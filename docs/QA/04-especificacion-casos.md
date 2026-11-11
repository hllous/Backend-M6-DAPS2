# 04 · Especificación de casos de prueba

> Versión 2.0 · 10/11/2026. Módulo 6 «Ambiente e Higiene», Grupo 04. Cada caso apunta a un criterio de [02-historias-y-criterios.md](02-historias-y-criterios.md) (ahí están el CUANDO y el ENTONCES) y figura en [03-matriz-trazabilidad.md](03-matriz-trazabilidad.md).

## Cómo leerla

- **Tipo:** Positivo (camino válido), Negativo (entrada o estado inválido, o falla externa que se rechaza) y Borde (límite, caso especial, concurrencia, degradación). Nos propusimos que al menos el 40 % sean negativos o de borde; el cálculo está al final.
- **Escenario:** precondición y datos del caso. El resultado esperado es el ENTONCES del criterio; en las secciones de casos agregados (CP-335 en adelante) va después de la flecha.
- **Prioridad:** la de la HU (Alta para Must, Media para Should, Baja para Could).
- **Test:** archivo y nombre del test del backend (`FE:` indica un test del frontend, solo por nombre de archivo y sin revisar su contenido; `Manual:` indica que no hay test automático). Se muestran hasta dos por caso.
- **Estado:** **Pasó** significa que el test citado existe y que la corrida completa no tuvo fallos: R08 (local sobre `1d600d2`: 2746 unitarios y 312 e2e, más 4 de 4 en RabbitMQ real) para CP-001 a CP-348 y R09 (local sobre `142e1a3`: 2854 unitarios y 343 e2e) para CP-349 en adelante. «Corregido: …» es un criterio que cambió después de la HU, con su ACT e issue. «—» es un caso que no se ejecutó (manual o solo test del frontend).
- Los casos CP-285 en adelante pertenecen a criterios agregados con correcciones posteriores. Las rutas de test son de este repo, salvo las del frontend.


## HU-01 — Catálogos con tablas filtrables, componentes uniformes y estados de carga

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-001 | CA-HU01-1 | Usuario con cualquier rol de M6; catálogo con más de 20 registros; Zonas: ordenar por nombre y filtrar por texto; página 2 | Positivo | FE: `catalog-shell.spec.ts`<br>FE: `zones-catalog.spec.ts` | Corregido: ACT-F1, FE #528, #520, #525; sin ejecutar |
| CP-002 | CA-HU01-2 | Backend demorado a propósito (mock con retardo); Abrir Servicios y un catálogo de cada grupo | Positivo | FE: `catalog-a-loading.spec.ts`<br>FE: `catalog-b-loading.spec.ts`<br>(+1 más) | Corregido: ACT-F1, FE #528, #520, #525; sin ejecutar |
| CP-003 | CA-HU01-3 | Pipeline de CI del repo Frontend-M6-DAPS2; Ejecutar el job de CI del frontend | Positivo | Manual: Guard de CI del frontend citado por Trello; no se localizó el script en esta pasada. | — |
| CP-004 | CA-HU01-4 | Backend devolviendo 500 o sin responder; Abrir Zonas con GET /zones fallando | Negativo | FE: `failure-journeys.spec.ts` | — |

## HU-02 — Alta de zonas operativas y recorridos con paradas

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-005 | CA-HU02-1 | Rol M6_ADMIN; code "ZT-01" libre; { code: "ZT-01", name: "Zona de prueba" } | Positivo | `zones.service.spec.ts` › «nace activa si el DTO no dice lo contrario»<br>`auth-roles.e2e-spec.ts` › «$grupo: $method $path» | Pasó |
| CP-006 | CA-HU02-2 | Recorrido sin paradas; zonas A, B y C activas; stops: [A, B, C] | Positivo | `routes.service.spec.ts` › «asigna sequence por el orden del array, 1-indexed»<br>`routes.service.spec.ts` › «actualiza Route.updatedAt en la misma transaccion»<br>(+1 más) | Pasó (corregido: ACT-16, #283) |
| CP-007 | CA-HU02-2 | Recorrido con paradas previas; stops: [] (array vacío) | Borde | `routes.service.spec.ts` › «acepta el array vacio para dejar el recorrido sin paradas» | Pasó |
| CP-008 | CA-HU02-3 | Zona activa; DELETE /zones/:id | Positivo | `zones.service.spec.ts` › «es baja lógica, no borrado» | Pasó |
| CP-009 | CA-HU02-3 | Recorrido activo; DELETE /routes/:id | Positivo | `routes.service.spec.ts` › «la baja es lógica» | Pasó |
| CP-010 | CA-HU02-4 | Zona con code "ZT-01" existente; { code: "ZT-01", name: "Otra" } | Negativo | `zones.service.spec.ts` › «un código repetido da 409, no un error de Prisma» | Pasó |
| CP-011 | CA-HU02-4 | Recorrido con code "R-01" existente; { code: "R-01", name: "Otro" } | Negativo | `routes.service.spec.ts` › «un código repetido da 409, no un error de Prisma» | Pasó |
| CP-012 | CA-HU02-5 | Recorrido con paradas; stops: [A, A] | Negativo | `routes.service.spec.ts` › «rechaza una zona repetida: romperia ServiceZone al copiar el recorrido» | Pasó |
| CP-013 | CA-HU02-5 | Recorrido con paradas; stops: [A, <uuid inexistente>] | Negativo | `routes.service.spec.ts` › «devuelve 404 nombrando las zonas que no existen» | Pasó |
| CP-014 | CA-HU02-6 | Catálogo de M9 cargado; barrio con id que M9 no tiene | Negativo | `zones.service.spec.ts` › «con catálogo, un id que M9 no tiene da 400 y no escribe nada» | Pasó (corregido: ACT-27, #376, #420, #421, #457) |
| CP-015 | CA-HU02-6 | Catálogo de M9 sin cargar (Core caído); barrio con id cualquiera | Borde | `zones.service.spec.ts` › «sin catálogo degrada: asigna aunque el id sea desconocido» | Pasó (corregido: ACT-27, #376, #420, #421, #457) |
| CP-016 | CA-HU02-6 | Catálogo de M9 sin cargar; GET /neighborhoods | Negativo | `neighborhoods.service.spec.ts` › «sin catálogo responde 503, no una lista vacía» | Pasó (corregido: ACT-27, #376, #420, #421, #457) |
| CP-285 | CA-HU02-7 | Comuna 3 existente; { code, name, communeId } | Positivo | `zones.service.spec.ts` › «crea con comuna existente; con una inexistente da 400» | Pasó (corregido: ACT-27, #376, #420, #421, #457) |
| CP-286 | CA-HU02-7 | Comuna inexistente; PATCH { communeId: <uuid inexistente> } | Negativo | `zones.service.spec.ts` › «una comuna inexistente da 400 y no escribe» | Pasó (corregido: ACT-27, #376, #420, #421, #457) |
| CP-287 | CA-HU02-7 | Zonas de comunas 2, 10 y sin comuna; GET /zones | Positivo | `zones.service.spec.ts` › «ordena por número de comuna, luego por nombre, con id de desempate» | Pasó (corregido: ACT-27, #376, #420, #421, #457) |
| CP-288 | CA-HU02-7 | Zona con comuna; PATCH { communeId: null } | Borde | `zones.service.spec.ts` › «communeId null desasigna la comuna sin consultar» | Pasó (corregido: ACT-27, #376, #420, #421, #457) |

## HU-03 — Administración de tipos de servicio, frecuencias, cuadrillas, vehículos y sitios de disposición

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-017 | CA-HU03-1 | Rol M6_ADMIN; patente "AB123CD" libre; { plate: "AB123CD", vehicleType: "COMPACTOR_TRUCK" } | Positivo | `vehicles.service.spec.ts` › «nace activo y sin capacidad si no se la pasan» | Pasó |
| CP-018 | CA-HU03-2 | Rol M6_ADMIN; { name, crewType: "MUNICIPAL", specialty: "COLLECTION", leaderUserId: "7" } | Positivo | `crews.service.spec.ts` › «nace activa y sin cooperativa si no se la pasan»<br>`crews.service.spec.ts` › «el líder se guarda como id de M1 normalizado (#365)» | Pasó (corregido: ACT-09, #454, #455) |
| CP-019 | CA-HU03-2 | Cuadrilla existente; agregar integrante con userId "09012" | Borde | `crew-ownership.e2e-spec.ts` › «normaliza los ceros a la izquierda: el integrante "09012" es el 9012» | Pasó |
| CP-020 | CA-HU03-3 | Tipo de servicio activo; DELETE /service-types/:id | Positivo | `service-types.service.spec.ts` › «la baja es logica: marca active=false, no borra» | Pasó |
| CP-021 | CA-HU03-3 | Sitio de disposición con CollectionRecord cargados; DELETE /disposal-sites/:id | Positivo | `disposal-sites.service.spec.ts` › «la baja es logica para no romper el historico de CollectionRecord» | Pasó |
| CP-022 | CA-HU03-3 | Frecuencia que todavía no empezó a regir; DELETE /service-frequencies/:id | Borde | `service-frequencies.service.spec.ts` › «si la regla todavia no empezo, la cierra en su fecha de inicio» | Pasó |
| CP-023 | CA-HU03-4 | Vehículo con patente "AB123CD" existente; { plate: "AB123CD" } | Negativo | `vehicles.service.spec.ts` › «una patente repetida da 409» | Pasó |
| CP-024 | CA-HU03-4 | Tipo de servicio con code existente; { code duplicado } | Negativo | `service-types.service.spec.ts` › «traduce el codigo duplicado a 409» | Pasó |
| CP-025 | CA-HU03-4 | Cuadrilla nueva; leaderUserId "usr-abc" (no numérico) | Negativo | `crew-ownership.e2e-spec.ts` › «rechaza ids de integrante y líder que no son numéricos de M1» | Pasó |
| CP-026 | CA-HU03-5 | Frecuencia existente lunes-viernes turno MORNING; nueva regla lunes, MORNING, misma vigencia | Negativo | `service-frequencies.service.spec.ts` › «crear con una regla superpuesta da 409 y no escribe» | Pasó |
| CP-027 | CA-HU03-5 | Tipo de servicio con mode POINT; POST /service-frequencies con ese tipo | Negativo | `service-frequencies.service.spec.ts` › «rechaza un tipo de servicio que no es de modo ROUTE» | Pasó |
| CP-289 | CA-HU03-6 | Cuadrilla con zona base A; { zoneId: B, validFrom: hoy, validTo: hoy+7 } | Positivo | `crews.service.spec.ts` › «guarda la reubicación con el actor del token y fechas sin hora» | Pasó (corregido: ACT-09, #454, #455) |
| CP-290 | CA-HU03-6 | Cuadrilla con reubicación vigente; otra reubicación que se pisa | Negativo | `crews.service.spec.ts` › «un período que se pisa con otro da 409» | Pasó (corregido: ACT-09, #454, #455) |
| CP-291 | CA-HU03-6 | Cualquiera; validTo anterior a validFrom | Negativo | `crews.service.spec.ts` › «validTo anterior a validFrom da 400» | Pasó (corregido: ACT-09, #454, #455) |
| CP-292 | CA-HU03-6 | Cualquiera; sin validTo | Borde | `crews.service.spec.ts` › «sin validTo queda abierta» | Pasó |
| CP-293 | CA-HU03-6 | Cuadrilla reubicada hoy; GET /crews?zoneId=B | Borde | `crews.service.spec.ts` › «zoneId filtra por la zona efectiva: reubicación vigente o, sin ella, la base» | Pasó |

## HU-04 — Suspender un servicio guardando motivo y nota por separado

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-028 | CA-HU04-1 | Servicio IN_PROGRESS; usuario integrante de su cuadrilla; { reason: "VEHICLE_BREAKDOWN", note: "Se pinchó una rueda" } | Positivo | `services.service.spec.ts` › «suspender guarda el motivo»<br>`services.service.spec.ts` › «suspender guarda la nota opcional» | Pasó (corregido: ACT-15, #282) |
| CP-029 | CA-HU04-2 | Servicio SUSPENDED con motivo y nota; GET /services/:id | Positivo | `services.service.spec.ts` › «suspender guarda la nota opcional»<br>FE: `services.spec.ts` | Pasó (corregido: ACT-15, #282) |
| CP-030 | CA-HU04-3 | Servicio IN_PROGRESS; { reason, note: "   " } | Borde | `services.service.spec.ts` › «suspender con nota de solo espacios la guarda como null» | Pasó (corregido: ACT-15, #282) |
| CP-031 | CA-HU04-4 | Servicio SCHEDULED; POST /services/:id/suspend | Negativo | `services.service.spec.ts` › «rechaza una transicion invalida nombrando las validas»<br>`services-lifecycle.e2e-spec.ts` › «rechaza con 409 una transición que la tabla no admite» | Pasó |
| CP-032 | CA-HU04-5 | Servicio IN_PROGRESS; note de 501 caracteres | Borde | `length-limits.dtos.spec.ts` › «%s: el tope pasa y tope+1 falla» | Pasó |
| CP-033 | CA-HU04-6 | Servicio IN_PROGRESS de la cuadrilla A; usuario de la cuadrilla B; POST /services/:id/suspend | Negativo | `services-ownership.spec.ts` › «%s: un usuario ajeno a la cuadrilla recibe 403 NOT_ASSIGNED»<br>`crew-ownership.e2e-spec.ts` › «un ajeno no puede suspender, reanudar, informar zona, registrar residuos ni avisar demora» | Pasó (corregido: ACT-04, #365, #394) |

## HU-05 — Programar un servicio sobre un recorrido o un punto

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-034 | CA-HU05-1 | Tipo ROUTE; recorrido con 3 paradas; cuadrilla libre ese día; { serviceTypeId, routeId, scheduledDate: mañana, windowFrom: "08:00", windowTo: "12:00", crewId } | Positivo | `services.service.spec.ts` › «copia el modo del ServiceType, no lo recibe del DTO»<br>`services.service.spec.ts` › «copia las zonas del recorrido como snapshot, con su sequence»<br>(+1 más) | Pasó |
| CP-035 | CA-HU05-2 | Contenedor existente en una zona; { serviceTypeId (POINT), targetType: "CONTAINER", targetId } | Positivo | `services.service.spec.ts` › «deriva la zona de un POINT desde el bien del inventario» | Pasó |
| CP-036 | CA-HU05-2 | Zona existente, sin objetivo; { serviceTypeId (POINT), zoneId } | Borde | `services-queries-inventory.spec.ts` › «sin objetivo, se ubica por la zona suelta» | Pasó |
| CP-037 | CA-HU05-3 | Cuadrilla con servicio 08:00-12:00 ese día; nuevo servicio 10:00-14:00 con la misma cuadrilla, sin overrideNote | Negativo | `services.service.spec.ts` › «rechaza con 409 si la cuadrilla se solapa, sin crear ni encolar»<br>`services.service.spec.ts` › «rechaza con 409 si el vehículo se solapa» | Pasó |
| CP-038 | CA-HU05-3 | Misma situación; nuevo servicio con overrideNote de 12 caracteres | Borde | `services.service.spec.ts` › «con overrideNote crea igual y guarda la nota» | Pasó |
| CP-039 | CA-HU05-3 | Servicio 08:00-12:00 y nuevo 12:00-16:00; franjas contiguas | Borde | `services-delay-assignment.spec.ts` › «franjas contiguas no son conflicto» | Pasó |
| CP-040 | CA-HU05-4 | Tipo de servicio ROUTE; sin routeId | Negativo | `services.service.spec.ts` › «rechaza un ROUTE sin routeId» | Pasó |
| CP-041 | CA-HU05-4 | Recorrido sin paradas cargadas; routeId de ese recorrido | Negativo | `services.service.spec.ts` › «rechaza un recorrido sin paradas cargadas» | Pasó |
| CP-042 | CA-HU05-4 | Tipo POINT; sin targetType/targetId ni zoneId | Negativo | `services.service.spec.ts` › «rechaza un POINT sin objetivo ni zona» | Pasó |
| CP-043 | CA-HU05-4 | Cualquier tipo; windowFrom "12:00", windowTo "08:00" | Negativo | `services.service.spec.ts` › «rechaza una ventana horaria invertida» | Pasó |
| CP-044 | CA-HU05-4 | Origen PLANNED; ticketId informado | Negativo | `services.service.spec.ts` › «rechaza ticketId con cualquier otro origen» | Pasó |
| CP-045 | CA-HU05-5 | RABBITMQ_URL sin definir o broker apagado; ticket en ROUTED; { origin: "TICKET", ticketId } | Positivo | `services.service.spec.ts` › «el alta solo encola el aviso a M2, nunca urbanServiceScheduled»<br>`services-lifecycle.e2e-spec.ts` › «programa el servicio y encola solo el aviso a M2 (sin urbanServiceScheduled)»<br>(+1 más) | Pasó (corregido: ACT-23, #346) |
| CP-046 | CA-HU05-5 | Servicio sin ticket; sin ticketId | Borde | `services.service.spec.ts` › «un servicio sin ticketId no publica nada hacia M2» | Pasó |
| CP-294 | CA-HU05-6 | Cuadrilla de la zona B; servicio en la zona A; POST /services o assign-crew sin overrideNote | Negativo | `services-delay-assignment.spec.ts` › «cuadrilla de otra zona: rebota pidiendo nota y no escribe»<br>`services.service.spec.ts` › «cuadrilla de una zona que el recorrido no toca: pide nota y no crea» | Pasó (corregido: ACT-09, #454, #455) |
| CP-295 | CA-HU05-6 | Cuadrilla de otra especialidad; assign-crew sin overrideNote | Negativo | `services.service.spec.ts` › «especialidad que no corresponde al tipo REC-DOM: pide nota» | Pasó (corregido: ACT-09, #454, #455) |
| CP-296 | CA-HU05-6 | Cuadrilla de otra zona; assign-crew con overrideNote | Positivo | `services-delay-assignment.spec.ts` › «con nota se asigna igual y la nota queda guardada» | Pasó |
| CP-297 | CA-HU05-6 | Cuadrilla de la zona y especialidad correcta; POST /services | Positivo | `services.service.spec.ts` › «cuadrilla de la zona del recorrido y especialidad correcta: crea sin nota» | Pasó |
| CP-298 | CA-HU05-6 | Tipo de servicio sin mapa de especialidad; assign-crew | Borde | `services-delay-assignment.spec.ts` › «un tipo de servicio sin mapear no genera aviso» | Pasó |

## HU-06 — Reprogramar o cancelar un servicio con motivo

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-047 | CA-HU06-1 | Servicio en cada uno de los tres estados; { reason: "Pedido de la zona" } | Positivo | `services.service.spec.ts` › «se puede cancelar desde %s»<br>`services.service.spec.ts` › «reanudar y cancelar desde SUSPENDED limpian statusNote» | Pasó |
| CP-048 | CA-HU06-2 | Servicio SCHEDULED; confirm-reschedule { scheduledDate: mañana } | Positivo | `services.service.spec.ts` › «confirm-reschedule vuelve a SCHEDULED con la fecha nueva» | Pasó |
| CP-049 | CA-HU06-2 | Servicio RESCHEDULED; confirm-reschedule con fecha de hoy (Argentina) | Borde | `services.service.spec.ts` › «confirmar con la fecha de hoy (Argentina) es válido» | Pasó |
| CP-050 | CA-HU06-2 | Servicio RESCHEDULED sin fecha nueva; cancel directo | Positivo | `services.service.spec.ts` › «un servicio reprogramado se puede cancelar sin inventar una fecha» | Pasó |
| CP-051 | CA-HU06-3 | Servicio RESCHEDULED; scheduledDate: ayer | Negativo | `services.service.spec.ts` › «confirmar con una fecha pasada da 400 y no transiciona» | Pasó |
| CP-052 | CA-HU06-3 | Servicio IN_PROGRESS; POST /services/:id/cancel | Negativo | `services.service.spec.ts` › «rechaza una transicion invalida nombrando las validas» | Pasó |
| CP-053 | CA-HU06-4 | Servicios SCHEDULED en la zona afectada; weatherAlertIssued severity HIGH, from/to | Positivo | `consumers.spec.ts` › «una alerta severa marca los servicios de la zona para reprogramar»<br>`consumers.spec.ts` › «la ventana acota los servicios por scheduledDate» | Pasó |
| CP-054 | CA-HU06-4 | Misma zona; severity LOW | Borde | `consumers.spec.ts` › «una alerta leve avisa pero no reprograma» | Pasó |
| CP-055 | CA-HU06-4 | Misma zona; severity HIGH sin from/to | Negativo | `consumers.spec.ts` › «una alerta severa sin ventana from/to se descarta: no reprograma todas» | Pasó |
| CP-056 | CA-HU06-5 | Servicio SCHEDULED con corte REQUESTED; streetClosureRejected por el inbox | Positivo | `consumers.spec.ts` › «el rechazo del corte marca el servicio para reprogramar, no lo cancela» | Pasó |
| CP-057 | CA-HU06-5 | Servicio ya IN_PROGRESS; streetClosureRejected | Borde | `consumers.spec.ts` › «si el servicio ya no está SCHEDULED, el rechazo no lo reprograma» | Pasó |

## HU-07 — Ejecución en campo: iniciar, resultado por zona y cierre

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-058 | CA-HU07-1 | Servicio ROUTE con 2 zonas y cuadrilla; usuario líder; start; POST zone-results x2 (SERVICED); complete | Positivo | `services-lifecycle.e2e-spec.ts` › «informa el resultado de la zona y cierra el servicio como COMPLETED»<br>`crew-ownership.e2e-spec.ts` › «el integrante y el líder de la cuadrilla sí ejecutan el ciclo completo»<br>(+1 más) | Pasó |
| CP-059 | CA-HU07-2 | Servicio IN_PROGRESS con una zona NOT_SERVICED y motivo; complete | Positivo | `services.service.spec.ts` › «cierra PARTIALLY_COMPLETED si alguna zona no se atendio» | Pasó |
| CP-060 | CA-HU07-3 | Servicio con 2 zonas y 1 resultado; complete | Negativo | `services.service.spec.ts` › «no deja cerrar si falta el resultado de alguna zona» | Pasó |
| CP-061 | CA-HU07-3 | Servicio IN_PROGRESS; { zoneId, status: "NOT_SERVICED" } sin reason | Negativo | `services.service.spec.ts` › «exige motivo cuando la zona no quedo SERVICED» | Pasó |
| CP-062 | CA-HU07-3 | Servicio IN_PROGRESS; { zoneId, status: "SERVICED", reason: "x" } | Negativo | `services.service.spec.ts` › «rechaza motivo cuando la zona quedo SERVICED» | Pasó |
| CP-063 | CA-HU07-3 | Zona con resultado ya informado; segundo POST zone-results para la misma zona | Negativo | `services.service.spec.ts` › «rechaza una zona que ya tiene resultado» | Pasó |
| CP-064 | CA-HU07-4 | Servicio de la cuadrilla A; usuario de la B; POST /services/:id/start | Negativo | `crew-ownership.e2e-spec.ts` › «el integrante de otra cuadrilla no puede iniciar el servicio: 403 NOT_ASSIGNED»<br>`services-ownership.spec.ts` › «%s: un usuario ajeno a la cuadrilla recibe 403 NOT_ASSIGNED» | Pasó (corregido: ACT-04, #365, #394) |
| CP-065 | CA-HU07-4 | Servicio sin cuadrilla; cualquier acción de Campo | Negativo | `crew-ownership.e2e-spec.ts` › «un servicio sin cuadrilla da 403 a todo Campo, en cada acción» | Pasó (corregido: ACT-04, #365, #394) |
| CP-066 | CA-HU07-4 | Servicio inexistente; start sobre un uuid inexistente | Borde | `crew-ownership.e2e-spec.ts` › «un servicio inexistente sigue siendo 404 (no se confunde con 403)» | Pasó |
| CP-067 | CA-HU07-5 | Tipo con requiresVehicle = true y sin vehículo; start | Negativo | `services.service.spec.ts` › «no deja iniciar sin vehiculo si el tipo lo exige»<br>`services-lifecycle.e2e-spec.ts` › «no deja iniciar sin cuadrilla y sí después de asignarla» | Pasó |
| CP-068 | CA-HU07-6 | Servicio SCHEDULED; delayType START | Positivo | `services-delay-assignment.spec.ts` › «un servicio que no arrancó admite START»<br>`services-delay-assignment.spec.ts` › «no toca el estado del servicio» | Pasó |
| CP-069 | CA-HU07-6 | Servicio SCHEDULED; delayType DURATION | Negativo | `services-delay-assignment.spec.ts` › «un servicio que no arrancó rechaza DURATION» | Pasó |
| CP-070 | CA-HU07-6 | Servicio IN_PROGRESS; delayType START | Negativo | `services-delay-assignment.spec.ts` › «un servicio en curso rechaza START» | Pasó |
| CP-071 | CA-HU07-6 | Servicio con un aviso vigente; segundo aviso | Borde | `services-delay-assignment.spec.ts` › «un aviso nuevo reemplaza al vigente en vez de pisarlo» | Pasó |
| CP-072 | CA-HU07-7 | Servicio POINT sobre contenedor OVERFLOWED; falla forzada de escritura; complete | Negativo | `containers-close.e2e-spec.ts` › «revierte el cierre del servicio si falla la escritura del contenedor dentro de la transacción»<br>`containers-close.e2e-spec.ts` › «no cierra el servicio si falta la ubicación nueva del contenedor en RELOCATING» | Pasó |
| CP-073 | CA-HU07-7 | Contenedor OVERFLOWED; complete COMPLETED | Positivo | `containers-close.e2e-spec.ts` › «devuelve a ACTIVE el contenedor desbordado al cerrar el servicio» | Pasó |
| CP-074 | CA-HU07-7 | Cierre PARTIAL; complete PARTIALLY_COMPLETED | Borde | `containers-close.e2e-spec.ts` › «no toca el contenedor si el cierre es parcial» | Pasó |

## HU-08 — Adjuntar evidencia fotográfica con reintento seguro

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-075 | CA-HU08-1 | Servicio IN_PROGRESS de mi cuadrilla; bucket R2 configurado; multipart: archivo JPEG con EXIF, ownerType SERVICE, ownerId, Idempotency-Key | Positivo | `attachments.service.spec.ts` › «sube el archivo y persiste el Attachment cuando el owner existe»<br>`attachments.service.spec.ts` › «sube el archivo sin los metadatos»<br>(+1 más) | Pasó |
| CP-076 | CA-HU08-2 | Evidencia subida con la clave K; mismo POST con la clave K | Borde | `attachments.service.spec.ts` › «con una Idempotency-Key ya usada, devuelve el attachment existente sin volver a subir»<br>`attachments.service.spec.ts` › «tambien lo borra cuando pierde la carrera de la Idempotency-Key» | Pasó |
| CP-077 | CA-HU08-3 | Ejecutable renombrado a .jpg; Content-Type image/jpeg con bytes de otro tipo | Negativo | `attachments.service.spec.ts` › «rechaza un archivo cuyo contenido no coincide con lo declarado» | Pasó |
| CP-078 | CA-HU08-3 | Archivo de 10 MB + 1 byte; POST /evidence | Negativo | `attachments.service.spec.ts` › «rechaza un archivo que supera el tamaño máximo» | Pasó |
| CP-079 | CA-HU08-3 | Tipo text/plain; POST /evidence | Negativo | `attachments.service.spec.ts` › «rechaza un tipo de archivo no permitido» | Pasó |
| CP-080 | CA-HU08-3 | Sin header; POST /evidence sin Idempotency-Key | Negativo | `attachments.service.spec.ts` › «rechaza sin Idempotency-Key» | Pasó |
| CP-081 | CA-HU08-4 | Servicio de otra cuadrilla; POST /evidence ownerType SERVICE | Negativo | `crew-ownership.e2e-spec.ts` › «SERVICE: el ajeno recibe 403 NOT_ASSIGNED; el integrante y el líder suben (201)» | Pasó (corregido: ACT-04, #365, #394) |
| CP-082 | CA-HU08-4 | Dueño inexistente; ownerId uuid inexistente | Negativo | `crew-ownership.e2e-spec.ts` › «un dueño inexistente es 404, no 403» | Pasó |
| CP-083 | CA-HU08-5 | Sin R2_BUCKET ni R2_PUBLIC_URL_BASE; POST /evidence válido | Negativo | `attachments.service.spec.ts` › «el camino válido responde 503 y no persiste nada (la Idempotency-Key queda libre)» | Pasó |
| CP-084 | CA-HU08-5 | Falla forzada al escribir la fila; POST /evidence válido | Negativo | `attachments.service.spec.ts` › «borra el archivo del bucket si la fila no se puede escribir» | Pasó |
| CP-299 | CA-HU08-6 | Servicio de otra cuadrilla; GET /evidence con ownerType SERVICE | Negativo | `attachments.service.spec.ts` › «Campo sobre un servicio de otra cuadrilla: 403 NOT_ASSIGNED y no consulta evidencia» | Pasó (corregido: ACT-05, #466) |
| CP-300 | CA-HU08-6 | Servicio de mi cuadrilla; GET /evidence | Positivo | `attachments.service.spec.ts` › «Campo sobre lo propio lee» | Pasó (corregido: ACT-05, #466) |
| CP-301 | CA-HU08-6 | Dueño inexistente; ownerId uuid inexistente | Negativo | `attachments.service.spec.ts` › «dueño inexistente: 404» | Pasó (corregido: ACT-05, #466) |
| CP-302 | CA-HU08-6 | Rol M6_OFICINA_AMBIENTAL; GET /evidence de una inspección | Positivo | `attachments.service.spec.ts` › «Oficina Ambiental lee sin chequear rol ni pertenencia» | Pasó (corregido: ACT-05, #466) |

## HU-09 — Derivar una reparación de infraestructura o pedir un corte de calle

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-085 | CA-HU09-1 | Rol M6_OFICINA_OPERACIONES; servicio con ticketId; { damageType: "BROKEN_PAVEMENT", detectedIn: servicio } | Positivo | `outbound-requests.service.spec.ts` › «publica infrastructureRepairRequested al crear»<br>`outbound-requests.service.spec.ts` › «si el servicio de origen nacio de un reclamo, el ticketId viaja»<br>(+1 más) | Pasó |
| CP-086 | CA-HU09-2 | Intervención AUTHORIZED; { sections: [{ streetName, fromCross, toCross, direction: "BOTH" }], closureType: "PARTIAL" } | Positivo | `outbound-requests.service.spec.ts` › «intervención AUTHORIZED: se crea y se encola»<br>`outbound-requests.service.spec.ts` › «sourceModule viaja como M6, que es lo que dice la tabla de M7»<br>(+1 más) | Pasó (corregido: ACT-14, #447, #481) |
| CP-087 | CA-HU09-3 | Inspección sin cerrar; POST /repair-requests | Negativo | `environmental-flow.e2e-spec.ts` › «sin cerrar: 409 y no se crea la solicitud» | Pasó (corregido: ACT-28, #451) |
| CP-088 | CA-HU09-3 | Inspección cerrada NO_VIOLATION; POST /repair-requests | Negativo | `environmental-flow.e2e-spec.ts` › «cerrada con NO_VIOLATION: 409 y no se crea la solicitud» | Pasó (corregido: ACT-28, #451) |
| CP-089 | CA-HU09-3 | Expediente NOISE con infracción; POST /repair-requests | Negativo | `environmental-flow.e2e-spec.ts` › «expediente NOISE con infracción: 409 y allowedActions.repair en false» | Pasó (corregido: ACT-28, #451) |
| CP-090 | CA-HU09-3 | Pedido abierto para el mismo origen y daño; segundo POST | Negativo | `outbound-requests.service.spec.ts` › «un pedido abierto para el mismo origen y daño: 409 y no se crea ni se encola» | Pasó (corregido: ACT-28, #451) |
| CP-091 | CA-HU09-3 | Cualquiera; requestedTo anterior a requestedFrom | Negativo | `outbound-requests.service.spec.ts` › «un corte que termina antes de empezar se rechaza» | Pasó |
| CP-092 | CA-HU09-4 | Corte REQUESTED; approve con closureId de M7 | Positivo | `outbound-requests.service.spec.ts` › «aprobar guarda el identificador de corte de M7» | Pasó |
| CP-093 | CA-HU09-4 | Corte REQUESTED; reject con motivo | Positivo | `outbound-requests.service.spec.ts` › «rechazar guarda el motivo para devolverlo en la respuesta» | Pasó |
| CP-094 | CA-HU09-4 | Corte REJECTED; approve | Negativo | `outbound-requests.service.spec.ts` › «el 409 lista las transiciones válidas» | Pasó |
| CP-095 | CA-HU09-4 | Corte EXPIRED; end (streetClosureEnded tardío) | Borde | `outbound-requests.service.spec.ts` › «finalizar desde EXPIRED es válido: un streetClosureEnded tardío o el /end manual» | Pasó |
| CP-096 | CA-HU09-5 | Corte APPROVED con approvedTo vencido + gracia; barrido (arranque o programado) | Positivo | `street-closure-expiry.e2e-spec.ts` › «persiste la ventana, vence por el barrido y reprograma el servicio»<br>`street-closure-expiry.sweeper.spec.ts` › «la gracia es de 6 horas» | Pasó (corregido: ACT-22, #321) |
| CP-097 | CA-HU09-5 | Corte dentro de la gracia o vigente; barrido | Borde | `street-closure-expiry.e2e-spec.ts` › «un corte dentro de la gracia o todavia vigente no se toca» | Pasó |
| CP-098 | CA-HU09-5 | Servicio ya IN_PROGRESS; barrido | Borde | `street-closure-expiry.e2e-spec.ts` › «un servicio ya iniciado no se reprograma al vencer su corte» | Pasó (corregido: ACT-22, #321) |
| CP-303 | CA-HU09-6 | Corte APPROVED con ventana de M7; GET /street-closure-requests/:id | Positivo | `outbound-requests.service.spec.ts` › «la respuesta expone la ventana autorizada y el motivo de rechazo (null si no hay)»<br>`consumers.spec.ts` › «el corte aprobado persiste la ventana autorizada en approvedFrom/approve» | Pasó (corregido: ACT-14, #447, #481) |
| CP-304 | CA-HU09-6 | Corte REJECTED con motivo; GET /street-closure-requests/:id | Positivo | `outbound-requests.service.spec.ts` › «rechazar guarda el motivo para devolverlo en la respuesta» | Pasó |
| CP-305 | CA-HU09-6 | Corte ya APPROVED; streetClosureApproved repetido | Borde | `consumers.spec.ts` › «un reintento de Approved sobre un corte ya APPROVED no pisa la ventana» | Pasó |
| CP-306 | CA-HU09-6 | Corte REQUESTED; streetClosureApproved con fechas ausentes o ilegibles | Borde | `consumers.spec.ts` › «fechas ausentes o ilegibles no tumban el handler ni se guardan» | Pasó |

## HU-10 — Filtrar las intervenciones de arbolado por prioridad

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-099 | CA-HU10-1 | Intervenciones con prioridades LOW, HIGH y CRITICAL; priority=HIGH | Positivo | `tree-interventions.service.spec.ts` › «filtra por prioridad combinada con tipo y estado»<br>FE: `tree-interventions.spec.ts` | Pasó (corregido: ACT-18, #293, #294, #340) |
| CP-100 | CA-HU10-2 | Cualquier rol de M6; priority=URGENTE | Negativo | Manual: La validación del enum la hace el ValidationPipe; no se encontró un test específico del filtro priority en esta pasada. | — |
| CP-101 | CA-HU10-3 | Filtro priority aplicado; GET /tree-interventions sin priority | Positivo | `tree-interventions.service.spec.ts` › «filtra por tipo y estado»<br>FE: `tree-interventions.spec.ts` | Pasó |

## HU-11 — Gestión de contenedores (desborde, daño, vaciado, reparación y reubicación)

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-102 | CA-HU11-1 | Contenedor ACTIVE; POST report-overflow; POST empty | Positivo | `containers.service.spec.ts` › «reportOverflow lleva de ACTIVE a OVERFLOWED»<br>`containers.service.spec.ts` › «empty vuelve a ACTIVE y limpia los datos del daño»<br>(+2 más) | Pasó |
| CP-103 | CA-HU11-2 | Contenedor ACTIVE; Oficina M6_OFICINA_OPERACIONES para start/complete; { damageType: "LID_BROKEN", severity: "MEDIUM", requiresPublicWorks: false } | Positivo | `containers.service.spec.ts` › «guarda el daño y publica containerDamaged»<br>`containers.service.spec.ts` › «el evento se encola en la misma transacción que el cambio de estado»<br>(+1 más) | Pasó |
| CP-104 | CA-HU11-3 | Contenedor ACTIVE; relocate; confirm-relocation con ubicación nueva | Positivo | `containers.service.spec.ts` › «confirmRelocation guarda la ubicación nueva» | Pasó |
| CP-105 | CA-HU11-3 | Contenedor DAMAGED; remove | Positivo | `containers.service.spec.ts` › «startRepair y remove salen los dos de DAMAGED» | Pasó |
| CP-106 | CA-HU11-3 | Contenedor ACTIVE; remove | Negativo | `containers.service.spec.ts` › «solo se llega a REMOVED desde DAMAGED» | Pasó |
| CP-107 | CA-HU11-4 | Contenedor en cada uno de los 6 estados; cada acción no permitida | Negativo | `containers.service.spec.ts` › «desde %s, el guard respeta la tabla»<br>`containers.service.spec.ts` › «el 409 nombra las transiciones válidas desde donde está» | Pasó |
| CP-108 | CA-HU11-4 | Contenedor REMOVED; cualquier transición | Negativo | `containers.service.spec.ts` › «un contenedor retirado no se mueve más» | Pasó |
| CP-109 | CA-HU11-4 | Contenedor inexistente; cualquier transición | Negativo | `containers.service.spec.ts` › «una transición sobre un contenedor inexistente da 404» | Pasó |
| CP-110 | CA-HU11-4 | Contenedor con code "CT-01"; POST /containers con code "CT-01" | Negativo | `containers.service.spec.ts` › «un código repetido da 409, no un error de Prisma» | Pasó |
| CP-111 | CA-HU11-4 | Estado cambia entre la lectura y la escritura; dos requests concurrentes | Borde | `containers.service.spec.ts` › «si el estado cambió entre la lectura y la escritura da 409»<br>`containers.service.spec.ts` › «un conflicto de concurrencia (409) no deja fila» | Pasó |
| CP-112 | CA-HU11-5 | Rol M6_OFICINA_OPERACIONES; POST /containers/:id/report-damage | Negativo | `auth-roles.e2e-spec.ts` › «$grupo: $method $path» | Pasó (corregido: ACT-01, #161, #235) |
| CP-113 | CA-HU11-6 | Falla forzada del historial; report-damage | Negativo | `containers.service.spec.ts` › «si falla el historial la acción entera falla y no se publica el evento» | Pasó |
| CP-114 | CA-HU11-6 | Bus no disponible; report-damage | Positivo | `containers.service.spec.ts` › «el evento se encola en la misma transacción que el cambio de estado»<br>`outbox-dispatcher.service.spec.ts` › «una falla la deja PENDING para que la proxima barrida reintente» | Pasó |
| CP-307 | CA-HU11-7 | Contenedor con 3 transiciones; GET /containers/:id/history | Positivo | `containers.service.spec.ts` › «lista paginado y del más reciente al más antiguo» | Pasó (corregido: ACT-30, #453) |
| CP-308 | CA-HU11-7 | Contenedor inexistente; GET /containers/:id/history | Negativo | `containers.service.spec.ts` › «da 404 si el contenedor no existe» | Pasó |
| CP-309 | CA-HU11-7 | Contenedor ACTIVE; report-damage con observations | Positivo | `containers.service.spec.ts` › «guarda las observaciones y las devuelve, sin sumarlas al evento» | Pasó (corregido: ACT-30, #453) |
| CP-310 | CA-HU11-7 | Contenedor ACTIVE; report-damage sin observations | Borde | `containers.service.spec.ts` › «sin observaciones guarda null» | Pasó |

## HU-12 — Censo de arbolado, relevamientos de riesgo y podas o extracciones

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-115 | CA-HU12-1 | Árbol existente; rol M6_CAMPO_CUADRILLA; { riskLevel: "HIGH", riskType: "FALLING_BRANCH", surveyedAt: hoy } | Positivo | `tree-surveys.service.spec.ts` › «un riesgo %s publica treeRiskDetected»<br>`tree-surveys.service.spec.ts` › «el evento y el relevamiento van en la misma transacción»<br>(+1 más) | Pasó |
| CP-116 | CA-HU12-2 | Intervención SAFETY_PRUNING REQUESTED; authorize; assign-service con servicio POINT | Positivo | `tree-interventions.service.spec.ts` › «una poda la autoriza quien tiene rol de operaciones, sin M6_ADMIN»<br>`tree-interventions.service.spec.ts` › «asocia el servicio sin encolar eventos»<br>(+1 más) | Pasó (corregido: ACT-08, #456) |
| CP-117 | CA-HU12-3 | Extracción PENDING_AUTHORIZATION; authorize con rol M6_ADMIN | Positivo | `tree-intervention-authorization.e2e-spec.ts` › «M6_ADMIN autoriza una extracción y la respuesta dice quién la solicitó y quién la autorizó»<br>`tree-intervention-authorization.e2e-spec.ts` › «M6_ADMIN autoriza lo que él mismo solicitó y queda registrado» | Pasó (corregido: ACT-08, #456) |
| CP-118 | CA-HU12-4 | Extracción PENDING_AUTHORIZATION; authorize con M6_OFICINA_OPERACIONES | Negativo | `tree-intervention-authorization.e2e-spec.ts` › «Operaciones no autoriza una extracción: 403 ROLE_REQUIRED y sigue pendiente»<br>`tree-intervention-authorization.e2e-spec.ts` › «Operaciones no rechaza una extracción: 403 ROLE_REQUIRED» | Pasó (corregido: ACT-08, #456) |
| CP-119 | CA-HU12-4 | Extracción en REQUESTED; authorize | Negativo | `tree-interventions.service.spec.ts` › «no deja autorizar una extracción que sigue en REQUESTED» | Pasó |
| CP-120 | CA-HU12-5 | Árbol existente; riskLevel HIGH sin riskType | Negativo | `tree-surveys.service.spec.ts` › «un riesgo %s sin riskType da 400 sin escribir nada» | Pasó |
| CP-121 | CA-HU12-5 | Árbol existente; surveyedAt: mañana | Negativo | Manual: La regla de fecha futura figura en docs/api/endpoints.md; no se localizó un test específico en esta pasada. | — |
| CP-122 | CA-HU12-5 | Árbol inexistente; POST /trees/:id/surveys | Negativo | `tree-surveys.service.spec.ts` › «un árbol inexistente da 404 sin escribir nada» | Pasó |
| CP-123 | CA-HU12-5 | Intervención REQUESTED; assign-service | Negativo | `tree-interventions.service.spec.ts` › «solo se programa lo autorizado» | Pasó |
| CP-124 | CA-HU12-5 | Servicio que ya ejecuta otra intervención; assign-service | Negativo | `tree-interventions.service.spec.ts` › «un servicio que ya ejecuta otra intervención da 409» | Pasó |
| CP-125 | CA-HU12-6 | Árbol existente; riskLevel LOW | Borde | `tree-surveys.service.spec.ts` › «un riesgo %s se guarda pero no publica nada» | Pasó |
| CP-126 | CA-HU12-7 | Bus no disponible; relevamiento HIGH | Positivo | `tree-surveys.service.spec.ts` › «el evento y el relevamiento van en la misma transacción»<br>`outbox-dispatcher.service.spec.ts` › «una falla la deja PENDING para que la proxima barrida reintente» | Pasó |

## HU-13 — Administrar espacios verdes y puntos verdes

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-127 | CA-HU13-1 | Zona existente; { code, name, spaceType: "SQUARE", zoneId } | Positivo | `green-spaces.service.spec.ts` › «nace activo y sin superficie si no se la pasan» | Pasó |
| CP-128 | CA-HU13-1 | Zona existente; { code, name, wasteTypes: ["RECYCLABLE"], zoneId } | Positivo | `green-points.service.spec.ts` › «devuelve los tipos de residuo ordenados» | Pasó |
| CP-129 | CA-HU13-2 | Punto verde con 2 tipos; PATCH wasteTypes: ["GREEN"] | Positivo | `green-points.service.spec.ts` › «al actualizar los tipos de residuo reemplaza el conjunto completo» | Pasó |
| CP-130 | CA-HU13-3 | Zona inexistente; zoneId uuid inexistente | Negativo | `green-spaces.service.spec.ts` › «una zona inexistente da 404» | Pasó |
| CP-131 | CA-HU13-3 | Punto con code existente; POST con code repetido | Negativo | `green-points.service.spec.ts` › «traduce el codigo duplicado a 409» | Pasó |
| CP-132 | CA-HU13-3 | Espacio verde existente; PATCH spaceType | Borde | `green-spaces.service.spec.ts` › «el tipo de espacio es inmutable» | Pasó |
| CP-133 | CA-HU13-4 | Recurso activo; DELETE | Positivo | `green-spaces.service.spec.ts` › «es baja lógica, no borrado»<br>`green-points.service.spec.ts` › «la baja es logica» | Pasó |

## HU-14 — Filtrar la cola de denuncias por rango de fechas

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-134 | CA-HU14-1 | Denuncias con updatedAt dentro y fuera del rango; from=2026-10-01&to=2026-10-31 | Positivo | `environmental-reports.service.spec.ts` › «from/to filtran updatedAt por días argentinos, to inclusivo»<br>FE: `environmental-reports.spec.ts` | Pasó (corregido: ACT-18, #293, #294, #340) |
| CP-135 | CA-HU14-2 | Cualquier rol de M6; from=2026-10-31&to=2026-10-01 | Negativo | `environmental-reports.service.spec.ts` › «from posterior a to da 400 y no consulta la base» | Pasó (corregido: ACT-18, #293, #294, #340) |
| CP-136 | CA-HU14-2 | Cualquier rol de M6; from=2026-02-30 | Negativo | `query-environmental-reports.dto.spec.ts` | Pasó |
| CP-137 | CA-HU14-3 | Denuncias de varias fechas; solo from, o solo to | Borde | `environmental-reports.service.spec.ts` › «acepta solo from o solo to» | Pasó (corregido: ACT-18, #293, #294, #340) |
| CP-311 | CA-HU14-4 | Expedientes en 3 estados; status=RECEIVED&status=UNDER_REVIEW | Positivo | `environmental-reports.service.spec.ts` › «status con varios valores filtra con in y count usa el mismo where» | Pasó (corregido: ACT-18, #293, #294, #340) |
| CP-312 | CA-HU14-4 | Cualquiera; sin status | Borde | `environmental-reports.service.spec.ts` › «sin status el where no trae la clave» | Pasó |
| CP-313 | CA-HU14-4 | Cualquiera; status vacío | Negativo | `query-environmental-reports.dto.spec.ts` › «rechaza una lista vacía con 400» | Pasó (corregido: ACT-18, #293, #294, #340) |

## HU-15 — Recibir denuncias ambientales y asignarlas a una cuadrilla para inspeccionarlas

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-138 | CA-HU15-1 | Expediente RECEIVED con ticketId; POST /environmental-reports/:id/start-review | Positivo | `environmental-reports.service.spec.ts` › «startReview lo pone en análisis y le avisa al vecino»<br>`environmental-flow.e2e-spec.ts` › «recibe la denuncia y la toma para análisis» | Pasó |
| CP-139 | CA-HU15-2 | Expediente UNDER_REVIEW; cuadrilla de inspección; { scheduledDate, inspectorId? } | Positivo | `environmental-flow.e2e-spec.ts` › «programa la inspección y deja el expediente en INSPECTION_SCHEDULED»<br>`environmental-flow.e2e-spec.ts` › «programa el servicio de la inspección y el vínculo queda en la inspección (#218)»<br>(+1 más) | Pasó |
| CP-140 | CA-HU15-3 | Rol M6_CAMPO_INSPECTOR; POST /environmental-reports sin ticketId | Positivo | `environmental-reports.service.spec.ts` › «un inspector sí abre expedientes de oficio (sin ticketId)»<br>`environmental-reports.service.spec.ts` › «un expediente de oficio nace en RECEIVED y sin reclamo» | Pasó |
| CP-141 | CA-HU15-3 | Rol M6_CAMPO_INSPECTOR; POST /environmental-reports con ticketId | Negativo | `auth-roles.e2e-spec.ts` › «POST /environmental-reports: ticketId solo con Oficina Ambiental» | Pasó |
| CP-142 | CA-HU15-4 | Expediente RECEIVED; POST forward (solo desde UNDER_REVIEW) | Negativo | `environmental-reports.service.spec.ts` › «una acción que la tabla no permite no escribe nada»<br>`environmental-reports.service.spec.ts` › «el 409 nombra las transiciones válidas desde donde está» | Pasó |
| CP-143 | CA-HU15-4 | Inspector sin el rol; { inspectorId: "123" } | Negativo | `auth-roles.e2e-spec.ts` › «solo se asigna a quien tiene M6_CAMPO_INSPECTOR (400 si no) y se guarda» | Pasó |
| CP-144 | CA-HU15-4 | Expediente UNDER_REVIEW; forward y dismiss | Borde | `environmental-reports.service.spec.ts` › «forward sale hacia M2 como RETURNED, no como REJECTED»<br>`environmental-reports.service.spec.ts` › «dismiss sale como REJECTED» | Pasó |
| CP-145 | CA-HU15-5 | Expediente ya abierto para el ticket; ROUTED repetido con otro eventId | Negativo | `consumers.spec.ts` › «un ROUTED repetido no abre un segundo expediente» | Pasó |
| CP-146 | CA-HU15-5 | Ticket de M3; ticketUpdated con responsibleAreaId distinto de M6 | Negativo | `consumers.spec.ts` › «no persiste nada de un ticket que no es nuestro» | Pasó |
| CP-147 | CA-HU15-5 | Sin expediente todavía; cambio de prioridad antes del ROUTED | Borde | `consumers.spec.ts` › «sale failed, y el reintento del Core lo aplica tras el ROUTED»<br>`inbox.e2e-spec.ts` › «un PRIORITY_CHANGED que llega antes que su ROUTED se aplica en el reintento» | Pasó |

## HU-16 — Registrar la inspección y emitir el acta de constatación

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-148 | CA-HU16-1 | Inspección abierta; usuario con M6_CAMPO_INSPECTOR asignado; { outcome: "VIOLATION_FOUND", nextStep: "NOTICE_TO_BE_ISSUED", inspectedAt: hoy } | Positivo | `environmental-flow.e2e-spec.ts` › «cierra la inspección con infracción y lleva el expediente a VIOLATION_FOUND»<br>`environmental-inspections.service.spec.ts` › «VIOLATION_FOUND lleva el expediente hasta VIOLATION_FOUND»<br>(+1 más) | Pasó |
| CP-149 | CA-HU16-2 | Inspección VIOLATION_FOUND con establishmentId; { violationType, severity, suggestedAction, establishmentId } | Positivo | `environmental-flow.e2e-spec.ts` › «emite el acta, la deriva a M4 y cierra el expediente en NOTICE_ISSUED»<br>`environmental-inspections.service.spec.ts` › «publica environmentalViolationDetected cuando hay establecimiento»<br>(+2 más) | Pasó |
| CP-150 | CA-HU16-3 | Inspección abierta; outcome NO_VIOLATION | Positivo | `environmental-inspections.service.spec.ts` › «NO_VIOLATION lleva el expediente hasta NO_VIOLATION» | Pasó |
| CP-151 | CA-HU16-3 | Inspección abierta; outcome INCONCLUSIVE | Borde | `environmental-inspections.service.spec.ts` › «INCONCLUSIVE lo deja en INSPECTED, esperando otra inspeccion» | Pasó |
| CP-152 | CA-HU16-3 | Inspección VIOLATION_FOUND sin establishmentId; emitir acta | Borde | `environmental-inspections.service.spec.ts` › «SIN establecimiento el acta se registra pero NO se deriva a M4» | Pasó |
| CP-153 | CA-HU16-3 | Inspección sin acta; GET violation-notice | Borde | `environmental-flow.e2e-spec.ts` › «el GET del acta sin acta emitida responde 200 con el literal null; inspección inexistente, 404» | Pasó (corregido: ACT-17, #284) |
| CP-154 | CA-HU16-4 | Inspección con acta emitida; segundo POST violation-notice | Negativo | `environmental-flow.e2e-spec.ts` › «no deja emitir una segunda acta sobre la misma inspección»<br>`environmental-inspections.service.spec.ts` › «el acta es inmutable: no se emite una segunda sobre la misma inspe» | Pasó |
| CP-155 | CA-HU16-4 | Inspección sin VIOLATION_FOUND; POST violation-notice | Negativo | `environmental-inspections.service.spec.ts` › «no se emite acta sobre una inspeccion sin VIOLATION_FOUND» | Pasó |
| CP-156 | CA-HU16-4 | Inspección abierta; inspectedAt: mañana | Negativo | `environmental-inspections.service.spec.ts` › «inspectedAt en el futuro da 400» | Pasó |
| CP-157 | CA-HU16-4 | Inspección abierta; outcome VIOLATION_FOUND sin nextStep | Negativo | `environmental-inspections.service.spec.ts` › «VIOLATION_FOUND sin nextStep da 400» | Pasó |
| CP-158 | CA-HU16-4 | Inspección ya cerrada; complete otra vez | Negativo | `environmental-inspections.service.spec.ts` › «una inspeccion ya cerrada no se vuelve a cerrar» | Pasó |
| CP-159 | CA-HU16-5 | Inspección asignada al inspector A; usuario inspector B; complete | Negativo | `crew-ownership.e2e-spec.ts` › «otro inspector que el asignado: 403 NOT_ASSIGNED y la inspección sigue abierta»<br>`crew-ownership.e2e-spec.ts` › «una inspección ya cerrada: el ajeno ve 403 (no el 409), el asignado ve 409» | Pasó (corregido: ACT-04, #365, #394) |
| CP-160 | CA-HU16-5 | Inspección sin inspector asignado; complete por cualquier inspector | Borde | `crew-ownership.e2e-spec.ts` › «sin inspector asignado la cierra cualquier inspector, y queda el del token» | Pasó |
| CP-161 | CA-HU16-6 | Bus no disponible; emitir acta | Positivo | `environmental-inspections.service.spec.ts` › «publica environmentalViolationDetected cuando hay establecimiento»<br>`outbox-dispatcher.service.spec.ts` › «una falla la deja PENDING para que la proxima barrida reintente» | Pasó |
| CP-162 | CA-HU16-6 | Ticket de M2 en RESOLVED o CLOSED; emitir acta | Borde | `environmental-inspections.service.spec.ts` › «sin ticketId no publica ni consulta el estado» | Pasó |
| CP-314 | CA-HU16-7 | Inspección de un expediente con ubicación; GET /environmental-inspections/:id | Positivo | `environmental-inspections.service.spec.ts` › «findOne expone tipo, dirección y coordenadas del expediente (Deci» | Pasó (corregido: ACT-29, #452) |
| CP-315 | CA-HU16-7 | Expediente sin coordenadas; GET /environmental-inspections/:id | Borde | `environmental-inspections.service.spec.ts` › «findOne devuelve lat y lng null si el expediente no tiene coordena» | Pasó |
| CP-316 | CA-HU16-7 | Inspección con acta emitida; GET /environmental-inspections/:id | Borde | `environmental-inspections.service.spec.ts` › «findOne: con acta ya emitida, allowedActions.notice es false» | Pasó (corregido: ACT-29, #452) |
| CP-317 | CA-HU16-8 | Expediente sin start-review previo; emitir acta | Positivo | `environmental-notice-ticket.e2e-spec.ts` › «sin startReview previo el acta informa STARTED, no PROGRESS» | Pasó (corregido: ACT-31, #325) |
| CP-318 | CA-HU16-8 | Expediente con start-review previo; emitir acta | Positivo | `environmental-notice-ticket.e2e-spec.ts` › «con startReview previo el acta informa PROGRESS»<br>`environmental-inspections.service.spec.ts` › «con el ticket IN_PROGRESS informa PROGRESS» | Pasó (corregido: ACT-31, #325) |
| CP-319 | CA-HU16-8 | Expediente de oficio; emitir acta | Borde | `environmental-inspections.service.spec.ts` › «sin ticketId no publica ni consulta el estado» | Pasó |

## HU-17 — Registrar la sanción que devuelve M4 y cerrar el expediente

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-163 | CA-HU17-1 | Expediente NOTICE_ISSUED; sobre del inbox con sourceViolationId válido; POST /events/inbox commercialFineGenerated | Positivo | `environmental-flow.e2e-spec.ts` › «recibe la multa de M4 por el inbox, registra la resolución y cierra el expediente»<br>`consumers.spec.ts` › «la multa crea el SanctionOutcome y cierra el expediente»<br>(+1 más) | Pasó (corregido: ACT-26, #374) |
| CP-164 | CA-HU17-2 | Acta NOTICE_ISSUED; closureUpdate status ORDERED | Positivo | `consumers.spec.ts` › «closureUpdate ORDERED registra la clausura» | Pasó |
| CP-165 | CA-HU17-2 | Acta con clausura ordenada; closureUpdate status LIFTED | Positivo | `consumers.spec.ts` › «closureUpdate LIFTED registra el levantamiento» | Pasó |
| CP-166 | CA-HU17-3 | Inbox; commercialFineGenerated sin sourceViolationId | Negativo | `environmental-flow.e2e-spec.ts` › «rechaza con 400 una multa sin sourceViolationId válido y no guarda la fila»<br>`consumers.spec.ts` › «sin sourceViolationId no sabemos que acta resolvieron: se descarta» | Pasó |
| CP-167 | CA-HU17-3 | Acta ya con resolución; segundo commercialFineGenerated con otro eventId | Negativo | `consumers.spec.ts` › «un acta que ya tiene resolucion no se resuelve dos veces» | Pasó |
| CP-168 | CA-HU17-4 | Expediente NOTICE_ISSUED con deadlineAt pasado; barrido | Positivo | `report-deadline.sweeper.spec.ts` › «cierra solo los NOTICE_ISSUED con el plazo vencido» | Pasó |
| CP-169 | CA-HU17-4 | Barrido al arrancar con la base caída; arranque | Borde | `report-deadline.sweeper.spec.ts` › «si la base no responde al arrancar, no tumba el arranq» | Pasó |

## HU-18 — Pedirle información adicional al vecino (INFORMATION_REQUIRED)

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-170 | CA-HU18-1 | Expediente UNDER_REVIEW con ticket IN_PROGRESS o ROUTED; { message: "Adjunte una foto del frente", requiredBy: "2026-12-31" } | Positivo | `information-request.e2e-spec.ts` › «pide información, queda pendiente y avisa a M2»<br>`environmental-reports.service.spec.ts` › «marca la solicitud y encola INFORMATION_REQUIRED en la misma transacción» | Pasó (corregido: ACT-21, #169, #338, #342) |
| CP-171 | CA-HU18-2 | Solicitud pendiente; ticketUpdated INFORMATION_PROVIDED con message | Positivo | `information-request.e2e-spec.ts` › «la respuesta de M2 cierra la solicitud y guarda lo que contestó el vecino»<br>`consumers.spec.ts` › «INFORMATION_PROVIDED cierra la solicitud pendiente junto con guardar la respuesta» | Pasó (corregido: ACT-21, #169, #338, #342) |
| CP-172 | CA-HU18-2 | Solicitud pendiente; INFORMATION_PROVIDED con purpose RECLASSIFICATION | Borde | `consumers.spec.ts` › «INFORMATION_PROVIDED de una reclasificación (purpose) se ignora» | Pasó |
| CP-173 | CA-HU18-3 | Expediente de oficio; request-information | Negativo | `environmental-reports.service.spec.ts` › «409 si el expediente no nació de un reclamo: no hay a quién preguntarle» | Pasó |
| CP-174 | CA-HU18-3 | Solicitud pendiente; segundo request-information | Negativo | `information-request.e2e-spec.ts` › «un segundo pedido es 409 y no encola otro evento» | Pasó (corregido: ACT-21, #169, #338, #342) |
| CP-175 | CA-HU18-3 | Solicitud pendiente; forward | Negativo | `information-request.e2e-spec.ts` › «con una pendiente, forward es 409» | Pasó |
| CP-176 | CA-HU18-3 | Cualquiera; requiredBy en el pasado | Negativo | `environmental-reports.service.spec.ts` › «requiredBy en el pasado es 400 y no escribe nada» | Pasó |
| CP-177 | CA-HU18-3 | Ticket en M2 en estado terminal; request-information | Negativo | `environmental-reports.service.spec.ts` › «409 si M2 tiene el ticket en %s» | Pasó |
| CP-178 | CA-HU18-4 | Solicitud pendiente sin respuesta; forward / dismiss / close | Borde | `information-request.e2e-spec.ts` › «con una pendiente, forward es 409; un estado distinto de PENDING_INFORMATION la apaga» | Pasó (corregido: ACT-21, #169, #338, #342) |

## HU-19 — M9 conoce los eventos que publica y consume M6

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-179 | CA-HU19-1 | CORE_API_URL y token de módulo configurados; arranque de M6 o core:register | Positivo | `core-registry.service.spec.ts` › «registra lo que sale del código: 8 suscripciones (sin weatherAlertIssued) y 6 publicaciones» | Pasó (corregido: ACT-25, #266, #381, #391) |
| CP-180 | CA-HU19-2 | Core con 3 suscripciones ya activas; sync | Positivo | `core-registry.service.spec.ts` › «crea solo lo que falta y loguea lo que sobra sin borrarlo»<br>`core-registry.service.spec.ts` › «correrlo dos veces no duplica nada» | Pasó (corregido: ACT-25, #266, #381, #391) |
| CP-181 | CA-HU19-2 | Cualquiera; modo simulacro (dry-run) | Borde | `core-registry.service.spec.ts` › «no hace ningún POST y el plan coincide con lo que haría el modo real» | Pasó (corregido: ACT-25, #266, #381, #391) |
| CP-182 | CA-HU19-3 | Core caído; arranque de M6 | Negativo | `core-registry.service.spec.ts` › «una falla del Core no tira la app: se reintenta con backoff y se complet»<br>`core-registry.service.spec.ts` › «abandona tras los intentos máximos» | Pasó |
| CP-183 | CA-HU19-3 | Core con respuesta paginada (meta.total mayor a lo recibido); sync | Negativo | `core-registry.service.spec.ts` › «una respuesta paginada (meta.total mayor a lo recibido) no crea nada» | Pasó |
| CP-184 | CA-HU19-3 | Sin CORE_API_URL; arranque | Borde | `core-registry.service.spec.ts` › «sin CORE_API_URL no hace nada» | Pasó |

## HU-20 — Adaptar M6 al contrato de integración definitivo de M9

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-185 | CA-HU20-1 | Fila PENDING en outbox; broker disponible; barrido del dispatcher | Positivo | `outbox-dispatcher.service.spec.ts` › «envuelve el payload en el sobre del Core»<br>`outbox-dispatcher.service.spec.ts` › «el sobre lleva exactamente las claves del Core, sin extras»<br>(+3 más) | Pasó |
| CP-186 | CA-HU20-2 | Cola q.ambiente creada por el Core; mensaje con sobre válido | Positivo | `rabbitmq.consumer.spec.ts` › «%s → ack»<br>`rabbitmq.consumer.spec.ts` › «el sobre del Core llega al inbox con eventId y la correlación»<br>(+1 más) | Pasó (corregido: ACT-24, #296, #295, #413) |
| CP-187 | CA-HU20-3 | Handler que falla; mensaje válido | Negativo | `rabbitmq.consumer.spec.ts` › «failed → nack, para que el Core reintente con backoff» | Pasó |
| CP-188 | CA-HU20-3 | Cuerpo no JSON; mensaje con texto plano | Negativo | `rabbitmq.consumer.spec.ts` › «un cuerpo que no es JSON → nack» | Pasó |
| CP-189 | CA-HU20-3 | Payload sin campos obligatorios; ticketUpdated incompleto | Negativo | `rabbitmq.consumer.spec.ts` › «payload inválido para el handler (400 del inbox) → nack» | Pasó |
| CP-190 | CA-HU20-4 | Sobre sin campos null; ROUTED sin nulls | Borde | `sobre-reserializado.spec.ts` › «con el ROUTED sin los nulls el snapshot sale igual de completo»<br>`sobre-reserializado.spec.ts` › «el inbox lo acepta y procesa» | Pasó (corregido: ACT-24, #296, #295, #413) |
| CP-191 | CA-HU20-5 | Cola inexistente; arranque con RABBITMQ_URL | Negativo | `rabbitmq.consumer.spec.ts` › «sin la cola (falta suscribirse en el Core) loguea y falla el setup para que recovery reintente» | Pasó |
| CP-192 | CA-HU20-5 | Broker que cancela el consumo; cancelación | Borde | `rabbitmq.consumer.spec.ts` › «si el broker cancela el consumo, cierra el canal para reconectar» | Pasó |
| CP-193 | CA-HU20-5 | Sin RABBITMQ_URL; arranque | Borde | `rabbitmq.consumer.spec.ts` › «sin RABBITMQ_URL no se instancia nada» | Pasó |
| CP-194 | CA-HU20-5 | Exchange muni.inbox no declarado; publicar | Negativo | `rabbitmq.publisher.spec.ts` › «un 404 de checkExchange dice que el Core no declaró la topología» | Pasó (corregido: ACT-24, #296, #295, #413) |

## HU-21 — Ver en M2 la fecha y la franja en que se agendó mi reclamo

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-195 | CA-HU21-1 | Ticket en ROUTED; POST /services con ticketId, fecha y franja | Positivo | `services.service.spec.ts` › «agendar con el ticket en %s manda STARTED con la programación»<br>`ticket-state.spec.ts` › «fecha y franja, en es-AR» | Pasó (corregido: ACT-19, #303, #309, #396) |
| CP-196 | CA-HU21-1 | Ticket en ROUTED; ciclo de vida de un servicio nacido de un reclamo | Positivo | `services-lifecycle.e2e-spec.ts` › «proyecta hacia M2 los cambios del servicio nacido de un reclamo» | Pasó |
| CP-197 | CA-HU21-2 | Ticket IN_PROGRESS; confirm-reschedule con fecha y franja nuevas | Positivo | `services.service.spec.ts` › «confirmar la fecha nueva con el ticket IN_PROGRESS manda PROGRESS»<br>`services.service.spec.ts` › «agendar con el ticket IN_PROGRESS manda PROGRESS» | Pasó (corregido: ACT-19, #303, #309, #396) |
| CP-198 | CA-HU21-3 | Ticket en RESOLVED; POST /services con ticketId | Negativo | `services.service.spec.ts` › «agendar con el ticket en %s no publica (M2 lo rechazaría)» | Pasó (corregido: ACT-19, #303, #309, #396) |
| CP-199 | CA-HU21-3 | Servicio sin ticket; POST /services sin ticketId | Negativo | `services.service.spec.ts` › «un servicio sin ticketId no publica nada hacia M2» | Pasó |
| CP-200 | CA-HU21-3 | Servicio con cuadrilla y notas; POST /services con ticketId | Negativo | `services.service.spec.ts` › «no manda la cuadrilla ni las notas» | Pasó |
| CP-201 | CA-HU21-4 | Bus no disponible; POST /services con ticketId | Positivo | `services.service.spec.ts` › «el estado se lee con el cliente de la transacción»<br>`outbox-dispatcher.service.spec.ts` › «una falla la deja PENDING para que la proxima barrida reintente» | Pasó |
| CP-320 | CA-HU21-5 | Token con actorId UUID; aviso de demora de un servicio de un reclamo | Positivo | `services-delay-assignment.spec.ts` › «updatedBy.id sale del actorId de M1, y es null si no vino» | Pasó (corregido: ACT-07, #314, #485) |
| CP-321 | CA-HU21-5 | Token sin actorId; cambio de estado de un expediente con ticket | Borde | `environmental-reports.service.spec.ts` › «sin actorId en el token, updatedBy.id viaja null y no se usa el sub» | Pasó (corregido: ACT-07, #314, #485) |
| CP-322 | CA-HU21-5 | JWT de M1 con actorId; validar el token | Positivo | `jwt.strategy.spec.ts` › «expone el actorId UUID del token sin tocar userId» | Pasó (corregido: ACT-07, #314, #485) |

## HU-22 — M2 reasigna o reclasifica un ticket sin que M6 lo confunda con una respuesta del vecino

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-202 | CA-HU22-1 | Inbox; ROUTED con details.routing | Positivo | `consumers.spec.ts` › «ROUTED lee el snapshot de details.routing y deduce el tipo del texto»<br>`consumers.spec.ts` › «ROUTED toma el escalamiento del snapshot» | Pasó |
| CP-203 | CA-HU22-2 | Expediente abierto; INFORMATION_PROVIDED con purpose | Borde | `consumers.spec.ts` › «INFORMATION_PROVIDED de una reclasificación (purpose) se ignora» | Pasó (corregido: ACT-20, #170, #307) |
| CP-204 | CA-HU22-3 | Expediente de M6; ticketUpdated con responsibleAreaId M3 | Negativo | `consumers.spec.ts` › «el filtro de responsibleAreaId tambien protege a los updateType que actuan sobre un expediente ya abierto»<br>`consumers.spec.ts` › «un evento de otra área que no es ROUTED no toca el expediente» | Pasó (corregido: ACT-20, #170, #307) |
| CP-205 | CA-HU22-4 | Servicios SCHEDULED del ticket; ticketUpdated CANCELLED | Positivo | `consumers.spec.ts` › «CANCELLED cancela los servicios programados del reclamo»<br>`consumers.spec.ts` › «CANCELLED solo toca los estados desde los que se puede cancelar» | Pasó (corregido: ACT-20, #170, #307) |
| CP-206 | CA-HU22-5 | Expediente con ESCALATION_CHANGED reciente; ESCALATION_CHANGED atrasado | Negativo | `inbox.e2e-spec.ts` › «el reintento atrasado de un ESCALATION_CHANGED no pisa al más nuevo»<br>`consumers.spec.ts` › «ordena por data.updatedAt y no por el occurredAt del sobre» | Pasó (corregido: ACT-20, #170, #307) |

## HU-23 — Publicar y consumir eventos con outbox/inbox idempotente

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-207 | CA-HU23-1 | Broker disponible; barrido del dispatcher | Positivo | `outbox-dispatcher.service.spec.ts` › «marca SENT con publishedAt cuando la publicacion sale bien»<br>`outbox.service.spec.ts` › «escribe con el cliente de transacción que recibe» | Pasó |
| CP-208 | CA-HU23-2 | Evento ticketUpdated ya procesado; mismo eventId | Positivo | `inbox.e2e-spec.ts` › «descarta el mismo eventId sin volver a aplicarlo»<br>`inbox.service.spec.ts` › «un messageId ya procesado NO vuelve a aplicar el efecto» | Pasó |
| CP-209 | CA-HU23-2 | Dos entregas simultáneas del mismo eventId; concurrencia | Borde | `inbox.service.spec.ts` › «dos entregas solapadas del mismo eventId corren el handler una sola vez»<br>`inbox.service.spec.ts` › «la idempotencia la decide el unique de la base, no una consulta previa» | Pasó |
| CP-210 | CA-HU23-3 | Inbox; ticketUpdated sin currentStatus | Negativo | `inbox.e2e-spec.ts` › «rechaza con 400 el payload inválido y no guarda la fila»<br>`inbox-validation.spec.ts` › «%s con %j da 400 y nombra %s» | Pasó |
| CP-211 | CA-HU23-3 | Evento rechazado antes; reenvío corregido con el mismo eventId | Borde | `inbox-validation.spec.ts` › «el rechazado no se guarda y el corregido con el mismo eventId se procesa» | Pasó |
| CP-212 | CA-HU23-4 | Broker que rechaza; 5 intentos | Negativo | `outbox-dispatcher.service.spec.ts` › «al agotar los intentos la marca FAILED y deja de tomarla» | Pasó |
| CP-213 | CA-HU23-4 | Fila FAILED; POST /events/outbox/:id/retry | Positivo | `outbox-retry.e2e-spec.ts` › «FAILED → retry → PENDING → el dispatcher lo publica → SENT, y queda auditado» | Pasó (corregido: ACT-11, #459) |
| CP-214 | CA-HU23-4 | Fila SENT o PENDING; retry | Negativo | `outbox-retry.e2e-spec.ts` › «reintentar un SENT o un PENDING da 409 y no audita» | Pasó (corregido: ACT-11, #459) |
| CP-215 | CA-HU23-4 | Handler que lanza una excepción; ticketUpdated | Negativo | `inbox.e2e-spec.ts` › «un eventId cuyo handler falló se reintenta, y si anda queda procesado y sin error» | Pasó |
| CP-216 | CA-HU23-4 | Lote de FAILED; POST /events/outbox/retry-failed sin confirm | Borde | `outbox-retry.e2e-spec.ts` › «retry-failed exige confirm: true y reencola con tope» | Pasó (corregido: ACT-11, #459) |
| CP-217 | CA-HU23-5 | Token con sub_type CIUDADANO; POST /events/inbox | Negativo | `inbox.e2e-spec.ts` › «un token de ciudadano recibe 403 en lectura, escritura e inbox; el de empleado pasa» | Pasó (corregido: ACT-03, #359) |
| CP-218 | CA-HU23-5 | Rol M6_OFICINA_OPERACIONES; POST /events/inbox | Negativo | `auth-roles.e2e-spec.ts` › «$grupo: $method $path» | Pasó |

## HU-24 — Probar M6 contra el Core real de M9 antes de la entrega

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-219 | CA-HU24-1 | Procedimiento de docs/testing.md; token de módulo; publicar un evento y recibir otro por q.ambiente | Positivo | Manual: Prueba de integración manual/ambiental (sin test automatizado: no hay broker real en los tests). | — |
| CP-220 | CA-HU24-2 | Backend desplegado en Render; prueba pasiva y suscripción pruebaConexionM6 | Positivo | Manual: Prueba manual en el ambiente desplegado; la evidencia está en el historial de integración (#442, cerrado el 05/11; la prueba con el Core real quedó en el historial de integración, sin test automatizado). | — |
| CP-221 | CA-HU24-3 | Core sin la suscripción de M6; arranque con RABBITMQ_URL | Negativo | `rabbitmq.consumer.spec.ts` › «sin la cola (falta suscribirse en el Core) loguea y falla el setup para que recovery reintente»<br>`rabbitmq.consumer.spec.ts` › «verifica la cola del Core en modo pasivo, sin declarar ni bindear nada» | Pasó |
| CP-222 | CA-HU24-4 | Broker que devuelve nack; publicar | Negativo | `rabbitmq.publisher.spec.ts` › «el nack del broker se propaga, para que el dispatcher deje la fila PENDING»<br>`rabbitmq.publisher.spec.ts` › «si la conexión falla, un intento posterior vuelve a probar» | Pasó |
| CP-223 | CA-HU24-4 | Broker caído más de 50 s; barrido x5 | Negativo | `outbox-dispatcher.service.spec.ts` › «al agotar los intentos la marca FAILED y deja de tomarla»<br>`outbox-retry.e2e-spec.ts` › «FAILED → retry → PENDING → el dispatcher lo publica → SENT, y queda auditado» | Pasó (corregido: ACT-11, #459) |

## HU-25 — Un ticket devuelto puede volver a derivarse a M6 y reactiva su expediente

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-224 | CA-HU25-1 | Expediente FORWARDED; ticketUpdated ROUTED con otro eventId | Positivo | `consumers.spec.ts` › «reactiva el expediente devuelto con el snapshot nuevo, sin crear otro»<br>`consumers.spec.ts` › «publica un STARTED, una sola vez, en la misma operación» | Pasó (corregido: ACT-19, #303, #309, #396) |
| CP-225 | CA-HU25-2 | Expediente en UNDER_REVIEW; ROUTED | Negativo | `consumers.spec.ts` › «un expediente que no está FORWARDED no publica nada» | Pasó (corregido: ACT-20, #170, #307) |
| CP-226 | CA-HU25-2 | Expediente FORWARDED con cambio más reciente; ROUTED atrasado | Negativo | `consumers.spec.ts` › «un ROUTED más viejo que el último cambio del expediente no lo reactiva» | Pasó (corregido: ACT-20, #170, #307) |
| CP-227 | CA-HU25-3 | Expediente FORWARDED; ROUTED de M3 | Positivo | `consumers.spec.ts` › «un ROUTED de otra área cierra el expediente que habíamos devuelto, sin leer su contenido» | Pasó (corregido: ACT-20, #170, #307) |
| CP-228 | CA-HU25-3 | Expediente FORWARDED; CANCELLED | Positivo | `consumers.spec.ts` › «si M2 cancela el ticket que habíamos devuelto, el expediente se cierra» | Pasó (corregido: ACT-20, #170, #307) |
| CP-229 | CA-HU25-4 | Expediente ya reactivado; ROUTED reentregado | Borde | `consumers.spec.ts` › «un reintento que ya no encuentra el expediente en FORWARDED no lo duplica» | Pasó |

## HU-26 — Fechas legibles y nombres en lugar de UUID en la demo

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-230 | CA-HU26-1 | Listado con fechas; Servicios y Control ambiental | Positivo | FE: `Frontend-M6-DAPS2/src/lib/argentina-date.test.ts`<br>FE: `services-period.spec.ts` | Corregido: ACT-F4, FE #321; sin ejecutar |
| CP-231 | CA-HU26-2 | Servicios con cuadrilla y vehículo; Listado de Servicios | Positivo | FE: `service-vehicle-labels.spec.ts` | Corregido: ACT-F4, FE #321; sin ejecutar |
| CP-232 | CA-HU26-3 | Fecha 2026-10-31T23:30:00-03:00; listar | Borde | FE: `Frontend-M6-DAPS2/src/lib/argentina-date.test.ts` | — |

## HU-27 — Consultar sin login el estado de mi denuncia, cuándo pasa el servicio y dónde están los puntos verdes

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-233 | CA-HU27-1 | Expediente con inspección y acta; GET /public/reports/<ticketId> | Positivo | `citizen-portal.service.spec.ts` › «devuelve exactamente los campos públicos, ni uno más»<br>`citizen-portal.service.spec.ts` › «colapsa el estado interno a una etapa que el vecino puede leer»<br>(+2 más) | Pasó |
| CP-234 | CA-HU27-2 | Servicios de varios estados; GET /public/services sin from/to | Positivo | `citizen-portal.service.spec.ts` › «sin fechas mira los próximos 30 días y saltea los cancelados»<br>`citizen-portal.service.spec.ts` › «sin from arranca hoy en Argentina aunque en UTC ya sea mañana»<br>(+1 más) | Pasó |
| CP-235 | CA-HU27-2 | Puntos verdes activos e inactivos; GET /public/green-points | Positivo | `citizen-portal.service.spec.ts` › «solo los activos, con los residuos que recibe cada uno» | Pasó |
| CP-236 | CA-HU27-3 | Expediente con publicId TK-0001; GET /public/reports/TK-0001 | Negativo | Manual: Regla documentada (docs/api/endpoints.md, #145); no se localizó un test específico. | — |
| CP-237 | CA-HU27-3 | Ticket sin expediente; GET /public/reports/<uuid sin expediente> | Negativo | `citizen-portal.service.spec.ts` › «un reclamo sin expediente da 404 sin decir si el ticket existe en M2» | Pasó |
| CP-238 | CA-HU27-4 | Una misma IP; 21 requests en 1 minuto | Negativo | Manual: No hay test de 429 de punta a punta localizado (SEC-W03: "falta ejecutar el test"). | — |
| CP-239 | CA-HU27-4 | BFF con clave; X-M6-BFF-Key correcta e incorrecta + X-Forwarded-For | Borde | `client-tracker.spec.ts` › «con la clave correcta usa la IP del vecino»<br>`client-tracker.spec.ts` › «con clave incorrecta (mismo largo) ignora el X-Forwarded-For» | Pasó (corregido: ACT-06, #470) |
| CP-240 | CA-HU27-5 | Sin Authorization; GET /containers | Negativo | `services-lifecycle.e2e-spec.ts` › «rechaza con 401 un pedido sin token»<br>`route-roles.spec.ts` › «solo los públicos esperados saltean la autorización» | Pasó |
| CP-241 | CA-HU27-5 | Sin Authorization; GET /health, /public/zones, /public/services, /public/green-points | Positivo | `auth-roles.e2e-spec.ts` › «endpoints públicos» | Pasó |

## HU-28 — Tablero de indicadores (cobertura, cumplimiento, incidencias y residuos)

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-242 | CA-HU28-1 | Recorrido con 4 zonas y 3 atendidas; GET /indicators/coverage | Positivo | `indicators.service.spec.ts` › «cuenta pares servicio/zona, no servicios»<br>`indicators.service.spec.ts` › «lo programado a futuro no cuenta como programado ni como pendiente» | Pasó |
| CP-243 | CA-HU28-2 | Datos en dos períodos; bucket=month&compare=previous | Positivo | `indicators.service.spec.ts` › «bucket=month corta en el último día de cada mes y recorta los bordes»<br>`indicators.service.spec.ts` › «compare=previous trae el período anterior de igual duración y la diferencia» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-244 | CA-HU28-2 | Un período sin datos; compare=previous | Borde | `indicators.service.spec.ts` › «sin base en alguno de los dos períodos, las diferencias son nulas» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-245 | CA-HU28-3 | Cualquier rol de M6; from=2026-11-01&to=2026-10-01 en los cuatro indicadores | Negativo | `indicators.service.spec.ts` › «los cuatro indicadores rechazan from posterior a to» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-246 | CA-HU28-3 | Cualquier rol de M6; bucket=day con 91 días | Borde | `indicators.service.spec.ts` › «90 puntos entran; 91 responden 400 con el motivo y las dos salidas»<br>`indicators.service.spec.ts` › «el tope se valida antes de consultar la base» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-247 | CA-HU28-4 | Sin reclamos abiertos; GET /indicators/incidents | Borde | `indicators.service.spec.ts` › «sin reclamos abiertos el porcentaje de vencidos es null, no 0 %» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-248 | CA-HU28-4 | Sin historial de contenedores; GET /indicators/incidents | Borde | `indicators.service.spec.ts` › «un contenedor sin filas hasta el fin del período no cuenta» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-323 | CA-HU28-5 | Reclamo abierto con más días hábiles que el plazo; GET /indicators/incidents | Positivo | `indicators.service.spec.ts` › «vencido: abierto cuyos días hábiles desde el alta hasta hoy superan el plazo» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-324 | CA-HU28-5 | Alta viernes y cierre viernes siguiente; GET /indicators/incidents | Borde | `indicators.service.spec.ts` › «de un viernes al viernes siguiente son 5 hábiles» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-325 | CA-HU28-5 | Variable de entorno del plazo; arranque con otro plazo | Borde | `indicators.service.spec.ts` › «el plazo sale de la configuración» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-326 | CA-HU28-5 | Un período sin reclamos resueltos; compare=previous | Borde | `indicators.service.spec.ts` › «sin resueltos en alguno de los dos períodos, la diferencia es null» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-327 | CA-HU28-6 | Contenedor desbordado dos veces; GET /indicators/incidents | Positivo | `indicators.service.spec.ts` › «cuenta un incidente de desborde por transición, no por contenedor» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-328 | CA-HU28-6 | Transiciones a DAMAGED; GET /indicators/incidents | Positivo | `indicators.service.spec.ts` › «cuenta los incidentes de daño por transición a DAMAGED» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-329 | CA-HU28-6 | Historial posterior al período; GET /indicators/incidents | Borde | `indicators.service.spec.ts` › «trackingSince es el instante de la fila más antigua, aunque sea posterior al período» | Pasó (corregido: ACT-13, #461, #473, #475) |
| CP-330 | CA-HU28-6 | Sin historial en el período anterior; compare=previous | Borde | `indicators.service.spec.ts` › «sin historial en el período anterior la diferencia es null, no una mejora inventada» | Pasó (corregido: ACT-13, #461, #473, #475) |

## HU-29 — Ver y hacer solo lo que mi rol permite, con el rol que viene de M1

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-249 | CA-HU29-1 | Sin Authorization; POST /services/:id/start y cada fila de la matriz | Negativo | `auth-roles.e2e-spec.ts` › «sin token da 401» | Pasó (corregido: ACT-01, #161, #235) |
| CP-250 | CA-HU29-2 | Rol M6_CAMPO_CUADRILLA; POST /services y POST violation-notice | Negativo | `auth-roles.e2e-spec.ts` › «$grupo: $method $path»<br>`auth-roles.e2e-spec.ts` › «el 403 por rol no revela qué rol faltaba»<br>(+1 más) | Pasó (corregido: ACT-01, #161, #235) |
| CP-251 | CA-HU29-3 | Rol M6_OFICINA_OPERACIONES; POST /services | Positivo | `auth-roles.e2e-spec.ts` › «$grupo: $method $path» | Pasó (corregido: ACT-01, #161, #235) |
| CP-252 | CA-HU29-3 | Rol M6_AUDITOR; GET /zones y POST /zones | Borde | `auth-roles.e2e-spec.ts` › «un GET permitido devuelve 200 y el auditor lee pero no escribe»<br>`route-roles.spec.ts` › «M6_AUDITOR no aparece en ninguna escritura» | Pasó |
| CP-253 | CA-HU29-4 | Usuario con roles y cuadrilla; GET /me | Positivo | `demo-personas.e2e-spec.ts` › «GET /me: el líder y el integrante ven su cuadrilla con su rol»<br>FE: `access-roles.spec.ts`<br>(+1 más) | Pasó (corregido: ACT-10, #458) |
| CP-254 | CA-HU29-5 | Token con sub_type CIUDADANO; GET /zones | Negativo | `jwt-auth.guard.spec.ts` › «rechaza a un ciudadano con 403 y mensaje claro»<br>`demo-personas.e2e-spec.ts` › «el ciudadano queda afuera, también de GET /me» | Pasó (corregido: ACT-03, #359) |
| CP-255 | CA-HU29-5 | Empleado sin roles de M6; GET /zones y POST /zones | Negativo | `auth-roles.e2e-spec.ts` › «%s: 403 en lectura y en escritura»<br>`auth-roles.e2e-spec.ts` › «GET /me sí responde a un empleado sin roles: es cómo el frontend se entera» | Pasó |
| CP-256 | CA-HU29-5 | Token vencido, con firma alterada, alg=none, otro emisor; GET /me | Negativo | `jwt.strategy.spec.ts` › «rechaza: %s» | Pasó (corregido: ACT-02, #354, #448) |
| CP-257 | CA-HU29-6 | Un solo M6_ADMIN sin admins de bootstrap; DELETE /role-assignments/:userId | Negativo | `role-assignments.e2e-spec.ts` › «no deja el sistema sin M6_ADMIN cuando no hay admins de bootstrap» | Pasó |
| CP-258 | CA-HU29-6 | Rol de Oficina y de Campo juntos; PUT con ambos | Negativo | `role-assignments.e2e-spec.ts` › «exclusividad Oficina/Campo: 400 y no cambia nada» | Pasó |
| CP-259 | CA-HU29-6 | Cualquiera; PUT con rol inexistente, repetido o id no numérico | Borde | `role-assignments.e2e-spec.ts` › «rol inexistente, repetido o id no numérico: 400» | Pasó |
| CP-260 | CA-HU29-7 | JWT con rol "ADMIN" o "constructor"; GET /me | Negativo | `m1-role.adapter.spec.ts` › «valor desconocido %p: ninguno y warn»<br>`jwt.strategy.spec.ts` › «sin filas en la tabla no hay roles efectivos (el rol de M1 solo no autoriza)» | Pasó |
| CP-261 | CA-HU29-7 | ADMINISTRATIVO con fila M6_ADMIN; GET /me | Borde | `auth-roles.e2e-spec.ts` › «ADMINISTRATIVO con fila M6_ADMIN NO es admin: la fila queda dormida»<br>`jwt.strategy.spec.ts` › «lee la tabla en cada request, sin caché» | Pasó |

## HU-30 — Activar la autenticación real de M1 con sesión sellada en el BFF

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-262 | CA-HU30-1 | M1 hosteado; secreto cargado en Render; login real + GET /me | Positivo | FE: `real-m1-login.spec.ts`<br>`jwt.strategy.spec.ts` › «acepta un access token de M1 y lo mapea a roles de M6» | Pasó |
| CP-263 | CA-HU30-2 | JWT_SECRET desactualizado; GET /me con token de M1 | Negativo | `jwt.strategy.spec.ts` › «rechaza: %s» | Pasó |
| CP-264 | CA-HU30-3 | Cookie de sesión vencida; abrir una pantalla protegida | Negativo | FE: `failure-journeys.spec.ts`<br>FE: `entry-and-roles.spec.ts` | Corregido: ACT-F7, FE #379, #381, #437; sin ejecutar |
| CP-265 | CA-HU30-4 | M1 caído; login | Negativo | FE: `real-m1-login.spec.ts` | — |

## HU-31 — Seguridad de la Clase 11 (SEC-W01 a W06, SEC-I01, SEC-I02, SEC-D01, SEC-D02)

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-266 | CA-HU31-1 | Cualquier endpoint protegido; cuatro tokens inválidos | Negativo | `jwt.strategy.spec.ts` › «rechaza: %s»<br>`services-lifecycle.e2e-spec.ts` › «rechaza con 401 un pedido sin token» | Pasó (corregido: ACT-02, #354, #448) |
| CP-267 | CA-HU31-2 | Rol M6_CAMPO_CUADRILLA; POST /services | Negativo | `auth-roles.e2e-spec.ts` › «$grupo: $method $path»<br>`roles.guard.spec.ts` › «rechaza con ROLE_REQUIRED si no tiene ninguno» | Pasó (corregido: ACT-01, #161, #235) |
| CP-268 | CA-HU31-3 | Portal público; las tres consultas | Negativo | `citizen-portal.service.spec.ts` › «devuelve exactamente los campos públicos, ni uno más»<br>`citizen-portal.service.spec.ts` › «un reclamo sin expediente da 404 sin decir si el ticket existe en M2» | Pasó |
| CP-269 | CA-HU31-4 | Servicio SCHEDULED; PATCH con status: "COMPLETED" | Negativo | `services-lifecycle.e2e-spec.ts` › «rechaza con 400 un body con propiedades que el DTO no declara» | Pasó |
| CP-270 | CA-HU31-5 | Excepción no contemplada; cualquier endpoint | Negativo | `http-exception.filter.spec.ts` › «deja en 500 cualquier error no contemplado»<br>`http-exception.filter.spec.ts` › «traduce P2025 a 404 en vez de dejarlo salir como 500» | Pasó |
| CP-271 | CA-HU31-6 | Usuario de Campo; tres archivos de prueba | Negativo | `attachments.service.spec.ts` › «rechaza un archivo cuyo contenido no coincide con lo declarado»<br>`attachments.service.spec.ts` › «rechaza un archivo que supera el tamaño máximo»<br>(+1 más) | Pasó |
| CP-272 | CA-HU31-7 | ticketUpdated procesado; mismo eventId | Positivo | `inbox.e2e-spec.ts` › «descarta el mismo eventId sin volver a aplicarlo» | Pasó |
| CP-273 | CA-HU31-8 | Inbox; payload inválido | Negativo | `inbox.e2e-spec.ts` › «rechaza con 400 el payload inválido y no guarda la fila»<br>`inbox-validation.spec.ts` › «el 400 no vuelca el contenido recibido» | Pasó |
| CP-274 | CA-HU31-9 | Logger capturado; request con Authorization | Negativo | `logging.interceptor.spec.ts` › «deja pasar la respuesta y loguea método, url y status»<br>`roles.guard.spec.ts` › «loguea la denegación con usuario, ruta y roles requeridos, sin token» | Pasó |
| CP-275 | CA-HU31-10 | GET /environmental-reports/:id; lectura de un expediente | Negativo | `environmental-flow.e2e-spec.ts` › «leer el acta con su resolución deja una fila READ por recurso, con el actor y sin contenido (#643)» | Pasó |
| CP-276 | CA-HU31-11 | Broker que rechaza; 5 intentos y luego POST /events/outbox/:id/retry con M6_ADMIN | Negativo | `outbox-dispatcher.service.spec.ts` › «al agotar los intentos la marca FAILED y deja de tomarla»<br>`outbox-retry.e2e-spec.ts` › «FAILED → retry → PENDING → el dispatcher lo publica → SENT, y queda auditado» | Pasó (corregido: ACT-11, #459) |
| CP-331 | CA-HU31-12 | Contenedor ACTIVE; transiciones con distintos actores | Positivo | `audit.e2e-spec.ts` › «cada transición del contenedor deja una fila con el actor del token»<br>`audit.service.spec.ts` › «record guarda estados y recorta la nota» | Pasó (corregido: ACT-12, #460) |
| CP-332 | CA-HU31-12 | Contenedor en estado inválido; transición rechazada | Negativo | `audit.e2e-spec.ts` › «una transición rechazada (409) no deja fila» | Pasó (corregido: ACT-12, #460) |
| CP-333 | CA-HU31-12 | Rol de Oficina; GET /audit | Negativo | `audit.e2e-spec.ts` › «solo M6_ADMIN y M6_AUDITOR consultan» | Pasó (corregido: ACT-12, #460) |
| CP-334 | CA-HU31-12 | Fila de auditoría existente; UPDATE o DELETE directo | Borde | `audit.e2e-spec.ts` › «la tabla es de solo agregado: ni UPDATE ni DELETE» | Pasó (corregido: ACT-12, #460) |

## HU-32 — Release hardening (Fase 8): observabilidad, promoción y rollback, WCAG 2.2 AA, privacidad y GA

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-277 | CA-HU32-1 | CI del frontend; Playwright con AxeBuilder | Positivo | FE: `accessibility.spec.ts` | — |
| CP-278 | CA-HU32-2 | Backend y base arriba; GET /health y /health/ready | Positivo | `health.controller.spec.ts` › «liveness devuelve ok sin tocar la base»<br>`health.controller.spec.ts` › «ready devuelve 200 con la base arriba» | Pasó |
| CP-279 | CA-HU32-3 | Base caída; GET /health/ready | Negativo | `health.controller.spec.ts` › «ready responde 503 sin filtrar el error de la base»<br>`health.controller.spec.ts` › «ready responde 503 si la base no contesta a tiempo» | Pasó |
| CP-280 | CA-HU32-4 | Respuesta del backend; GET /health | Negativo | `security-headers.middleware.spec.ts` › «pone las cabeceras base y sigue la cadena»<br>`security-headers.middleware.spec.ts` › «agrega HSTS solo en producción» | Pasó |

## HU-33 — e2e con datos deterministas y shards balanceados

| ID | Criterio | Escenario | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-281 | CA-HU33-1 | CI con service container postgres:16; npm run test:e2e | Positivo | Manual: Es la propia ejecución del job e2e del CI (.github/workflows/ci.yml, Postgres 16); no hay un test que la pruebe. Resultado de CI no consultado en esta pasada. | Medición manual |
| CP-282 | CA-HU33-2 | DATABASE_URL remota; npm run test:e2e | Negativo | `guard-database-url.e2e-spec.ts` › «tira con un host remoto»<br>`guard-database-url.e2e-spec.ts` › «tira si no hay DATABASE_URL»<br>(+1 más) | Pasó |
| CP-283 | CA-HU33-3 | Cuadrillas con ids usr-…; crews:migrate-user-ids dos veces | Borde | `crew-user-id-migration.e2e-spec.ts` › «es idempotente: la segunda corrida no cambia nada»<br>`crew-user-id-migration.e2e-spec.ts` › «el simulacro imprime el plan, reporta lo que no tiene mapeo y no toca nada» | Pasó |
| CP-284 | CA-HU33-4 | Base local limpia; npm test y npm run test:e2e x3 | Borde | Manual: No medido: Jest avisó de un worker que no sale (posibles handles abiertos). A medir con --detectOpenHandles. | Medición manual |

## Casos agregados: PR #577 a #585 (CP-335 a CP-348)

Casos automatizados de los PR #577 a #585. Se numeran a continuación de los anteriores y cada uno figura en la [matriz](03-matriz-trazabilidad.md), salvo CP-348, que no tiene criterio propio en [02-historias-y-criterios.md](02-historias-y-criterios.md). Los casos parametrizados cuentan como **un** caso; entre paréntesis va la cantidad de tests.

| ID | Criterio | Escenario y resultado esperado | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-335 | CA-HU04-4 | Servicio en cada estado de `ServiceStatus`; Cada par origen → destino fuera de `VALID_TRANSITIONS` → recibo 409 y no se escribe el servicio, ni el outbox, ni la auditoría (53 tests parametrizados) | Negativo | `services-transitions.spec.ts` (#582) | Pasó |
| CP-336 | CA-HU09-4 | Reparación o corte de calle en cada estado; Cada transición fuera de la tabla → recibo 409 y no cambia nada (46 tests parametrizados) | Negativo | `outbound-requests-transitions.spec.ts` (#582) | Pasó |
| CP-337 | CA-HU12-4 | Intervención de arbolado en cada estado; Cada transición fuera de la tabla → recibo 409 y no cambia nada (15 tests parametrizados) | Negativo | `tree-interventions-transitions.spec.ts` (#582) | Pasó |
| CP-338 | CA-HU23-2 | RabbitMQ real (contenedor); cola propia del test; El mismo `eventId` publicado dos veces y un testigo posterior → queda una sola fila en el inbox y el efecto se aplica una vez | Borde | `rabbitmq-real.e2e-spec.ts` › «un eventId repetido se procesa una sola vez» | Pasó |
| CP-339 | CA-HU23-3 | RabbitMQ real; JSON mal formado y un sobre sin campos obligatorios, seguidos de un mensaje válido → no dejan fila, el consumer no se traba y el válido siguiente se procesa | Negativo | `rabbitmq-real.e2e-spec.ts` › «un mensaje inválido no deja fila ni traba al consumer» | Pasó |
| CP-340 | CA-HU24-1 | RabbitMQ real; cola propia (no `q.ambiente`); Un sobre `weatherAlertIssued` válido → el consumer lo procesa y queda una fila procesada en el inbox. **Parcial:** no prueba la publicación del outbox ni el Core de M9 | Positivo | `rabbitmq-real.e2e-spec.ts` › «procesa un mensaje válido» | Pasó |
| CP-341 | CA-HU24-3 | RabbitMQ real con API de management; Cierre de las conexiones del broker menos la del publisher del test → el consumer reconecta y procesa el mensaje siguiente. **Parcial:** corta conexiones, no apaga el broker | Borde | `rabbitmq-real.e2e-spec.ts` › «se recupera cuando el broker le cierra la conexión» | Pasó |
| CP-342 | CA-HU31-3 | App con `THROTTLE_LIMIT=3`; 4 `GET /zones` seguidos con token M6_ADMIN → la cuarta da 429, `GET /neighborhoods` sigue respondiendo y `/health` no cuenta. **Parcial:** es el límite global, no el del portal | Negativo | `throttler.e2e-spec.ts` › «devuelve 429 al pasar el límite de un endpoint y los demás siguen respondiendo» | Pasó |
| CP-343 | CA-HU31-4 | Servicio creado y zona existente; `{status:'COMPLETED'}`, `{role:'M6_ADMIN'}`, `{id}`, mezcla válida + `status`; `PATCH /zones` con `code` y `createdAt` → recibo 400 y la fila queda idéntica; un rol en el body no escala privilegios (6 tests) | Negativo | `security-input.e2e-spec.ts` › «PATCH /services/:id rechaza %j con 400 y no persiste»<br>`security-input.e2e-spec.ts` › «PATCH /zones/:id rechaza campos fuera del DTO con 400» | Pasó |
| CP-344 | CA-HU31-6 | Almacenamiento de evidencia reemplazado por un doble; Archivo de más de 10 MB → recibo 413 (lo corta multer) | Negativo | `security-input.e2e-spec.ts` › «un archivo de más de 10 MB responde 413 (lo corta multer)» | Pasó |
| CP-345 | CA-HU32-4 | App levantada con `configureApp()`; Cualquier ruta salvo `/api/docs` → lleva `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'` | Positivo | `security-input.e2e-spec.ts` › «la API manda una CSP restrictiva» | Pasó |
| CP-346 | CA-HU32-4 | App levantada; `/api/docs` → el middleware **no** agrega CSP (Swagger UI la necesita); es el hallazgo DEF-19 | Borde | `security-input.e2e-spec.ts` › «el middleware no agrega CSP en /api/docs (aunque acá responda 404)» | Pasó |
| CP-347 | CA-HU31-9 | Pedido con `?access_token=` y header `Authorization`; `/x?token=SECRETO&page=2`, `access_token`, `api-key`, `client_secret`, `sig`, `session`, etc. → el log y el `path` del error redactan el valor sensible (`[REDACTED]`) y no tocan `page`, `status`, `search`, etc. | Negativo | `redact-url.spec.ts` › «redacta %s»<br>`logging.interceptor.spec.ts` › «el log no incluye el token de la query ni el header Authorization» | Pasó |
| CP-348 | sin criterio (seguridad, HU-31) | App con Postgres real; zona, expediente y servicio; Payloads de inyección SQL y de `<script>` en nombre, dirección, descripción y notas → no hay 500 ni efectos, el dato vuelve idéntico y la tabla sigue viva. La API **no** rechaza ni escapa estos textos (9 tests: 3 payloads × 3 recursos) | Negativo | `security-input.e2e-spec.ts` › describe `payload %s` | Pasó |

**Suites de nivel API, contrato y carga que no se cuentan como casos** (no están mapeadas a un criterio): la colección Newman `test/api/m6.postman_collection.json` (455 requests ejecutados, 435 definidos, 763 assertions, 0 fallidas), Schemathesis contra `docs/api/openapi.json` (4388 casos en el paso de esquema y errores de servidor, 4384 en `status_code_conformance`, **bloqueante** desde #593; solo `GET`) y la prueba de carga k6 (`test/perf/k6-criticos.js`; resultados en `test/perf/resultados/2026-11-09/`, **solo en local**, ver `05-informe-ejecucion.md`). Newman y Schemathesis corren en `.github/workflows/api-tests.yml`; k6 no corre en el CI. El éxito está probado en 61 de las 152 operaciones; los 91 endpoints restantes están en `test/api/PENDIENTES.md`.

## Casos agregados: PR #597 (CP-349 a CP-372)

Casos automatizados del PR [#597](https://github.com/hllous/Backend-M6-DAPS2/pull/597) (issues #590 a #594), del **Eje C** de la consigna (Problem Details, ETag con 412, `Idempotency-Key`) y en los hallazgos H-1 y H-2 de Schemathesis; **no son criterios de ninguna HU**, así que ningún caso apunta a un criterio de [02-historias-y-criterios.md](02-historias-y-criterios.md) y figuran en la tabla «Defectos y pruebas sin criterio propio» de la [matriz](03-matriz-trazabilidad.md). En el resumen se cuentan aparte, como «Transversales sin HU». Cada caso agrupa los tests que lo respaldan.

| ID | Criterio | Escenario y resultado esperado | Tipo | Test | Estado |
|---|---|---|---|---|---|
| CP-349 | sin criterio (Eje C, transversal) | Backend levantado con `configureApp()`; POST /zones con campo de más; GET sin token; escritura con rol AUDITOR; GET de un id inexistente; alta con código repetido → responde `application/problem+json` con `type`, `title`, `status`, `detail` e `instance` y conserva los campos históricos (`statusCode`, `message`, `error`, `code`, `timestamp`, `path`); el 403 lleva `code: ROLE_REQUIRED` | Negativo | `problem-details.e2e-spec.ts` › «400: body inválido», «401: sin token», «404: recurso inexistente», «409: código duplicado» y «403: rol insuficiente (AUDITOR escribe) con code ROLE_REQUIRED»<br>`http-exception.filter.spec.ts` › «responde application/problem+json con los campos RFC y los históricos» | Pasó |
| CP-350 | sin criterio (Eje C, transversal) | App con `THROTTLE_LIMIT` bajo; Pedidos seguidos hasta pasar el límite → el 429 sale como `application/problem+json` con el cuerpo RFC y los campos históricos | Negativo | `problem-details.e2e-spec.ts` › «responde problem+json con el cuerpo RFC y los campos históricos» (describe «429 en Problem Details»)<br>`http-exception.filter.spec.ts` › «429 (ThrottlerException) sale como problem+json» | Pasó |
| CP-351 | sin criterio (Eje C, transversal) | Error previo al router; Cuerpo JSON mal formado; cuerpo más grande que el límite del body-parser → responde 400 (JSON mal formado) o 413 (cuerpo grande) en `problem+json`, no un 500 genérico | Negativo | `problem-details.e2e-spec.ts` › «400: JSON mal formado» y «413: cuerpo más grande que el límite del body-parser»<br>`http-exception.filter.spec.ts` › «un error de body-parser (413) conserva su status en vez de caer en 500» | Pasó |
| CP-352 | sin criterio (Eje C, transversal) | Pedido con `?access_token=` en la query; GET con token en la query → ambos salen con el valor sensible redactado | Negativo | `problem-details.e2e-spec.ts` › «el token de la query sale redactado en instance y path»<br>`http-exception.filter.spec.ts` › «instance sale redactada igual que path» | Pasó |
| CP-353 | sin criterio (Eje C, transversal) | OpenAPI generado por `createOpenApiDocument()`; Todas las respuestas 4xx y 5xx → toda respuesta de error se declara como `application/problem+json` | Positivo | `openapi-contract.spec.ts` › «toda respuesta de error se declara como application/problem+json (ADR-011)» | Pasó |
| CP-354 | sin criterio (Eje C, transversal) | Contenedor existente; GET /containers/:id → devuelve un `ETag` débil derivado de `updatedAt` (`W/"<epoch ms>"`) | Positivo | `etag-if-match.e2e-spec.ts` › «el GET individual devuelve un ETag débil derivado de updatedAt»<br>`etag.spec.ts` › «etagOf es débil y distingue milisegundos» | Pasó |
| CP-355 | sin criterio (Eje C, transversal) | Contenedor con ETag vigente; Transición con `If-Match` igual al ETag actual → responde 2xx y devuelve el ETag nuevo | Positivo | `etag-if-match.e2e-spec.ts` › «con el ETag correcto aplica la transición y devuelve el ETag nuevo» | Pasó |
| CP-356 | sin criterio (Eje C, transversal) | Contenedor modificado después de leerlo; Transición con un `If-Match` viejo → recibo 412 y no se escribe nada, ni el outbox | Negativo | `etag-if-match.e2e-spec.ts` › «con un ETag viejo responde 412 y no escribe nada, ni en el outbox»<br>`etag.spec.ts` › «con uno que no coincide lanza 412» | Pasó |
| CP-357 | sin criterio (Eje C, transversal) | Contenedor existente; Transición sin `If-Match` o con `*` → se comporta como siempre (el header es opcional) | Borde | `etag-if-match.e2e-spec.ts` › «sin If-Match, o con "*", se comporta como siempre»<br>`etag.spec.ts` › «sin header o con "*" no condiciona el UPDATE» | Pasó |
| CP-358 | sin criterio (Eje C, transversal) | Contenedor en un estado que no admite la transición; `If-Match` vigente y transición inválida; `If-Match` viejo y transición inválida → con el ETag vigente da 409; con uno viejo da 412 (el 412 se evalúa primero) | Negativo | `etag-if-match.e2e-spec.ts` › «un If-Match vigente sobre una transición inválida sigue dando 409» | Pasó |
| CP-359 | sin criterio (Eje C, transversal) | Dos clientes con el mismo ETag; Dos pedidos simultáneos con el mismo `If-Match` → uno gana (2xx) y el otro recibe 412: `[200, 412]`; la condición va en el `where` del UPDATE, dentro de la misma transacción | Borde | `etag-if-match.e2e-spec.ts` › «dos pedidos con el mismo ETag: uno gana y el otro recibe 412» y «contenedor: dos PATCH con el mismo ETag, uno gana y el otro recibe 412» | Pasó |
| CP-360 | sin criterio (Eje C, transversal) | Servicio, expediente ambiental e intervención de arbolado; Transición con `If-Match` viejo → recibo 412 y el estado no cambia | Negativo | `etag-if-match.e2e-spec.ts` › «servicios: ETag en el GET y 412 con uno viejo», «expedientes ambientales: 412 con un ETag viejo» y «intervenciones de arbolado: 412 con un ETag viejo y no cambia el estado»<br>`services-if-match.spec.ts` › «con un ETag viejo da 412 y no escribe nada» | Pasó |
| CP-361 | sin criterio (Eje C, transversal) | Contenedor y servicio; `PATCH /containers/:id` y `PATCH /services/:id` con `If-Match` → 200 y ETag nuevo con el vigente; 412 sin cambios con uno viejo; como hoy sin header; en concurrencia `[200, 412]` | Negativo | `etag-if-match.e2e-spec.ts` › «contenedor: ETag vigente -> 200 y ETag nuevo; viejo -> 412 sin cambios; sin header como hoy» y «servicio: ETag viejo -> 412 sin cambios; vigente -> 200; concurrencia -> [200, 412]» | Pasó |
| CP-362 | sin criterio (Eje C, transversal) | Endpoint de creación con `@Idempotent()`; Dos POST con la misma `Idempotency-Key` y el mismo cuerpo → se crea un único recurso y la segunda respuesta es la misma, con `Idempotency-Replayed` | Positivo | `idempotency.e2e-spec.ts` › «misma clave y mismo cuerpo: un solo recurso y la misma respuesta»<br>`idempotency.interceptor.spec.ts` › «mismo cuerpo, completada: replay sin ejecutar» | Pasó |
| CP-363 | sin criterio (Eje C, transversal) | Clave ya usada; La misma `Idempotency-Key` con otro cuerpo → recibo 422 y no se crea nada | Negativo | `idempotency.e2e-spec.ts` › «misma clave con otro cuerpo: 422 y no se crea nada»<br>`idempotency.interceptor.spec.ts` › «otro cuerpo da 422» | Pasó |
| CP-364 | sin criterio (Eje C, transversal) | Endpoint de creación; Dos pedidos concurrentes con la misma clave → se crea un solo recurso | Borde | `idempotency.e2e-spec.ts` › «dos requests concurrentes con la misma clave crean un solo recurso» | Pasó |
| CP-365 | sin criterio (Eje C, transversal) | Endpoint de creación con código único; Dos POST iguales sin `Idempotency-Key` → se comporta como siempre: el duplicado da 409 | Borde | `idempotency.e2e-spec.ts` › «sin clave se comporta como siempre: el duplicado da 409»<br>`idempotency.interceptor.spec.ts` › «sin header no toca la base» | Pasó |
| CP-366 | sin criterio (Eje C, transversal) | Endpoint de creación; `Idempotency-Key` de más de 255 caracteres (también vacía, con caracteres no ASCII o repetida como arreglo) → recibo 400 y no se crea nada | Negativo | `idempotency.e2e-spec.ts` › «clave de más de 255 caracteres da 400 y no crea nada»<br>`idempotency.interceptor.spec.ts` › `it.each` de claves inválidas | Pasó |
| CP-367 | sin criterio (Eje C, transversal) | Primer pedido que falla; POST con clave que da error de validación o de negocio y reintento corregido → el error no se guarda y la clave sirve para reintentar | Borde | `idempotency.e2e-spec.ts` › «una respuesta de error no se guarda: la clave sirve para reintentar»<br>`idempotency.interceptor.spec.ts` › «el fallo del handler libera la clave y propaga el error» | Pasó |
| CP-368 | sin criterio (Eje C, transversal) | Servicio creado con clave; Replay de la misma clave → no se vuelve a escribir en el outbox | Borde | `idempotency.e2e-spec.ts` › «el replay no vuelve a escribir en el outbox» | Pasó |
| CP-369 | sin criterio (Eje C, transversal) | Registro `IN_PROGRESS` de la clave; Un registro en curso reciente y otro de más de 60 s → el reciente da 409 y el viejo se retoma y ejecuta. **Limitación conocida (ADR-013):** guardar la respuesta no es atómico con la transacción de dominio | Borde | `idempotency.e2e-spec.ts` › «un registro en curso y viejo se puede retomar; uno reciente da 409»<br>`idempotency.interceptor.spec.ts` › «en curso y reciente da 409» y «en curso y viejo se retoma y ejecuta» | Pasó |
| CP-370 | sin criterio (Eje C, transversal) | OpenAPI generado; Todos los `GET` con parámetros de ruta o `@Query()` → declaran el 400 (`@ApiBadRequestParams()`); es el cierre de DEF-20 y lo exige el paso `status_code_conformance` de Schemathesis | Negativo | `openapi-contract.spec.ts` › «todo GET con parámetros declara el 400 (DEF-20)» | Pasó |
| CP-371 | sin criterio (Eje C, transversal) | App con `NEIGHBORHOODS_CATALOG_FILE` apuntando al snapshot local; GET /neighborhoods con token M6_ADMIN → responde 200 con los barrios (más de 40, con `id` y `codigo`) | Positivo | `neighborhoods-catalog.e2e-spec.ts` › «con el catálogo local responde 200 con los barrios» | Pasó |
| CP-372 | sin criterio (Eje C, transversal) | App sin `NEIGHBORHOODS_CATALOG_FILE`; GET /neighborhoods → responde 503, no una lista vacía; la variable se rechaza en producción | Negativo | `neighborhoods-catalog.e2e-spec.ts` › «sin catálogo responde 503»<br>`configuration.spec.ts` › «se acepta fuera de producción y se rechaza en producción» | Pasó |

## Resumen

- Casos: **372**: 348 para 175 criterios de 33 HU (334 iniciales más CP-335 a CP-348; CP-348 no tiene criterio propio y se cuenta en HU-31) más 24 casos transversales sin HU (CP-349 a CP-372). Los casos parametrizados cuentan como uno: los 114 tests de transiciones de #582 son 3 casos.
- Positivos: 121 (32,5 %). Negativos: 168 (45,2 %). Borde: 83 (22,3 %).
- **Negativos + borde: 251 de 372 = 67,5 %** (nuestra meta: 40 % o más). Cumple la meta.
- Casos marcados **Corregido**: 116.
- Automatizados con test del backend: 353 (94,9 %). Solo con test del frontend sin verificar: 9. Sin test automatizado: 10.
- Los 19 casos sin test del backend (9 de frontend y 10 manuales) no se ejecutaron.

| HU | Casos | Positivos | Negativos | Borde | Neg. + borde |
|---|---|---|---|---|---|
| HU-01 | 4 | 3 | 1 | 0 | 25,0 % |
| HU-02 | 16 | 6 | 7 | 3 | 62,5 % |
| HU-03 | 16 | 5 | 7 | 4 | 68,8 % |
| HU-04 | 7 | 2 | 3 | 2 | 71,4 % |
| HU-05 | 18 | 5 | 8 | 5 | 72,2 % |
| HU-06 | 11 | 5 | 3 | 3 | 54,5 % |
| HU-07 | 17 | 4 | 10 | 3 | 76,5 % |
| HU-08 | 14 | 3 | 10 | 1 | 78,6 % |
| HU-09 | 19 | 7 | 7 | 5 | 63,2 % |
| HU-10 | 3 | 2 | 1 | 0 | 33,3 % |
| HU-11 | 17 | 7 | 8 | 2 | 58,8 % |
| HU-12 | 13 | 4 | 8 | 1 | 69,2 % |
| HU-13 | 7 | 4 | 2 | 1 | 42,9 % |
| HU-14 | 7 | 2 | 3 | 2 | 71,4 % |
| HU-15 | 10 | 3 | 5 | 2 | 70,0 % |
| HU-16 | 21 | 7 | 6 | 8 | 66,7 % |
| HU-17 | 7 | 4 | 2 | 1 | 42,9 % |
| HU-18 | 9 | 2 | 5 | 2 | 77,8 % |
| HU-19 | 6 | 2 | 2 | 2 | 66,7 % |
| HU-20 | 10 | 2 | 5 | 3 | 80,0 % |
| HU-21 | 10 | 6 | 3 | 1 | 40,0 % |
| HU-22 | 5 | 2 | 2 | 1 | 60,0 % |
| HU-23 | 14 | 3 | 7 | 4 | 78,6 % |
| HU-24 | 7 | 3 | 3 | 1 | 57,1 % |
| HU-25 | 6 | 3 | 2 | 1 | 50,0 % |
| HU-26 | 3 | 2 | 0 | 1 | 33,3 % |
| HU-27 | 9 | 4 | 4 | 1 | 55,6 % |
| HU-28 | 15 | 5 | 1 | 9 | 66,7 % |
| HU-29 | 13 | 2 | 8 | 3 | 84,6 % |
| HU-30 | 4 | 1 | 3 | 0 | 75,0 % |
| HU-31 | 20 | 2 | 17 | 1 | 90,0 % |
| HU-32 | 6 | 3 | 2 | 1 | 50,0 % |
| HU-33 | 4 | 1 | 1 | 2 | 75,0 % |
| Transversales sin HU (Eje C, CP-349 a CP-372) | 24 | 5 | 12 | 7 | 79,2 % |
| **Total** | **372** | **121** | **168** | **83** | **67,5 %** |

Los casos de rol y de pertenencia ("403 NOT_ASSIGNED", "403 ROLE_REQUIRED") se cuentan como negativos. Los de degradación ante la caída de un sistema externo se cuentan como borde cuando el sistema sigue operando y como negativos cuando se rechaza la operación.
