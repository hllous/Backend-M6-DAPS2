# 02 — Historias de usuario y criterios de aceptación

Entregable 2 de QA del módulo 6 (Ambiente e Higiene, Grupo 04). Prueba del TP: martes 10/11/2026. Versión del 03/11/2026.

## Cómo se armó

- **Fuente:** el tablero de Trello "M6 - Product Backlog & Story Map" (leído el 03/11/2026) para las historias, la prioridad y el release; el código y los tests de este repo para el comportamiento real (estados, códigos 400/403/404/409, enums); `docs/api/endpoints.md` y `docs/eventos/`. Los issues de GitHub siguen siendo la fuente del detalle técnico.
- **Numeración:** HU-01 a HU-36 siguen el orden del tablero, de izquierda a derecha y de arriba abajo. Los IDs no se reutilizan. HU-34 a HU-36 son las tres "Won't" y no tienen criterios.
- **Formato:** Como / Quiero / Para, y criterios Dado / Cuando / Entonces numerados `CA-HUnn-k`. Cada criterio es un hecho verificable (un estado, un código HTTP, un valor); no hay términos como "rápido" o "correctamente".
- **Tipos de criterio:** **Feliz** (camino principal), **Alternativo** (otra variante válida o un borde), **Error** (entrada o estado inválido) y **Falla externa** (cae un sistema del que depende: M1, M2, M3, M4, M7, M9, el bus, el Core, el almacenamiento). Toda HU tiene al menos 3 criterios y toda HU con integración tiene al menos un criterio de falla externa.
- **Criterios propuestos:** los criterios que **vienen de Trello** (tarjetas de las HU de R2 y las tarjetas SEC de la Clase 11 del tablero Histórico) están sin marca; algunos se adaptaron al comportamiento real del código y la diferencia se lista en "Discrepancias". **Todos los demás, que redactó QA** (incluidos los de las HU del MVP, que en Trello no traían criterios), llevan la marca **(propuesto, a validar por el PO)**.
- **Actualizaciones posteriores:** las tarjetas de Trello se volcaron el 20/10 y la matriz SEC es del 13/10. Cada HU afectada tiene una subsección "Actualizaciones posteriores a la HU" con lo que cambió hasta el 03/11/2026, el issue, el PR, el commit y el criterio que quedó corregido o agregado. Se relevaron los issues cerrados desde el 13/10 en este repo y en `hllous/Frontend-M6-DAPS2`, los PR mergeados y los runs de CI de `develop` (índice más abajo). Los criterios agregados por una corrección llevan **(propuesto, a validar por el PO)** y se numeran a continuación del último criterio de la HU.
- **MoSCoW:** se toma el de Trello cuando figura (R2 MUST, R3 COULD). Las HU del MVP entregado se consideran **Must**. Para las HU de R2 ya entregadas sin prioridad en Trello se propuso una; la columna "Fuente" lo indica.
- **Regla de cierre de la cátedra:** ningún criterio de una HU Must puede fallar al cierre. Las HU Must que hoy tienen trabajo abierto son HU-20, HU-24 y HU-30; además HU-31 tiene un criterio (SEC-D02) que no se cumple. Ver "Riesgos" al final.

## Resumen

| HU | Título | Actor | MoSCoW | Fuente MoSCoW | Release | Criterios |
|---|---|---|---|---|---|---|
| [HU-01](#hu-01--catálogos-con-tablas-filtrables-componentes-uniformes-y-estados-de-carga) | Catálogos con tablas filtrables, componentes uniformes y estados de carga | Oficina | Should | propuesto (la tarjeta no la fija) | R2 | 4 |
| [HU-02](#hu-02--alta-de-zonas-operativas-y-recorridos-con-paradas) | Alta de zonas operativas y recorridos con paradas | Oficina | Must | MVP entregado | MVP | 7 |
| [HU-03](#hu-03--administración-de-tipos-de-servicio-frecuencias-cuadrillas-vehículos-y-sitios-de-disposición) | Administración de tipos de servicio, frecuencias, cuadrillas, vehículos y sitios de disposición | Oficina | Must | MVP entregado | MVP | 6 |
| [HU-04](#hu-04--suspender-un-servicio-guardando-motivo-y-nota-por-separado) | Suspender un servicio guardando motivo y nota por separado | Oficina | Should | propuesto (la tarjeta no la fija) | R2 | 6 |
| [HU-05](#hu-05--programar-un-servicio-sobre-un-recorrido-o-un-punto) | Programar un servicio sobre un recorrido o un punto | Oficina | Must | MVP entregado | MVP | 6 |
| [HU-06](#hu-06--reprogramar-o-cancelar-un-servicio-con-motivo) | Reprogramar o cancelar un servicio con motivo | Oficina | Must | MVP entregado | MVP | 5 |
| [HU-07](#hu-07--ejecución-en-campo-iniciar-resultado-por-zona-y-cierre) | Ejecución en campo: iniciar, resultado por zona y cierre | líder de cuadrilla | Must | MVP entregado | MVP | 7 |
| [HU-08](#hu-08--adjuntar-evidencia-fotográfica-con-reintento-seguro) | Adjuntar evidencia fotográfica con reintento seguro | miembro de cuadrilla | Must | MVP entregado | MVP | 6 |
| [HU-09](#hu-09--derivar-una-reparación-de-infraestructura-o-pedir-un-corte-de-calle) | Derivar una reparación de infraestructura o pedir un corte de calle | cuadrilla | Must | MVP entregado | MVP | 6 |
| [HU-10](#hu-10--filtrar-las-intervenciones-de-arbolado-por-prioridad) | Filtrar las intervenciones de arbolado por prioridad | Oficina | Should | propuesto (la tarjeta no la fija) | R2 | 3 |
| [HU-11](#hu-11--gestión-de-contenedores-desborde-daño-vaciado-reparación-y-reubicación) | Gestión de contenedores (desborde, daño, vaciado, reparación y reubicación) | Oficina | Must | MVP entregado | MVP | 7 |
| [HU-12](#hu-12--censo-de-arbolado-relevamientos-de-riesgo-y-podas-o-extracciones) | Censo de arbolado, relevamientos de riesgo y podas o extracciones | Oficina | Must | MVP entregado | MVP | 7 |
| [HU-13](#hu-13--administrar-espacios-verdes-y-puntos-verdes) | Administrar espacios verdes y puntos verdes | Oficina | Must | MVP entregado | MVP | 4 |
| [HU-14](#hu-14--filtrar-la-cola-de-denuncias-por-rango-de-fechas) | Filtrar la cola de denuncias por rango de fechas | Oficina | Should | propuesto (la tarjeta no la fija) | R2 | 4 |
| [HU-15](#hu-15--recibir-denuncias-ambientales-y-asignarlas-a-una-cuadrilla-para-inspeccionarlas) | Recibir denuncias ambientales y asignarlas a una cuadrilla para inspeccionarlas | Oficina | Must | MVP entregado | MVP | 5 |
| [HU-16](#hu-16--registrar-la-inspección-y-emitir-el-acta-de-constatación) | Registrar la inspección y emitir el acta de constatación | inspector | Must | MVP entregado | MVP | 8 |
| [HU-17](#hu-17--registrar-la-sanción-que-devuelve-m4-y-cerrar-el-expediente) | Registrar la sanción que devuelve M4 y cerrar el expediente | Oficina | Must | MVP entregado | MVP | 4 |
| [HU-18](#hu-18--pedirle-información-adicional-al-vecino-informationrequired) | Pedirle información adicional al vecino (INFORMATION_REQUIRED) | Oficina | Could | Trello (R3 COULD) | R3 | 4 |
| [HU-19](#hu-19--m9-conoce-los-eventos-que-publica-y-consume-m6) | M9 conoce los eventos que publica y consume M6 | M9 (Core) | Must | propuesto (necesario para recibir por q.ambiente) | R2 | 3 |
| [HU-20](#hu-20--adaptar-m6-al-contrato-de-integración-definitivo-de-m9) | Adaptar M6 al contrato de integración definitivo de M9 | equipo de M6 | Must | Trello (R2 MUST) | R2 | 5 |
| [HU-21](#hu-21--ver-en-m2-la-fecha-y-la-franja-en-que-se-agendó-mi-reclamo) | Ver en M2 la fecha y la franja en que se agendó mi reclamo | vecino | Should | propuesto (la tarjeta no la fija) | R2 | 5 |
| [HU-22](#hu-22--m2-reasigna-o-reclasifica-un-ticket-sin-que-m6-lo-confunda-con-una-respuesta-del-vecino) | M2 reasigna o reclasifica un ticket sin que M6 lo confunda con una respuesta del vecino | M2 | Must | propuesto (contrato v1.77 de M2) | R2 | 5 |
| [HU-23](#hu-23--publicar-y-consumir-eventos-con-outboxinbox-idempotente) | Publicar y consumir eventos con outbox/inbox idempotente | equipo de M6 | Must | MVP entregado | MVP | 5 |
| [HU-24](#hu-24--probar-m6-contra-el-core-real-de-m9-antes-de-la-entrega) | Probar M6 contra el Core real de M9 antes de la entrega | equipo de M6 | Must | Trello (R2 MUST) | R2 | 4 |
| [HU-25](#hu-25--un-ticket-devuelto-puede-volver-a-derivarse-a-m6-y-reactiva-su-expediente) | Un ticket devuelto puede volver a derivarse a M6 y reactiva su expediente | M2 | Should | propuesto (la tarjeta no la fija) | R2 | 4 |
| [HU-26](#hu-26--fechas-legibles-y-nombres-en-lugar-de-uuid-en-la-demo) | Fechas legibles y nombres en lugar de UUID en la demo | Oficina | Could | propuesto (la tarjeta no la fija) | R2 | 3 |
| [HU-27](#hu-27--consultar-sin-login-el-estado-de-mi-denuncia-cuándo-pasa-el-servicio-y-dónde-están-los-puntos-verdes) | Consultar sin login el estado de mi denuncia, cuándo pasa el servicio y dónde están los puntos verdes | vecino | Must | MVP entregado | MVP | 5 |
| [HU-28](#hu-28--tablero-de-indicadores-cobertura-cumplimiento-incidencias-y-residuos) | Tablero de indicadores (cobertura, cumplimiento, incidencias y residuos) | Oficina | Must | MVP entregado | MVP | 6 |
| [HU-29](#hu-29--ver-y-hacer-solo-lo-que-mi-rol-permite-con-el-rol-que-viene-de-m1) | Ver y hacer solo lo que mi rol permite, con el rol que viene de M1 | Oficina y Campo | Must | propuesto (la tarjeta no la fija) | R2 | 7 |
| [HU-30](#hu-30--activar-la-autenticación-real-de-m1-con-sesión-sellada-en-el-bff) | Activar la autenticación real de M1 con sesión sellada en el BFF | Oficina y Campo | Must | Trello (R2 MUST) | R2 | 4 |
| [HU-31](#hu-31--seguridad-de-la-clase-11-sec-w01-a-w06-sec-i01-sec-i02-sec-d01-sec-d02) | Seguridad de la Clase 11 (SEC-W01 a W06, SEC-I01, SEC-I02, SEC-D01, SEC-D02) | equipo de M6 | Must | MVP entregado | MVP | 12 |
| [HU-32](#hu-32--release-hardening-fase-8-observabilidad-promoción-y-rollback-wcag-22-aa-privacidad-y-ga) | Release hardening (Fase 8): observabilidad, promoción y rollback, WCAG 2.2 AA, privacidad y GA | equipo de M6 | Could | Trello (R3 COULD) | R3 | 4 |
| [HU-33](#hu-33--e2e-con-datos-deterministas-y-shards-balanceados) | e2e con datos deterministas y shards balanceados | equipo de M6 | Could | Trello (R3 COULD) | R3 | 4 |
| HU-34 a HU-36 | Fuera de alcance (Won't) | — | Won't | Trello | — | 0 |

Total: 33 HU con criterios, 175 criterios (144 propuestos por QA) y 3 HU fuera de alcance.

## HU-01 — Catálogos con tablas filtrables, componentes uniformes y estados de carga

- **Como** Oficina **quiero** que todos los catálogos y listados usen la misma tabla (orden, filtros, columnas redimensionables) y muestren un esqueleto mientras cargan **para** trabajar igual en todas las pantallas y no confundir "cargando" con "vacío".
- **Prioridad:** Should — fuente: propuesto (la tarjeta no la fija). **Release:** R2.
- **Estado:** Entregado (FE #528, #520, #525).

- **CA-HU01-1** (Feliz): **DADO** un catálogo con más de una página (pageSize 20 por defecto), **CUANDO** lo abro, **ENTONCES** puedo ordenar y filtrar con el mismo componente de tabla que Servicios. — *Agregado por ACT-F1*
- **CA-HU01-2** (Feliz): **DADO** que el backend tarda en responder, **CUANDO** la pantalla carga, **ENTONCES** veo un esqueleto con la forma final, no un spinner suelto ni la tabla vacía. — *Agregado por ACT-F1*
- **CA-HU01-3** (Alternativo): **DADO** cualquier pantalla del frontend, **CUANDO** corre el guard de shadcn en el CI del frontend, **ENTONCES** no quedan componentes de UI escritos a mano fuera del registro. — *Agregado por ACT-F1*
- **CA-HU01-4** (Error; propuesto, a validar por el PO): **DADO** que el backend responde con error 5xx o excede el timeout de 15 s del BFF, **CUANDO** abro un catálogo, **ENTONCES** la pantalla muestra un mensaje de error con aria-live o role="alert" y no una tabla vacía.

## HU-02 — Alta de zonas operativas y recorridos con paradas

- **Como** Oficina **quiero** dar de alta zonas operativas y recorridos con paradas **para** programar servicios sobre ellos.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado (BE #283 ajuste).

- **CA-HU02-1** (Feliz; propuesto, a validar por el PO): **DADO** un usuario con rol M6_ADMIN, **CUANDO** crea una zona con code y name únicos (POST /zones), **ENTONCES** recibe 201 y la zona nace con active = true.
- **CA-HU02-2** (Feliz; propuesto, a validar por el PO): **DADO** un recorrido existente y tres zonas activas, **CUANDO** reemplazo sus paradas con PUT /routes/:id/stops [zonaA, zonaB, zonaC], **ENTONCES** las paradas quedan con sequence 1, 2 y 3 en el orden del array y Route.updatedAt se actualiza en la misma transacción (BE #283). — *Corregido por ACT-16*
- **CA-HU02-3** (Alternativo; propuesto, a validar por el PO): **DADO** una zona o un recorrido existente, **CUANDO** ejecuto DELETE sobre él, **ENTONCES** recibo 204, el registro sigue existiendo y queda con active = false (baja lógica).
- **CA-HU02-4** (Error; propuesto, a validar por el PO): **DADO** una zona o un recorrido con el mismo code, **CUANDO** intento crear otro con ese code, **ENTONCES** recibo 409, no un error de Prisma.
- **CA-HU02-5** (Error; propuesto, a validar por el PO): **DADO** un recorrido, **CUANDO** envío paradas con una zona repetida o con una zona que no existe, **ENTONCES** recibo 400 (zona repetida) o 404 nombrando las zonas inexistentes, y las paradas actuales no cambian.
- **CA-HU02-6** (Falla externa; propuesto, a validar por el PO): **DADO** que el catálogo de barrios de M9 todavía no se pudo leer, **CUANDO** asigno barrios a una zona (POST /zones/:id/neighborhoods) o consulto GET /neighborhoods, **ENTONCES** la asignación se acepta con un warning (sin catálogo) y GET /neighborhoods responde 503, no una lista vacía; con catálogo cargado, un id que M9 no tiene da 400 y no escribe nada. — *Corregido por ACT-27*
- **CA-HU02-7** (Alternativo; propuesto, a validar por el PO): **DADO** una zona y una comuna existentes, **CUANDO** asigno communeId a la zona (POST o PATCH /zones) o listo las zonas, **ENTONCES** la zona queda ligada a la comuna (400 si la comuna no existe, null la desasigna) y el listado sale ordenado por número de comuna (1 a 15), luego por nombre. — *Agregado por ACT-27*

## HU-03 — Administración de tipos de servicio, frecuencias, cuadrillas, vehículos y sitios de disposición

- **Como** Oficina **quiero** administrar tipos de servicio, frecuencias, cuadrillas, vehículos y sitios de disposición **para** tener los recursos listos al programar.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado.

- **CA-HU03-1** (Feliz; propuesto, a validar por el PO): **DADO** un usuario con rol M6_ADMIN, **CUANDO** registra un vehículo con patente única (POST /vehicles), **ENTONCES** recibe 201 y el vehículo nace activo.
- **CA-HU03-2** (Feliz; propuesto, a validar por el PO): **DADO** un usuario con rol M6_ADMIN, **CUANDO** crea una cuadrilla con specialty y un líder con id numérico de M1 (POST /crews), **ENTONCES** recibe 201, la cuadrilla nace activa y el id del líder se guarda normalizado (sin ceros a la izquierda). — *Corregido por ACT-09*
- **CA-HU03-3** (Alternativo; propuesto, a validar por el PO): **DADO** un tipo de servicio, un sitio de disposición, un vehículo o una frecuencia, **CUANDO** ejecuto DELETE, **ENTONCES** recibo 204 y el registro no se borra: queda inactivo (en la frecuencia se cierra la vigencia con validTo = hoy argentino).
- **CA-HU03-4** (Error; propuesto, a validar por el PO): **DADO** un code o una patente ya existentes, o ids de integrante que no son numéricos de M1, **CUANDO** intento crear el recurso o la cuadrilla, **ENTONCES** recibo 409 por duplicado o 400 por id inválido, sin guardar nada.
- **CA-HU03-5** (Error; propuesto, a validar por el PO): **DADO** una frecuencia vigente para el mismo recorrido, tipo y turno que comparte algún día, **CUANDO** creo o modifico otra regla que se superpone, o la creo sobre un tipo de servicio de modo POINT, **ENTONCES** recibo 409 (superposición) o 400 (tipo que no es ROUTE) y no se escribe nada.
- **CA-HU03-6** (Alternativo; propuesto, a validar por el PO): **DADO** una cuadrilla y una zona activa, **CUANDO** reubico la cuadrilla (POST /crews/:id/zone-assignments) entre validFrom y validTo, **ENTONCES** queda guardada con el actor del token y fechas sin hora; sin validTo queda abierta; 409 si el período se pisa con otro y 400 si validTo es anterior a validFrom o la zona está de baja; el filtro zoneId usa la zona efectiva de hoy. — *Agregado por ACT-09*

## HU-04 — Suspender un servicio guardando motivo y nota por separado

- **Como** Oficina **quiero** que al suspender un servicio el motivo y la nota se guarden por separado **para** dejar trazabilidad de por qué se frenó.
- **Prioridad:** Should — fuente: propuesto (la tarjeta no la fija). **Release:** R2.
- **Estado:** Entregado (BE #282, FE #617).

- **CA-HU04-1** (Feliz): **DADO** un servicio en curso (IN_PROGRESS), **CUANDO** lo suspendo eligiendo un motivo y escribiendo una nota, **ENTONCES** el backend guarda reason y note en campos distintos. — *Agregado por ACT-15*
- **CA-HU04-2** (Feliz): **DADO** un servicio suspendido, **CUANDO** abro su detalle, **ENTONCES** veo el motivo y la nota por separado (statusNote). — *Agregado por ACT-15; Agregado por ACT-F2*
- **CA-HU04-3** (Alternativo): **DADO** que no escribo nota, **CUANDO** suspendo (o la nota son solo espacios), **ENTONCES** la suspensión se acepta igual y la nota queda null. — *Agregado por ACT-15*
- **CA-HU04-4** (Error; propuesto, a validar por el PO): **DADO** un servicio en SCHEDULED, COMPLETED o CANCELLED, **CUANDO** intento suspenderlo, **ENTONCES** recibo 409 nombrando las transiciones válidas desde el estado actual.
- **CA-HU04-5** (Error; propuesto, a validar por el PO): **DADO** un servicio en curso, **CUANDO** envío una nota de más de 500 caracteres, **ENTONCES** recibo 400 y el servicio no cambia de estado.
- **CA-HU04-6** (Error; propuesto, a validar por el PO): **DADO** un usuario con rol de Campo que no es líder ni integrante de la cuadrilla del servicio, **CUANDO** intento suspenderlo, **ENTONCES** recibo 403 con code NOT_ASSIGNED y el estado no cambia. — *Agregado por ACT-04*

## HU-05 — Programar un servicio sobre un recorrido o un punto

- **Como** Oficina **quiero** programar un servicio sobre un recorrido o un punto, con fecha, franja y cuadrilla **para** planificar la operación.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado.

- **CA-HU05-1** (Feliz; propuesto, a validar por el PO): **DADO** un usuario con rol M6_OFICINA_OPERACIONES, un tipo de servicio de modo ROUTE y un recorrido con paradas, **CUANDO** creo un servicio con fecha, ventana horaria y una cuadrilla sin conflictos (POST /services), **ENTONCES** recibo 201, el servicio nace SCHEDULED, el modo se copia del tipo y las zonas del recorrido se copian como snapshot con su sequence.
- **CA-HU05-2** (Alternativo; propuesto, a validar por el PO): **DADO** un tipo de servicio de modo POINT, **CUANDO** creo el servicio indicando targetType y targetId de un bien del inventario, o una zoneId suelta, **ENTONCES** la zona se deriva del bien o se usa la zona indicada, y el servicio nace SCHEDULED.
- **CA-HU05-3** (Error; propuesto, a validar por el PO): **DADO** una cuadrilla o un vehículo ya tomados ese día en una franja que se pisa, **CUANDO** creo el servicio sin overrideNote, **ENTONCES** recibo 409 nombrando los servicios en conflicto, no se crea el servicio ni se encola ningún evento; con overrideNote de 10 a 500 caracteres se crea y la nota queda guardada con quién y cuándo.
- **CA-HU05-4** (Error; propuesto, a validar por el PO): **DADO** datos incompletos o inconsistentes, **CUANDO** envío un ROUTE sin routeId, un recorrido sin paradas, un POINT sin objetivo ni zona, una ventana invertida, ticketId con un origen distinto de TICKET o un tipo dado de baja, **ENTONCES** recibo 400 y no se crea el servicio.
- **CA-HU05-5** (Falla externa; propuesto, a validar por el PO): **DADO** un servicio con ticketId y el bus RabbitMQ no disponible, **CUANDO** lo programo, **ENTONCES** recibo 201 igual, el aviso a M2 queda PENDING en el outbox escrito en la misma transacción y no se publica urbanServiceScheduled. — *Corregido por ACT-23*
- **CA-HU05-6** (Error; propuesto, a validar por el PO): **DADO** una cuadrilla que no trabaja en la zona del servicio ese día o cuya especialidad no corresponde al tipo, **CUANDO** creo o asigno el servicio sin overrideNote, **ENTONCES** recibo 409 pidiendo overrideNote y no se escribe nada; con overrideNote de 10 a 500 caracteres se asigna y la nota queda con quién y cuándo; sin zona o especialidad cargadas, o con tipo sin mapear, no avisa. — *Agregado por ACT-09*

## HU-06 — Reprogramar o cancelar un servicio con motivo

- **Como** Oficina **quiero** reprogramar o cancelar un servicio con motivo **para** responder a cambios sin perder el historial.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado (incluye reprogramación por alerta climática).

- **CA-HU06-1** (Feliz; propuesto, a validar por el PO): **DADO** un servicio en SCHEDULED, RESCHEDULED o SUSPENDED, **CUANDO** lo cancelo con motivo (POST /services/:id/cancel), **ENTONCES** pasa a CANCELLED y, si estaba suspendido, se limpia statusNote.
- **CA-HU06-2** (Feliz; propuesto, a validar por el PO): **DADO** un servicio SCHEDULED, **CUANDO** lo reprogramo (reschedule) y luego confirmo con fecha y ventana nuevas (confirm-reschedule), **ENTONCES** pasa a RESCHEDULED y vuelve a SCHEDULED con la fecha nueva; confirmar con la fecha de hoy argentina es válido.
- **CA-HU06-3** (Error; propuesto, a validar por el PO): **DADO** un servicio RESCHEDULED, IN_PROGRESS o con datos inválidos, **CUANDO** confirmo con una fecha anterior a hoy, cancelo uno IN_PROGRESS, cancelo sin motivo o envío note a cancel/reschedule, **ENTONCES** recibo 400 (fecha pasada, falta de motivo, note no permitido) o 409 (IN_PROGRESS) y no hay transición.
- **CA-HU06-4** (Alternativo; propuesto, a validar por el PO): **DADO** una alerta climática HIGH o CRITICAL de M9 (weatherAlertIssued) con ventana from/to y zonas, **CUANDO** llega al inbox, **ENTONCES** los servicios SCHEDULED de esas zonas y fechas pasan a RESCHEDULED; una alerta leve solo avisa y una severa sin ventana se descarta.
- **CA-HU06-5** (Falla externa; propuesto, a validar por el PO): **DADO** un servicio SCHEDULED dependiente de un corte de calle, **CUANDO** M7 rechaza el corte (streetClosureRejected), **ENTONCES** el servicio pasa a RESCHEDULED con el motivo y no se cancela; uno ya iniciado no se toca.

## HU-07 — Ejecución en campo: iniciar, resultado por zona y cierre

- **Como** líder de cuadrilla **quiero** iniciar el servicio, registrar el resultado de cada zona y cerrarlo **para** que Oficina sepa qué quedó sin atender y por qué.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado.

- **CA-HU07-1** (Feliz; propuesto, a validar por el PO): **DADO** un servicio SCHEDULED con cuadrilla asignada y un usuario líder o integrante de esa cuadrilla, **CUANDO** lo inicio, informo SERVICED en cada zona y lo cierro, **ENTONCES** pasa por IN_PROGRESS y termina COMPLETED.
- **CA-HU07-2** (Alternativo; propuesto, a validar por el PO): **DADO** un servicio IN_PROGRESS en el que alguna zona quedó PARTIAL o NOT_SERVICED, **CUANDO** lo cierro, **ENTONCES** el estado final se calcula como PARTIALLY_COMPLETED (no se elige).
- **CA-HU07-3** (Error; propuesto, a validar por el PO): **DADO** un servicio IN_PROGRESS, **CUANDO** cierro sin el resultado de alguna zona, informo una zona sin motivo (si no es SERVICED) o con motivo (si es SERVICED), o repito el resultado de una zona, **ENTONCES** recibo 409 (falta resultado, zona repetida) o 400 (motivo faltante o sobrante) y no se escribe nada.
- **CA-HU07-4** (Error; propuesto, a validar por el PO): **DADO** un usuario de Campo ajeno a la cuadrilla, o un servicio sin cuadrilla asignada, **CUANDO** intento iniciar, informar zona, registrar residuos o avisar demora, **ENTONCES** recibo 403 con code NOT_ASSIGNED y no se escribe nada; un servicio inexistente sigue dando 404. — *Agregado por ACT-04*
- **CA-HU07-5** (Error; propuesto, a validar por el PO): **DADO** un servicio SCHEDULED cuyo tipo exige vehículo o sin cuadrilla, **CUANDO** intento iniciarlo, **ENTONCES** recibo 409 (sin vehículo) o 403 NOT_ASSIGNED (sin cuadrilla) y el servicio sigue SCHEDULED.
- **CA-HU07-6** (Alternativo; propuesto, a validar por el PO): **DADO** un servicio SCHEDULED o IN_PROGRESS, **CUANDO** aviso una demora (POST /services/:id/delay-notices), **ENTONCES** el estado no cambia; START solo se acepta antes de arrancar y DURATION solo con la cuadrilla trabajando (la combinación cruzada da 400) y un aviso nuevo reemplaza al vigente.
- **CA-HU07-7** (Error; propuesto, a validar por el PO): **DADO** un servicio que atiende un contenedor y se cierra COMPLETED, **CUANDO** falla la escritura del contenedor dentro de la transacción de cierre, **ENTONCES** el cierre se revierte completo: el servicio sigue IN_PROGRESS, el contenedor no cambia y no queda fila en el outbox.

## HU-08 — Adjuntar evidencia fotográfica con reintento seguro

- **Como** miembro de cuadrilla **quiero** adjuntar fotos como evidencia, con reintento seguro **para** respaldar el trabajo hecho.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado (validación autoritativa de magic bytes y EXIF en #90).

- **CA-HU08-1** (Feliz; propuesto, a validar por el PO): **DADO** un integrante de la cuadrilla de un servicio y un archivo JPEG válido de hasta 10 MB, **CUANDO** lo subo con POST /evidence con Idempotency-Key, **ENTONCES** recibo 201, la evidencia queda asociada al dueño y el objeto almacenado no conserva EXIF ni GPS.
- **CA-HU08-2** (Alternativo; propuesto, a validar por el PO): **DADO** una Idempotency-Key ya usada para el mismo dueño, **CUANDO** repito el POST /evidence, **ENTONCES** recibo el Attachment existente y no se vuelve a subir el archivo.
- **CA-HU08-3** (Error; propuesto, a validar por el PO): **DADO** un archivo inválido, **CUANDO** subo un archivo cuyo contenido no coincide con el tipo declarado, de más de 10 MB, de un tipo no permitido o sin Idempotency-Key, **ENTONCES** recibo 400 (contenido, tipo o clave), 413 (más de 10 MB) y no se sube nada. — *Corregido por ACT-F6*
- **CA-HU08-4** (Error; propuesto, a validar por el PO): **DADO** un usuario de Campo ajeno a la cuadrilla del servicio o un dueño inexistente, **CUANDO** subo o listo evidencia, **ENTONCES** recibo 403 NOT_ASSIGNED (ajeno) o 404 (dueño inexistente). — *Agregado por ACT-04*
- **CA-HU08-5** (Falla externa; propuesto, a validar por el PO): **DADO** que el almacenamiento R2 no está configurado o la fila no se puede escribir, **CUANDO** subo un archivo válido, **ENTONCES** recibo 503 (sin R2), no se persiste nada y la Idempotency-Key queda libre; si falla la escritura de la fila, el archivo se borra del bucket.
- **CA-HU08-6** (Error; propuesto, a validar por el PO): **DADO** evidencia de un dueño que no es mío o que no existe, **CUANDO** la leo (GET /evidence?ownerType=&ownerId=), **ENTONCES** recibo 403 NOT_ASSIGNED (Campo ajeno) o 404 (dueño inexistente); Campo lee lo propio y Oficina, Admin y Auditoría leen cualquiera. — *Corregido por ACT-05*

## HU-09 — Derivar una reparación de infraestructura o pedir un corte de calle

- **Como** cuadrilla **quiero** derivar una reparación de infraestructura o pedir un corte de calle **para** resolver lo que excede a M6.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado.

- **CA-HU09-1** (Feliz; propuesto, a validar por el PO): **DADO** un servicio nacido de un reclamo (con ticketId), **CUANDO** creo un pedido de reparación (POST /repair-requests), **ENTONCES** se crea la solicitud REQUESTED y se encola infrastructureRepairRequested hacia M3 con el ticketId, en la misma transacción.
- **CA-HU09-2** (Feliz; propuesto, a validar por el PO): **DADO** una intervención de arbolado AUTHORIZED, **CUANDO** pido un corte de calle (POST /street-closure-requests) con al menos un tramo y closureType, **ENTONCES** se crea el pedido REQUESTED y se encola streetClosureRequested hacia M7 con sourceModule "M6" y affectedSections {street, from, to, direction}. — *Corregido por ACT-14*
- **CA-HU09-3** (Error; propuesto, a validar por el PO): **DADO** un origen que no justifica la derivación, **CUANDO** creo la reparación sobre una inspección sin cerrar, NO_VIOLATION o de un expediente NOISE, o repito un pedido abierto; o creo un corte con requestedTo anterior a requestedFrom o sobre una intervención no AUTHORIZED, **ENTONCES** recibo 409 (origen o duplicado) o 400 (fechas) y no se crea ni se encola nada. — *Corregido por ACT-28*
- **CA-HU09-4** (Alternativo; propuesto, a validar por el PO): **DADO** un corte de calle REQUESTED, **CUANDO** M7 lo aprueba, lo rechaza o lo da por terminado (approve, reject, end), **ENTONCES** pasa a APPROVED guardando el closureId, REJECTED guardando el motivo, o ENDED (también desde REQUESTED o EXPIRED); una transición inválida da 409 nombrando las válidas.
- **CA-HU09-5** (Falla externa; propuesto, a validar por el PO): **DADO** un corte APPROVED cuya ventana autorizada (approvedTo) venció hace más de 6 horas sin que M7 avise el fin, **CUANDO** corre el barrido de vencimiento, **ENTONCES** el corte pasa a EXPIRED y el servicio no iniciado vuelve a reprogramarse; uno ya iniciado no se toca. — *Agregado por ACT-22*
- **CA-HU09-6** (Alternativo; propuesto, a validar por el PO): **DADO** un corte de calle al que M7 respondió, **CUANDO** consulto el pedido (GET /street-closure-requests/:id), **ENTONCES** trae la ventana pedida (closureFrom, closureTo), la autorizada (approvedFrom, approvedTo; null hasta aprobar) y el motivo de rechazo (rejectionReason; null si no fue rechazado); un reintento de Approved no pisa la ventana ya guardada. — *Agregado por ACT-14*

## HU-10 — Filtrar las intervenciones de arbolado por prioridad

- **Como** Oficina **quiero** filtrar las intervenciones de arbolado por prioridad **para** atender primero las urgentes.
- **Prioridad:** Should — fuente: propuesto (la tarjeta no la fija). **Release:** R2.
- **Estado:** Entregado (BE #293, FE #621).

- **CA-HU10-1** (Feliz): **DADO** el listado de intervenciones, **CUANDO** elijo una o más prioridades (GET /tree-interventions?priority=), **ENTONCES** solo veo las intervenciones con esa prioridad y la paginación cuenta sobre el total filtrado. — *Agregado por ACT-18; Agregado por ACT-F3*
- **CA-HU10-2** (Error): **DADO** un valor de prioridad inválido en la query, **CUANDO** llamo al endpoint, **ENTONCES** recibo 400 con el error estándar.
- **CA-HU10-3** (Alternativo): **DADO** que limpio el filtro, **CUANDO** recargo, **ENTONCES** vuelvo a ver todas las intervenciones.

## HU-11 — Gestión de contenedores (desborde, daño, vaciado, reparación y reubicación)

- **Como** Oficina **quiero** gestionar contenedores (desborde, daño, vaciado, reparación y reubicación) **para** que no queden puntos críticos sin atender.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado (historial de estados en #475).

- **CA-HU11-1** (Feliz; propuesto, a validar por el PO): **DADO** un contenedor ACTIVE y un usuario de la cuadrilla (M6_CAMPO_CUADRILLA), **CUANDO** reporto desborde (report-overflow) y luego lo vacío (empty), **ENTONCES** pasa ACTIVE → OVERFLOWED → ACTIVE, y cada transición deja una fila de historial y de auditoría con el actor del token.
- **CA-HU11-2** (Feliz; propuesto, a validar por el PO): **DADO** un contenedor ACTIVE, **CUANDO** reporto daño (report-damage), inicio y completo la reparación, **ENTONCES** pasa ACTIVE → DAMAGED → UNDER_REPAIR → ACTIVE, se publica containerDamaged en la misma transacción y al completar se limpian los datos del daño.
- **CA-HU11-3** (Alternativo; propuesto, a validar por el PO): **DADO** un contenedor ACTIVE o DAMAGED, **CUANDO** lo reubico (relocate → confirm-relocation) o lo retiro (remove), **ENTONCES** pasa a RELOCATING y vuelve a ACTIVE con la ubicación nueva, o a REMOVED solo desde DAMAGED; REMOVED no tiene salida.
- **CA-HU11-4** (Error; propuesto, a validar por el PO): **DADO** un contenedor en un estado que no admite la acción, **CUANDO** la invoco, **ENTONCES** recibo 409 nombrando las transiciones válidas; un contenedor inexistente da 404 y un código repetido en el alta da 409.
- **CA-HU11-5** (Error; propuesto, a validar por el PO): **DADO** un usuario de Oficina que no es de Campo, **CUANDO** intento reportar un daño, un desborde o vaciar un contenedor, **ENTONCES** recibo 403 con code ROLE_REQUIRED. — *Agregado por ACT-01*
- **CA-HU11-6** (Falla externa; propuesto, a validar por el PO): **DADO** el bus no disponible o una falla al escribir el historial, **CUANDO** reporto un daño, **ENTONCES** el reporte no se pierde (containerDamaged queda en el outbox PENDING); si falla la fila de historial, la acción entera falla y no se publica el evento.
- **CA-HU11-7** (Alternativo; propuesto, a validar por el PO): **DADO** un contenedor con transiciones y un daño con observaciones, **CUANDO** consulto GET /containers/:id/history o reporto el daño con observations, **ENTONCES** el historial sale paginado del más reciente al más antiguo (404 si el contenedor no existe) y las observaciones se guardan y se devuelven sin viajar al evento de M3. — *Agregado por ACT-30*

## HU-12 — Censo de arbolado, relevamientos de riesgo y podas o extracciones

- **Como** Oficina **quiero** llevar el censo de arbolado con relevamientos de riesgo y programar podas o extracciones **para** gestionar el riesgo del arbolado urbano.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado (#456: la autorización de una extracción exige M6_ADMIN).

- **CA-HU12-1** (Feliz; propuesto, a validar por el PO): **DADO** un árbol del censo y un usuario de cuadrilla, **CUANDO** cargo un relevamiento con riskLevel HIGH o CRITICAL y riskType, **ENTONCES** se guarda el relevamiento y se publica treeRiskDetected hacia M3 en la misma transacción, con la fecha del relevamiento como occurredAt.
- **CA-HU12-2** (Feliz; propuesto, a validar por el PO): **DADO** una intervención de poda REQUESTED, **CUANDO** la autoriza un usuario M6_OFICINA_OPERACIONES y la asocio a un servicio POINT, **ENTONCES** pasa a AUTHORIZED con fecha de autorización y queda vinculada al servicio. — *Agregado por ACT-08*
- **CA-HU12-3** (Alternativo; propuesto, a validar por el PO): **DADO** una intervención de extracción (REMOVAL), **CUANDO** la mando a autorizar y la decide un M6_ADMIN, **ENTONCES** pasa REQUESTED → PENDING_AUTHORIZATION → AUTHORIZED, y la respuesta dice quién la solicitó y quién la autorizó; un M6_ADMIN puede autorizar lo que él mismo solicitó y queda registrado. — *Corregido por ACT-08*
- **CA-HU12-4** (Error; propuesto, a validar por el PO): **DADO** una extracción, **CUANDO** la autoriza o rechaza M6_OFICINA_OPERACIONES, o se autoriza estando en REQUESTED, **ENTONCES** recibo 403 ROLE_REQUIRED (rol) o 409 (REQUESTED) y la intervención sigue pendiente. — *Corregido por ACT-08*
- **CA-HU12-5** (Error; propuesto, a validar por el PO): **DADO** datos de relevamiento o de asociación inválidos, **CUANDO** envío riskLevel HIGH sin riskType, surveyedAt posterior a hoy (huso Argentina), un árbol inexistente, una intervención no AUTHORIZED o un servicio que no es POINT o que ya ejecuta otra intervención, **ENTONCES** recibo 400, 404 o 409 y no se escribe nada.
- **CA-HU12-6** (Alternativo; propuesto, a validar por el PO): **DADO** un relevamiento con riskLevel LOW o MEDIUM, **CUANDO** lo cargo, **ENTONCES** se guarda pero no se publica treeRiskDetected.
- **CA-HU12-7** (Falla externa; propuesto, a validar por el PO): **DADO** M3 sin responder o el bus no disponible, **CUANDO** cargo un relevamiento HIGH, **ENTONCES** el relevamiento queda guardado y treeRiskDetected queda en el outbox para el reintento del dispatcher.

## HU-13 — Administrar espacios verdes y puntos verdes

- **Como** Oficina **quiero** administrar espacios verdes y puntos verdes **para** programar riego, corte y vaciado.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado.

- **CA-HU13-1** (Feliz; propuesto, a validar por el PO): **DADO** un usuario M6_OFICINA_OPERACIONES, **CUANDO** registro un espacio verde o un punto verde con una zona existente, **ENTONCES** recibo 201 y el recurso nace activo.
- **CA-HU13-2** (Alternativo; propuesto, a validar por el PO): **DADO** un punto verde con tipos de residuo, **CUANDO** lo actualizo con un nuevo array wasteTypes, **ENTONCES** el array reemplaza el conjunto completo.
- **CA-HU13-3** (Error; propuesto, a validar por el PO): **DADO** una zona inexistente, un code repetido o un recurso inexistente, **CUANDO** creo o actualizo, **ENTONCES** recibo 404 (zona o recurso inexistente) o 409 (code repetido).
- **CA-HU13-4** (Alternativo; propuesto, a validar por el PO): **DADO** un espacio o punto verde, **CUANDO** ejecuto DELETE, **ENTONCES** recibo 204 y queda inactivo (baja lógica).

## HU-14 — Filtrar la cola de denuncias por rango de fechas

- **Como** Oficina **quiero** filtrar la cola de denuncias por rango de fechas **para** revisar lo que entró en un período.
- **Prioridad:** Should — fuente: propuesto (la tarjeta no la fija). **Release:** R2.
- **Estado:** Entregado (BE #294, FE #622). El filtro actúa sobre updatedAt: pendiente de confirmar con el PO si debe ser createdAt.

- **CA-HU14-1** (Feliz): **DADO** la cola de denuncias, **CUANDO** elijo "desde" y "hasta" (GET /environmental-reports?from=&to=), **ENTONCES** veo solo las denuncias del rango, inclusivo, en día argentino (UTC-3) y meta.total refleja el rango. — *Agregado por ACT-18; Agregado por ACT-F3*
- **CA-HU14-2** (Error): **DADO** que "desde" es posterior a "hasta", o una fecha inexistente, **CUANDO** filtro, **ENTONCES** recibo 400 sin consultar la base y el formulario me avisa. — *Agregado por ACT-18*
- **CA-HU14-3** (Alternativo): **DADO** que cargo solo una de las dos fechas, **CUANDO** filtro, **ENTONCES** el rango queda abierto de ese lado. — *Agregado por ACT-18*
- **CA-HU14-4** (Alternativo; propuesto, a validar por el PO): **DADO** la cola de denuncias, **CUANDO** filtro por varios estados (status repetido o separado por comas), **ENTONCES** veo los expedientes de cualquiera de esos estados (OR), los duplicados se ignoran, meta.total ya viene filtrado y un valor desconocido o una lista vacía da 400. — *Agregado por ACT-18*

## HU-15 — Recibir denuncias ambientales y asignarlas a una cuadrilla para inspeccionarlas

- **Como** Oficina **quiero** recibir denuncias ambientales y asignarlas a una cuadrilla para inspeccionarlas **para** que cada denuncia tenga un responsable y una inspección.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado (la señal de posible denuncia duplicada, BE #285, no tiene criterio acá: ver pendientes).

- **CA-HU15-1** (Feliz; propuesto, a validar por el PO): **DADO** un usuario M6_OFICINA_AMBIENTAL y un expediente en RECEIVED, **CUANDO** lo tomo para análisis (start-review), **ENTONCES** pasa a UNDER_REVIEW y, si nació de un reclamo, M2 recibe un updateTicketStatus.
- **CA-HU15-2** (Feliz; propuesto, a validar por el PO): **DADO** un expediente UNDER_REVIEW, **CUANDO** programo la inspección (POST /environmental-reports/:reportId/inspections), **ENTONCES** el expediente pasa a INSPECTION_SCHEDULED, la inspección se ejecuta como un Service POINT y assignedCrewId refleja la cuadrilla de ese servicio.
- **CA-HU15-3** (Alternativo; propuesto, a validar por el PO): **DADO** un usuario que es solo inspector (M6_CAMPO_INSPECTOR) o de Oficina Ambiental, **CUANDO** abro un expediente de oficio (sin ticketId), o con ticketId, **ENTONCES** el inspector abre de oficio y recibe 400 si manda ticketId; Oficina Ambiental o Admin pueden enviar ticketId.
- **CA-HU15-4** (Error; propuesto, a validar por el PO): **DADO** un expediente o una asignación inválida, **CUANDO** invoco una acción que la tabla de estados no permite, o asigno un inspectorId sin M6_CAMPO_INSPECTOR, **ENTONCES** recibo 409 nombrando las transiciones válidas, o 400 en el inspector, y no se escribe nada.
- **CA-HU15-5** (Falla externa; propuesto, a validar por el PO): **DADO** un ticketUpdated ROUTED de M2 que llega al inbox repetido, de otra área, o antes que el ROUTED del cual depende, **CUANDO** lo proceso, **ENTONCES** un ROUTED repetido no abre un segundo expediente; uno de otra área no persiste nada; uno que depende de un ROUTED aún no recibido sale failed y el reintento del Core lo aplica después.

### Actualizaciones posteriores a la HU

Cambios entre el volcado de Trello (20/10) y el 03/11/2026 que afectan a esta HU.

- **ACT-N1** (16/10/2026; BE #285, FE #413): La señal de posible denuncia duplicada NO se implementó: el PO decidió el 16/10 que no se quiere advertencia de denuncias parecidas, solo evitar duplicados exactos (los ids los genera el backend y el frontend bloquea el doble envío). BE #285 se cerró como no planificado y FE #413 con la decisión. La tarjeta de Trello de HU-15 todavía dice "BE #285 ✅ y FE #413 ✅". No cambia ningún criterio: es una aclaración.

## HU-16 — Registrar la inspección y emitir el acta de constatación

- **Como** inspector **quiero** registrar la inspección y emitir el acta de constatación **para** dejar asentada la violación.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado (BE #284: GET violation-notice sin acta devuelve 200 null).

- **CA-HU16-1** (Feliz; propuesto, a validar por el PO): **DADO** un inspector asignado y una inspección abierta, **CUANDO** la cierro con VIOLATION_FOUND y nextStep, **ENTONCES** el expediente pasa a VIOLATION_FOUND y completedByUserId queda con el usuario del token.
- **CA-HU16-2** (Feliz; propuesto, a validar por el PO): **DADO** una inspección VIOLATION_FOUND de un establecimiento y un usuario M6_OFICINA_AMBIENTAL, **CUANDO** emito el acta (POST /environmental-inspections/:id/violation-notice), **ENTONCES** el expediente pasa a NOTICE_ISSUED, se fija el plazo de vencimiento, el número de acta es correlativo por año y se publica environmentalViolationDetected con la evidencia de la inspección.
- **CA-HU16-3** (Alternativo; propuesto, a validar por el PO): **DADO** una inspección que cierra NO_VIOLATION o INCONCLUSIVE, o un acta sin establishmentId, **CUANDO** completo la inspección o emito el acta, **ENTONCES** NO_VIOLATION lleva el expediente a NO_VIOLATION; INCONCLUSIVE lo deja en INSPECTED; un acta sin establishmentId se registra pero no se deriva a M4; GET violation-notice sin acta responde 200 con null. — *Corregido por ACT-17*
- **CA-HU16-4** (Error; propuesto, a validar por el PO): **DADO** un acta o una inspección en estado o con datos inválidos, **CUANDO** emito una segunda acta sobre la misma inspección, emito acta sobre una inspección sin VIOLATION_FOUND o sin cerrar, cierro con inspectedAt futuro, cierro VIOLATION_FOUND sin nextStep o cierro una inspección ya cerrada, **ENTONCES** recibo 409 (segunda acta, estado incorrecto, ya cerrada) o 400 (fecha futura, falta nextStep) y no se escribe nada.
- **CA-HU16-5** (Error; propuesto, a validar por el PO): **DADO** una inspección asignada a otro inspector, **CUANDO** la intento cerrar, **ENTONCES** recibo 403 NOT_ASSIGNED, la inspección sigue abierta y el 403 va antes que el 409 de "ya cerrada". — *Agregado por ACT-04*
- **CA-HU16-6** (Falla externa; propuesto, a validar por el PO): **DADO** el bus no disponible cuando se emite el acta de un establecimiento, **CUANDO** emito el acta, **ENTONCES** el acta queda registrada y environmentalViolationDetected queda en el outbox para el reintento; con el ticket de M2 en estado terminal no se publica el aviso.
- **CA-HU16-7** (Alternativo; propuesto, a validar por el PO): **DADO** una inspección de un expediente, **CUANDO** consulto GET /environmental-inspections/:id, **ENTONCES** trae reportType, address, lat y lng del expediente (null sin coordenadas) y allowedActions (repair, notice, suggestedViolationType); con acta emitida notice es false. — *Agregado por ACT-29*
- **CA-HU16-8** (Alternativo; propuesto, a validar por el PO): **DADO** un acta emitida sobre un expediente que nació de un reclamo, **CUANDO** se informa a M2, **ENTONCES** sale STARTED si el ticket no pasó por start-review o está en ROUTED, PROGRESS si ya está IN_PROGRESS, y no se publica ni se consulta el estado sin ticketId. — *Agregado por ACT-31*

## HU-17 — Registrar la sanción que devuelve M4 y cerrar el expediente

- **Como** Oficina **quiero** registrar la sanción que devuelve M4 y cerrar el expediente **para** completar el circuito denuncia → acta → sanción.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado (BE #236 e2e por el inbox).

- **CA-HU17-1** (Feliz; propuesto, a validar por el PO): **DADO** un expediente con acta emitida (NOTICE_ISSUED), **CUANDO** M4 publica commercialFineGenerated con el sourceViolationId del acta, **ENTONCES** se crea el SanctionOutcome y el expediente pasa a SANCTIONED y se cierra. — *Corregido por ACT-26*
- **CA-HU17-2** (Alternativo; propuesto, a validar por el PO): **DADO** un acta derivada a M4, **CUANDO** M4 publica closureUpdate ORDERED o LIFTED, **ENTONCES** ORDERED registra la clausura como resolución y LIFTED registra el levantamiento y cierra.
- **CA-HU17-3** (Error; propuesto, a validar por el PO): **DADO** un evento de M4 sin sourceViolationId válido, o de un acta ya resuelta, **CUANDO** llega al inbox, **ENTONCES** por HTTP recibo 400 y no se guarda la fila; un acta ya resuelta no se resuelve dos veces; sin sourceViolationId el consumidor lo descarta.
- **CA-HU17-4** (Falla externa; propuesto, a validar por el PO): **DADO** que M4 no publica nada cuando decide que no corresponde castigo, **CUANDO** vence el plazo (deadlineAt, SANCTION_DEADLINE_DAYS) de un expediente NOTICE_ISSUED, **ENTONCES** el sistema lo cierra solo (NOTICE_ISSUED → CLOSED) y no toca los que no están vencidos.

## HU-18 — Pedirle información adicional al vecino (INFORMATION_REQUIRED)

- **Como** Oficina **quiero** pedirle información adicional al vecino sobre una denuncia **para** poder resolver denuncias incompletas.
- **Prioridad:** Could — fuente: Trello (R3 COULD). **Release:** R3.
- **Estado:** Trello la marca Bloqueado (depende de M2), pero el código y un e2e ya la implementan (BE #169).

- **CA-HU18-1** (Feliz; propuesto, a validar por el PO): **DADO** un expediente UNDER_REVIEW con ticketId, **CUANDO** pido información (POST /environmental-reports/:id/request-information) con un mensaje de hasta 500 caracteres, **ENTONCES** queda informationRequestPending en true y se encola INFORMATION_REQUIRED hacia M2 en la misma transacción. — *Corregido por ACT-21*
- **CA-HU18-2** (Alternativo; propuesto, a validar por el PO): **DADO** una solicitud pendiente, **CUANDO** M2 envía INFORMATION_PROVIDED o un cambio de estado distinto de PENDING_INFORMATION, **ENTONCES** la solicitud se cierra y se guarda lo que contestó el vecino; una de reclasificación (purpose) se ignora. — *Corregido por ACT-21*
- **CA-HU18-3** (Error; propuesto, a validar por el PO): **DADO** un expediente sin ticketId, fuera de UNDER_REVIEW, con una solicitud ya pendiente o con el ticket en PENDING_INFORMATION o estado terminal, **CUANDO** pido información, o envío requiredBy en el pasado, **ENTONCES** recibo 409 (estado, ticket, duplicada) o 400 (requiredBy pasado) y no se encola nada; mientras hay una pendiente, forward, dismiss y close dan 409. — *Corregido por ACT-21*
- **CA-HU18-4** (Falla externa; propuesto, a validar por el PO): **DADO** que M2 no responde, **CUANDO** pasa el tiempo sin INFORMATION_PROVIDED, **ENTONCES** la solicitud sigue pendiente y bloquea forward, dismiss y close hasta que M2 informe un estado distinto de PENDING_INFORMATION. — *Corregido por ACT-21*

## HU-19 — M9 conoce los eventos que publica y consume M6

- **Como** M9 (Core) **quiero** conocer qué eventos publica y consume M6 **para** rutear el bus sin configuración manual.
- **Prioridad:** Must — fuente: propuesto (necesario para recibir por q.ambiente). **Release:** R2.
- **Estado:** Entregado (BE #266). La tarjeta dice 8 publicados y 10 consumidos: el código registra 6 publicaciones y 8 suscripciones.

- **CA-HU19-1** (Feliz; propuesto, a validar por el PO): **DADO** el catálogo del Core, **CUANDO** M6 arranca con CORE_REGISTER_ON_BOOT activo o se ejecuta npm run core:register, **ENTONCES** quedan registradas 6 publicaciones y 8 suscripciones (weatherAlertIssued es simulado y no se suscribe), con maxAttempts 4. — *Corregido por ACT-25*
- **CA-HU19-2** (Alternativo; propuesto, a validar por el PO): **DADO** un registro previo parcial o ejecutado más de una vez, **CUANDO** se ejecuta el registro, **ENTONCES** crea solo lo que falta, loguea lo que sobra sin borrarlo y no duplica nada; el modo simulacro no hace ningún POST. — *Corregido por ACT-25*
- **CA-HU19-3** (Falla externa; propuesto, a validar por el PO): **DADO** que el Core no responde, responde con error o con una lista paginada incompleta, **CUANDO** M6 intenta registrarse, **ENTONCES** el arranque de M6 no se bloquea, el registro se reintenta con backoff y abandona al llegar a los intentos máximos; con una respuesta paginada incompleta no crea nada a ciegas y el script sale con código distinto de 0.

## HU-20 — Adaptar M6 al contrato de integración definitivo de M9

- **Como** equipo de M6 **quiero** que M6 publique y consuma con el sobre y la cola definitivos del Core **para** integrarse con el resto de los módulos.
- **Prioridad:** Must — fuente: Trello (R2 MUST). **Release:** R2.
- **Estado:** En curso: queda abierto el paraguas BE #257 (Sprint 10).

- **CA-HU20-1** (Feliz; propuesto, a validar por el PO): **DADO** un evento en el outbox de M6, **CUANDO** el dispatcher lo publica al exchange fanout muni.inbox, **ENTONCES** el sobre lleva exactamente las claves del Core, el eventId es el id de la fila, occurredAt va en ISO 8601 con offset y la fila queda SENT con publishedAt.
- **CA-HU20-2** (Feliz; propuesto, a validar por el PO): **DADO** un mensaje en la cola q.ambiente, **CUANDO** M6 lo consume, **ENTONCES** si el inbox responde processed, duplicate o ignored se hace ack, y el sobre llega al inbox con eventId y correlación. — *Agregado por ACT-24*
- **CA-HU20-3** (Error; propuesto, a validar por el PO): **DADO** un mensaje inválido o un handler que falla, **CUANDO** se consume, **ENTONCES** el resultado failed, un cuerpo que no es JSON o un payload inválido producen nack sin reencolar y el Core reintenta con su backoff.
- **CA-HU20-4** (Alternativo; propuesto, a validar por el PO): **DADO** el sobre re-serializado por el Core (los null desaparecen), **CUANDO** llega al inbox, **ENTONCES** los handlers tratan un campo ausente igual que null y el inbox lo acepta y procesa. — *Agregado por ACT-24*
- **CA-HU20-5** (Falla externa; propuesto, a validar por el PO): **DADO** que falta la cola q.ambiente, el broker cancela el consumo o RABBITMQ_URL no está definida, **CUANDO** arranca o corre el consumidor, **ENTONCES** sin la cola loguea y falla el setup para que recovery reintente; si el broker cancela el consumo cierra el canal para reconectar; sin RABBITMQ_URL no instancia nada. — *Agregado por ACT-24*

## HU-21 — Ver en M2 la fecha y la franja en que se agendó mi reclamo

- **Como** vecino **quiero** ver en M2 la fecha y la franja en que se agendó mi reclamo **para** saber cuándo va a pasar el servicio sin llamar.
- **Prioridad:** Should — fuente: propuesto (la tarjeta no la fija). **Release:** R2.
- **Estado:** Entregado (BE #303). M2 confirmó que va como texto en publicMessage.

- **CA-HU21-1** (Feliz): **DADO** un servicio agendado para un ticket cuyo estado en M2 es ROUTED (o desconocido), **CUANDO** se programa, **ENTONCES** M2 recibe un updateTicketStatus STARTED con la fecha y la franja en es-AR dentro de publicMessage. — *Corregido por ACT-19*
- **CA-HU21-2** (Feliz): **DADO** un servicio reprogramado de un ticket IN_PROGRESS, **CUANDO** cambio la fecha (confirm-reschedule), **ENTONCES** M2 recibe un PROGRESS con la fecha nueva y no se repite el STARTED. — *Corregido por ACT-19*
- **CA-HU21-3** (Error; propuesto, a validar por el PO): **DADO** un ticket cuyo estado en M2 es IN_REVIEW, PENDING_INFORMATION, RESOLVED, CLOSED, CANCELLED o DUPLICATE, o un servicio sin ticketId, **CUANDO** se programa, **ENTONCES** no se publica ningún aviso (M2 lo rechazaría) y el mensaje nunca incluye cuadrilla ni notas. — *Corregido por ACT-19*
- **CA-HU21-4** (Falla externa; propuesto, a validar por el PO): **DADO** que M2 o el bus no están disponibles al programar, **CUANDO** se agenda el servicio, **ENTONCES** el servicio se guarda y el aviso queda PENDING en el outbox, que el dispatcher reenvía; el estado del ticket se lee con el cliente de la transacción.
- **CA-HU21-5** (Alternativo; propuesto, a validar por el PO): **DADO** una proyección hacia M2 (updateTicketStatus) con un token con o sin actorId, **CUANDO** se publica el aviso, **ENTONCES** updatedBy.id es el actorId UUID del JWT de M1 o null si no vino; nunca el sub. — *Agregado por ACT-07*

## HU-22 — M2 reasigna o reclasifica un ticket sin que M6 lo confunda con una respuesta del vecino

- **Como** M2 **quiero** reasignar un ticket entre módulos y reclasificarlo **para** que M6 no lo confunda con una respuesta del vecino.
- **Prioridad:** Must — fuente: propuesto (contrato v1.77 de M2). **Release:** R2.
- **Estado:** Entregado (BE #307, PR #304).

- **CA-HU22-1** (Feliz; propuesto, a validar por el PO): **DADO** un ticketUpdated ROUTED de M2 con responsibleAreaId de M6, category y subcategory, **CUANDO** llega al inbox, **ENTONCES** se abre el expediente con el snapshot de details.routing y el escalamiento.
- **CA-HU22-2** (Alternativo; propuesto, a validar por el PO): **DADO** un INFORMATION_PROVIDED con purpose RECLASSIFICATION, **CUANDO** llega al inbox, **ENTONCES** se ignora y no se guarda como respuesta del vecino. — *Agregado por ACT-20*
- **CA-HU22-3** (Error; propuesto, a validar por el PO): **DADO** un ticketUpdated de otra área (M3, M7 o sin responsibleAreaId), **CUANDO** llega al inbox, **ENTONCES** no persiste nada del ticket, no publica y no modifica el expediente. — *Agregado por ACT-20*
- **CA-HU22-4** (Alternativo; propuesto, a validar por el PO): **DADO** un ticket cancelado en M2, **CUANDO** llega CANCELLED, **ENTONCES** se cancelan los servicios programados del reclamo y solo los que admiten esa transición. — *Agregado por ACT-20*
- **CA-HU22-5** (Falla externa; propuesto, a validar por el PO): **DADO** un ticketUpdated atrasado respecto de uno más nuevo, **CUANDO** llega tarde por el bus, **ENTONCES** no pisa el estado más nuevo, ordenando por data.updatedAt y no por occurredAt del sobre. — *Agregado por ACT-20*

## HU-23 — Publicar y consumir eventos con outbox/inbox idempotente

- **Como** equipo de M6 **quiero** publicar y consumir eventos con outbox/inbox idempotente **para** no perder mensajes ni aplicar dos veces el mismo efecto.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado (6 eventos publicados y 10 consumidos, 9 con handler).

- **CA-HU23-1** (Feliz; propuesto, a validar por el PO): **DADO** una fila PENDING en el outbox escrita en la misma transacción del cambio de dominio, **CUANDO** corre el dispatcher y el broker acepta el mensaje, **ENTONCES** la fila pasa a SENT con publishedAt y el cambio de dominio y la fila nacieron juntos.
- **CA-HU23-2** (Alternativo; propuesto, a validar por el PO): **DADO** un evento ya recibido (mismo eventId), **CUANDO** llega por segunda vez al inbox, **ENTONCES** se registra como duplicate, no se vuelve a aplicar el efecto y no hay error.
- **CA-HU23-3** (Error; propuesto, a validar por el PO): **DADO** un evento con un campo obligatorio ausente o con tipo incorrecto, **CUANDO** llega a POST /events/inbox, **ENTONCES** recibo 400 diciendo qué corregir, no se aplica ningún efecto y no queda fila en el inbox; el mismo eventId corregido se procesa.
- **CA-HU23-4** (Falla externa; propuesto, a validar por el PO): **DADO** un envío al broker que falla 5 veces seguidas o un handler que falla, **CUANDO** corren el dispatcher o el inbox, **ENTONCES** la fila del outbox queda FAILED con lastError y deja de barrerse, y M6_ADMIN la reencola con retry (FAILED → PENDING → SENT, auditado); un handler que falla deja la fila sin processedAt y un reenvío del mismo eventId lo reintenta. — *Agregado por ACT-11*
- **CA-HU23-5** (Error; propuesto, a validar por el PO): **DADO** un token de ciudadano o un empleado que no es M6_ADMIN, **CUANDO** invoco POST /events/inbox, **ENTONCES** recibo 403 y no se procesa nada. — *Agregado por ACT-03*

## HU-24 — Probar M6 contra el Core real de M9 antes de la entrega

- **Como** equipo de M6 **quiero** probar M6 contra el Core real de M9 **para** verificar la circulación de eventos de ida y vuelta antes de la entrega.
- **Prioridad:** Must — fuente: Trello (R2 MUST). **Release:** R2.
- **Estado:** En curso: pendiente BE #442 (prueba pasiva desde Render y suscripción pruebaConexionM6), Sprint 10.

- **CA-HU24-1** (Feliz): **DADO** RabbitMQ y el Core de M9 levantados en local según docs/testing.md, **CUANDO** M6 publica en muni.inbox y consume de q.ambiente, **ENTONCES** los eventos de ida y vuelta se ven funcionando.
- **CA-HU24-2** (Alternativo; propuesto, a validar por el PO): **DADO** el puerto 5671 habilitado para los rangos de Render (M9, 28/10), **CUANDO** ejecuto la prueba pasiva desde Render (BE #442), **ENTONCES** se verifica TCP/TLS, autenticación y checkQueue de q.ambiente sin publicar ni consumir, y se documenta el eventId del evento pruebaConexionM6.
- **CA-HU24-3** (Error; propuesto, a validar por el PO): **DADO** que la cola q.ambiente no existe en el Core, **CUANDO** M6 arranca el consumidor, **ENTONCES** loguea el motivo y falla el setup para que recovery reintente, sin declarar colas ni bindings propios.
- **CA-HU24-4** (Falla externa; propuesto, a validar por el PO): **DADO** que el broker o el Core no responden o rechazan la publicación, **CUANDO** M6 intenta publicar, **ENTONCES** el nack del broker se propaga, la fila queda PENDING y tras 5 intentos FAILED, y se reproduce con retry sin duplicar efecto en el receptor. — *Agregado por ACT-11*

## HU-25 — Un ticket devuelto puede volver a derivarse a M6 y reactiva su expediente

- **Como** M2 **quiero** volver a derivar a M6 un ticket que M6 había devuelto **para** que el expediente se reactive sin duplicarse.
- **Prioridad:** Should — fuente: propuesto (la tarjeta no la fija). **Release:** R2.
- **Estado:** Entregado (BE #170, PR #304).

- **CA-HU25-1** (Feliz; propuesto, a validar por el PO): **DADO** un expediente FORWARDED y un nuevo ROUTED del mismo ticket con otro eventId, **CUANDO** llega al inbox, **ENTONCES** el expediente vuelve a UNDER_REVIEW con el snapshot nuevo, sin crear otro, y se publica un STARTED una sola vez. — *Corregido por ACT-19; Corregido por ACT-20*
- **CA-HU25-2** (Error; propuesto, a validar por el PO): **DADO** un expediente que no está FORWARDED, o un ROUTED más viejo que el último cambio del expediente, **CUANDO** llega al inbox, **ENTONCES** no se reactiva ni se publica nada. — *Corregido por ACT-20*
- **CA-HU25-3** (Alternativo; propuesto, a validar por el PO): **DADO** un expediente devuelto y un ROUTED de otra área o un CANCELLED de M2, **CUANDO** llega al inbox, **ENTONCES** un ROUTED de otra área cierra el expediente devuelto sin leer su contenido y un CANCELLED lo cierra. — *Corregido por ACT-20*
- **CA-HU25-4** (Falla externa; propuesto, a validar por el PO): **DADO** un reintento del Core que ya no encuentra el expediente en FORWARDED, **CUANDO** se reentrega el ROUTED, **ENTONCES** no duplica la reactivación ni el aviso y no falla.

## HU-26 — Fechas legibles y nombres en lugar de UUID en la demo

- **Como** Oficina **quiero** que la demo muestre fechas legibles y nombres en lugar de UUID **para** entender los datos de un vistazo.
- **Prioridad:** Could — fuente: propuesto (la tarjeta no la fija). **Release:** R2.
- **Estado:** Entregado (FE #321).

- **CA-HU26-1** (Feliz): **DADO** cualquier listado, **CUANDO** se muestra una fecha, **ENTONCES** está en formato argentino dd/mm/aaaa hh:mm y en el día local. — *Agregado por ACT-F4*
- **CA-HU26-2** (Feliz): **DADO** un listado con referencias a otras entidades, **CUANDO** lo veo, **ENTONCES** leo el nombre o el código, no el UUID. — *Agregado por ACT-F4*
- **CA-HU26-3** (Error; propuesto, a validar por el PO): **DADO** una hora cercana a medianoche donde UTC ya es el día siguiente, **CUANDO** se muestra la fecha, **ENTONCES** se muestra el día de Argentina (UTC-3), no el de UTC.

## HU-27 — Consultar sin login el estado de mi denuncia, cuándo pasa el servicio y dónde están los puntos verdes

- **Como** vecino **quiero** consultar sin login el estado de mi denuncia, cuándo pasa el servicio y dónde están los puntos verdes **para** saber el avance sin llamar.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado (SEC-W03: mínima exposición y límite de consultas).

- **CA-HU27-1** (Feliz; propuesto, a validar por el PO): **DADO** el ticketId (UUID) de un reclamo con expediente, **CUANDO** consulto GET /public/reports/:ticketId sin token, **ENTONCES** recibo 200 con la etapa (una de siete), el tipo, la dirección y las fechas, sin identidad del inspector, hallazgos, checklist ni acta.
- **CA-HU27-2** (Alternativo; propuesto, a validar por el PO): **DADO** consultas públicas de servicios y puntos verdes, **CUANDO** las hago sin fechas, **ENTONCES** veo los próximos 30 días desde hoy en Argentina, sin servicios cancelados ni datos de cuadrilla, vehículo o notas; y solo los puntos verdes activos con los residuos que reciben.
- **CA-HU27-3** (Error; propuesto, a validar por el PO): **DADO** el publicId correlativo (TK-…) o un ticketId sin expediente, **CUANDO** consulto el seguimiento, **ENTONCES** recibo 404 sin datos y sin confirmar si el ticket existe en M2.
- **CA-HU27-4** (Error; propuesto, a validar por el PO): **DADO** más de 20 consultas por minuto a /public/reports/:ticketId (o 60 por minuto en el resto) desde la misma IP, **CUANDO** consulto, **ENTONCES** recibo 429; con la X-M6-BFF-Key correcta se cuenta la IP del vecino y con una clave incorrecta se ignora X-Forwarded-For. — *Corregido por ACT-06*
- **CA-HU27-5** (Error; propuesto, a validar por el PO): **DADO** una petición sin token a un endpoint no público, **CUANDO** la hago, **ENTONCES** recibo 401, y solo /health y los cuatro /public/* son accesibles sin JWT.

## HU-28 — Tablero de indicadores (cobertura, cumplimiento, incidencias y residuos)

- **Como** Oficina **quiero** un tablero de indicadores de cobertura, cumplimiento, incidencias y residuos **para** medir la operación.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado; etapas 1 y 2 (#473, #475). Zonas no atendidas sigue pendiente de definición (#461).

- **CA-HU28-1** (Feliz; propuesto, a validar por el PO): **DADO** servicios programados con fecha vencida y resultados por zona, **CUANDO** consulto GET /indicators/coverage, **ENTONCES** la cobertura cuenta pares (servicio, zona), no servicios, y lo programado a futuro va aparte y no cuenta como pendiente.
- **CA-HU28-2** (Alternativo; propuesto, a validar por el PO): **DADO** un período y el período anterior de igual duración, **CUANDO** consulto con bucket y compare=previous, **ENTONCES** la suma de la serie es igual a totals y delta trae la diferencia; sin base en alguno de los períodos la diferencia es null. — *Corregido por ACT-13*
- **CA-HU28-3** (Error; propuesto, a validar por el PO): **DADO** parámetros inválidos, **CUANDO** consulto con from posterior a to o con una serie de más de 90 puntos, **ENTONCES** recibo 400 con el motivo, antes de consultar la base. — *Agregado por ACT-13*
- **CA-HU28-4** (Alternativo; propuesto, a validar por el PO): **DADO** sin reclamos abiertos o sin historial de contenedores, **CUANDO** consulto incidencias, **ENTONCES** el porcentaje de vencidos y los contenedores dañados pendientes son null, no 0. — *Agregado por ACT-13*
- **CA-HU28-5** (Alternativo; propuesto, a validar por el PO): **DADO** reclamos CLOSED y reclamos abiertos, **CUANDO** consulto GET /indicators/incidents, **ENTONCES** reports.withinDeadline trae {resolved, withinDeadline, pct} y reports.overdue trae {open, overdue, pct}, en días hábiles contra INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS (5 por defecto); sin cerrados o sin abiertos el pct es null. — *Agregado por ACT-13*
- **CA-HU28-6** (Alternativo; propuesto, a validar por el PO): **DADO** el historial de estados de contenedores (container_status_history), **CUANDO** consulto GET /indicators/incidents, **ENTONCES** los desbordes y daños se cuentan por transición con origen no nulo (no por contenedor), los dañados pendientes salen del último estado conocido y sin historial son null; trackingSince indica desde cuándo hay datos. — *Agregado por ACT-13*

## HU-29 — Ver y hacer solo lo que mi rol permite, con el rol que viene de M1

- **Como** Oficina y Campo **quiero** ver y hacer solo lo que mi rol permite, con el rol que viene de M1 **para** que cada persona opere solo lo que le corresponde.
- **Prioridad:** Must — fuente: propuesto (la tarjeta no la fija). **Release:** R2.
- **Estado:** Entregado (BE #161, #235; FE #469).

- **CA-HU29-1** (Error): **DADO** un request sin token, **CUANDO** llamo a un endpoint de gestión, **ENTONCES** recibo 401. — *Agregado por ACT-01*
- **CA-HU29-2** (Error): **DADO** un usuario con rol Campo, **CUANDO** intento emitir un acta o programar un servicio, **ENTONCES** recibo 403 con code ROLE_REQUIRED y el cuerpo no revela qué rol faltaba. — *Agregado por ACT-01*
- **CA-HU29-3** (Feliz): **DADO** un usuario con rol Oficina, **CUANDO** programo un servicio, **ENTONCES** recibo 2xx; y un GET permitido devuelve 200 también al auditor, que no puede escribir. — *Agregado por ACT-01*
- **CA-HU29-4** (Feliz): **DADO** el frontend con sesión iniciada, **CUANDO** consulto GET /me, **ENTONCES** el menú muestra solo las capacidades que devuelve GET /me (roles, cuadrillas e isAssignedInspector). — *Agregado por ACT-10; Agregado por ACT-F5*
- **CA-HU29-5** (Error; propuesto, a validar por el PO): **DADO** un token de ciudadano, un empleado sin roles de M6, o un JWT vencido, con firma alterada, alg=none o de otro emisor, **CUANDO** lo uso, **ENTONCES** 401 para los tokens inválidos, 403 para el ciudadano y para el empleado sin roles (salvo GET /me, que responde). — *Agregado por ACT-02; Agregado por ACT-03*
- **CA-HU29-6** (Error; propuesto, a validar por el PO): **DADO** el último M6_ADMIN, o un conjunto que mezcla roles de Oficina y de Campo, **CUANDO** intento cambiar los roles (PUT o DELETE /role-assignments/:userId), **ENTONCES** recibo 409 (quitaría el último admin) o 400 (mezcla Oficina y Campo, rol inexistente o repetido) y no cambia nada.
- **CA-HU29-7** (Falla externa; propuesto, a validar por el PO): **DADO** un rol de M1 que M6 no conoce o que cambió, **CUANDO** llega un JWT de M1, **ENTONCES** un rol desconocido no autoriza (nunca roles de M6); un rol de M6 asignado que el rol de M1 ya no permite queda dormido; los roles se leen de la base en cada request.

## HU-30 — Activar la autenticación real de M1 con sesión sellada en el BFF

- **Como** Oficina y Campo **quiero** iniciar sesión con mi cuenta real de M1 **para** operar con mi identidad y mis roles reales.
- **Prioridad:** Must — fuente: Trello (R2 MUST). **Release:** R2.
- **Estado:** En curso: pendiente BE #488 (secreto vigente de M1 en Render) y FE #800 (retirar el modo backend-development).

- **CA-HU30-1** (Feliz; propuesto, a validar por el PO): **DADO** la cuenta de un empleado en M1 y el secreto vigente de M1 cargado en el backend (JWT_SECRET, JWT_ISSUER), **CUANDO** inicio sesión por el BFF (POST {M1}/auth/usuario/login) y consulto GET /me, **ENTONCES** recibo 200 con mis roles de M6; el JWT de M1 va en una cookie sellada httpOnly y nunca llega al navegador.
- **CA-HU30-2** (Error; propuesto, a validar por el PO): **DADO** un JWT firmado con un secreto distinto del cargado en el backend, **CUANDO** llamo a un endpoint protegido, **ENTONCES** recibo 401 (hoy sucede en Render hasta que se cargue el secreto vigente de M1).
- **CA-HU30-3** (Error; propuesto, a validar por el PO): **DADO** una sesión vencida o un 401 del backend, **CUANDO** navego, **ENTONCES** el BFF reintenta una vez con refresh y, si falla, redirige al login con el aviso de sesión vencida. — *Agregado por ACT-F7*
- **CA-HU30-4** (Falla externa; propuesto, a validar por el PO): **DADO** que M1 no responde o devuelve 5xx al iniciar sesión, o que el build desplegado no está en modo real-m1, **CUANDO** inicio sesión, **ENTONCES** el BFF corta a los 15 s con un mensaje de error; un build deployado en un modo distinto de real-m1 falla al arrancar (fail closed, FE #800).

## HU-31 — Seguridad de la Clase 11 (SEC-W01 a W06, SEC-I01, SEC-I02, SEC-D01, SEC-D02)

- **Como** equipo de M6 **quiero** cumplir los criterios de seguridad de la Clase 11 **para** proteger los datos y la operación del módulo.
- **Prioridad:** Must — fuente: MVP entregado. **Release:** MVP.
- **Estado:** Entregado. Los veredictos de Trello son del 13/10: se revalidan acá contra el código actual.

- **CA-HU31-1** (Error): **DADO** un endpoint protegido (SEC-W01), **CUANDO** se invoca sin token, con token vencido, con firma de otro secreto o con alg "none", **ENTONCES** los cuatro casos responden 401 con el formato de error estándar y sin datos del recurso. — *Corregido por ACT-02*
- **CA-HU31-2** (Error): **DADO** un usuario autenticado sin el rol de supervisión (SEC-W02), **CUANDO** envía POST /services con un body válido, **ENTONCES** recibe 403 y no se crea ningún servicio. — *Corregido por ACT-01*
- **CA-HU31-3** (Error): **DADO** una consulta anónima al portal (SEC-W03), **CUANDO** consulta con el publicId, con un ticketId válido o más de 20 veces por minuto, **ENTONCES** 404 sin datos, solo etapa, tipo, dirección y fechas, y 429 respectivamente.
- **CA-HU31-4** (Error): **DADO** un supervisor autenticado y un servicio SCHEDULED (SEC-W04), **CUANDO** envía PATCH /services/:id con status "COMPLETED" u otro campo fuera del DTO, **ENTONCES** recibe 400 y el estado en la base no cambia.
- **CA-HU31-5** (Error): **DADO** una falla interna forzada (SEC-W05), **CUANDO** se invoca el endpoint, **ENTONCES** responde 500 con mensaje genérico, sin stack ni SQL; el id de correlación en el log no está implementado (limitación conocida).
- **CA-HU31-6** (Error): **DADO** un archivo cuyo contenido no coincide con el tipo, de más de 10 MB o con EXIF (SEC-W06), **CUANDO** se sube a POST /evidence, **ENTONCES** 400, 413 y 201 sin EXIF respectivamente.
- **CA-HU31-7** (Alternativo): **DADO** un evento ya recibido (SEC-I01), **CUANDO** llega por segunda vez, **ENTONCES** se registra como duplicate, sin volver a aplicar el efecto.
- **CA-HU31-8** (Error): **DADO** un evento con campo obligatorio ausente o de tipo incorrecto (SEC-I02), **CUANDO** llega al inbox, **ENTONCES** 400 con qué corregir, sin efecto ni fila; la DLQ es del Core (decisión documentada).
- **CA-HU31-9** (Error): **DADO** una request con header Authorization y datos de una denuncia (SEC-D01), **CUANDO** se procesa con éxito o falla, **ENTONCES** ningún log contiene el token, secretos ni datos personales en claro; el LoggingInterceptor registra solo método, URL, estado y duración.
- **CA-HU31-10** (Error): **DADO** un usuario autenticado que consulta una denuncia ambiental o un acta (SEC-D02), **CUANDO** las lee, **ENTONCES** se registra quién, cuándo y qué recurso consultó, sin copiar el contenido.
- **CA-HU31-11** (Falla externa; propuesto, a validar por el PO): **DADO** un evento saliente que el broker o el Core rechazan cinco veces seguidas (SEC-I02, lado emisor), **CUANDO** corre el dispatcher, **ENTONCES** la fila queda FAILED con lastError y deja de barrerse, y solo M6_ADMIN la reencola con retry, con auditoría del actor; la DLQ y el backoff del reintento de entrada son del Core. — *Agregado por ACT-11*
- **CA-HU31-12** (Alternativo; propuesto, a validar por el PO): **DADO** una alta o una transición de estado del dominio (contenedores, expedientes, inspecciones, actas, derivaciones, intervenciones, servicios y catálogos), **CUANDO** se ejecuta, **ENTONCES** queda una fila de auditoría de solo agregado con el actor del token, el estado de origen y destino y el motivo que el flujo ya pedía, en la misma transacción; una transición rechazada (409) no deja fila; GET /audit lo consultan solo M6_ADMIN y M6_AUDITOR. — *Agregado por ACT-12*

## HU-32 — Release hardening (Fase 8): observabilidad, promoción y rollback, WCAG 2.2 AA, privacidad y GA

- **Como** equipo de M6 **quiero** endurecer el módulo para producción **para** operarlo con garantías y ante auditoría.
- **Prioridad:** Could — fuente: Trello (R3 COULD). **Release:** R3.
- **Estado:** Abierta en el frontend (#146 a #151); fuera del alcance de la Clase 15 salvo lo listado acá.

- **CA-HU32-1** (Feliz; propuesto, a validar por el PO): **DADO** las pantallas del frontend, **CUANDO** corre axe con las etiquetas WCAG en el CI, **ENTONCES** no hay violaciones críticas de accesibilidad.
- **CA-HU32-2** (Alternativo; propuesto, a validar por el PO): **DADO** el despliegue del backend, **CUANDO** consulto GET /health y GET /health/ready, **ENTONCES** liveness responde 200 sin consultar la base y readiness responde 200 con la base arriba.
- **CA-HU32-3** (Error; propuesto, a validar por el PO): **DADO** que la base no responde o tarda más de 3 s, **CUANDO** consulto GET /health/ready, **ENTONCES** recibo 503 sin filtrar el error de la base.
- **CA-HU32-4** (Error; propuesto, a validar por el PO): **DADO** una respuesta del frontend, **CUANDO** se inspeccionan los headers de seguridad (CSP, X-Frame-Options, HSTS, Referrer-Policy), **ENTONCES** están presentes (hoy no lo están en el frontend: limitación conocida; en el backend hay nosniff, X-Frame-Options, Referrer-Policy y HSTS solo en producción).

## HU-33 — e2e con datos deterministas y shards balanceados

- **Como** equipo de M6 **quiero** que los e2e corran con datos deterministas y shards balanceados **para** obtener el mismo resultado en cada corrida.
- **Prioridad:** Could — fuente: Trello (R3 COULD). **Release:** R3.
- **Estado:** Abierta en el frontend (#575, #579).

- **CA-HU33-1** (Feliz; propuesto, a validar por el PO): **DADO** el job e2e del CI del backend con Postgres 16, **CUANDO** corre npm run test:e2e, **ENTONCES** migra la base local y ejecuta las suites de test/ contra Postgres real.
- **CA-HU33-2** (Error; propuesto, a validar por el PO): **DADO** una DATABASE_URL con host remoto o ausente, **CUANDO** arrancan los e2e, **ENTONCES** el guard aborta antes de migrar y no toca la base desplegada.
- **CA-HU33-3** (Alternativo; propuesto, a validar por el PO): **DADO** la migración de ids de cuadrilla ejecutada dos veces, **CUANDO** corro el script, **ENTONCES** la segunda corrida no cambia nada y el simulacro no toca la base.
- **CA-HU33-4** (Error; propuesto, a validar por el PO): **DADO** la suite de tests ejecutada tres veces seguidas, **CUANDO** comparo los resultados, **ENTONCES** son idénticos (0 tests inestables).

## Índice de actualizaciones posteriores a las HU

Relevamiento al 03/11/2026: issues cerrados desde el 13/10 (backend y frontend), PR mergeados y CI de develop. Detalle por HU en cada subsección y estado de ejecución en [03-matriz-trazabilidad.md](03-matriz-trazabilidad.md).

| ID | Fecha | Issues y PR | Commits | HU y criterios | Estado |
|---|---|---|---|---|---|
| ACT-01 | 21/10/2026 | #161, #235; PR #366, #369 | e6153f9, f1e1ff6 | CA-HU31-2 corregido, CA-HU29-1 agregado, CA-HU29-2 agregado, CA-HU29-3 agregado, CA-HU11-5 agregado | Corregido — Pasó en CI |
| ACT-02 | 21/10/2026 y 28/10/2026 | #354, #448; PR #358, #450 | b9511a7, bd61e3a | CA-HU31-1 corregido, CA-HU29-5 agregado | Corregido — Pasó en CI |
| ACT-03 | 21/10/2026 | #359; PR #362 | e6aac3b | CA-HU29-5 agregado, CA-HU23-5 agregado | Corregido — Pasó en CI |
| ACT-04 | 22/10/2026 (cerrado el 23/10) | #365, #394; PR #395 | 2c76ed7 | CA-HU07-4 agregado, CA-HU04-6 agregado, CA-HU16-5 agregado, CA-HU08-4 agregado | Corregido — Pasó en CI |
| ACT-05 | 30/10/2026 | #466; PR #468 | c2d12a8 | CA-HU08-6 corregido | Corregido — Pasó en CI |
| ACT-06 | 02/11/2026 | #470; PR #480 | 65dde9f | CA-HU27-4 corregido | Corregido — Pasó en CI |
| ACT-07 | 20/10/2026 y 02/11/2026 | #314, #485; PR #318, #489 | a5f4153, a108b56 | CA-HU21-5 agregado | Corregido — Pasó en CI |
| ACT-08 | 29/10/2026 | #456; PR #464 | bfdf200 | CA-HU12-3 corregido, CA-HU12-4 corregido, CA-HU12-2 agregado | Corregido — Pasó en CI |
| ACT-09 | 29/10/2026 (cerrado el 02/11) | #454, #455; PR #465 | 305386b | CA-HU03-2 corregido, CA-HU03-6 agregado, CA-HU05-6 agregado | Corregido — Pasó en CI |
| ACT-10 | 30/10/2026 | #458; PR #469 | 374f66e | CA-HU29-4 agregado | Corregido — Pasó en CI |
| ACT-11 | 29/10/2026 | #459; PR #463 | 3bf5b46 | CA-HU23-4 agregado, CA-HU24-4 agregado, CA-HU31-11 agregado | Corregido — Pasó en CI |
| ACT-12 | 02/11/2026 | #460; PR #483 | 39069dc | CA-HU31-12 agregado | Corregido — Pasó en CI |
| ACT-13 | 01/11/2026 y 02/11/2026 | #461, #473, #475; PR #474, #476 | 7a004e1, 6a83001 | CA-HU28-2 corregido, CA-HU28-3 agregado, CA-HU28-4 agregado, CA-HU28-5 agregado, CA-HU28-6 agregado | Corregido — Pasó en CI |
| ACT-14 | 02/11/2026 | #447, #481; PR #478, #487 | 47b24e9, 9482e01 | CA-HU09-2 corregido, CA-HU09-6 agregado | Corregido — Pasó en CI |
| ACT-15 | 19/10/2026 | #282; PR #290 | 708ad7f | CA-HU04-1 agregado, CA-HU04-2 agregado, CA-HU04-3 agregado | Corregido — Pasó en CI |
| ACT-16 | 19/10/2026 | #283; PR #288 | 3210e9d | CA-HU02-2 corregido | Corregido — Pasó en CI |
| ACT-17 | 19/10/2026 | #284; PR #289 | b18f066 | CA-HU16-3 corregido | Corregido — Pasó en CI |
| ACT-18 | 20/10/2026 y 21/10/2026 | #293, #294, #340; PR #315, #316, #357 | 11fa0a8, c888012, a54d9a9 | CA-HU10-1 agregado, CA-HU14-1 agregado, CA-HU14-2 agregado, CA-HU14-3 agregado, CA-HU14-4 agregado | Corregido — Pasó en CI |
| ACT-19 | 20/10/2026 y 23/10/2026 | #303, #309, #396; PR #319, #320, #399 | 11dfb5c, 32b7d5a, 02c39d3 | CA-HU21-1 corregido, CA-HU21-2 corregido, CA-HU21-3 corregido, CA-HU25-1 corregido | Corregido — Pasó en CI |
| ACT-20 | 20/10/2026 | #170, #307; PR #304, #308 | 6ac608e, 2721433 | CA-HU25-1 corregido, CA-HU25-2 corregido, CA-HU25-3 corregido, CA-HU22-2 agregado, CA-HU22-3 agregado, CA-HU22-4 agregado, CA-HU22-5 agregado | Corregido — Pasó en CI |
| ACT-21 | 20/10/2026 y 21/10/2026 | #169, #338, #342; PR #335, #339, #343 | b05d0f5, 6ecfac8, 0998ac4 | CA-HU18-1 corregido, CA-HU18-2 corregido, CA-HU18-3 corregido, CA-HU18-4 corregido | Corregido — Pasó en CI |
| ACT-22 | 20/10/2026 | #321; PR #323 | a05bc2e | CA-HU09-5 agregado | Corregido — Pasó en CI |
| ACT-23 | 21/10/2026 | #346; PR #346 | 97809ec | CA-HU05-5 corregido | Corregido — Pasó en CI |
| ACT-24 | 20/10/2026, 21/10/2026 y 27/10/2026 | #296, #295, #413; PR #317, #356, #432 | d3b9d08, 1c5957c, 9278dfa | CA-HU20-4 agregado, CA-HU20-5 agregado, CA-HU20-2 agregado | Corregido — Pasó en CI |
| ACT-25 | 21/10/2026, 22/10/2026 y 26/10/2026 | #266, #381, #391; PR #356, #382, #392 | 1c5957c, 0768c9e, eae6f14 | CA-HU19-1 corregido, CA-HU19-2 corregido | Corregido — Pasó en CI |
| ACT-26 | 22/10/2026 | #374; PR #375 | 21f18af | CA-HU17-1 corregido | Corregido — Pasó en CI |
| ACT-27 | 27/10/2026 y 29/10/2026 | #376, #420, #421, #457; PR #419, #425, #426, #464 | 94aeff3, 3aa1cce, 733f976, bfdf200 | CA-HU02-6 corregido, CA-HU02-7 agregado | Corregido — Pasó en CI |
| ACT-28 | 29/10/2026 | #451; PR #462 | 605085f | CA-HU09-3 corregido | Corregido — Pasó en CI |
| ACT-29 | 30/10/2026 | #452; PR #462 (donde entran los tests de este cambio) | 605085f | CA-HU16-7 agregado | Corregido — Pasó en CI |
| ACT-30 | 02/11/2026 | #453; PR #482 | 9aa2f14 | CA-HU11-7 agregado | Corregido — Pasó en CI |
| ACT-31 | 20/10/2026 | #325; PR #330 | 728f477 | CA-HU16-8 agregado | Corregido — Pasó en CI |
| ACT-F1 | 31/10/2026 | FE #528, #520, #525 | — | CA-HU01-1 agregado, CA-HU01-2 agregado, CA-HU01-3 agregado | Corregido; ejecución pendiente |
| ACT-F2 | 23/10/2026 | FE #617 | — | CA-HU04-2 agregado | Corregido; ejecución pendiente |
| ACT-F3 | 21/10/2026 | FE #621, #622 | — | CA-HU10-1 agregado, CA-HU14-1 agregado | Corregido; ejecución pendiente |
| ACT-F4 | 28/10/2026 | FE #321 | — | CA-HU26-1 agregado, CA-HU26-2 agregado | Corregido; ejecución pendiente |
| ACT-F5 | 30/10/2026 | FE #469 | — | CA-HU29-4 agregado | Corregido; ejecución pendiente |
| ACT-F6 | 13/10/2026 | FE #380, #435, #438 | — | CA-HU08-3 corregido | Corregido; ejecución pendiente |
| ACT-F7 | 13/10/2026 al 14/10/2026 | FE #379, #381, #437 | — | CA-HU30-3 agregado | Corregido; ejecución pendiente |
| ACT-N1 | 16/10/2026 | BE #285, FE #413 | — | HU15 (aclaración) | Aclaración |

## Fuera de alcance (Won't, por ahora)

Propuestas de alcance del tablero, a validar por el PO. No tienen criterios ni casos.

- **HU-34 — Alta del reclamo del vecino dentro de M6.** El ticket es de M2. M6 lo recibe ruteado (ticketUpdated) y le devuelve el estado (updateTicketStatus).
- **HU-35 — Cobro y gestión de multas.** Lo resuelve M4. M6 emite el acta y registra la sanción que vuelve.
- **HU-36 — App mobile nativa para cuadrillas.** El frontend web es responsive y cubre el uso en el celular.

## Discrepancias entre Trello y el código (a corregir en Trello o confirmar)

Los criterios de este documento siguen el código. Estas son las diferencias encontradas:

1. **HU-05 y HU-12:** Trello dice que al programar un servicio se publica `urbanServiceScheduled` hacia M7 y que se publica `treePruningScheduled`. Desde el 21/10 ya no se emiten (M7 no los consume): ver `docs/eventos/publicados/descartados.md` y el test «el alta solo encola el aviso a M2, nunca urbanServiceScheduled».
2. **HU-19 y HU-23:** Trello dice "8 eventos publicados y 10 consumidos". El código registra 6 publicaciones y 8 suscripciones (weatherAlertIssued es simulado y no se suscribe); los consumidos documentados son 10 y 9 tienen handler.
3. **HU-21:** Trello dice que M2 recibe STARTED y luego PROGRESS. El código emite uno solo según el estado del ticket: STARTED si está en ROUTED o es desconocido, PROGRESS si ya está IN_PROGRESS.
4. **HU-18:** Trello la marca Bloqueado, pero existen el endpoint request-information, el consumo de INFORMATION_PROVIDED y un e2e (`test/information-request.e2e-spec.ts`).
5. **HU-31:** los veredictos de las tarjetas SEC son del 13/10. SEC-W02 figuraba NO CUMPLE y hoy el `RolesGuard` es global y falla cerrado (ACT-01); SEC-W01 se corrigió con la validación del JWT de M1 (ACT-02). SEC-D02 sigue sin cumplirse. SEC-W05 sigue parcial (sin id de correlación, sin RFC 9457). `AGENTS.md` todavía dice que ningún endpoint usa @Roles: está desactualizado.
6. **HU-14:** el filtro de fechas actúa sobre updatedAt y no sobre createdAt; está pendiente de confirmar con el PO.
7. **HU-28:** la tarjeta dice que FE #82 y #143 siguen abiertos en GitHub; la tarjeta de higiene del 03/11 dice que están cerrados. GitHub confirma que ambos se cerraron el 20/10.
8. **HU-15:** la tarjeta dice "señal de posible denuncia duplicada: BE #285 ✅ y FE #413 ✅". No se implementó: el PO decidió el 16/10 que no se quiere advertencia de denuncias parecidas, y BE #285 se cerró como no planificado (ACT-N1).
9. **HU-18:** ver ACT-21; **HU-05:** ver ACT-23.

## Pendientes de validar con el PO

- Los criterios propuestos (144) y la prioridad MoSCoW propuesta en HU-01, HU-04, HU-10, HU-14, HU-19, HU-21, HU-22, HU-25, HU-26 y HU-29.
- Corregir en Trello la tarjeta de HU-15 (señal de denuncia duplicada, ACT-N1), la de HU-18 (Bloqueado) y la de HU-05 (urbanServiceScheduled).
- Si el filtro de fechas de HU-14 debe usar createdAt.

## Riesgos de cierre (HU Must con trabajo abierto)

| HU | Qué falta | Referencia |
|---|---|---|
| HU-20 | Paraguas del contrato definitivo de M9 | BE #257 |
| HU-24 | Prueba pasiva desde Render y suscripción pruebaConexionM6; procedimiento local con el Core | BE #299, #442 |
| HU-30 | Cargar el secreto vigente de M1 en Render y retirar el modo backend-development del BFF | BE #488, FE #800 |
| HU-31 | SEC-D02: auditoría de lectura de datos Tier 2 | Trello SEC-D02, ADR-005 |
