# BRD del Módulo 6: Ambiente, Higiene y Servicios Urbanos

> Versión 1.0 · 17/11/2026 · Grupo 04 · Módulo 6

Requisitos de negocio del Módulo 6 del TPO «Municipalidad UADE». El detalle funcional está en la [documentación funcional](documentacion-funcional.md).

## 1. Resumen ejecutivo

El Módulo 6 (M6) es el módulo operativo de campo de la higiene urbana y el control ambiental de una plataforma municipal distribuida de nueve módulos. Planifica y ejecuta los servicios de recolección, limpieza, arbolado y espacios verdes; administra el inventario urbano ambiental (contenedores, árboles, espacios verdes y puntos verdes); y tramita las denuncias ambientales hasta el acta de constatación, registrando después la resolución sancionatoria que devuelve el módulo de Habilitaciones (M4).

El módulo no atiende al vecino de forma directa: el reclamo lo recibe M2 y lo deriva a M6 por un evento. M6 devuelve el avance a M2, que es el canal oficial del vecino, y ofrece también una consulta pública sin login.

| Aspecto | Valor |
|---|---|
| Usuarios | Personal municipal: Oficina, Campo, Auditoría y Administración |
| Integración | Eventos asincrónicos por bus (RabbitMQ del Core, M9); REST solo para lo síncrono |
| Identidad | El JWT lo emite M1; M6 valida y decide los permisos propios |
| Backend | Node.js, NestJS, Prisma, PostgreSQL |
| Frontend | Next.js, React, Tailwind, con BFF |

## 2. Contexto y problema de negocio

### 2.1 La plataforma

La municipalidad se modela como una plataforma distribuida: nueve grupos, un módulo por grupo, cada módulo con frontend, backend en tres capas y base propia, sin acceso directo entre bases. La integración es por eventos asincrónicos sobre un bus; REST se usa solo para lo síncrono. El módulo 9 (M9, Core) administra el bus y los catálogos globales.

| Módulo | Rol en la plataforma | Relación con M6 |
|---|---|---|
| M1 | Ciudadanos e identidad | Emite el JWT de usuario |
| M2 | Atención ciudadana | Dueño del reclamo (ticket); deriva a M6 |
| M3 | Obras públicas | Recibe daños y riesgos que no resuelve M6 |
| M4 | Habilitaciones | Recibe las actas y decide la sanción |
| M7 | Tránsito | Autoriza los cortes de calle |
| M9 | Core | Bus, catálogos y alertas |
| M5, M8 | Otros dominios | Sin intercambio con M6 |

### 2.2 Qué no hace M6

El ticket es de M2, la multa la decide y la cobra M4, los cortes de calle los autoriza M7 y las reparaciones de infraestructura las resuelve M3. M6 emite el aviso o el pedido correspondiente y registra la respuesta.

## 3. Objetivos de negocio y criterios de éxito

Los criterios tienen una medición o una regla verificable en el repositorio. Las cifras salen del informe de ejecución de QA (backend, `develop` @ `53cde64`, 16/11/2026); no se recalcularon.

| ID | Objetivo de negocio | Criterio de éxito | Resultado |
|---|---|---|---|
| OB-01 | Que cada servicio tenga responsable, zona y resultado | Todo servicio lleva zona y el cierre exige resultado por zona | Regla en HU-05 y HU-07 |
| OB-02 | Que lo no atendido quede registrado con motivo | Resultado de zona `NOT_SERVICED` o `PARTIAL` exige motivo | Regla en HU-07 |
| OB-03 | Que la denuncia llegue a acta y sanción con trazabilidad | Circuito denuncia → inspección → acta → sanción → cierre | HU-15, HU-16 y HU-17 |
| OB-04 | Que ningún evento se pierda ni se aplique dos veces | Outbox en la misma transacción e inbox idempotente por `eventId` | HU-23, 5 criterios |
| OB-05 | Que cada persona haga solo lo que su rol permite | Roles de M6 sobre el rol de M1; 401 y 403 verificados | HU-29, 7 criterios |
| OB-06 | Que la operación sea medible | Cuatro familias de indicadores | HU-28, 6 criterios |
| OB-07 | Que el módulo sea defendible ante una auditoría | Auditoría de solo agregado con actor, origen y destino | HU-31, criterio 12 |

Medidas de calidad:

| Medida | Valor | Umbral | Fuente |
|---|---|---|---|
| Historias de usuario con criterios | 33 | 33 | QA 02 |
| Criterios ejecutados y pasados | 177 de 181 (97,8 %) | ≥ 95 % | QA 01 §5 |
| Criterios fallados | 0 | 0 en las Must | QA 01 §5 |
| Tests automatizados | 3474 | — | QA 05 §2 |
| Cobertura de líneas | 98,71 % | ≥ 80 % en negocio | QA 05 §3 |
| Mutation score | 76,11 % | ≥ 60 % | QA 05 §5 |
| Carga: p95, 50 usuarios, 5 min | 32,84 ms | < 500 ms | QA 05 §2.1 |
| Error en carga | 0,00 % | < 1 % | QA 05 §2.1 |
| Pipeline de CI | 2 min 23 s | ≤ 15 min | QA 05 §4 |
| Defectos abiertos | 0 bloqueantes, 0 críticos, 0 mayores, 2 menores | ≤ 3 mayores | QA 01 §5 |

Hay 4 criterios sin test automatizado (QA 01 §5, que remite a la matriz de trazabilidad). La mutation del frontend tiene medición completa: 66,51 % con umbral de 65 (QA 01 §2, DEF-35 cerrado).

## 4. Alcance

### 4.1 Dentro del alcance

| Área | Qué incluye |
|---|---|
| Catálogos | Tipos de servicio, zonas operativas, recorridos con paradas, frecuencias, cuadrillas, vehículos, sitios de disposición |
| Programación | Servicios sobre un recorrido o un punto; asignación de cuadrilla y vehículo; reprogramación y cancelación con motivo |
| Ejecución en campo | Inicio, suspensión, reanudación, cierre; resultado por zona; avisos de demora; registro de residuos; evidencia |
| Contenedores y puntos verdes | Desborde, daño, vaciado, reparación, reubicación, retiro; puntos verdes de entrega voluntaria |
| Arbolado | Censo, relevamientos de riesgo, poda, extracción, plantación, tratamiento |
| Espacios verdes | Alta, edición y baja; programación de riego y corte como servicios |
| Control ambiental | Expediente, inspección, acta de constatación, sanción de M4, cierre |
| Derivaciones | Pedido de reparación a M3; pedido de corte de calle a M7 |
| Vecino | Avance a M2; consulta pública sin login |
| Indicadores | Cobertura, cumplimiento, incidencias, residuos |
| Seguridad y trazabilidad | Roles, pertenencia de Campo, auditoría, límite de tasa |

### 4.2 Fuera de alcance

| Ítem | Motivo | Fuente |
|---|---|---|
| Alta del reclamo del vecino en M6 (HU-34) | El ticket es de M2 | QA 02 |
| Cobro y gestión de multas (HU-35) | Lo resuelve M4 | QA 02 |
| App móvil nativa para cuadrillas (HU-36) | El frontend web es responsive | QA 02 |
| Generación automática de servicios desde las frecuencias | No se implementó | entidades/configuracion-y-recursos |
| Marcado automático de demora por tolerancia | No se implementó | Documento de Alcance |
| Cálculo de SLA con el vecino | El plazo lo fija M2 | Documento de Alcance |
| Listado de denuncias por ciudadano o rol de ciudadano en M6 | El ciudadano no opera en M6 | Documento de Alcance |
| Registro propio de incidencias de espacios verdes | Se deriva a M3 como reparación | Documento de Alcance |
| Eventos de M1, M5 y M8 | M6 no consume ninguno | eventos/consumidos |
| Login y contraseñas | El JWT lo emite M1 | ADR-004 |
| Pruebas internas de otros módulos | Son de cada grupo | QA 01 §1 |
| Release hardening completo, con observabilidad y promoción (HU-32) y e2e deterministas del frontend (HU-33) | Prioridad Could, abiertas en el frontend | QA 02 |

## 5. Interesados y roles

### 5.1 Interesados

| Persona | Rol |
|---|---|
| Facundo Iriarte | Product Owner |
| Benjamin Martinez | Desarrollador |
| Nicolas Llousas | Desarrollador |
| Bautista Castro | DevOps |
| Santiago Peralta | QA |
| Miqueas Quintieri | Scrum Master |

### 5.2 Roles del sistema

El rol de M1 llega en el JWT (uno solo por usuario, sin área). M6 lo adapta con una tabla local de asignaciones que administra un `M6_ADMIN`. Los roles efectivos son lo asignado en M6 más lo que el rol de M1 permite (ADR-008).

| Rol de M6 | Lado | Qué hace |
|---|---|---|
| `M6_ADMIN` | Oficina | Administra catálogos, cuadrillas, roles, eventos; autoriza extracciones |
| `M6_OFICINA_OPERACIONES` | Oficina | Programa, asigna, reprograma y cancela servicios; gestiona inventario |
| `M6_OFICINA_AMBIENTAL` | Oficina | Tramita expedientes y emite actas |
| `M6_CAMPO_CUADRILLA` | Campo | Ejecuta servicios, reporta contenedores, carga relevamientos |
| `M6_CAMPO_INSPECTOR` | Campo | Abre expedientes de oficio y cierra inspecciones |
| `M6_AUDITOR` | Solo lectura | Consulta, auditoría y eventos |

| Rol de M1 | Roles de M6 asignables |
|---|---|
| `CIUDADANO`, `MESA_ENTRADAS`, `SERVICIO` | Ninguno |
| `ADMINISTRATIVO` | Operaciones, Ambiental, Cuadrilla, Inspector |
| `RESPONSABLE_AREA` | Los de `ADMINISTRATIVO` y `M6_ADMIN` |
| `AUDITOR` | `M6_AUDITOR` |
| Cualquier otro | Ninguno |

Reglas de negocio sobre roles: Oficina y Campo son excluyentes en un mismo usuario; no se puede quitar el último `M6_ADMIN`; un token de ciudadano recibe 403 en todo endpoint no público.

## 6. Requisitos de negocio

Cada requisito (RN) lleva la prioridad MoSCoW más alta de las historias de usuario (HU) que lo implementan. Las HU y su prioridad están en `docs/QA/02-historias-y-criterios.md`.

### 6.1 Requisitos

| RN | Requisito de negocio | MoSCoW |
|---|---|---|
| RN-01 | Mantener los catálogos operativos: zonas, recorridos, tipos de servicio, frecuencias, cuadrillas, vehículos y sitios de disposición | Must |
| RN-02 | Programar un servicio sobre un recorrido o un punto, con fecha, franja y cuadrilla | Must |
| RN-03 | Reprogramar, suspender y cancelar servicios con motivo, sin perder el historial | Must |
| RN-04 | Ejecutar el servicio en campo con resultado por zona y cierre | Must |
| RN-05 | Respaldar el trabajo con evidencia fotográfica y reintento seguro | Must |
| RN-06 | Registrar residuos recolectados: volumen, peso y destino | Must |
| RN-07 | Gestionar contenedores: desborde, daño, vaciado, reparación y reubicación | Must |
| RN-08 | Llevar el censo de arbolado, los relevamientos de riesgo y las podas y extracciones | Must |
| RN-09 | Administrar espacios verdes y puntos verdes | Must |
| RN-10 | Derivar reparaciones a Obras Públicas y pedir cortes de calle a Tránsito | Must |
| RN-11 | Recibir denuncias ambientales y asignarlas a una inspección | Must |
| RN-12 | Registrar la inspección y emitir el acta de constatación | Must |
| RN-13 | Registrar la sanción de M4 y cerrar el expediente, también por vencimiento | Must |
| RN-14 | Pedirle información adicional al vecino sobre su denuncia | Could |
| RN-15 | Mantener informado al vecino a través de M2 | Must |
| RN-16 | Permitir la consulta pública sin login de denuncia, servicios y puntos verdes | Must |
| RN-17 | Medir la operación con un tablero de indicadores | Must |
| RN-18 | Operar con identidad de M1 y permisos por rol | Must |
| RN-19 | Integrarse por eventos sin perder ni duplicar mensajes | Must |
| RN-20 | Proteger los datos y la operación según la Clase 11 de seguridad | Must |
| RN-21 | Auditar quién hizo qué y cuándo sobre los datos de dominio | Must |
| RN-22 | Presentar listados y fechas de forma legible y uniforme | Should |
| RN-23 | Operar con garantías de producción: salud, accesibilidad, pruebas deterministas | Could |

### 6.2 Tabla RN → HU

| RN | HU que lo implementan |
|---|---|
| RN-01 | HU-02, HU-03 |
| RN-02 | HU-05 |
| RN-03 | HU-04, HU-06 |
| RN-04 | HU-07 |
| RN-05 | HU-08 |
| RN-06 | HU-07, HU-28 |
| RN-07 | HU-11 |
| RN-08 | HU-10, HU-12 |
| RN-09 | HU-13 |
| RN-10 | HU-09 |
| RN-11 | HU-14, HU-15, HU-22, HU-25 |
| RN-12 | HU-16 |
| RN-13 | HU-17 |
| RN-14 | HU-18 |
| RN-15 | HU-21, HU-22, HU-25 |
| RN-16 | HU-27 |
| RN-17 | HU-28 |
| RN-18 | HU-29, HU-30 |
| RN-19 | HU-19, HU-20, HU-23, HU-24 |
| RN-20 | HU-31 |
| RN-21 | HU-31 |
| RN-22 | HU-01, HU-26 |
| RN-23 | HU-32, HU-33 |


## 7. Reglas de negocio

### 7.1 Servicios

| ID | Regla | Fuente |
|---|---|---|
| RB-01 | Un servicio es `ROUTE` (secuencia de zonas) o `POINT` (un bien o ubicación) y nunca tiene la lista de zonas vacía | entidades/service |
| RB-02 | Las zonas se copian al programar y no se recalculan al editar el recorrido | entidades/service |
| RB-03 | Un servicio nace en `SCHEDULED` | HU-05 |
| RB-04 | La cuadrilla o el vehículo ya tomados en una franja que se pisa no bloquean: sin justificación (10 a 500 caracteres) da 409, con ella se asigna y queda registrado quién y cuándo | entidades/service, HU-05 |
| RB-05 | Una cuadrilla que no trabaja en la zona ese día o con especialidad distinta al tipo genera el mismo aviso | HU-05 |
| RB-06 | Una franja horaria ausente se trata como todo el día | entidades/service |
| RB-07 | Solo la cuadrilla del servicio (líder o integrante) lo inicia, suspende, reanuda, cierra y le registra resultados | endpoints.md |
| RB-08 | El estado final lo calcula el sistema: `COMPLETED` si todo se atendió, `PARTIALLY_COMPLETED` si alguna zona quedó `PARTIAL` o `NOT_SERVICED` | HU-07 |
| RB-09 | Una zona no atendida exige motivo; una zona atendida no lleva motivo | HU-07 |
| RB-10 | La demora es un aviso, no un estado; el aviso nuevo reemplaza al vigente | entidades/service |
| RB-11 | Cancelar y reprogramar exigen motivo; un servicio en curso no se cancela | HU-06 |
| RB-12 | Una alerta climática `HIGH` o `CRITICAL` con ventana y zonas reprograma los servicios `SCHEDULED` afectados | HU-06 |
| RB-13 | Un corte de calle rechazado por M7 deja el servicio en `RESCHEDULED`, no lo cancela | HU-06 |
| RB-14 | La frecuencia no genera servicios y no puede superponerse con otra del mismo recorrido, tipo y turno | entidades/configuracion-y-recursos |
| RB-15 | Las fechas se interpretan en el día argentino (UTC-3) | HU-06, HU-14, HU-26 |
| RB-16 | La baja es lógica en catálogos e inventarios: el registro sigue existiendo inactivo | endpoints.md |

### 7.2 Residuos y evidencia

| ID | Regla | Fuente |
|---|---|---|
| RB-17 | Los residuos se registran con tipo, volumen, peso y sitio de disposición | entidades/service |
| RB-18 | La evidencia es JPEG, PNG, WebP o PDF, de hasta 10 MB, con firma de bytes verificada | HU-08, código |
| RB-19 | La evidencia no conserva EXIF ni GPS | HU-08 |
| RB-20 | Una subida repetida con la misma `Idempotency-Key` devuelve la existente | HU-08 |

### 7.3 Contenedores y arbolado

| ID | Regla | Fuente |
|---|---|---|
| RB-21 | Un contenedor pasa por `ACTIVE`, `OVERFLOWED`, `DAMAGED`, `UNDER_REPAIR`, `RELOCATING` y `REMOVED`; `REMOVED` no tiene salida y solo se llega desde `DAMAGED` | entidades/container |
| RB-22 | Cada alta y transición deja una fila de historial y de auditoría con el actor | HU-11 |
| RB-23 | Pasar a `DAMAGED` avisa a M3; `requiresPublicWorks` marca el componente que corresponde a Obras Públicas | entidades/container |
| RB-24 | Cerrar el servicio que atiende un contenedor lo lleva a `ACTIVE` según su estado; un cierre parcial no lo transiciona | entidades/container |
| RB-25 | Un relevamiento con riesgo `HIGH` o `CRITICAL` exige tipo de riesgo y avisa a M3; con `LOW` o `MEDIUM` solo se guarda | HU-12 |
| RB-26 | Toda intervención debe estar `AUTHORIZED` antes de asociarse a un servicio `POINT` | entidades/tree-intervention |
| RB-27 | La extracción exige justificación y la autoriza un `M6_ADMIN`; quien la solicita no la decide | entidades/tree-intervention, HU-12 |
| RB-28 | El corte de calle de una intervención se pide aparte y exige la intervención `AUTHORIZED` | HU-09 |

### 7.4 Control ambiental

| ID | Regla | Fuente |
|---|---|---|
| RB-29 | M2 es dueño del ticket; M6 abre el expediente solo con un `ROUTED` dirigido a M6 | eventos/consumidos/ticketUpdated |
| RB-30 | El inspector abre expedientes de oficio sin `ticketId`; Oficina Ambiental o Admin pueden asociar uno | HU-15 |
| RB-31 | Solo el inspector asignado cierra la inspección; sin asignado, cualquier inspector | endpoints.md |
| RB-32 | El acta es inmutable: un error se corrige emitiendo otra | entidades/control-ambiental |
| RB-33 | El acta tiene numeración correlativa por año y fija un plazo de vencimiento | HU-16 |
| RB-34 | El acta se deriva a M4 solo si identifica un establecimiento; si no, se registra y el expediente cierra de nuestro lado | entidades/control-ambiental |
| RB-35 | `suggestedAction` no es vinculante: la decisión es de M4 | entidades/control-ambiental |
| RB-36 | La sanción de M4 llega con el id del acta y cierra el expediente | HU-17 |
| RB-37 | M4 no publica nada cuando no corresponde castigo: el expediente `NOTICE_ISSUED` se cierra solo al vencer el plazo (30 días por defecto, `SANCTION_DEADLINE_DAYS`) | entidades/environmental-report, código |
| RB-38 | El barrido de vencimiento corre cada hora y al arrancar | entidades/environmental-report |
| RB-39 | Con una solicitud de información pendiente no se puede derivar, desestimar ni cerrar | HU-18 |
| RB-40 | La reapertura llega por M2 (`REOPENED`); un expediente `SANCTIONED` no se reabre | entidades/environmental-report |
| RB-41 | Un evento de M2 más viejo que el último aplicado a ese dato no lo pisa; se ordena por `data.updatedAt` | eventos/consumidos/ticketUpdated |
| RB-42 | Lo interno (hallazgos, checklist, inspector, contenido del acta) nunca sale hacia M2 ni al portal público | entidades/control-ambiental |

### 7.5 Cortes de calle y reparaciones

| ID | Regla | Fuente |
|---|---|---|
| RB-43 | Un corte `REQUESTED` pasa a `APPROVED`, `REJECTED` o `ENDED` según M7 | HU-09 |
| RB-44 | Un corte `APPROVED` cuya ventana venció hace más de 6 horas sin aviso de M7 pasa a `EXPIRED` | HU-09, código |
| RB-45 | Un pedido de reparación abierto no se duplica y exige un origen que lo justifique | HU-09 |

### 7.6 Indicadores y portal

| ID | Regla | Fuente |
|---|---|---|
| RB-46 | La cobertura cuenta pares (servicio, zona), no servicios | README, HU-28 |
| RB-47 | Un reclamo abierto está vencido a los 5 días hábiles (`INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS`) | HU-28, código |
| RB-48 | Si no hay base de cálculo, el indicador es `null`, no 0 | HU-28 |
| RB-49 | El portal público muestra siete etapas, sin identidad del inspector ni contenido del acta | HU-27 |
| RB-50 | El portal limita a 20 consultas por minuto el seguimiento y a 60 el resto, por IP | HU-27, código |

### 7.7 Seguridad y trazabilidad

| ID | Regla | Fuente |
|---|---|---|
| RB-51 | Solo personal municipal opera; el ciudadano recibe 403 | endpoints.md |
| RB-52 | Una escritura sin rol declarado se rechaza para todos | ADR-008 |
| RB-53 | La auditoría es de solo agregado, se escribe en la misma transacción y no se purga | entidades/auditoria |
| RB-54 | Leer un acta o una resolución de M4 deja una fila `READ`; si no se puede auditar, la lectura falla | entidades/auditoria |
| RB-55 | Un evento saliente que falla 5 veces queda `FAILED` y solo un `M6_ADMIN` lo reencola | HU-23, código |

## 8. Procesos de negocio principales

### 8.1 Servicios urbanos (recolección, limpieza, riego y corte)

1. Oficina de Operaciones mantiene los catálogos de zonas, recorridos, tipos, cuadrillas y vehículos.
2. Oficina programa el servicio sobre un recorrido o un punto, con fecha, franja y cuadrilla.
3. El sistema avisa si la cuadrilla o el vehículo chocan con otro servicio o no encajan con la zona; Oficina justifica o elige otra.
4. Si el servicio nació de un reclamo, M2 recibe la fecha y la franja.
5. El líder de la cuadrilla inicia el servicio el día programado.
6. La cuadrilla informa el resultado de cada zona, los residuos y la evidencia, y avisa demoras.
7. El líder cierra el servicio; el sistema calcula `COMPLETED` o `PARTIALLY_COMPLETED`.
8. Si hubo cambios (alerta climática, corte rechazado), el servicio pasa a `RESCHEDULED` y Oficina confirma la fecha nueva o lo cancela.

### 8.2 Contenedores

1. La cuadrilla reporta un desborde o un daño de un contenedor `ACTIVE`.
2. En el daño, el sistema avisa a M3 (`containerDamaged`) con la marca de obra pública.
3. Oficina programa el vaciado o inicia la reparación; el contenedor pasa a `UNDER_REPAIR`.
4. Al cerrar el servicio o completar la reparación, el contenedor vuelve a `ACTIVE`.
5. Si no admite reparación, Oficina lo retira (`REMOVED`) desde `DAMAGED`. También puede reubicarlo.

### 8.3 Arbolado

1. La cuadrilla carga un relevamiento con estado sanitario y riesgo.
2. Con riesgo `HIGH` o `CRITICAL`, el sistema avisa a M3 (`treeRiskDetected`).
3. Oficina solicita una intervención (poda, extracción, plantación, tratamiento).
4. Las podas se autorizan directo; la extracción se envía a autorización y la decide un `M6_ADMIN`.
5. Una intervención autorizada se asocia a un servicio `POINT` que la ejecuta.
6. Si requiere cortar la calle, Oficina pide el corte a M7 sobre la intervención autorizada.

### 8.4 Control ambiental y expedientes

1. M2 deriva una denuncia (`ROUTED`) o el inspector detecta una infracción de oficio; se abre el expediente en `RECEIVED`.
2. Oficina Ambiental toma el expediente (`UNDER_REVIEW`) y decide: inspeccionar, derivar a otra área o desestimar.
3. Si inspecciona, programa la inspección sobre un servicio `POINT` con cuadrilla (`INSPECTION_SCHEDULED`).
4. El inspector asignado cierra la inspección con resultado: sin infracción, infracción o no concluyente.
5. Con infracción, Oficina Ambiental emite el acta; el expediente pasa a `NOTICE_ISSUED` y, si hay establecimiento, se deriva a M4.
6. M4 devuelve la multa o la clausura; el expediente pasa a `SANCTIONED` y se cierra.
7. Si M4 no responde antes del plazo, el expediente se cierra solo.
8. Si hace falta, Oficina pide información al vecino por M2 mientras revisa.

### 8.5 Denuncias del vecino

1. El vecino presenta el reclamo en M2; M6 no interviene en el alta.
2. M2 lo deriva a M6; M6 abre el expediente y avisa que está en análisis.
3. A medida que avanza, M6 publica a M2 el estado: en análisis, rechazada, devuelta, iniciada o resuelta.
4. El vecino consulta sin login con el identificador del reclamo y ve una de siete etapas, el tipo, la dirección y las fechas.
5. Si el vecino rechaza la solución, M2 reabre y el expediente vuelve a `UNDER_REVIEW`.

### 8.6 Cuadrillas y asignación de zonas

1. Un `M6_ADMIN` da de alta la cuadrilla con tipo, especialidad, líder e integrantes; los ids de personal se validan con M1.
2. Un `M6_ADMIN` o la Oficina de Operaciones asigna la cuadrilla a una zona por un período.
3. Al programar un servicio, el sistema compara la zona efectiva de la cuadrilla y su especialidad con el servicio.
4. Solo líder e integrantes ejecutan los servicios de su cuadrilla.

## 9. Integraciones con otros módulos

| Módulo | Qué recibe M6 | Qué envía M6 | Por qué, en términos de negocio |
|---|---|---|---|
| M1 | JWT de usuario; consulta de identidad por REST | — | Saber quién es la persona y validar a los integrantes de las cuadrillas |
| M2 | `ticketUpdated` | `updateTicketStatus` | Recibir las denuncias derivadas y devolver el avance al vecino |
| M3 | `workOrderScheduled`, `workOrderCompleted` | `containerDamaged`, `treeRiskDetected`, `infrastructureRepairRequested` | Pasar a Obras Públicas lo que excede a M6 y saber cuándo se resolvió |
| M4 | `commercialFineGenerated`, `closureUpdate` | `environmentalViolationDetected` | Que Habilitaciones sancione sobre el acta y devuelva la resolución |
| M7 | `streetClosureApproved`, `streetClosureRejected`, `streetClosureEnded` | `streetClosureRequested` | Pedir y conocer la disponibilidad de la calle antes de trabajar |
| M9 | Entrega del bus; catálogo de barrios y comunas | Publicación al exchange del Core | Transporte de eventos y datos maestros compartidos |

Notas por contraparte (fichas de `docs/integracion/`):

- M1: hosteado, con login real verificado el 3/11. La consulta de identidad es REST con un token de módulo del Core, solo lectura (ADR-009).
- M2: M6 solo escucha `ticketUpdated`. De sus trece tipos de actualización, seis disparan acción y siete se ignoran a propósito.
- M3: el contrato se cerró el 5/10. `containerDamaged` y `treeRiskDetected` son avisos sin respuesta; solo la reparación tiene respuesta.
- M4: la búsqueda de establecimientos sigue abierta (#500); el acta no se deriva sin `establishmentId`. Plan B: que el inspector lo cargue a mano.
- M7: el cruce más limpio. Es el único consumidor de `streetClosureRequested`.
- M9: exchange `muni.inbox` y cola `q.ambiente` creados por el Core; M6 solo los verifica. M6 se registra con 6 publicaciones y 8 suscripciones.
- M5 y M8: sin intercambio. `weatherAlertIssued` se simula dentro de M6 y `notificationSent` no tiene publicador ni handler.

Seis eventos publicados y diez documentados como consumidos (nueve con handler, ocho suscriptos en el Core). El detalle está en la sección 6 de la documentación funcional.

## 10. Supuestos, restricciones y dependencias

### 10.1 Supuestos

| ID | Supuesto | Fuente |
|---|---|---|
| SU-01 | M2 entrega las denuncias de M6 con `responsibleAreaId` de M6 | eventos/consumidos/ticketUpdated |
| SU-02 | M1 mantiene el contrato del JWT: HMAC con secreto compartido, claims `iss`, `sub`, `sub_type`, `rol`, `typ`, TTL de 15 minutos | ADR-004 |
| SU-03 | El Core entrega los eventos con reintentos, sin garantizar el orden | eventos/consumidos |
| SU-04 | M4 no publica nada cuando decide que no corresponde castigo | entidades/control-ambiental |
| SU-05 | Los nombres de personal cargados a mano en cuadrillas no llevan datos sensibles | endpoints.md |
| SU-06 | El plan gratuito de Render duerme el servicio; la demo se ensaya despertando `/health` | QA 01 §6, R7 |

### 10.2 Restricciones

| ID | Restricción | Fuente |
|---|---|---|
| RE-01 | M6 se comunica con otros módulos solo por eventos, salvo la consulta de identidad a M1 | ADR-006, ADR-009 |
| RE-02 | Base propia, sin acceso directo a las bases de otros módulos | AGENTS.md |
| RE-03 | Arquitectura de tres capas por recurso | AGENTS.md |
| RE-04 | Backend con Node.js, NestJS, Prisma y PostgreSQL; bus RabbitMQ | ADR-001, ADR-006 |
| RE-05 | Sobre de evento del Core, con campos fijos y sin extras | eventos/publicados |
| RE-06 | Backend desplegado en Render con base en Supabase; frontend en Vercel | QA 01 §1 |
| RE-07 | Cobertura mínima del 90 % global exigida por el repo | AGENTS.md |

### 10.3 Dependencias abiertas

Del tablero `docs/bloqueantes.md` (revisión del 15/11/2026): 4 abiertos, ninguno bloqueante.

| Con quién | Qué falta |
|---|---|
| M3 | Pendientes del Core que M3 anota |
| M3 | Validación formal de los schemas Draft 2020-12 |
| M9 y M2 | Decisiones del Core sobre validación de `format`, identidad por AMQP, clave de barrio y dueño de `updateTicketStatus` |
| M4 | Contrato de la búsqueda de establecimientos |

## 11. Riesgos de negocio

Probabilidad (P) e impacto (I) de 1 a 3; prioridad = P × I (QA 01 §6).

| ID | Riesgo | P | I | Prio. |
|---|---|---|---|---|
| R3 | M1 devuelve 401 por secreto distinto o claims faltantes | 3 | 3 | 9 |
| R7 | Arranque en frío de Render o de M1 durante la demo | 3 | 3 | 9 |
| R4 | Una transición inválida acepta una acción que debería dar 409 | 2 | 3 | 6 |
| R5 | Un rol o una cuadrilla ajena ejecuta lo que no le corresponde | 2 | 3 | 6 |
| R6 | Un mensaje duplicado se aplica dos veces | 2 | 3 | 6 |
| R8 | Regresión de contrato con otros módulos | 2 | 3 | 6 |
| R2 | El Core o un externo no responde; espera de 5 s y sin circuit breaker | 2 | 2 | 4 |
| R10 | Archivo malicioso o con metadatos personales | 2 | 2 | 4 |
| R14 | Dependencia con vulnerabilidad | 2 | 2 | 4 |
| R21 | Un cliente sin `If-Match` o sin parser de Problem Details | 2 | 2 | 4 |

Riesgos de integración que salpican a M6 (`docs/integracion/riesgos.md`):

| Riesgo | Estado |
|---|---|
| Tormenta de eventos técnicos entre módulos | Resuelto el 20/10: M9 da de baja esos eventos |
| Colisión de nombres de eventos con M4 | Abierto; los eventos de M6 van prefijados |
| Adjuntos con formas distintas entre módulos | M6 se alineó a la forma de M2 hacia M2; hacia M2 aún no se mandan adjuntos |
| Replay de un `eventId` viejo tras purgar el inbox | Aceptado el 5/11; purga a 180 días por defecto |
| Balde de límite de tasa compartido entre operadores | Aceptado el 16/11 |
| M2 no resuelve la derivación | Plan B: detección de oficio, que no depende de nadie |

Defectos abiertos con impacto en el cierre de HU Must: DEF-38 (Swagger UI público en producción y evidencia servida por URL pública del bucket), según `docs/QA/02-historias-y-criterios.md`.

## 12. Criterios de aceptación del producto

El producto se acepta cuando:

1. Las 33 HU del alcance tienen sus criterios de aceptación ejecutados, con 0 fallos en las HU Must (`docs/QA/02-historias-y-criterios.md`).
2. Se cumplen los criterios de salida del plan de pruebas: cobertura, mutation, defectos abiertos, carga, calidad estática y seguridad (`docs/QA/01-plan-y-estrategia.md` §5).
3. El paquete de pruebas está ejecutado y documentado: matriz de trazabilidad, especificación de casos, informe de ejecución, registro de defectos e informe de seguridad (`docs/QA/03` a `07`).
4. Los contratos coinciden con el código: `docs/api/openapi.json` al día, schemas de eventos validados y roles por endpoint generados desde el código.

## Fuentes

| Tema | Archivo |
|---|---|
| Qué hace el módulo, glosario, indicadores | `docs/README.md` |
| Alcance y funcionalidades | `docs/documentacion/fuentes/alcance-entregable.md` (copia local, ignorada por git) y `docs/Documento de Alcance - Grupo 04 (Modulo 6).pdf` |
| Estados y modelo | `docs/entidades/*.md` |
| Valores cerrados | `docs/enumeraciones.md` |
| Eventos | `docs/eventos/publicados/README.md`, `docs/eventos/consumidos/README.md` |
| Endpoints y roles | `docs/api/endpoints.md` |
| Decisiones | `docs/decisiones/adr-001` a `adr-017` (en particular ADR-004, 006, 008, 009, 010) |
| Historias de usuario y criterios | `docs/QA/02-historias-y-criterios.md` |
| Plan, riesgos y roles del equipo | `docs/QA/01-plan-y-estrategia.md` |
| Cifras de ejecución | `docs/QA/05-informe-ejecucion.md` |
| Manual de usuario | `docs/QA/manual-de-usuario.md` |
| Seed de demo | `docs/seed.md` |
| Integración | `docs/bloqueantes.md`, `docs/integracion/` (m1, m2, m3, m4, m7, m9, riesgos) |
| Código (valores por defecto y tablas de transición) | `src/config/env.validation.ts`, `src/modules/*/` |
