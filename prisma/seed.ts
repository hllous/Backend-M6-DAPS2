import {
  ContainerStatus,
  ContainerType,
  CrewType,
  DamageType,
  DelayType,
  DisposalSiteType,
  EnvironmentalReportStatus,
  EnvironmentalReportType,
  GreenSpaceType,
  InspectionNextStep,
  InspectionOutcome,
  NotServicedReason,
  PrismaClient,
  RepairDamageType,
  RepairRequestStatus,
  RiskLevel,
  RiskType,
  SanctionDecision,
  ServiceCategory,
  ServiceMode,
  ServiceOrigin,
  ServiceStatus,
  Severity,
  Shift,
  StreetClosureRequestStatus,
  StreetClosureType,
  SuggestedAction,
  TreeHealthStatus,
  TreeInterventionStatus,
  TreeInterventionType,
  VehicleType,
  ViolationType,
  WasteType,
  ZoneResultStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Seed del sector norte de la Ciudad Autónoma de Buenos Aires.
 *
 * Cubre cuatro barrios reales —Belgrano, Palermo, Recoleta y Retiro— con sus
 * calles, plazas y avenidas verdaderas. La geografía real importa: con
 * "Av. Siempreviva 1000" no se ve si el ruteo por zona tiene sentido, y con
 * direcciones reales sí. Palermo tiene unas 17 km² y Retiro 1,4: eso cambia
 * cómo se arma un recorrido, y es lo que este seed deja probar.
 *
 * **Idempotente.** Los catálogos van por upsert sobre su código único, así que
 * se puede correr las veces que haga falta. Lo transaccional —servicios,
 * expedientes, derivaciones— se crea solo si su tabla está vacía: son datos de
 * demostración, no catálogo, y no tienen clave natural por la que upsertear.
 *
 * **Los `neighborhoodId` son placeholders.** El catálogo de barrios es de M9 y
 * sigue sin publicarse (docs/bloqueantes.md), así que acá se usan slugs
 * legibles con prefijo `caba-`. Cuando M9 publique, se reemplazan por sus IDs:
 * el prefijo hace que sean fáciles de encontrar.
 */

// ════════════════════════════════════════════════════════════
// FECHAS
// ════════════════════════════════════════════════════════════

/**
 * Las fechas van relativas a hoy, no fijas.
 *
 * Un seed con fechas fijas envejece: a los dos meses "el servicio de mañana"
 * quedó en el pasado y la agenda aparece vacía. Con offsets siempre hay
 * servicios cerrados atrás, uno en curso hoy y trabajo por delante.
 */
const HOY = new Date();

/** Medianoche UTC del día a `n` días de hoy. Para las columnas `@db.Date`. */
function dia(n: number): Date {
  const d = new Date(Date.UTC(HOY.getUTCFullYear(), HOY.getUTCMonth(), HOY.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Un instante del día `n`, a la hora indicada. Para los campos `DateTime`. */
function momento(n: number, h: number, m = 0): Date {
  const d = dia(n);
  d.setUTCHours(h, m, 0, 0);
  return d;
}

/** Hora suelta, para las columnas `@db.Time()` de la ventana horaria. */
function hora(h: number, m = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
}

// ════════════════════════════════════════════════════════════
// CATÁLOGOS
// ════════════════════════════════════════════════════════════

const SERVICE_TYPES = [
  {
    code: 'REC-DOM',
    name: 'Recolección domiciliaria',
    category: ServiceCategory.WASTE_COLLECTION,
    mode: ServiceMode.ROUTE,
    requiresVehicle: true,
  },
  {
    code: 'REC-REC',
    name: 'Recolección de reciclables',
    category: ServiceCategory.WASTE_COLLECTION,
    mode: ServiceMode.ROUTE,
    requiresVehicle: true,
  },
  {
    code: 'REC-VOL',
    name: 'Retiro de voluminosos y restos de obra',
    category: ServiceCategory.WASTE_COLLECTION,
    mode: ServiceMode.POINT,
    requiresVehicle: true,
  },
  {
    code: 'BAR-MEC',
    name: 'Barrido mecánico',
    category: ServiceCategory.STREET_CLEANING,
    mode: ServiceMode.ROUTE,
    requiresVehicle: true,
  },
  {
    code: 'BAR-MAN',
    name: 'Barrido manual',
    category: ServiceCategory.STREET_CLEANING,
    mode: ServiceMode.ROUTE,
    requiresVehicle: false,
  },
  {
    code: 'HIG-LAV',
    name: 'Lavado e hidrolavado de veredas',
    category: ServiceCategory.STREET_CLEANING,
    mode: ServiceMode.ROUTE,
    requiresVehicle: true,
  },
  {
    code: 'CONT-VAC',
    name: 'Vaciado de contenedor',
    category: ServiceCategory.CONTAINERS,
    mode: ServiceMode.POINT,
    requiresVehicle: true,
  },
  {
    code: 'CONT-LAV',
    name: 'Lavado de contenedores',
    category: ServiceCategory.CONTAINERS,
    mode: ServiceMode.POINT,
    requiresVehicle: true,
  },
  {
    code: 'ARB-POD',
    name: 'Poda de arbolado',
    category: ServiceCategory.TREES,
    mode: ServiceMode.POINT,
    requiresVehicle: true,
  },
  {
    code: 'ARB-CENSO',
    name: 'Censo de arbolado urbano',
    category: ServiceCategory.TREES,
    mode: ServiceMode.ROUTE,
    requiresVehicle: false,
  },
  {
    code: 'EV-RIEGO',
    name: 'Riego de espacio verde',
    category: ServiceCategory.GREEN_SPACES,
    mode: ServiceMode.POINT,
    requiresVehicle: true,
  },
  {
    code: 'EV-MANT',
    name: 'Mantenimiento de espacio verde',
    category: ServiceCategory.GREEN_SPACES,
    mode: ServiceMode.POINT,
    requiresVehicle: false,
  },
  {
    code: 'AMB-INSP',
    name: 'Inspección ambiental',
    category: ServiceCategory.ENVIRONMENTAL_CONTROL,
    mode: ServiceMode.POINT,
    requiresVehicle: false,
  },
];

/**
 * Zonas operativas: nuestra unidad de trabajo, que agrupa barrios de M9.
 *
 * "Zona operativa" (la nuestra) y "zona" (la de M9) son la misma palabra para
 * cosas distintas — está anotado como pendiente en docs/bloqueantes.md.
 *
 * **Palermo va partido en tres.** Es el barrio más grande de la Ciudad: más
 * que Belgrano, Recoleta y Retiro juntos. Una cuadrilla no lo cubre en un
 * turno, así que se parte con criterio operativo real — la trama gastronómica
 * de Hollywood y Las Cañitas, la comercial de Soho, y el corredor de parques
 * sobre Figueroa Alcorta, que es mantenimiento de espacios verdes y no
 * recolección domiciliaria. Belgrano va partido en dos por lo mismo, más leve:
 * Belgrano C es alta densidad y Belgrano R es casi todo casa baja.
 */
const ZONES = [
  {
    code: 'Z-BEL-C',
    name: 'Belgrano C y Barrio Chino',
    neighborhoods: ['caba-belgrano-c', 'caba-bajo-belgrano', 'caba-barrio-chino'],
  },
  { code: 'Z-BEL-R', name: 'Belgrano R', neighborhoods: ['caba-belgrano-r'] },
  {
    code: 'Z-PAL-H',
    name: 'Palermo Hollywood y Las Cañitas',
    neighborhoods: ['caba-palermo-hollywood', 'caba-las-canitas'],
  },
  {
    code: 'Z-PAL-S',
    name: 'Palermo Soho y Villa Freud',
    neighborhoods: ['caba-palermo-soho', 'caba-villa-freud'],
  },
  {
    code: 'Z-PAL-P',
    name: 'Palermo Parque y Botánico',
    neighborhoods: ['caba-palermo-chico', 'caba-palermo-botanico', 'caba-bosques-de-palermo'],
  },
  { code: 'Z-REC', name: 'Recoleta', neighborhoods: ['caba-recoleta'] },
  { code: 'Z-RET', name: 'Retiro y Catalinas', neighborhoods: ['caba-retiro', 'caba-catalinas'] },
];

/**
 * Recorridos, con las zonas en el orden real en que las haría un camión:
 * de norte a sur siguiendo los corredores de Cabildo, Santa Fe y Libertador.
 */
const ROUTES = [
  {
    code: 'R-REC-N',
    name: 'Recolección domiciliaria — corredor Cabildo (Belgrano y Palermo norte)',
    stops: [
      { zone: 'Z-BEL-R', min: 75 },
      { zone: 'Z-BEL-C', min: 110 },
      { zone: 'Z-PAL-H', min: 95 },
    ],
  },
  {
    code: 'R-REC-S',
    name: 'Recolección domiciliaria — corredor Santa Fe (Palermo sur, Recoleta y Retiro)',
    stops: [
      { zone: 'Z-PAL-S', min: 105 },
      { zone: 'Z-REC', min: 120 },
      { zone: 'Z-RET', min: 80 },
    ],
  },
  {
    code: 'R-RECI',
    name: 'Recolección de reciclables — Comunas 2, 13 y 14',
    stops: [
      { zone: 'Z-BEL-C', min: 70 },
      { zone: 'Z-PAL-H', min: 70 },
      { zone: 'Z-PAL-S', min: 70 },
      { zone: 'Z-REC', min: 65 },
    ],
  },
  {
    code: 'R-BAR-CAB',
    name: 'Barrido mecánico — Av. Cabildo y Av. Luis María Campos',
    stops: [
      { zone: 'Z-BEL-C', min: 60 },
      { zone: 'Z-BEL-R', min: 45 },
    ],
  },
  {
    code: 'R-BAR-SF',
    name: 'Barrido mecánico — Av. Santa Fe, Av. Las Heras y Av. del Libertador',
    stops: [
      { zone: 'Z-PAL-S', min: 55 },
      { zone: 'Z-REC', min: 70 },
      { zone: 'Z-RET', min: 50 },
    ],
  },
  {
    code: 'R-PARQ',
    name: 'Mantenimiento de parques — Bosques de Palermo y Barrancas',
    stops: [
      { zone: 'Z-PAL-P', min: 180 },
      { zone: 'Z-BEL-C', min: 60 },
    ],
  },
];

/**
 * Destinos de disposición final del AMBA. El Norte III de CEAMSE, en José León
 * Suárez, es donde termina efectivamente la fracción húmeda de estas comunas.
 */
const DISPOSAL_SITES = [
  {
    code: 'DS-NORTE3',
    name: 'CEAMSE — Complejo Ambiental Norte III (José León Suárez)',
    siteType: DisposalSiteType.LANDFILL,
  },
  {
    code: 'DS-TR-COLEG',
    name: 'Estación de transferencia Colegiales',
    siteType: DisposalSiteType.TRANSFER_STATION,
  },
  {
    code: 'DS-CRC-VARELA',
    name: 'Centro de Reciclaje de la Ciudad (Villa Soldati)',
    siteType: DisposalSiteType.RECYCLING_PLANT,
  },
  {
    code: 'DS-COMP-SALD',
    name: 'Planta de compostaje Saldías',
    siteType: DisposalSiteType.COMPOSTING_PLANT,
  },
];

/**
 * Flota. Patentes en formato Mercosur (AA123BB), el vigente en Argentina desde
 * 2016. `capacity` se lee según el tipo: m³ de caja en los camiones de carga,
 * de tolva en la barredora y de tanque en el regador; toneladas de izaje en el
 * hidroelevador.
 */
const VEHICLES = [
  { plate: 'AB123CD', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 19 },
  { plate: 'AB456CE', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 19 },
  { plate: 'AC789DF', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 21 },
  { plate: 'AC012DG', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 21 },
  { plate: 'AD345EH', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 15 },
  { plate: 'AD678EJ', vehicleType: VehicleType.DUMP_TRUCK, capacity: 12 },
  { plate: 'AE901FK', vehicleType: VehicleType.DUMP_TRUCK, capacity: 12 },
  { plate: 'AE234FL', vehicleType: VehicleType.SWEEPER, capacity: 5 },
  { plate: 'AF567GM', vehicleType: VehicleType.SWEEPER, capacity: 5 },
  { plate: 'AF890GN', vehicleType: VehicleType.SWEEPER, capacity: 4 },
  { plate: 'AG123HP', vehicleType: VehicleType.WATER_TANKER, capacity: 10 },
  { plate: 'AG456HQ', vehicleType: VehicleType.WATER_TANKER, capacity: 8 },
  { plate: 'AH789JR', vehicleType: VehicleType.CRANE_TRUCK, capacity: 3 },
  { plate: 'AH012JS', vehicleType: VehicleType.CRANE_TRUCK, capacity: 2 },
  { plate: 'AJ345KT', vehicleType: VehicleType.VAN, capacity: 1 },
  // Reservado: sale de servicio por mantenimiento, para poder probar el filtro
  // `active` de la flota sin tener que desactivar uno a mano.
  { plate: 'AJ678KU', vehicleType: VehicleType.VAN, capacity: 1, active: false },
];

/**
 * Cuadrillas.
 *
 * Las cooperativas son de recuperadores urbanos: en CABA la fracción reciclable
 * la levantan cooperativas, no el servicio municipal. Existen acá como `Crew`,
 * no como beneficiarias de un programa — su registro como organización es de M1
 * (docs/bloqueantes.md), por eso `organizationId` es una referencia externa.
 */
const CREWS = [
  {
    name: 'Cuadrilla Belgrano — Recolección',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.MORNING,
    leaderUserId: 'usr-m1-0101',
    organizationId: null,
    members: ['usr-m1-0101', 'usr-m1-0102', 'usr-m1-0103', 'usr-m1-0104'],
  },
  {
    name: 'Cuadrilla Palermo — Recolección',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.MORNING,
    leaderUserId: 'usr-m1-0111',
    organizationId: null,
    members: ['usr-m1-0111', 'usr-m1-0112', 'usr-m1-0113', 'usr-m1-0114'],
  },
  {
    name: 'Cuadrilla Recoleta-Retiro — Recolección',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.NIGHT,
    leaderUserId: 'usr-m1-0121',
    organizationId: null,
    members: ['usr-m1-0121', 'usr-m1-0122', 'usr-m1-0123'],
  },
  {
    name: 'Cooperativa El Ceibo — Reciclables Comuna 2',
    crewType: CrewType.COOPERATIVE,
    defaultShift: Shift.AFTERNOON,
    leaderUserId: 'usr-m1-0201',
    organizationId: 'org-m1-coop-ceibo',
    members: ['usr-m1-0201', 'usr-m1-0202', 'usr-m1-0203'],
  },
  {
    name: 'Cooperativa Barrancas — Reciclables Comuna 13',
    crewType: CrewType.COOPERATIVE,
    defaultShift: Shift.AFTERNOON,
    leaderUserId: 'usr-m1-0211',
    organizationId: 'org-m1-coop-barrancas',
    members: ['usr-m1-0211', 'usr-m1-0212'],
  },
  {
    name: 'Cuadrilla Barrido Norte',
    crewType: CrewType.CONTRACTOR,
    defaultShift: Shift.NIGHT,
    leaderUserId: 'usr-m1-0301',
    organizationId: 'org-m1-emp-higiene-norte',
    members: ['usr-m1-0301', 'usr-m1-0302', 'usr-m1-0303'],
  },
  {
    name: 'Cuadrilla Arbolado Comuna 14',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.MORNING,
    leaderUserId: 'usr-m1-0401',
    organizationId: null,
    members: ['usr-m1-0401', 'usr-m1-0402', 'usr-m1-0403'],
  },
  {
    name: 'Cuadrilla Arbolado Comunas 2 y 13',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.AFTERNOON,
    leaderUserId: 'usr-m1-0411',
    organizationId: null,
    members: ['usr-m1-0411', 'usr-m1-0412'],
  },
  {
    name: 'Cuadrilla Espacios Verdes — Bosques de Palermo',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.MORNING,
    leaderUserId: 'usr-m1-0501',
    organizationId: null,
    members: ['usr-m1-0501', 'usr-m1-0502', 'usr-m1-0503', 'usr-m1-0504'],
  },
  {
    name: 'Inspectores Ambientales — Comunas 1, 2, 13 y 14',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.MORNING,
    leaderUserId: 'usr-m1-0601',
    organizationId: null,
    members: ['usr-m1-0601', 'usr-m1-0602'],
  },
];

// ════════════════════════════════════════════════════════════
// INVENTARIO URBANO
// ════════════════════════════════════════════════════════════

/**
 * Contenedores en esquinas reales.
 *
 * Los estados no son todos `ACTIVE` a propósito: hay uno desbordado, uno
 * dañado con derivación a Obras y uno en reubicación, que son los casos que
 * disparan eventos hacia M3 y M2.
 */
const CONTAINERS = [
  {
    code: 'CT-BEL-0001',
    zone: 'Z-BEL-C',
    containerType: ContainerType.HOUSEHOLD,
    address: 'Av. Cabildo 2200',
    lat: -34.5619,
    lng: -58.4562,
    capacityLiters: 3200,
  },
  {
    code: 'CT-BEL-0002',
    zone: 'Z-BEL-C',
    containerType: ContainerType.RECYCLABLE,
    address: 'Av. Juramento 2400',
    lat: -34.5615,
    lng: -58.4581,
    capacityLiters: 3200,
  },
  {
    code: 'CT-BEL-0003',
    zone: 'Z-BEL-C',
    containerType: ContainerType.HOUSEHOLD,
    address: 'Arribeños 2100',
    lat: -34.5546,
    lng: -58.4485,
    capacityLiters: 2400,
    // El Barrio Chino: mucha gastronomía, mucho volumen los fines de semana.
    status: ContainerStatus.OVERFLOWED,
  },
  {
    code: 'CT-BEL-0004',
    zone: 'Z-BEL-C',
    containerType: ContainerType.GREEN,
    address: 'Av. Virrey Vértiz 1900',
    lat: -34.5577,
    lng: -58.4479,
    capacityLiters: 1100,
  },
  {
    code: 'CT-BEL-0005',
    zone: 'Z-BEL-R',
    containerType: ContainerType.HOUSEHOLD,
    address: 'Echeverría 2800',
    lat: -34.5702,
    lng: -58.4645,
    capacityLiters: 2400,
  },
  {
    code: 'CT-BEL-0006',
    zone: 'Z-BEL-R',
    containerType: ContainerType.RECYCLABLE,
    address: 'Av. Elcano 3100',
    lat: -34.5731,
    lng: -58.4595,
    capacityLiters: 2400,
  },
  {
    code: 'CT-PAL-0001',
    zone: 'Z-PAL-H',
    containerType: ContainerType.HOUSEHOLD,
    address: 'Honduras 5800',
    lat: -34.5842,
    lng: -58.4352,
    capacityLiters: 3200,
  },
  {
    code: 'CT-PAL-0002',
    zone: 'Z-PAL-H',
    containerType: ContainerType.RECYCLABLE,
    address: 'Fitz Roy 1700',
    lat: -34.5836,
    lng: -58.4372,
    capacityLiters: 3200,
  },
  {
    code: 'CT-PAL-0003',
    zone: 'Z-PAL-H',
    containerType: ContainerType.HOUSEHOLD,
    address: 'Báez 400',
    lat: -34.5668,
    lng: -58.4343,
    capacityLiters: 2400,
    // Las Cañitas: la vereda gastronómica castiga los contenedores.
    status: ContainerStatus.DAMAGED,
    damageType: DamageType.LID_BROKEN,
    severity: Severity.MEDIUM,
    requiresPublicWorks: false,
  },
  {
    code: 'CT-PAL-0004',
    zone: 'Z-PAL-S',
    containerType: ContainerType.HOUSEHOLD,
    address: 'Gurruchaga 1800',
    lat: -34.5889,
    lng: -58.4297,
    capacityLiters: 3200,
  },
  {
    code: 'CT-PAL-0005',
    zone: 'Z-PAL-S',
    containerType: ContainerType.RECYCLABLE,
    address: 'Jorge Luis Borges 1900',
    lat: -34.5884,
    lng: -58.4304,
    capacityLiters: 3200,
  },
  {
    code: 'CT-PAL-0006',
    zone: 'Z-PAL-S',
    containerType: ContainerType.BULKY,
    address: 'Av. Juan B. Justo 1900',
    lat: -34.5866,
    lng: -58.4342,
    capacityLiters: 5000,
  },
  {
    code: 'CT-PAL-0007',
    zone: 'Z-PAL-P',
    containerType: ContainerType.GREEN,
    address: 'Av. Sarmiento 2700',
    lat: -34.5738,
    lng: -58.4143,
    capacityLiters: 5000,
  },
  {
    code: 'CT-PAL-0008',
    zone: 'Z-PAL-P',
    containerType: ContainerType.HOUSEHOLD,
    address: 'Av. Las Heras 3900',
    lat: -34.5798,
    lng: -58.4093,
    capacityLiters: 2400,
    status: ContainerStatus.RELOCATING,
  },
  {
    code: 'CT-REC-0001',
    zone: 'Z-REC',
    containerType: ContainerType.HOUSEHOLD,
    address: 'Av. Pueyrredón 1700',
    lat: -34.5896,
    lng: -58.3966,
    capacityLiters: 3200,
  },
  {
    code: 'CT-REC-0002',
    zone: 'Z-REC',
    containerType: ContainerType.RECYCLABLE,
    address: 'Junín 1800',
    lat: -34.5872,
    lng: -58.3944,
    capacityLiters: 3200,
  },
  {
    code: 'CT-REC-0003',
    zone: 'Z-REC',
    containerType: ContainerType.HOUSEHOLD,
    address: 'Av. Callao 1200',
    lat: -34.5949,
    lng: -58.3922,
    capacityLiters: 2400,
  },
  {
    code: 'CT-RET-0001',
    zone: 'Z-RET',
    containerType: ContainerType.HOUSEHOLD,
    address: 'Esmeralda 1100',
    lat: -34.5947,
    lng: -58.3798,
    capacityLiters: 3200,
  },
  {
    code: 'CT-RET-0002',
    zone: 'Z-RET',
    containerType: ContainerType.RECYCLABLE,
    address: 'Av. Leandro N. Alem 800',
    lat: -34.5951,
    lng: -58.3719,
    capacityLiters: 3200,
  },
  {
    code: 'CT-RET-0003',
    zone: 'Z-RET',
    containerType: ContainerType.HOUSEHOLD,
    address: 'Juncal 1000',
    lat: -34.5952,
    lng: -58.3814,
    capacityLiters: 2400,
  },
];

/**
 * Puntos verdes de entrega voluntaria, en las plazas donde efectivamente están.
 */
const GREEN_POINTS = [
  {
    code: 'GP-BEL-01',
    name: 'Punto Verde Barrancas de Belgrano',
    zone: 'Z-BEL-C',
    address: 'Av. Juramento y 11 de Septiembre de 1888',
    lat: -34.5585,
    lng: -58.4508,
    wasteTypes: [WasteType.RECYCLABLE, WasteType.GREEN],
  },
  {
    code: 'GP-PAL-01',
    name: 'Punto Verde Plaza Güemes',
    zone: 'Z-PAL-S',
    address: 'Charcas y Salguero',
    lat: -34.5895,
    lng: -58.4116,
    wasteTypes: [WasteType.RECYCLABLE],
  },
  {
    code: 'GP-PAL-02',
    name: 'Punto Verde Parque Tres de Febrero',
    zone: 'Z-PAL-P',
    address: 'Av. Infanta Isabel y Av. Sarmiento',
    lat: -34.5724,
    lng: -58.4166,
    wasteTypes: [WasteType.RECYCLABLE, WasteType.GREEN, WasteType.BULKY],
  },
  {
    code: 'GP-REC-01',
    name: 'Punto Verde Parque Las Heras',
    zone: 'Z-REC',
    address: 'Av. Coronel Díaz y Av. Las Heras',
    lat: -34.5852,
    lng: -58.4059,
    wasteTypes: [WasteType.RECYCLABLE, WasteType.GREEN],
  },
  {
    code: 'GP-RET-01',
    name: 'Punto Verde Plaza San Martín',
    zone: 'Z-RET',
    address: 'Av. Santa Fe y Maipú',
    lat: -34.5931,
    lng: -58.3758,
    wasteTypes: [WasteType.RECYCLABLE],
  },
];

/**
 * Arbolado. Las especies son las que realmente dominan estas comunas: tipa,
 * plátano, jacarandá, fresno y palo borracho. El plátano de Recoleta y las
 * tipas de Palermo son los dos ejemplares con riesgo alto, que es lo que
 * dispara `treeRiskDetected` hacia M3.
 */
const TREES = [
  {
    surveyCode: 'ARB-13-00101',
    zone: 'Z-BEL-C',
    species: 'Tipuana tipu',
    address: 'Av. Juramento 2200',
    lat: -34.5612,
    lng: -58.4562,
    heightM: 14.5,
    diameterCm: 68.0,
  },
  {
    surveyCode: 'ARB-13-00102',
    zone: 'Z-BEL-C',
    species: 'Jacaranda mimosifolia',
    address: 'Vuelta de Obligado 2300',
    lat: -34.5606,
    lng: -58.4557,
    heightM: 9.0,
    diameterCm: 41.5,
  },
  {
    surveyCode: 'ARB-13-00103',
    zone: 'Z-BEL-C',
    species: 'Platanus x acerifolia',
    address: '11 de Septiembre de 1888 1700',
    lat: -34.5588,
    lng: -58.4512,
    heightM: 18.0,
    diameterCm: 92.0,
  },
  {
    surveyCode: 'ARB-13-00104',
    zone: 'Z-BEL-R',
    species: 'Fraxinus pennsylvanica',
    address: 'Echeverría 2600',
    lat: -34.5695,
    lng: -58.4629,
    heightM: 11.5,
    diameterCm: 52.0,
  },
  {
    surveyCode: 'ARB-13-00105',
    zone: 'Z-BEL-R',
    species: 'Ceiba speciosa',
    address: 'Superí 1800',
    lat: -34.5716,
    lng: -58.4652,
    heightM: 12.0,
    diameterCm: 74.0,
  },
  {
    surveyCode: 'ARB-14-00201',
    zone: 'Z-PAL-H',
    species: 'Tipuana tipu',
    address: 'Gorriti 5600',
    lat: -34.5855,
    lng: -58.4331,
    heightM: 16.0,
    diameterCm: 81.0,
  },
  {
    surveyCode: 'ARB-14-00202',
    zone: 'Z-PAL-H',
    species: 'Fraxinus pennsylvanica',
    address: 'Arévalo 1500',
    lat: -34.5824,
    lng: -58.4359,
    heightM: 10.5,
    diameterCm: 45.0,
  },
  {
    surveyCode: 'ARB-14-00203',
    zone: 'Z-PAL-S',
    species: 'Jacaranda mimosifolia',
    address: 'Armenia 1700',
    lat: -34.5893,
    lng: -58.4288,
    heightM: 8.5,
    diameterCm: 38.0,
  },
  {
    surveyCode: 'ARB-14-00204',
    zone: 'Z-PAL-S',
    species: 'Tipuana tipu',
    address: 'Thames 1800',
    lat: -34.5879,
    lng: -58.4291,
    heightM: 17.5,
    diameterCm: 88.0,
  },
  {
    surveyCode: 'ARB-14-00205',
    zone: 'Z-PAL-P',
    species: 'Platanus x acerifolia',
    address: 'Av. Figueroa Alcorta 3200',
    lat: -34.5749,
    lng: -58.4061,
    heightM: 19.0,
    diameterCm: 105.0,
  },
  {
    surveyCode: 'ARB-14-00206',
    zone: 'Z-PAL-P',
    species: 'Erythrina crista-galli',
    address: 'Av. Infanta Isabel 500',
    lat: -34.5731,
    lng: -58.4172,
    heightM: 7.0,
    diameterCm: 33.0,
  },
  {
    surveyCode: 'ARB-02-00301',
    zone: 'Z-REC',
    species: 'Ficus benjamina',
    address: 'Av. Quintana 400',
    lat: -34.5877,
    lng: -58.3899,
    heightM: 13.0,
    diameterCm: 79.0,
  },
  {
    surveyCode: 'ARB-02-00302',
    zone: 'Z-REC',
    species: 'Platanus x acerifolia',
    address: 'Av. Alvear 1800',
    lat: -34.5893,
    lng: -58.3865,
    heightM: 20.0,
    diameterCm: 112.0,
  },
  {
    surveyCode: 'ARB-02-00303',
    zone: 'Z-REC',
    species: 'Tipuana tipu',
    address: 'Ayacucho 1200',
    lat: -34.5905,
    lng: -58.3927,
    heightM: 15.0,
    diameterCm: 70.0,
  },
  {
    surveyCode: 'ARB-01-00401',
    zone: 'Z-RET',
    species: 'Ficus benjamina',
    address: 'Plaza San Martín — Av. Santa Fe 700',
    lat: -34.5929,
    lng: -58.3755,
    heightM: 14.0,
    diameterCm: 86.0,
  },
  {
    surveyCode: 'ARB-01-00402',
    zone: 'Z-RET',
    species: 'Jacaranda mimosifolia',
    address: 'Arroyo 900',
    lat: -34.5921,
    lng: -58.3806,
    heightM: 9.5,
    diameterCm: 44.0,
  },
];

/** Espacios verdes reales de las cuatro comunas. */
const GREEN_SPACES = [
  {
    name: 'Barrancas de Belgrano',
    spaceType: GreenSpaceType.PARK,
    zone: 'Z-BEL-C',
    areaM2: 54000,
  },
  {
    name: 'Plaza Manuel Belgrano',
    spaceType: GreenSpaceType.SQUARE,
    zone: 'Z-BEL-C',
    areaM2: 9800,
  },
  { name: 'Plaza Noruega', spaceType: GreenSpaceType.SQUARE, zone: 'Z-BEL-R', areaM2: 4200 },
  { name: 'Plaza Castelli', spaceType: GreenSpaceType.SQUARE, zone: 'Z-BEL-R', areaM2: 3100 },
  {
    name: 'Parque Tres de Febrero (Bosques de Palermo)',
    spaceType: GreenSpaceType.PARK,
    zone: 'Z-PAL-P',
    areaM2: 3900000,
  },
  {
    name: 'Jardín Botánico Carlos Thays',
    spaceType: GreenSpaceType.PARK,
    zone: 'Z-PAL-P',
    areaM2: 69800,
  },
  { name: 'Plaza Italia', spaceType: GreenSpaceType.SQUARE, zone: 'Z-PAL-P', areaM2: 7600 },
  {
    name: 'El Rosedal de Palermo',
    spaceType: GreenSpaceType.PARK,
    zone: 'Z-PAL-P',
    areaM2: 34000,
  },
  {
    name: 'Plazoleta Julio Cortázar (Plaza Serrano)',
    spaceType: GreenSpaceType.SQUARE,
    zone: 'Z-PAL-S',
    areaM2: 2400,
  },
  { name: 'Plaza Güemes', spaceType: GreenSpaceType.SQUARE, zone: 'Z-PAL-S', areaM2: 12500 },
  {
    name: 'Cantero central Av. Dorrego',
    spaceType: GreenSpaceType.MEDIAN,
    zone: 'Z-PAL-H',
    areaM2: 3400,
  },
  { name: 'Parque Las Heras', spaceType: GreenSpaceType.PARK, zone: 'Z-REC', areaM2: 124000 },
  { name: 'Plaza Francia', spaceType: GreenSpaceType.SQUARE, zone: 'Z-REC', areaM2: 18000 },
  { name: 'Plaza Vicente López', spaceType: GreenSpaceType.SQUARE, zone: 'Z-REC', areaM2: 21000 },
  { name: 'Plaza San Martín', spaceType: GreenSpaceType.PARK, zone: 'Z-RET', areaM2: 62000 },
  {
    name: 'Plaza Fuerza Aérea Argentina',
    spaceType: GreenSpaceType.SQUARE,
    zone: 'Z-RET',
    areaM2: 15000,
  },
  {
    name: 'Paseo Av. del Libertador — Catalinas',
    spaceType: GreenSpaceType.PROMENADE,
    zone: 'Z-RET',
    areaM2: 8900,
  },
];

/**
 * Frecuencias: qué recorrido se hace qué días.
 *
 * `weekdays` es 1=lunes … 7=domingo. La recolección domiciliaria va en días
 * alternados por corredor, el barrido mecánico de lunes a viernes de noche
 * —que es cuando las avenidas están libres— y los reciclables dos veces por
 * semana.
 */
const FREQUENCIES = [
  { serviceType: 'REC-DOM', route: 'R-REC-N', shift: Shift.MORNING, weekdays: [1, 3, 5] },
  { serviceType: 'REC-DOM', route: 'R-REC-S', shift: Shift.NIGHT, weekdays: [2, 4, 6] },
  { serviceType: 'REC-REC', route: 'R-RECI', shift: Shift.AFTERNOON, weekdays: [2, 5] },
  { serviceType: 'BAR-MEC', route: 'R-BAR-CAB', shift: Shift.NIGHT, weekdays: [1, 2, 3, 4, 5] },
  { serviceType: 'BAR-MEC', route: 'R-BAR-SF', shift: Shift.NIGHT, weekdays: [1, 2, 3, 4, 5] },
  { serviceType: 'EV-MANT', route: 'R-PARQ', shift: Shift.MORNING, weekdays: [1, 4] },
];

// ════════════════════════════════════════════════════════════
// CARGA
// ════════════════════════════════════════════════════════════

/**
 * Busca un id ya cargado y explota con nombre y apellido si no está.
 *
 * Sin esto, una referencia rota —un `Z-PAL-X` que nadie definió— devuelve
 * `undefined`, se lo come el `as string` y reaparece treinta líneas después
 * como un error de Prisma sobre una columna que no dice nada. El seed tiene
 * muchas referencias cruzadas por código; conviene que la que falle se
 * identifique sola.
 */
function buscar(mapa: Map<string, string>, clave: string, que: string): string {
  const id = mapa.get(clave);
  if (!id) {
    throw new Error(`seed: no existe ${que} '${clave}'. Definidos: ${[...mapa.keys()].join(', ')}`);
  }
  return id;
}

async function main() {
  // ── Catálogos ──────────────────────────────────────────
  for (const st of SERVICE_TYPES) {
    await prisma.serviceType.upsert({ where: { code: st.code }, update: st, create: st });
  }

  const zones = new Map<string, string>();
  for (const z of ZONES) {
    const zone = await prisma.zone.upsert({
      where: { code: z.code },
      update: { name: z.name },
      create: { code: z.code, name: z.name },
    });
    zones.set(z.code, zone.id);

    await prisma.zoneNeighborhood.createMany({
      data: z.neighborhoods.map((neighborhoodId) => ({ zoneId: zone.id, neighborhoodId })),
      skipDuplicates: true,
    });
  }
  const zoneId = (code: string): string => buscar(zones, code, 'la zona');

  const routes = new Map<string, string>();
  for (const r of ROUTES) {
    const route = await prisma.route.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: { code: r.code, name: r.name },
    });
    routes.set(r.code, route.id);

    // Las paradas se reemplazan enteras: el orden y la duración son el dato, y
    // un upsert parada por parada dejaría restos si el recorrido se acorta.
    await prisma.routeStop.deleteMany({ where: { routeId: route.id } });
    await prisma.routeStop.createMany({
      data: r.stops.map((s, i) => ({
        routeId: route.id,
        zoneId: zoneId(s.zone),
        sequence: i + 1,
        estimatedDurationMin: s.min,
      })),
    });
  }
  const routeId = (code: string): string => buscar(routes, code, 'el recorrido');

  for (const ds of DISPOSAL_SITES) {
    await prisma.disposalSite.upsert({ where: { code: ds.code }, update: ds, create: ds });
  }

  for (const v of VEHICLES) {
    await prisma.vehicle.upsert({ where: { plate: v.plate }, update: v, create: v });
  }

  // Crew no tiene clave única natural, así que se busca por nombre.
  const crews = new Map<string, string>();
  for (const c of CREWS) {
    const { members, ...datos } = c;
    const existing = await prisma.crew.findFirst({ where: { name: c.name } });
    const crew = existing ?? (await prisma.crew.create({ data: datos }));
    crews.set(c.name, crew.id);

    await prisma.crewMember.createMany({
      data: members.map((userId) => ({ crewId: crew.id, userId })),
      skipDuplicates: true,
    });
  }
  const crewId = (name: string): string => buscar(crews, name, 'la cuadrilla');

  // ── Inventario urbano ──────────────────────────────────
  const containers = new Map<string, string>();
  for (const c of CONTAINERS) {
    const { zone, ...datos } = c;
    const container = await prisma.container.upsert({
      where: { code: c.code },
      update: { ...datos, zoneId: zoneId(zone) },
      create: { ...datos, zoneId: zoneId(zone) },
    });
    containers.set(c.code, container.id);
  }

  for (const gp of GREEN_POINTS) {
    const { zone, wasteTypes, ...datos } = gp;
    const greenPoint = await prisma.greenPoint.upsert({
      where: { code: gp.code },
      update: { ...datos, zoneId: zoneId(zone) },
      create: { ...datos, zoneId: zoneId(zone) },
    });
    await prisma.greenPointWasteType.createMany({
      data: wasteTypes.map((wasteType) => ({ greenPointId: greenPoint.id, wasteType })),
      skipDuplicates: true,
    });
  }

  const trees = new Map<string, string>();
  for (const t of TREES) {
    const { zone, ...datos } = t;
    const tree = await prisma.tree.upsert({
      where: { surveyCode: t.surveyCode },
      update: { ...datos, zoneId: zoneId(zone) },
      create: { ...datos, zoneId: zoneId(zone) },
    });
    trees.set(t.surveyCode, tree.id);
  }

  // GreenSpace tampoco tiene clave natural: se busca por nombre, que en la
  // práctica no se repite entre plazas de la Ciudad.
  for (const gs of GREEN_SPACES) {
    const { zone, ...datos } = gs;
    const existing = await prisma.greenSpace.findFirst({ where: { name: gs.name } });
    if (!existing) {
      await prisma.greenSpace.create({ data: { ...datos, zoneId: zoneId(zone) } });
    }
  }

  // ServiceFrequency no tiene clave única natural, así que se busca por la
  // combinación que la identifica en la práctica.
  for (const f of FREQUENCIES) {
    const st = await prisma.serviceType.findUnique({ where: { code: f.serviceType } });
    if (!st) continue;

    const existing = await prisma.serviceFrequency.findFirst({
      where: { serviceTypeId: st.id, routeId: routeId(f.route), shift: f.shift },
    });
    if (existing) continue;

    await prisma.serviceFrequency.create({
      data: {
        serviceTypeId: st.id,
        routeId: routeId(f.route),
        shift: f.shift,
        validFrom: dia(-120),
        weekdays: { createMany: { data: f.weekdays.map((weekday) => ({ weekday })) } },
      },
    });
  }

  // ── Censo de arbolado ──────────────────────────────────
  //
  // Un relevamiento por árbol, con dos casos de riesgo alto: son los que
  // justifican una intervención y, en el del plátano de Alvear, el corte de
  // calle hacia M7.
  if ((await prisma.treeSurvey.count()) === 0) {
    const relevamientos = [
      {
        tree: 'ARB-13-00103',
        healthStatus: TreeHealthStatus.WEAKENED,
        riskLevel: RiskLevel.MEDIUM,
        riskType: RiskType.FALLING_BRANCH,
        suggestedIntervention: TreeInterventionType.SAFETY_PRUNING,
        notes: 'Rama seca sobre la senda peatonal de las Barrancas.',
      },
      {
        tree: 'ARB-14-00204',
        healthStatus: TreeHealthStatus.HEALTHY,
        riskLevel: RiskLevel.LOW,
        suggestedIntervention: TreeInterventionType.FORMATION_PRUNING,
        notes: 'Copa invadiendo el tendido de alumbrado.',
      },
      {
        tree: 'ARB-14-00205',
        healthStatus: TreeHealthStatus.WEAKENED,
        riskLevel: RiskLevel.HIGH,
        riskType: RiskType.POWER_LINE_CONTACT,
        suggestedIntervention: TreeInterventionType.SAFETY_PRUNING,
        requiresStreetClosure: true,
        notes: 'Contacto con el tendido sobre Figueroa Alcorta. Requiere corte parcial.',
      },
      {
        tree: 'ARB-02-00302',
        healthStatus: TreeHealthStatus.DISEASED,
        riskLevel: RiskLevel.CRITICAL,
        riskType: RiskType.TRUNK_INSTABILITY,
        suggestedIntervention: TreeInterventionType.REMOVAL,
        requiresStreetClosure: true,
        requiresPublicWorks: true,
        notes: 'Pudrición basal. Inclinación creciente sobre la vereda de Av. Alvear.',
      },
      {
        tree: 'ARB-02-00303',
        healthStatus: TreeHealthStatus.HEALTHY,
        riskLevel: RiskLevel.NONE,
        notes: 'Sin observaciones.',
      },
      {
        tree: 'ARB-01-00401',
        healthStatus: TreeHealthStatus.WEAKENED,
        riskLevel: RiskLevel.MEDIUM,
        riskType: RiskType.ROOT_UPLIFT,
        suggestedIntervention: TreeInterventionType.TREATMENT,
        notes: 'Raíz levantando el solado de la plaza.',
      },
    ];

    for (const [i, r] of relevamientos.entries()) {
      const { tree, ...datos } = r;
      await prisma.treeSurvey.create({
        data: {
          ...datos,
          treeId: buscar(trees, tree, 'el árbol'),
          surveyedAt: momento(-30 + i * 4, 10),
          inspectorId: 'usr-m1-0601',
        },
      });
    }
  }

  // ── Servicios ──────────────────────────────────────────
  //
  // Service no tiene clave única natural, así que la idempotencia es por
  // presencia: si ya hay servicios cargados, no se toca nada de acá para
  // abajo.
  if ((await prisma.service.count()) > 0) {
    await resumen();
    return;
  }

  const st = async (code: string) => {
    const row = await prisma.serviceType.findUnique({ where: { code } });
    if (!row) throw new Error(`seed: no existe el tipo de servicio '${code}'`);
    return row.id;
  };

  const recDom = await st('REC-DOM');
  const recRec = await st('REC-REC');
  const barMec = await st('BAR-MEC');
  const contVac = await st('CONT-VAC');
  const arbPod = await st('ARB-POD');
  const evMant = await st('EV-MANT');
  const ambInsp = await st('AMB-INSP');
  const recVol = await st('REC-VOL');

  const vehicle = async (plate: string) => {
    const row = await prisma.vehicle.findUnique({ where: { plate } });
    if (!row) throw new Error(`seed: no existe el vehículo '${plate}'`);
    return row.id;
  };

  const site = async (code: string) => {
    const row = await prisma.disposalSite.findUnique({ where: { code } });
    if (!row) throw new Error(`seed: no existe el destino de disposición '${code}'`);
    return row.id;
  };

  const norte3 = await site('DS-NORTE3');
  const crcVarela = await site('DS-CRC-VARELA');

  /** Las zonas de un recorrido, en orden, como snapshot para el Service. */
  const zonasDe = (code: string) => {
    const r = ROUTES.find((x) => x.code === code);
    return (r?.stops ?? []).map((s, i) => ({ zoneId: zoneId(s.zone), sequence: i + 1 }));
  };

  // 1. Recolección de hoy en Belgrano, en ejecución.
  const enCurso = await prisma.service.create({
    data: {
      serviceTypeId: recDom,
      mode: ServiceMode.ROUTE,
      status: ServiceStatus.IN_PROGRESS,
      origin: ServiceOrigin.PLANNED,
      routeId: routeId('R-REC-N'),
      scheduledDate: dia(0),
      windowFrom: hora(6),
      windowTo: hora(12),
      crewId: crewId('Cuadrilla Belgrano — Recolección'),
      vehicleId: await vehicle('AB123CD'),
      zones: { createMany: { data: zonasDe('R-REC-N') } },
      createdBy: 'usr-m1-0001',
    },
  });

  // El aviso de demora: DELAYED no es un estado, el servicio sigue
  // IN_PROGRESS mientras tanto (Issue #122).
  await prisma.serviceDelayNotice.create({
    data: {
      serviceId: enCurso.id,
      delayType: DelayType.START,
      delayMinutes: 45,
      reason: 'Corte de tránsito por obra en Av. Cabildo y Juramento.',
      newEstimatedEnd: momento(0, 12, 45),
      serviceStatus: ServiceStatus.IN_PROGRESS,
      reportedBy: 'usr-m1-0101',
      detectedAt: momento(0, 6, 40),
    },
  });

  // 1b. Un urgente que se le encima a la recolección de arriba.
  //
  //     Es a propósito: la franja 8-10 se pisa con la 6-12 del servicio
  //     anterior y comparte cuadrilla, así que la base arranca con un
  //     solapamiento real para poder ver el aviso de doble reserva sin tener
  //     que fabricarlo a mano. La asignación avisa y deja pasar, pero no en
  //     silencio: por eso viaja la nota de override (Issue #123).
  await prisma.service.create({
    data: {
      serviceTypeId: contVac,
      mode: ServiceMode.POINT,
      status: ServiceStatus.SCHEDULED,
      origin: ServiceOrigin.MANUAL,
      targetType: 'CONTAINER',
      targetId: buscar(containers, 'CT-PAL-0003', 'el contenedor'),
      scheduledDate: dia(0),
      windowFrom: hora(8),
      windowTo: hora(10),
      crewId: crewId('Cuadrilla Belgrano — Recolección'),
      vehicleId: await vehicle('AC012DG'),
      notes: 'Contenedor con tapa rota volcado sobre la vereda de Báez.',
      assignmentOverrideNote:
        'Se asigna igual: es la única cuadrilla con hidroelevador disponible y el contenedor está obstruyendo la vereda.',
      assignmentOverrideBy: 'usr-m1-0001',
      assignmentOverrideAt: momento(0, 7, 15),
      zones: { createMany: { data: [{ zoneId: zoneId('Z-PAL-H'), sequence: 1 }] } },
      createdBy: 'usr-m1-0001',
    },
  });

  // 2. Agenda de los próximos días, todavía sin cuadrilla asignada.
  await prisma.service.create({
    data: {
      serviceTypeId: recDom,
      mode: ServiceMode.ROUTE,
      status: ServiceStatus.SCHEDULED,
      origin: ServiceOrigin.PLANNED,
      routeId: routeId('R-REC-S'),
      scheduledDate: dia(1),
      windowFrom: hora(22),
      windowTo: hora(23, 59),
      zones: { createMany: { data: zonasDe('R-REC-S') } },
      createdBy: 'usr-m1-0001',
    },
  });

  await prisma.service.create({
    data: {
      serviceTypeId: barMec,
      mode: ServiceMode.ROUTE,
      status: ServiceStatus.SCHEDULED,
      origin: ServiceOrigin.PLANNED,
      routeId: routeId('R-BAR-SF'),
      scheduledDate: dia(2),
      windowFrom: hora(23),
      windowTo: hora(23, 59),
      crewId: crewId('Cuadrilla Barrido Norte'),
      vehicleId: await vehicle('AE234FL'),
      zones: { createMany: { data: zonasDe('R-BAR-SF') } },
      createdBy: 'usr-m1-0001',
    },
  });

  // 3. Reciclables de la semana pasada, cerrado completo y pesado en el
  //    Centro de Reciclaje.
  const reciclables = await prisma.service.create({
    data: {
      serviceTypeId: recRec,
      mode: ServiceMode.ROUTE,
      status: ServiceStatus.COMPLETED,
      origin: ServiceOrigin.PLANNED,
      routeId: routeId('R-RECI'),
      scheduledDate: dia(-3),
      crewId: crewId('Cooperativa El Ceibo — Reciclables Comuna 2'),
      vehicleId: await vehicle('AD345EH'),
      zones: { createMany: { data: zonasDe('R-RECI') } },
      createdBy: 'usr-m1-0001',
    },
  });

  for (const z of zonasDe('R-RECI')) {
    await prisma.zoneResult.create({
      data: {
        serviceId: reciclables.id,
        zoneId: z.zoneId,
        status: ZoneResultStatus.SERVICED,
        recordedAt: momento(-3, 17),
      },
    });
  }

  await prisma.collectionRecord.create({
    data: {
      serviceId: reciclables.id,
      disposalSiteId: crcVarela,
      wasteType: WasteType.RECYCLABLE,
      volumeM3: 12.4,
      weightKg: 2180,
    },
  });

  // 4. Cierre parcial: Palermo Hollywood quedó sin atender.
  //
  //    Es el caso que abre el abanico hacia M2 — un `PROGRESS` por cada
  //    reclamo abierto de esa zona, porque `zoneNotServiced` no tiene forma de
  //    representarse entero del lado de ellos.
  const parcial = await prisma.service.create({
    data: {
      serviceTypeId: recDom,
      mode: ServiceMode.ROUTE,
      status: ServiceStatus.PARTIALLY_COMPLETED,
      origin: ServiceOrigin.PLANNED,
      routeId: routeId('R-REC-N'),
      scheduledDate: dia(-5),
      crewId: crewId('Cuadrilla Belgrano — Recolección'),
      vehicleId: await vehicle('AB456CE'),
      zones: { createMany: { data: zonasDe('R-REC-N') } },
      createdBy: 'usr-m1-0001',
    },
  });

  const zonasParcial = zonasDe('R-REC-N');
  for (const z of zonasParcial.slice(0, 2)) {
    const zr = await prisma.zoneResult.create({
      data: {
        serviceId: parcial.id,
        zoneId: z.zoneId,
        status: ZoneResultStatus.SERVICED,
        recordedAt: momento(-5, 11),
      },
    });
    await prisma.collectionRecord.create({
      data: {
        serviceId: parcial.id,
        zoneResultId: zr.id,
        disposalSiteId: norte3,
        wasteType: WasteType.HOUSEHOLD,
        volumeM3: 17.2,
        weightKg: 4350,
      },
    });
  }

  await prisma.zoneResult.create({
    data: {
      serviceId: parcial.id,
      zoneId: zonasParcial[2].zoneId,
      status: ZoneResultStatus.NOT_SERVICED,
      reason: NotServicedReason.STREET_CLOSURE,
      proposedDate: dia(-4),
      notes: 'Corte total de Av. Dorrego por rodaje autorizado. No se pudo ingresar a la zona.',
      recordedAt: momento(-5, 11, 30),
    },
  });

  // 5. Suspendido por alerta meteorológica, y su reprogramación.
  await prisma.service.create({
    data: {
      serviceTypeId: barMec,
      mode: ServiceMode.ROUTE,
      status: ServiceStatus.SUSPENDED,
      statusReason: 'Alerta naranja por tormentas fuertes del SMN.',
      origin: ServiceOrigin.WEATHER_ALERT,
      routeId: routeId('R-BAR-CAB'),
      scheduledDate: dia(-1),
      crewId: crewId('Cuadrilla Barrido Norte'),
      vehicleId: await vehicle('AF567GM'),
      zones: { createMany: { data: zonasDe('R-BAR-CAB') } },
      createdBy: 'sistema',
    },
  });

  await prisma.service.create({
    data: {
      serviceTypeId: barMec,
      mode: ServiceMode.ROUTE,
      status: ServiceStatus.RESCHEDULED,
      statusReason: 'Reprogramación del barrido suspendido por la alerta.',
      origin: ServiceOrigin.WEATHER_ALERT,
      routeId: routeId('R-BAR-CAB'),
      scheduledDate: dia(3),
      zones: { createMany: { data: zonasDe('R-BAR-CAB') } },
      createdBy: 'sistema',
    },
  });

  // 6. Puntual nacido de un reclamo de M2: el contenedor desbordado del
  //    Barrio Chino.
  await prisma.service.create({
    data: {
      serviceTypeId: contVac,
      mode: ServiceMode.POINT,
      status: ServiceStatus.SCHEDULED,
      origin: ServiceOrigin.TICKET,
      ticketId: 'a3f1c9d2-5b74-4e18-9c02-71ad8e6b4f30',
      targetType: 'CONTAINER',
      targetId: buscar(containers, 'CT-BEL-0003', 'el contenedor'),
      scheduledDate: dia(0),
      windowFrom: hora(14),
      windowTo: hora(18),
      crewId: crewId('Cuadrilla Belgrano — Recolección'),
      vehicleId: await vehicle('AC789DF'),
      notes: 'Reclamo por desborde reiterado sobre Arribeños.',
      zones: { createMany: { data: [{ zoneId: zoneId('Z-BEL-C'), sequence: 1 }] } },
      createdBy: 'usr-m1-0001',
    },
  });

  // 7. Retiro de voluminosos, también de un reclamo.
  await prisma.service.create({
    data: {
      serviceTypeId: recVol,
      mode: ServiceMode.POINT,
      status: ServiceStatus.COMPLETED,
      origin: ServiceOrigin.TICKET,
      ticketId: 'c7e40b18-2a96-4d53-8f61-0b2e9d5a7c14',
      scheduledDate: dia(-2),
      crewId: crewId('Cuadrilla Palermo — Recolección'),
      vehicleId: await vehicle('AD678EJ'),
      notes: 'Restos de mudanza en la vereda de Honduras al 5800.',
      zones: { createMany: { data: [{ zoneId: zoneId('Z-PAL-H'), sequence: 1 }] } },
      createdBy: 'usr-m1-0001',
    },
  });

  // 8. Mantenimiento de los Bosques de Palermo.
  await prisma.service.create({
    data: {
      serviceTypeId: evMant,
      mode: ServiceMode.POINT,
      status: ServiceStatus.SCHEDULED,
      origin: ServiceOrigin.PLANNED,
      scheduledDate: dia(1),
      windowFrom: hora(7),
      windowTo: hora(13),
      crewId: crewId('Cuadrilla Espacios Verdes — Bosques de Palermo'),
      notes: 'Corte de césped y limpieza del Rosedal.',
      zones: { createMany: { data: [{ zoneId: zoneId('Z-PAL-P'), sequence: 1 }] } },
      createdBy: 'usr-m1-0001',
    },
  });

  // 9. Cancelado, para tener el estado terminal cargado.
  await prisma.service.create({
    data: {
      serviceTypeId: recVol,
      mode: ServiceMode.POINT,
      status: ServiceStatus.CANCELLED,
      statusReason: 'El vecino retiró los restos por su cuenta antes de la visita.',
      origin: ServiceOrigin.TICKET,
      ticketId: 'e91b7f04-6c38-4a25-b7d9-38fa1c05e2b6',
      scheduledDate: dia(-4),
      zones: { createMany: { data: [{ zoneId: zoneId('Z-REC'), sequence: 1 }] } },
      createdBy: 'usr-m1-0001',
    },
  });

  // ── Arbolado: intervenciones ───────────────────────────
  //
  // La poda de Figueroa Alcorta va con su Service ya programado y su pedido de
  // corte a M7. La extracción de Av. Alvear queda esperando autorización: una
  // REMOVAL no se programa sin firma.
  const podaService = await prisma.service.create({
    data: {
      serviceTypeId: arbPod,
      mode: ServiceMode.POINT,
      status: ServiceStatus.SCHEDULED,
      origin: ServiceOrigin.INSPECTION,
      scheduledDate: dia(4),
      windowFrom: hora(8),
      windowTo: hora(12),
      crewId: crewId('Cuadrilla Arbolado Comuna 14'),
      vehicleId: await vehicle('AH789JR'),
      notes: 'Poda de seguridad por contacto con tendido eléctrico.',
      zones: { createMany: { data: [{ zoneId: zoneId('Z-PAL-P'), sequence: 1 }] } },
      createdBy: 'usr-m1-0401',
    },
  });

  const poda = await prisma.treeIntervention.create({
    data: {
      interventionType: TreeInterventionType.SAFETY_PRUNING,
      serviceId: podaService.id,
      address: 'Av. Figueroa Alcorta 3200',
      requiresStreetClosure: true,
      status: TreeInterventionStatus.AUTHORIZED,
      priority: Severity.HIGH,
      trees: { createMany: { data: [{ treeId: buscar(trees, 'ARB-14-00205', 'el árbol') }] } },
    },
  });

  const extraccion = await prisma.treeIntervention.create({
    data: {
      interventionType: TreeInterventionType.REMOVAL,
      address: 'Av. Alvear 1800',
      requiresStreetClosure: true,
      status: TreeInterventionStatus.PENDING_AUTHORIZATION,
      priority: Severity.CRITICAL,
      justification:
        'Pudrición basal avanzada con inclinación creciente sobre vereda de alto tránsito peatonal. Riesgo de caída.',
      trees: { createMany: { data: [{ treeId: buscar(trees, 'ARB-02-00302', 'el árbol') }] } },
    },
  });

  // ── Derivaciones salientes ─────────────────────────────
  //
  // Hacia M7: el corte de calle de la poda, ya aprobado.
  const corte = await prisma.streetClosureRequest.create({
    data: {
      reason: 'Poda de seguridad sobre tendido eléctrico. Requiere hidroelevador en calzada.',
      sourceType: 'TREE_INTERVENTION',
      sourceId: poda.id,
      closureType: StreetClosureType.PARTIAL,
      closureFrom: momento(4, 8),
      closureTo: momento(4, 12),
      status: StreetClosureRequestStatus.APPROVED,
      closureId: 'M7-CL-2026-01184',
    },
  });
  await prisma.closureStreet.create({
    data: {
      requestId: corte.id,
      streetName: 'Av. Figueroa Alcorta',
      fromCross: 'Av. Dorrego',
      toCross: 'Salguero',
    },
  });

  // Y el de la extracción, todavía sin respuesta.
  const cortePendiente = await prisma.streetClosureRequest.create({
    data: {
      reason: 'Extracción de ejemplar con riesgo de caída. Corte total de la calzada.',
      sourceType: 'TREE_INTERVENTION',
      sourceId: extraccion.id,
      closureType: StreetClosureType.TOTAL,
      closureFrom: momento(9, 7),
      closureTo: momento(9, 17),
      status: StreetClosureRequestStatus.REQUESTED,
    },
  });
  await prisma.closureStreet.create({
    data: {
      requestId: cortePendiente.id,
      streetName: 'Av. Alvear',
      fromCross: 'Rodríguez Peña',
      toCross: 'Montevideo',
    },
  });

  // Hacia M3: lo que se detectó en la vía pública y no es nuestro.
  await prisma.repairRequest.create({
    data: {
      damageType: RepairDamageType.BROKEN_SIDEWALK,
      severity: Severity.HIGH,
      address: 'Plaza San Martín — Av. Santa Fe 700',
      detectedInType: 'SERVICE',
      detectedInId: parcial.id,
      publicSafetyRisk: true,
      status: RepairRequestStatus.IN_PROGRESS,
      workOrderId: 'M3-OT-2026-00742',
      requestedAt: momento(-12, 9),
    },
  });

  await prisma.repairRequest.create({
    data: {
      damageType: RepairDamageType.BLOCKED_DRAIN,
      severity: Severity.MEDIUM,
      address: 'Av. Juan B. Justo 1900',
      detectedInType: 'SERVICE',
      detectedInId: reciclables.id,
      publicSafetyRisk: false,
      status: RepairRequestStatus.REQUESTED,
      requestedAt: momento(-3, 16),
    },
  });

  // ── Control ambiental ──────────────────────────────────
  //
  // Tres expedientes que cubren el circuito entero: uno recién entrado por
  // reclamo, uno con acta ya derivada a M4 y multa aplicada, y uno de oficio
  // que se cerró sin infracción.
  const denunciaRuido = await prisma.environmentalReport.create({
    data: {
      reportType: EnvironmentalReportType.NOISE,
      address: 'Honduras 5800',
      // Sin coordenadas a propósito: la v1.6 de M2 sacó latitude/longitude de
      // su `location`, así que lo que nace de un reclamo llega sin punto.
      ticketId: 'a3f1c9d2-5b74-4e18-9c02-71ad8e6b4f30',
      reporterSnapshot: { isAnonymous: false, citizenId: 'cit-m1-88421' },
      status: EnvironmentalReportStatus.UNDER_REVIEW,
      priority: Severity.MEDIUM,
      deadlineAt: momento(12, 23, 59),
    },
  });

  const denunciaVuelco = await prisma.environmentalReport.create({
    data: {
      reportType: EnvironmentalReportType.ILLEGAL_DUMPSITE,
      address: 'Av. Juan B. Justo 1900',
      ticketId: 'b58d3e07-91c4-4f6a-a3e5-2d7c04b9f851',
      reporterSnapshot: { isAnonymous: true },
      status: EnvironmentalReportStatus.SANCTIONED,
      priority: Severity.HIGH,
    },
  });

  const denunciaOficio = await prisma.environmentalReport.create({
    data: {
      reportType: EnvironmentalReportType.ODOR,
      address: 'Av. Cabildo 2200',
      // De oficio: la carga el inspector, así que sí tiene coordenadas.
      lat: -34.5619,
      lng: -58.4562,
      reporterSnapshot: { isAnonymous: false, citizenId: null },
      status: EnvironmentalReportStatus.NO_VIOLATION,
      priority: Severity.LOW,
    },
  });

  // La inspección del vuelco, que terminó en acta.
  const inspService = await prisma.service.create({
    data: {
      serviceTypeId: ambInsp,
      mode: ServiceMode.POINT,
      status: ServiceStatus.COMPLETED,
      origin: ServiceOrigin.TICKET,
      ticketId: 'b58d3e07-91c4-4f6a-a3e5-2d7c04b9f851',
      scheduledDate: dia(-14),
      crewId: crewId('Inspectores Ambientales — Comunas 1, 2, 13 y 14'),
      zones: { createMany: { data: [{ zoneId: zoneId('Z-PAL-S'), sequence: 1 }] } },
      createdBy: 'usr-m1-0601',
    },
  });

  const inspeccion = await prisma.environmentalInspection.create({
    data: {
      reportId: denunciaVuelco.id,
      serviceId: inspService.id,
      inspectorId: 'usr-m1-0601',
      inspectedAt: momento(-14, 10, 30),
      findings:
        'Acopio de residuos de obra sobre la vereda y calzada, sin volquete habilitado. El responsable no exhibió contrato de transporte.',
      outcome: InspectionOutcome.VIOLATION_FOUND,
      nextStep: InspectionNextStep.NOTICE_TO_BE_ISSUED,
      checklistItems: {
        createMany: {
          data: [
            {
              itemCode: 'RSU-01',
              label: 'Separación en origen',
              result: false,
              observations: 'Sin separación.',
            },
            { itemCode: 'RSU-02', label: 'Contenedor habilitado', result: false },
            { itemCode: 'OBR-01', label: 'Volquete con permiso vigente', result: false },
            { itemCode: 'OBR-02', label: 'Vereda liberada al peatón', result: false },
            { itemCode: 'DOC-01', label: 'Documentación del transportista', result: false },
          ],
        },
      },
    },
  });

  const acta = await prisma.violationNotice.create({
    data: {
      noticeNumber: 'ACT-2026-000318',
      inspectionId: inspeccion.id,
      issuedAt: momento(-13, 9),
      establishmentId: 'est-m4-40219',
      violationType: ViolationType.ILLEGAL_DUMPING,
      severity: Severity.HIGH,
      suggestedAction: SuggestedAction.FINE,
      priorNoticeCount: 1,
    },
  });

  await prisma.sanctionOutcome.create({
    data: {
      violationNoticeId: acta.id,
      decision: SanctionDecision.FINE_ISSUED,
      decidedAt: momento(-6, 15),
      externalRef: 'M4-MUL-2026-02277',
    },
  });

  // La inspección del expediente de oficio, sin infracción.
  await prisma.environmentalInspection.create({
    data: {
      reportId: denunciaOficio.id,
      inspectorId: 'usr-m1-0602',
      inspectedAt: momento(-8, 11),
      findings: 'Olor atribuible a la red cloacal, no a actividad comercial. Se deriva a AySA.',
      outcome: InspectionOutcome.NO_VIOLATION,
      nextStep: InspectionNextStep.CASE_CLOSED,
      checklistItems: {
        createMany: {
          data: [
            { itemCode: 'EFL-01', label: 'Vuelco a la red sin tratamiento', result: true },
            { itemCode: 'EFL-02', label: 'Rejilla de captación limpia', result: true },
          ],
        },
      },
    },
  });

  // La inspección pendiente del reclamo de ruido, todavía sin ejecutar.
  const inspRuidoService = await prisma.service.create({
    data: {
      serviceTypeId: ambInsp,
      mode: ServiceMode.POINT,
      status: ServiceStatus.SCHEDULED,
      origin: ServiceOrigin.TICKET,
      ticketId: 'a3f1c9d2-5b74-4e18-9c02-71ad8e6b4f30',
      scheduledDate: dia(2),
      windowFrom: hora(21),
      windowTo: hora(23, 59),
      crewId: crewId('Inspectores Ambientales — Comunas 1, 2, 13 y 14'),
      notes: 'Medición de nivel sonoro en horario nocturno.',
      zones: { createMany: { data: [{ zoneId: zoneId('Z-PAL-H'), sequence: 1 }] } },
      createdBy: 'usr-m1-0601',
    },
  });

  await prisma.environmentalInspection.create({
    data: {
      reportId: denunciaRuido.id,
      serviceId: inspRuidoService.id,
      inspectorId: 'usr-m1-0601',
    },
  });

  await resumen();
}

async function resumen() {
  console.table({
    serviceTypes: await prisma.serviceType.count(),
    zones: await prisma.zone.count(),
    zoneNeighborhoods: await prisma.zoneNeighborhood.count(),
    routes: await prisma.route.count(),
    routeStops: await prisma.routeStop.count(),
    frequencies: await prisma.serviceFrequency.count(),
    disposalSites: await prisma.disposalSite.count(),
    vehicles: await prisma.vehicle.count(),
    crews: await prisma.crew.count(),
    crewMembers: await prisma.crewMember.count(),
    containers: await prisma.container.count(),
    greenPoints: await prisma.greenPoint.count(),
    trees: await prisma.tree.count(),
    treeSurveys: await prisma.treeSurvey.count(),
    treeInterventions: await prisma.treeIntervention.count(),
    greenSpaces: await prisma.greenSpace.count(),
    services: await prisma.service.count(),
    zoneResults: await prisma.zoneResult.count(),
    collectionRecords: await prisma.collectionRecord.count(),
    delayNotices: await prisma.serviceDelayNotice.count(),
    environmentalReports: await prisma.environmentalReport.count(),
    inspections: await prisma.environmentalInspection.count(),
    violationNotices: await prisma.violationNotice.count(),
    repairRequests: await prisma.repairRequest.count(),
    closureRequests: await prisma.streetClosureRequest.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
