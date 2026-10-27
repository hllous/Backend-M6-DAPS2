import {
  ContainerStatus,
  ContainerType,
  CrewType,
  DamageType,
  DelayType,
  DisposalSiteType,
  EnvironmentalReport,
  EnvironmentalReportStatus,
  EnvironmentalReportType,
  GreenSpaceType,
  InspectionNextStep,
  InspectionOutcome,
  M6Role,
  NotServicedReason,
  OutboxEventStatus,
  Prisma,
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
  ServiceType,
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
import { todayArgentina } from '../src/common/utils/date-only';
import { cargarSnapshot, syncZones } from '../src/core/zones-sync';
import { AggregateType, EventType } from '../src/events/event-types';
import * as payloads from '../src/events/payloads';
import { puntoEnGeometria, semillaDe } from '../src/common/utils/geo';
import {
  ArbolSeed,
  BARRIOS,
  Barrio,
  ContenedorSeed,
  ESPACIOS,
  PuntoVerdeSeed,
  cargarPoligonos,
  MIN_ARBOLES,
  MIN_CONTENEDORES,
  generarInventario,
} from './seed-lugares';

const prisma = new PrismaClient();

/**
 * Seed de demostración: Servicios Urbanos de los 48 barrios y las 15 comunas de la Ciudad.
 *
 * Ocho barrios (Belgrano, Palermo, Colegiales, Recoleta, San Nicolás, Puerto Madero,
 * Montserrat y Retiro) conservan calles, plazas y avenidas reales escritas a mano. Las coordenadas salen del
 * normalizador de direcciones de la Ciudad (USIG) y se verificaron contra los
 * polígonos oficiales de barrios: un contenedor que cae en el barrio de al lado
 * no se dibuja en el mapa de su zona.
 *
 * El volumen no es parejo a propósito. Palermo y Belgrano concentran la
 * recolección domiciliaria; San Nicolás y Montserrat, el trabajo céntrico
 * nocturno (recolección, barrido, hidrolavado); Retiro, volumen intermedio de
 * zona de transferencia y paso peatonal; Puerto Madero tiene poca recolección
 * y mucho espacio verde. Un reparto uniforme escondería justo lo
 * que el tablero tiene que mostrar.
 *
 * **Todo es determinístico.** Nada de Math.random: dos corridas el mismo día
 * dan la misma base, y una falla se reproduce.
 *
 * **Idempotente.** Los catálogos van por upsert sobre su clave natural. Lo
 * operativo —servicios, expedientes, derivaciones, eventos— se crea en una sola
 * transacción y solo si no hay servicios cargados: si algo falla a mitad de
 * camino no queda una base a medias, y una segunda corrida no duplica nada.
 *
 * **Zonas, comunas y lugares.** Las 48 zonas (una por barrio) y las 15 comunas salen del
 * snapshot del catálogo de M9 con `syncZones`, con los UUID reales. Los espacios verdes son
 * del dataset abierto de BA Data (`prisma/data/espacios-verdes.json`). Contenedores,
 * puntos verdes y arbolado se generan dentro del polígono de cada barrio (ver
 * `seed-lugares.ts`). Detalle y límites de lo auténtico en docs/seed.md.
 */

// ════════════════════════════════════════════════════════════
// FECHAS
// ════════════════════════════════════════════════════════════

/**
 * Las fechas van relativas a hoy, no fijas: un seed con fechas fijas envejece
 * y a los dos meses la agenda aparece vacía.
 *
 * "Hoy" es el de Argentina: entre las 21 y las 24 el día UTC ya es mañana, y
 * sembrar a esa hora corría toda la operación un día.
 */
const HOY = todayArgentina();

/** Año de las referencias externas (actas, OT de M3, cortes de M7, resoluciones de M4). */
const ANIO = HOY.getUTCFullYear();

/**
 * Plazo que tiene M4 para resolver un acta. Mismo default que
 * `SANCTION_DEADLINE_DAYS` en src/config/env.validation.ts: `issueNotice` fija
 * `deadlineAt = issuedAt + plazo`.
 */
const DIAS_PLAZO_SANCION = Number(process.env.SANCTION_DEADLINE_DAYS ?? 30);

/** Medianoche del día a `n` días de hoy. Para las columnas `@db.Date`. */
function dia(n: number): Date {
  const d = new Date(HOY);
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

/** Un instante del día `n` a la hora **argentina** indicada (UTC-3). */
function momento(n: number, h: number, m = 0): Date {
  const d = dia(n);
  d.setUTCHours(h + 3, m, 0, 0);
  return d;
}

/** Hora suelta, para las columnas `@db.Time()` de la ventana horaria. */
function hora(h: number, m = 0): Date {
  return new Date(Date.UTC(1970, 0, 1, h, m, 0, 0));
}

/** 1 = lunes … 7 = domingo, como `FrequencyWeekday`. */
function diaSemana(n: number): number {
  const w = dia(n).getUTCDay();
  return w === 0 ? 7 : w;
}

/**
 * UUID con forma v4 derivado de un texto. Los tickets de M2 son UUID y no
 * pueden salir de Math.random: la base tiene que ser la misma en cada corrida.
 */
function uuidDe(semilla: string): string {
  let hex = '';
  for (let vuelta = 0; hex.length < 32; vuelta++) {
    let h = 0x811c9dc5 ^ vuelta;
    for (const c of `${semilla}#${vuelta}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
    hex += (h >>> 0).toString(16).padStart(8, '0');
  }
  const variante = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variante}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
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

/** Los códigos de zona son los `codigo` de barrio de M9 (`belgrano`, `san-nicolas`…). */
const TODAS_LAS_ZONAS = BARRIOS.map((b) => b.codigo);

const CENTRO = ['san-nicolas', 'montserrat', 'puerto-madero', 'retiro'];

/**
 * Recorridos sobre corredores reales, con las zonas en el orden en que las
 * hace el camión y la duración estimada de cada tramo.
 */
export const ROUTES = [
  {
    code: 'R-REC-C13',
    name: 'Recolección domiciliaria Comuna 13 — Belgrano y Colegiales (Av. Cabildo, Av. Juramento y Av. Federico Lacroze)',
    stops: [
      { zone: 'belgrano', min: 175 },
      { zone: 'colegiales', min: 95 },
    ],
  },
  {
    code: 'R-REC-PAL',
    name: 'Recolección domiciliaria Palermo — Av. Santa Fe, Av. Scalabrini Ortiz y Av. Córdoba',
    stops: [{ zone: 'palermo', min: 210 }],
  },
  {
    code: 'R-REC-RECO',
    name: 'Recolección domiciliaria Recoleta — Av. Santa Fe, Av. Las Heras y Av. Pueyrredón',
    stops: [{ zone: 'recoleta', min: 190 }],
  },
  {
    code: 'R-REC-SNI',
    name: 'Recolección nocturna San Nicolás y Retiro — Microcentro, Tribunales, Florida norte y terminales',
    stops: [
      { zone: 'san-nicolas', min: 125 },
      { zone: 'retiro', min: 50 },
    ],
  },
  {
    code: 'R-REC-MON',
    name: 'Recolección nocturna Montserrat — Av. de Mayo, Av. Belgrano y Av. Independencia',
    stops: [{ zone: 'montserrat', min: 150 }],
  },
  {
    code: 'R-REC-PMA',
    name: 'Recolección nocturna Puerto Madero — Diques 1 a 4',
    stops: [{ zone: 'puerto-madero', min: 75 }],
  },
  {
    code: 'R-RECI-PR',
    name: 'Recolección de reciclables Palermo–Recoleta',
    stops: [
      { zone: 'palermo', min: 150 },
      { zone: 'recoleta', min: 90 },
    ],
  },
  {
    code: 'R-RECI-BC',
    name: 'Recolección de reciclables Belgrano–Colegiales',
    stops: [
      { zone: 'belgrano', min: 120 },
      { zone: 'colegiales', min: 70 },
    ],
  },
  {
    code: 'R-RECI-CEN',
    name: 'Recolección de reciclables Microcentro — grandes generadores de San Nicolás, Montserrat y Retiro',
    stops: [
      { zone: 'san-nicolas', min: 80 },
      { zone: 'montserrat', min: 55 },
      { zone: 'retiro', min: 40 },
    ],
  },
  {
    code: 'R-BAR-CEN',
    name: 'Barrido mecánico Microcentro — Av. Corrientes, Av. de Mayo y Diagonal Norte',
    stops: [
      { zone: 'san-nicolas', min: 130 },
      { zone: 'montserrat', min: 100 },
    ],
  },
  {
    code: 'R-BAR-SF',
    name: 'Barrido mecánico Av. Santa Fe y Av. del Libertador — Palermo, Recoleta y Retiro',
    stops: [
      { zone: 'palermo', min: 70 },
      { zone: 'recoleta', min: 65 },
      { zone: 'retiro', min: 40 },
    ],
  },
  {
    code: 'R-BAR-CAB',
    name: 'Barrido mecánico Av. Cabildo — Colegiales y Belgrano',
    stops: [
      { zone: 'colegiales', min: 35 },
      { zone: 'belgrano', min: 95 },
    ],
  },
  {
    code: 'R-BAR-MAN-PAL',
    name: 'Barrido manual ejes comerciales de Palermo — Plaza Serrano, Honduras y Thames',
    stops: [{ zone: 'palermo', min: 120 }],
  },
  {
    code: 'R-BAR-MAN-SNI',
    name: 'Barrido manual peatonales Florida (hasta Plaza San Martín) y Lavalle',
    stops: [
      { zone: 'san-nicolas', min: 135 },
      { zone: 'retiro', min: 40 },
    ],
  },
  {
    code: 'R-LAV-CEN',
    name: 'Hidrolavado Plaza de Mayo, Av. de Mayo y paseos de Puerto Madero',
    stops: [
      { zone: 'montserrat', min: 110 },
      { zone: 'puerto-madero', min: 80 },
    ],
  },
  {
    code: 'R-ARB-CENSO',
    name: 'Relevamiento de arbolado — Belgrano y Palermo',
    stops: [
      { zone: 'belgrano', min: 75 },
      { zone: 'palermo', min: 105 },
    ],
  },
];

/**
 * Destinos de disposición. Los camiones de la zona norte descargan en la
 * estación de transferencia de Colegiales y los del centro en la de Pompeya;
 * de ahí va al Norte III. Los reciclables van al Centro de Reciclaje.
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
    code: 'DS-TR-POMPEYA',
    name: 'Estación de transferencia Pompeya',
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
 * Flota: 32 unidades. Patentes Mercosur (AA123BB) ficticias.
 *
 * `capacity` se lee según el tipo: m³ de caja en compactadores y volcadores,
 * de tolva en barredoras y de tanque en regadores; toneladas de izaje en los
 * hidroelevadores; toneladas de carga en las utilitarias.
 *
 * El modelo no tiene estado de flota, solo `active`. "Fuera de servicio" es
 * `active: false`; "asignado" no se guarda, se deduce de los servicios del día.
 */
interface VehiculoSeed {
  plate: string;
  vehicleType: VehicleType;
  capacity: number;
  active?: boolean;
}

export const VEHICLES: VehiculoSeed[] = [
  // Compactadores: el grueso de la flota.
  { plate: 'AB123CD', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 19 },
  { plate: 'AB456CE', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 15 },
  { plate: 'AC789DF', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 21 },
  { plate: 'AC012DG', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 15 },
  { plate: 'AD345EH', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 15 },
  { plate: 'AD901EK', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 15 },
  { plate: 'AE112FA', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 19 },
  { plate: 'AE334FB', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 21 },
  { plate: 'AF556GC', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 15 },
  { plate: 'AF778GD', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 19 },
  // En el taller desde que se le rompió la caja en pleno recorrido de Belgrano.
  { plate: 'AG990HE', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 19, active: false },
  { plate: 'AL113MK', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 19 },
  { plate: 'AM335NB', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 21 },
  // Volcadores: voluminosos, restos verdes.
  { plate: 'AD678EJ', vehicleType: VehicleType.DUMP_TRUCK, capacity: 12 },
  { plate: 'AE901FK', vehicleType: VehicleType.DUMP_TRUCK, capacity: 12 },
  { plate: 'AH221JA', vehicleType: VehicleType.DUMP_TRUCK, capacity: 6 },
  { plate: 'AH443JB', vehicleType: VehicleType.DUMP_TRUCK, capacity: 6 },
  // Barredoras.
  { plate: 'AE234FL', vehicleType: VehicleType.SWEEPER, capacity: 5 },
  { plate: 'AF567GM', vehicleType: VehicleType.SWEEPER, capacity: 5 },
  // Cepillo lateral roto: esperando repuesto.
  { plate: 'AF890GN', vehicleType: VehicleType.SWEEPER, capacity: 4, active: false },
  { plate: 'AJ665KC', vehicleType: VehicleType.SWEEPER, capacity: 4 },
  // Regadores / hidrolavadoras.
  { plate: 'AG123HP', vehicleType: VehicleType.WATER_TANKER, capacity: 10 },
  { plate: 'AG456HQ', vehicleType: VehicleType.WATER_TANKER, capacity: 8 },
  { plate: 'AK331LF', vehicleType: VehicleType.WATER_TANKER, capacity: 8 },
  { plate: 'AK553LG', vehicleType: VehicleType.WATER_TANKER, capacity: 10 },
  // Hidroelevadores de poda.
  { plate: 'AH789JR', vehicleType: VehicleType.CRANE_TRUCK, capacity: 3 },
  { plate: 'AH012JS', vehicleType: VehicleType.CRANE_TRUCK, capacity: 2 },
  { plate: 'AL775MH', vehicleType: VehicleType.CRANE_TRUCK, capacity: 3 },
  // Utilitarias.
  { plate: 'AJ345KT', vehicleType: VehicleType.VAN, capacity: 1 },
  // Dada de baja por mantenimiento mayor.
  { plate: 'AJ678KU', vehicleType: VehicleType.VAN, capacity: 1, active: false },
  { plate: 'AL997MJ', vehicleType: VehicleType.VAN, capacity: 1 },
  { plate: 'AM219NA', vehicleType: VehicleType.VAN, capacity: 1 },
];

/** Qué tipos de vehículo sirven para cada tipo de servicio. */
const VEHICULOS_APTOS: Record<string, VehicleType[]> = {
  'REC-DOM': [VehicleType.COMPACTOR_TRUCK],
  'REC-REC': [VehicleType.COMPACTOR_TRUCK],
  'REC-VOL': [VehicleType.DUMP_TRUCK, VehicleType.CRANE_TRUCK],
  'BAR-MEC': [VehicleType.SWEEPER],
  'BAR-MAN': [VehicleType.VAN],
  'HIG-LAV': [VehicleType.WATER_TANKER],
  'CONT-VAC': [VehicleType.COMPACTOR_TRUCK],
  'CONT-LAV': [VehicleType.WATER_TANKER],
  'ARB-POD': [VehicleType.CRANE_TRUCK],
  'ARB-CENSO': [VehicleType.VAN],
  'EV-RIEGO': [VehicleType.WATER_TANKER],
  'EV-MANT': [VehicleType.VAN, VehicleType.DUMP_TRUCK],
  'AMB-INSP': [VehicleType.VAN],
};

/**
 * Doce cuadrillas, cuatro por turno.
 *
 * El modelo no guarda zona ni especialidad de una cuadrilla: `tipos` y `zonas`
 * no se persisten, son el contrato que el seed se obliga a cumplir al
 * asignarle servicios (ver `verificar`). `bajaDesde` es el día desde el que no
 * está disponible.
 *
 * Las cooperativas son de recuperadores urbanos: en la Ciudad la fracción
 * reciclable la levantan cooperativas, no el servicio municipal. Su registro
 * como organización es de M1, por eso `organizationId` es una referencia.
 */
interface CuadrillaSeed {
  clave: string;
  name: string;
  crewType: CrewType;
  defaultShift: Shift;
  leaderUserId: string;
  organizationId: string | null;
  members: string[];
  active: boolean;
  tipos: string[];
  zonas: string[];
  bajaDesde?: number;
}

export const CREWS: CuadrillaSeed[] = [
  // ── Mañana: recolección, barrido, poda, mantenimiento y riego ──
  {
    clave: 'BEL-REC',
    name: 'Cuadrilla Municipal Belgrano y Colegiales — Recolección',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.MORNING,
    leaderUserId: '101',
    organizationId: null,
    members: ['101', '102', '103', '104'],
    active: true,
    tipos: ['REC-DOM', 'CONT-VAC', 'REC-VOL'],
    zonas: ['belgrano', 'colegiales'],
  },
  {
    clave: 'PAL-REC',
    name: 'Cuadrilla Municipal Palermo — Recolección y Barrido',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.MORNING,
    leaderUserId: '111',
    organizationId: null,
    members: ['111', '112', '113', '114', '115'],
    active: true,
    tipos: ['REC-DOM', 'BAR-MAN', 'CONT-VAC', 'REC-VOL'],
    zonas: ['palermo'],
  },
  {
    clave: 'ARBOLADO',
    name: 'Cuadrilla Municipal Arbolado — Poda y Relevamiento de toda la Ciudad',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.MORNING,
    leaderUserId: '401',
    organizationId: null,
    members: ['401', '402', '403'],
    active: true,
    tipos: ['ARB-POD', 'ARB-CENSO'],
    zonas: TODAS_LAS_ZONAS,
  },
  {
    clave: 'EV',
    name: 'Cuadrilla Municipal Parques y Plazas — Espacios Verdes',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.MORNING,
    leaderUserId: '501',
    organizationId: null,
    members: ['501', '502', '503', '504'],
    active: true,
    tipos: ['EV-MANT', 'EV-RIEGO'],
    zonas: TODAS_LAS_ZONAS,
  },
  // ── Tarde: recolección, reciclables, limpieza e inspección ──
  {
    clave: 'COOP-PAL',
    name: 'Cooperativa de Recuperadores Palermo — Reciclables',
    crewType: CrewType.COOPERATIVE,
    defaultShift: Shift.AFTERNOON,
    leaderUserId: '201',
    organizationId: '3301',
    members: ['201', '202', '203', '204'],
    active: true,
    tipos: ['REC-REC', 'CONT-VAC'],
    zonas: ['palermo', 'recoleta', 'belgrano', 'colegiales'],
  },
  {
    // Convenio en renovación: sin cobertura hasta que se firme. Sus recorridos
    // los tomó la cooperativa de Palermo.
    clave: 'COOP-BC',
    name: 'Cooperativa de Recuperadores Belgrano y Colegiales — Reciclables',
    crewType: CrewType.COOPERATIVE,
    defaultShift: Shift.AFTERNOON,
    leaderUserId: '211',
    organizationId: '3302',
    members: ['211', '212', '213'],
    active: false,
    tipos: ['REC-REC'],
    zonas: ['belgrano', 'colegiales'],
    bajaDesde: -6,
  },
  {
    clave: 'RECO',
    name: 'Cuadrilla Municipal Recoleta — Recolección y Limpieza',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.AFTERNOON,
    leaderUserId: '121',
    organizationId: null,
    members: ['121', '122', '123', '124'],
    active: true,
    tipos: ['REC-DOM', 'REC-VOL', 'CONT-VAC', 'CONT-LAV'],
    zonas: ['recoleta'],
  },
  {
    // Sin vehículo propio: los inspectores se mueven a pie o en transporte público.
    clave: 'INSP',
    name: 'Cuadrilla Municipal Control Ambiental — Inspección',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.AFTERNOON,
    leaderUserId: '601',
    organizationId: null,
    members: ['601', '602'],
    active: true,
    tipos: ['AMB-INSP'],
    zonas: TODAS_LAS_ZONAS,
  },
  // ── Noche: recolección, barrido y limpieza céntrica ──
  {
    clave: 'CEN-REC',
    name: 'Cuadrilla Municipal Centro y Retiro — Recolección Nocturna',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.NIGHT,
    leaderUserId: '131',
    organizationId: null,
    members: ['131', '132', '133', '134'],
    active: true,
    tipos: ['REC-DOM'],
    zonas: CENTRO,
  },
  {
    clave: 'CEN-LIM',
    name: 'Cuadrilla Municipal Microcentro — Barrido Manual y Limpieza',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.NIGHT,
    leaderUserId: '141',
    organizationId: null,
    members: ['141', '142', '143', '144', '145'],
    active: true,
    tipos: ['BAR-MAN', 'HIG-LAV', 'CONT-VAC', 'CONT-LAV'],
    zonas: CENTRO,
  },
  {
    clave: 'BAR-MEC',
    name: 'Cuadrilla Municipal Avenidas — Barrido Mecánico',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.NIGHT,
    leaderUserId: '301',
    organizationId: null,
    members: ['301', '302', '303'],
    active: true,
    tipos: ['BAR-MEC'],
    zonas: ['san-nicolas', 'montserrat', 'retiro', 'palermo', 'recoleta', 'belgrano', 'colegiales'],
  },
  {
    clave: 'COOP-CEN',
    name: 'Cooperativa de Recuperadores Microcentro — Reciclables',
    crewType: CrewType.COOPERATIVE,
    defaultShift: Shift.NIGHT,
    leaderUserId: '221',
    organizationId: '3303',
    members: ['221', '222', '223', '224'],
    active: true,
    tipos: ['REC-REC', 'CONT-VAC'],
    zonas: CENTRO,
  },
];

/**
 * Personal de Oficina y auditoría de la demo. Los ids son los `sub` numéricos del
 * token de M1 (no hay usuarios reales: M1 no está hosteado y los tokens de demo los
 * firma scripts/generate-demo-jwt.mjs). El id 1 es el admin inicial y NO lleva fila:
 * es M6_ADMIN por M6_BOOTSTRAP_ADMIN_USER_IDS. Campo sale de las cuadrillas (CREWS).
 */
const PERSONAL_DE_OFICINA: { userId: string; roles: M6Role[] }[] = [
  { userId: '2', roles: [M6Role.M6_ADMIN] },
  { userId: '3', roles: [M6Role.M6_OFICINA_OPERACIONES] },
  { userId: '4', roles: [M6Role.M6_OFICINA_OPERACIONES] },
  { userId: '5', roles: [M6Role.M6_OFICINA_AMBIENTAL] },
  { userId: '6', roles: [M6Role.M6_OFICINA_AMBIENTAL] },
  { userId: '7', roles: [M6Role.M6_OFICINA_OPERACIONES, M6Role.M6_OFICINA_AMBIENTAL] },
  { userId: '8', roles: [M6Role.M6_AUDITOR] },
  { userId: '9', roles: [M6Role.M6_AUDITOR] },
];

/** Los roles de M6 de cada usuario de la demo: Oficina fija y Campo según su cuadrilla. */
function rolesDeLaDemo(): { userId: string; role: M6Role }[] {
  const filas = PERSONAL_DE_OFICINA.flatMap((p) =>
    p.roles.map((role) => ({ userId: p.userId, role })),
  );
  for (const c of CREWS) {
    for (const userId of new Set([c.leaderUserId, ...c.members])) {
      filas.push({ userId, role: M6Role.M6_CAMPO_CUADRILLA });
      // La cuadrilla de inspección también cierra las inspecciones ambientales.
      if (c.clave === 'INSP') filas.push({ userId, role: M6Role.M6_CAMPO_INSPECTOR });
    }
  }
  return filas;
}

/**
 * Franjas en las que trabaja cada turno, en minutos del día. La noche va en
 * dos pedazos porque la ventana de un servicio no cruza la medianoche
 * (`windowFrom < windowTo`): lo que se hace de madrugada se agenda en el día
 * en que ocurre.
 */
const FRANJAS_TURNO: Record<Shift, [number, number][]> = {
  [Shift.MORNING]: [[6 * 60, 13 * 60]],
  [Shift.AFTERNOON]: [[13 * 60, 21 * 60]],
  [Shift.NIGHT]: [
    [21 * 60, 23 * 60 + 59],
    [0, 6 * 60],
  ],
};

// ════════════════════════════════════════════════════════════
// INVENTARIO URBANO
// ════════════════════════════════════════════════════════════

function ct(
  code: string,
  zone: string,
  containerType: ContainerType,
  address: string,
  lat: number,
  lng: number,
  capacityLiters: number,
  extra: Partial<ContenedorSeed> = {},
): ContenedorSeed {
  return { code, zone, containerType, address, lat, lng, capacityLiters, ...extra };
}

const H = ContainerType.HOUSEHOLD;
const R = ContainerType.RECYCLABLE;

/**
 * Contenedores. La mayoría activos; los que no, cuentan algo: desbordes donde
 * hay gastronomía o salida de teatros, daños donde hay vandalismo, uno en el
 * taller, uno en reubicación y uno retirado por una peatonalización.
 */
const CONTAINERS_BASE: ContenedorSeed[] = [
  ct('CT-BEL-0001', 'belgrano', H, 'Av. Cabildo 2200', -34.5613, -58.4575, 3200),
  ct('CT-BEL-0002', 'belgrano', R, 'Av. Juramento 2400', -34.5621, -58.4565, 3200),
  // Barrio Chino: mucha gastronomía, mucho volumen los fines de semana.
  ct('CT-BEL-0003', 'belgrano', H, 'Arribeños 2200', -34.5572, -58.4508, 2400, {
    status: ContainerStatus.OVERFLOWED,
  }),
  ct(
    'CT-BEL-0004',
    'belgrano',
    ContainerType.GREEN,
    'Av. Virrey Vértiz 1900',
    -34.5599,
    -58.4482,
    1100,
  ),
  ct('CT-BEL-0005', 'belgrano', H, 'Echeverría 2800', -34.5651, -58.4594, 2400),
  ct('CT-BEL-0006', 'belgrano', R, 'Monroe 2600', -34.5594, -58.4616, 2400),
  ct('CT-BEL-0007', 'belgrano', H, 'Mendoza 2500', -34.5616, -58.4584, 3200),
  ct(
    'CT-BEL-0008',
    'belgrano',
    ContainerType.BULKY,
    'Av. Congreso 2300',
    -34.5549,
    -58.4612,
    5000,
    {
      status: ContainerStatus.DAMAGED,
      damageType: DamageType.BURNT,
      severity: Severity.HIGH,
      requiresPublicWorks: true,
    },
  ),
  // Retirado: la cuadra se peatonalizó. La fila queda porque los servicios
  // históricos la referencian.
  ct('CT-BEL-0009', 'belgrano', R, 'Mendoza 1700', -34.5571, -58.4507, 1100, {
    status: ContainerStatus.REMOVED,
  }),
  ct('CT-PAL-0001', 'palermo', H, 'Honduras 5800', -34.5826, -58.4383, 3200),
  ct('CT-PAL-0002', 'palermo', R, 'Fitz Roy 1700', -34.5842, -58.4364, 3200),
  // Las Cañitas: la vereda gastronómica castiga los contenedores.
  ct('CT-PAL-0003', 'palermo', H, 'Báez 400', -34.5715, -58.4321, 2400, {
    status: ContainerStatus.DAMAGED,
    damageType: DamageType.LID_BROKEN,
    severity: Severity.MEDIUM,
    requiresPublicWorks: false,
  }),
  ct('CT-PAL-0004', 'palermo', H, 'Gurruchaga 1800', -34.5881, -58.4273, 3200),
  ct('CT-PAL-0005', 'palermo', R, 'Jorge Luis Borges 1900', -34.5867, -58.4272, 3200),
  ct(
    'CT-PAL-0006',
    'palermo',
    ContainerType.BULKY,
    'Av. Juan B. Justo 1900',
    -34.5888,
    -58.4381,
    5000,
  ),
  ct(
    'CT-PAL-0007',
    'palermo',
    ContainerType.GREEN,
    'Scalabrini Ortiz 2400',
    -34.5861,
    -58.4176,
    1100,
  ),
  ct('CT-PAL-0008', 'palermo', H, 'Av. Las Heras 3900', -34.5819, -58.4141, 2400, {
    status: ContainerStatus.RELOCATING,
  }),
  ct('CT-PAL-0009', 'palermo', H, 'Godoy Cruz 1800', -34.5869, -58.433, 2400, {
    status: ContainerStatus.UNDER_REPAIR,
  }),
  ct('CT-PAL-0010', 'palermo', R, 'Av. Santa Fe 4200', -34.5813, -58.4217, 3200, {
    status: ContainerStatus.OVERFLOWED,
  }),
  ct('CT-PAL-0011', 'palermo', H, 'Serrano 1500', -34.5894, -58.4313, 3200),
  ct('CT-COL-0001', 'colegiales', H, 'Av. Federico Lacroze y Zapiola', -34.576, -58.4484, 3200),
  ct('CT-COL-0002', 'colegiales', R, 'Conde y Concepción Arenal', -34.5809, -58.4446, 2400),
  ct('CT-COL-0003', 'colegiales', H, 'Virrey Avilés y Ramón Freire', -34.5725, -58.4579, 2400, {
    status: ContainerStatus.OVERFLOWED,
  }),
  ct('CT-COL-0004', 'colegiales', ContainerType.GREEN, 'Av. Elcano 3100', -34.572, -58.4587, 1100),
  ct('CT-COL-0005', 'colegiales', H, 'Virrey Loreto 3400', -34.5759, -58.4566, 2400),
  ct('CT-REC-0001', 'recoleta', H, 'Av. Pueyrredón 1700', -34.5916, -58.4012, 3200),
  ct('CT-REC-0002', 'recoleta', R, 'Junín 1800', -34.5881, -58.3924, 3200),
  ct('CT-REC-0003', 'recoleta', H, 'Av. Callao 1200', -34.595, -58.3933, 2400),
  ct('CT-REC-0004', 'recoleta', H, 'Av. Santa Fe y Anchorena', -34.5933, -58.4051, 3200),
  ct('CT-REC-0005', 'recoleta', R, 'Av. Las Heras y Av. Pueyrredón', -34.5875, -58.3972, 3200),
  ct('CT-REC-0006', 'recoleta', H, 'French y Billinghurst', -34.5863, -58.4066, 2400, {
    status: ContainerStatus.UNDER_REPAIR,
  }),
  ct('CT-REC-0007', 'recoleta', H, 'Ayacucho 1500', -34.5918, -58.394, 2400),
  ct('CT-SNI-0001', 'san-nicolas', H, 'Tucumán y Reconquista', -34.6009, -58.3726, 3200),
  ct('CT-SNI-0002', 'san-nicolas', R, 'Sarmiento y San Martín', -34.6045, -58.3738, 3200),
  // La salida de los teatros de Corrientes lo desborda casi todas las noches.
  ct('CT-SNI-0003', 'san-nicolas', H, 'Av. Corrientes y Paraná', -34.6041, -58.3879, 3200, {
    status: ContainerStatus.OVERFLOWED,
  }),
  ct('CT-SNI-0004', 'san-nicolas', H, 'Viamonte y Uruguay', -34.6006, -58.3867, 2400),
  ct('CT-SNI-0005', 'san-nicolas', R, 'Libertad y Tucumán', -34.6015, -58.3839, 2400),
  ct('CT-SNI-0006', 'san-nicolas', H, 'Diagonal Norte y Esmeralda', -34.6057, -58.378, 3200, {
    status: ContainerStatus.DAMAGED,
    damageType: DamageType.VANDALIZED,
    severity: Severity.MEDIUM,
    requiresPublicWorks: false,
  }),
  ct('CT-MON-0001', 'montserrat', H, 'Av. de Mayo y Salta', -34.6092, -58.3834, 3200),
  ct('CT-MON-0002', 'montserrat', R, 'Chacabuco y Alsina', -34.6105, -58.3763, 2400),
  ct('CT-MON-0003', 'montserrat', H, 'Perú y Av. Belgrano', -34.6126, -58.3747, 3200),
  ct('CT-MON-0004', 'montserrat', H, 'Moreno y Piedras', -34.6117, -58.3777, 2400),
  ct('CT-MON-0005', 'montserrat', R, 'Hipólito Yrigoyen y Lima', -34.6097, -58.3819, 2400),
  ct('CT-RET-0001', 'retiro', H, 'Florida 900', -34.5976, -58.3755, 3200),
  ct('CT-RET-0002', 'retiro', R, 'Reconquista 1000', -34.5963, -58.3732, 3200),
  // La salida de las terminales de Retiro lo llena antes que la rotación.
  ct('CT-RET-0003', 'retiro', H, 'Av. Santa Fe 900', -34.5953, -58.3798, 3200, {
    status: ContainerStatus.OVERFLOWED,
  }),
  ct('CT-RET-0004', 'retiro', H, 'Esmeralda 1100', -34.5952, -58.3786, 2400),
  ct('CT-RET-0005', 'retiro', R, 'Juncal 1000', -34.5929, -58.3815, 2400),
  ct('CT-RET-0006', 'retiro', H, 'Av. Antártida Argentina 1100', -34.5904, -58.371, 3200),
  ct(
    'CT-PMA-0001',
    'puerto-madero',
    H,
    'Av. Alicia Moreau de Justo 1000',
    -34.6096,
    -58.3664,
    2400,
  ),
  ct('CT-PMA-0002', 'puerto-madero', R, 'Juana Manso 1000', -34.6093, -58.3629, 2400),
  ct('CT-PMA-0003', 'puerto-madero', H, 'Av. Alicia Moreau de Justo 400', -34.6024, -58.3674, 2400),
];

/** Puntos verdes de entrega voluntaria, en plazas. */
const GREEN_POINTS_BASE: PuntoVerdeSeed[] = [
  {
    code: 'GP-BEL-01',
    name: 'Punto Verde Barrancas de Belgrano',
    zone: 'belgrano',
    address: 'Av. Juramento y 11 de Septiembre de 1888',
    lat: -34.5588,
    lng: -58.4512,
    wasteTypes: [WasteType.RECYCLABLE, WasteType.GREEN],
  },
  {
    code: 'GP-PAL-01',
    name: 'Punto Verde Plaza Güemes',
    zone: 'palermo',
    address: 'Charcas y Jerónimo Salguero',
    lat: -34.5892,
    lng: -58.4158,
    wasteTypes: [WasteType.RECYCLABLE],
  },
  {
    code: 'GP-PAL-02',
    name: 'Punto Verde Parque Tres de Febrero',
    zone: 'palermo',
    address: 'Av. Infanta Isabel y Av. Iraola',
    lat: -34.5721,
    lng: -58.4137,
    wasteTypes: [WasteType.RECYCLABLE, WasteType.GREEN, WasteType.BULKY],
  },
  {
    code: 'GP-COL-01',
    name: 'Punto Verde Plaza Mafalda',
    zone: 'colegiales',
    address: 'Conde y Concepción Arenal',
    lat: -34.5812,
    lng: -58.4441,
    wasteTypes: [WasteType.RECYCLABLE],
  },
  {
    code: 'GP-REC-01',
    name: 'Punto Verde Parque Las Heras',
    zone: 'recoleta',
    address: 'Av. Las Heras y Av. Coronel Díaz',
    lat: -34.5852,
    lng: -58.4059,
    wasteTypes: [WasteType.RECYCLABLE, WasteType.GREEN],
  },
  {
    code: 'GP-SNI-01',
    name: 'Punto Verde Plaza Lavalle',
    zone: 'san-nicolas',
    address: 'Tucumán y Talcahuano',
    lat: -34.6015,
    lng: -58.3848,
    wasteTypes: [WasteType.RECYCLABLE],
  },
  {
    code: 'GP-MON-01',
    name: 'Punto Verde Plaza Montserrat',
    zone: 'montserrat',
    address: 'Av. Belgrano y Lima',
    lat: -34.6128,
    lng: -58.3812,
    wasteTypes: [WasteType.RECYCLABLE],
  },
  {
    code: 'GP-RET-01',
    name: 'Punto Verde Plaza San Martín',
    zone: 'retiro',
    address: 'Av. Santa Fe y Maipú',
    lat: -34.595,
    lng: -58.3777,
    wasteTypes: [WasteType.RECYCLABLE],
  },
  {
    code: 'GP-PMA-01',
    name: 'Punto Verde Puerto Madero — Dique 3',
    zone: 'puerto-madero',
    address: 'Av. Alicia Moreau de Justo y Macacha Güemes',
    lat: -34.6052,
    lng: -58.367,
    wasteTypes: [WasteType.RECYCLABLE, WasteType.MIXED],
  },
];

function arbol(
  surveyCode: string,
  zone: string,
  species: string,
  address: string,
  lat: number,
  lng: number,
  heightM: number,
  diameterCm: number,
): ArbolSeed {
  return { surveyCode, zone, species, address, lat, lng, heightM, diameterCm };
}

/**
 * Arbolado de alineación. Las especies son las que dominan cada barrio: tipa,
 * plátano, fresno y jacarandá al norte; lapacho y ceibo en Puerto Madero. El
 * código lleva la comuna (13 Belgrano/Colegiales, 14 Palermo, 2 Recoleta,
 * 1 centro).
 */
const TIPA = 'Tipuana tipu';
const PLATANO = 'Platanus x acerifolia';
const FRESNO = 'Fraxinus pennsylvanica';
const JACARANDA = 'Jacaranda mimosifolia';

const TREES_BASE: ArbolSeed[] = [
  arbol('ARB-13-00101', 'belgrano', TIPA, 'Av. Juramento 2200', -34.5609, -58.4546, 16, 78),
  arbol(
    'ARB-13-00102',
    'belgrano',
    JACARANDA,
    'Vuelta de Obligado 2300',
    -34.5597,
    -58.4573,
    9,
    41.5,
  ),
  arbol(
    'ARB-13-00103',
    'belgrano',
    PLATANO,
    '11 de Septiembre de 1888 1700',
    -34.5627,
    -58.4479,
    18,
    92,
  ),
  arbol('ARB-13-00104', 'belgrano', FRESNO, 'Echeverría 2600', -34.5641, -58.4576, 11.5, 52),
  arbol('ARB-13-00105', 'belgrano', 'Ceiba speciosa', 'Superí 1800', -34.5707, -58.4641, 12, 74),
  arbol(
    'ARB-13-00106',
    'belgrano',
    TIPA,
    'Mcal. Antonio José de Sucre 2400',
    -34.5639,
    -58.4549,
    15,
    70,
  ),
  arbol('ARB-13-00107', 'belgrano', 'Melia azedarach', 'La Pampa 2100', -34.5632, -58.4513, 8, 36),
  arbol('ARB-13-00201', 'colegiales', FRESNO, 'Zapiola 800', -34.5756, -58.4494, 10, 44),
  arbol('ARB-13-00202', 'colegiales', TIPA, 'Conesa 900', -34.5739, -58.4497, 14, 66),
  arbol('ARB-13-00203', 'colegiales', FRESNO, 'Virrey Avilés 3200', -34.5735, -58.4587, 12, 58),
  arbol(
    'ARB-13-00204',
    'colegiales',
    JACARANDA,
    'Teodoro García 2900',
    -34.5742,
    -58.4488,
    8.5,
    37,
  ),
  arbol('ARB-14-00301', 'palermo', TIPA, 'Gorriti 5600', -34.5851, -58.4371, 16, 81),
  arbol('ARB-14-00302', 'palermo', FRESNO, 'Arévalo 1500', -34.5827, -58.4425, 10.5, 45),
  arbol('ARB-14-00303', 'palermo', JACARANDA, 'Armenia 1700', -34.5894, -58.4273, 8.5, 38),
  arbol('ARB-14-00304', 'palermo', TIPA, 'Thames 1800', -34.5868, -58.4293, 17.5, 88),
  arbol(
    'ARB-14-00305',
    'palermo',
    PLATANO,
    'Av. Pres. Figueroa Alcorta y Jerónimo Salguero',
    -34.5765,
    -58.4049,
    19,
    105,
  ),
  arbol(
    'ARB-14-00306',
    'palermo',
    'Erythrina crista-galli',
    'Av. Infanta Isabel 500',
    -34.5708,
    -58.4213,
    7,
    33,
  ),
  arbol('ARB-14-00307', 'palermo', JACARANDA, 'Malabia 2300', -34.5861, -58.42, 9.5, 43),
  arbol(
    'ARB-14-00308',
    'palermo',
    'Ceiba speciosa',
    'República de la India 2900',
    -34.5792,
    -58.4154,
    13,
    80,
  ),
  arbol(
    'ARB-02-00401',
    'recoleta',
    'Ficus benjamina',
    'Av. Pres. Manuel Quintana 400',
    -34.5893,
    -58.3889,
    13,
    79,
  ),
  arbol('ARB-02-00402', 'recoleta', PLATANO, 'Av. Alvear 1800', -34.5885, -58.388, 20, 112),
  arbol('ARB-02-00403', 'recoleta', TIPA, 'Ayacucho 1200', -34.5947, -58.396, 15, 70),
  arbol('ARB-02-00404', 'recoleta', FRESNO, 'Peña 2200', -34.5913, -58.3966, 11, 49),
  arbol('ARB-02-00405', 'recoleta', TIPA, 'Agüero 1900', -34.5896, -58.4044, 16.5, 84),
  arbol(
    'ARB-01-00501',
    'puerto-madero',
    'Handroanthus impetiginosus',
    'Av. Alicia Moreau de Justo 1500',
    -34.6157,
    -58.3659,
    7.5,
    28,
  ),
  arbol(
    'ARB-01-00502',
    'puerto-madero',
    'Erythrina crista-galli',
    'Juana Manso 1300',
    -34.6128,
    -58.3622,
    6.5,
    30,
  ),
  arbol('ARB-01-00503', 'puerto-madero', TIPA, 'Macacha Güemes 500', -34.6047, -58.3624, 11, 46),
  arbol('ARB-01-00601', 'san-nicolas', PLATANO, 'Talcahuano 500', -34.6027, -58.3852, 17, 90),
  arbol('ARB-01-00602', 'san-nicolas', FRESNO, 'Suipacha 600', -34.6014, -58.3796, 10, 42),
  arbol(
    'ARB-01-00801',
    'retiro',
    'Ficus macrophylla',
    'Plaza San Martín — Maipú y Florida',
    -34.5953,
    -58.3753,
    22,
    180,
  ),
  arbol(
    'ARB-01-00802',
    'retiro',
    'Phytolacca dioica',
    'Plaza San Martín — Av. del Libertador',
    -34.5945,
    -58.376,
    12,
    150,
  ),
  arbol('ARB-01-00803', 'retiro', FRESNO, 'Arroyo 900', -34.5915, -58.38, 11, 47),
  arbol(
    'ARB-01-00701',
    'montserrat',
    PLATANO,
    'Bernardo de Irigoyen 600',
    -34.6151,
    -58.3803,
    18,
    95,
  ),
  arbol('ARB-01-00702', 'montserrat', FRESNO, 'Chacabuco 300', -34.6115, -58.3762, 9.5, 40),
];

/**
 * Inventario completo: lo escrito a mano para los ocho barrios originales y, en todos los
 * barrios, lo que falta hasta el mínimo, generado dentro del polígono oficial del barrio.
 */
const POLIGONOS = cargarPoligonos();

function contarPorZona(items: { zone: string }[]): Map<string, number> {
  const n = new Map<string, number>();
  for (const i of items) n.set(i.zone, (n.get(i.zone) ?? 0) + 1);
  return n;
}

const INVENTARIO = generarInventario(POLIGONOS, {
  contenedores: contarPorZona(CONTAINERS_BASE),
  puntosVerdes: contarPorZona(GREEN_POINTS_BASE),
  arboles: contarPorZona(TREES_BASE),
});

export const CONTAINERS: ContenedorSeed[] = [...CONTAINERS_BASE, ...INVENTARIO.contenedores];
export const GREEN_POINTS: PuntoVerdeSeed[] = [...GREEN_POINTS_BASE, ...INVENTARIO.puntosVerdes];
export const TREES: ArbolSeed[] = [...TREES_BASE, ...INVENTARIO.arboles];

/**
 * Espacios verdes: todos los del dataset de BA Data (plazas, parques, plazoletas, paseos).
 * Cada uno se identifica por `ev-<id del dataset>`; el nombre no sirve de clave porque se
 * repite entre barrios.
 */
const claveEspacio = (id: number): string => `ev-${id}`;

export const TIPO_ESPACIO: Record<string, GreenSpaceType> = {
  PLAZA: GreenSpaceType.SQUARE,
  PLAZOLETA: GreenSpaceType.SQUARE,
  PARQUE: GreenSpaceType.PARK,
  'PARQUE SEMIPÚBLICO': GreenSpaceType.PARK,
  'JARDÍN BOTÁNICO': GreenSpaceType.PARK,
  PASEO: GreenSpaceType.PROMENADE,
};

/** Los espacios que nombran los servicios escritos a mano, y su id en el dataset. */
const ESPACIO_POR_NOMBRE: Record<string, number> = {
  'Barrancas de Belgrano': 610,
  'Plaza Manuel Belgrano': 1154,
  'Plaza Noruega': 911,
  'Plaza Castelli': 899,
  'Parque Tres de Febrero (Bosques de Palermo)': 1537,
  'Jardín Botánico Carlos Thays': 1330,
  'Plaza Italia': 885,
  'El Rosedal de Palermo': 1490,
  'Plaza Güemes': 630,
  'Plaza Mafalda': 1160,
  'Plaza Francia': 887,
  'Plaza Vicente López': 481,
  'Plaza Intendente Alvear': 482,
  'Plaza Lavalle': 881,
  'Plaza de la República': 647,
  'Plaza de Mayo': 883,
  'Plaza San Martín': 882,
  'Plaza Fuerza Aérea Argentina': 511,
  'Parque Mujeres Argentinas': 1284,
  'Parque Micaela Bastidas': 1161,
  'Paseo de la Costanera Sur': 1274,
};

// ════════════════════════════════════════════════════════════
// PLAN DE OPERACIÓN
// ════════════════════════════════════════════════════════════

type Hm = readonly [number, number];
type Franja = readonly [Hm, Hm];
type Objetivo = 'CONTAINER' | 'TREE' | 'GREEN_SPACE' | 'GREEN_POINT';

interface ResultadoZona {
  zona: string;
  estado: ZoneResultStatus;
  motivo?: NotServicedReason;
  notas?: string;
  propuesta?: number;
}

interface Demora {
  tipo: DelayType;
  minutos: number;
  motivo: string;
  /** Estado del servicio cuando se levantó el aviso. */
  estado: ServiceStatus;
  /** [días desde el del servicio, hora, minuto]. */
  detectado: [number, number, number];
  finEstimado?: [number, number, number];
  reportadoPor: string;
}

/**
 * Un servicio, tal como quedó hoy después de pasar por la máquina de estados.
 * `resultados` solo hace falta cuando no son todas las zonas atendidas.
 */
interface Plan {
  clave?: string;
  tipo: string;
  dia: number;
  franja: Franja;
  cuadrilla?: string;
  vehiculo?: string;
  estado: ServiceStatus;
  origen: ServiceOrigin;
  recorrido?: string;
  objetivo?: { tipo: Objetivo; codigo: string };
  zona?: string;
  motivo?: string;
  ticket?: string;
  alerta?: string;
  notas?: string;
  resultados?: ResultadoZona[];
  /** El último resultado se cargó pasada la medianoche. */
  cierreTarde?: boolean;
  demoras?: Demora[];
  override?: string;
}

/** Franja horaria de 'HH:mm' a 'HH:mm'. */
function fr(desde: string, hasta: string): Franja {
  const hm = (t: string): Hm => [Number(t.slice(0, 2)), Number(t.slice(3, 5))];
  return [hm(desde), hm(hasta)];
}

const FRANJA = {
  madrugada: fr('00:30', '04:30'),
  mananaTemprano: fr('06:00', '11:00'),
};

/** Fin de la cursada: la agenda llega hasta acá (al menos tres días, si se siembra después). */
const FIN_DE_CURSADA = Date.UTC(2026, 11, 16);

/** Días que genera la planificación semanal: dos semanas de historia y la agenda hasta el fin de la cursada. */
const DESDE = -14;
const HASTA = Math.max(3, Math.round((FIN_DE_CURSADA - HOY.getTime()) / 86_400_000));

const TODOS = [1, 2, 3, 4, 5, 6, 7];
const LMV = [1, 3, 5];
const MJ = [2, 4];

/** El `routeId` del servicio lo decide la frecuencia; la cuadrilla y el vehículo pueden cambiar por día. */
interface FrecuenciaSeed {
  serviceType: string;
  route: string;
  shift: Shift;
  weekdays: number[];
  franja: Franja;
  cuadrilla: (d: number) => string;
  vehiculo?: (d: number) => string;
}

/**
 * Qué día se rompió la barredora AF890GN: la última pasada por Av. Santa Fe.
 * Depende del día de la semana en que se siembra, por eso se calcula.
 */
const ROTURA_BARREDORA = diasDe(MJ)
  .filter((d) => d < 0)
  .reverse()[0];

/** Días de baja de cada vehículo fuera de servicio: desde ese día no se le asigna nada. */
const BAJA_VEHICULO: Record<string, number> = {
  AG990HE: -8,
  AF890GN: ROTURA_BARREDORA + 1,
  AJ678KU: DESDE - 30,
};

export const FREQUENCIES: FrecuenciaSeed[] = [
  {
    serviceType: 'REC-DOM',
    route: 'R-REC-C13',
    shift: Shift.MORNING,
    weekdays: TODOS,
    franja: FRANJA.mananaTemprano,
    cuadrilla: () => 'BEL-REC',
    // Hasta la rotura del -9 salía el AG990HE; desde entonces, el de reserva.
    vehiculo: (d) => (d <= -9 ? 'AG990HE' : 'AB123CD'),
  },
  {
    serviceType: 'REC-DOM',
    route: 'R-REC-PAL',
    shift: Shift.MORNING,
    weekdays: TODOS,
    franja: fr('06:00', '09:30'),
    cuadrilla: () => 'PAL-REC',
    vehiculo: () => 'AC789DF',
  },
  {
    serviceType: 'REC-DOM',
    route: 'R-REC-RECO',
    shift: Shift.AFTERNOON,
    weekdays: TODOS,
    franja: fr('14:00', '18:00'),
    cuadrilla: () => 'RECO',
    vehiculo: () => 'AE112FA',
  },
  {
    serviceType: 'REC-DOM',
    route: 'R-REC-SNI',
    shift: Shift.NIGHT,
    weekdays: TODOS,
    franja: fr('21:00', '23:59'),
    cuadrilla: () => 'CEN-REC',
    vehiculo: () => 'AE334FB',
  },
  {
    serviceType: 'REC-DOM',
    route: 'R-REC-MON',
    shift: Shift.NIGHT,
    weekdays: TODOS,
    franja: fr('02:15', '05:30'),
    cuadrilla: () => 'CEN-REC',
    vehiculo: () => 'AE334FB',
  },
  {
    serviceType: 'REC-DOM',
    route: 'R-REC-PMA',
    shift: Shift.NIGHT,
    weekdays: LMV,
    franja: fr('00:30', '02:00'),
    cuadrilla: () => 'CEN-REC',
    vehiculo: () => 'AF556GC',
  },
  {
    serviceType: 'REC-REC',
    route: 'R-RECI-PR',
    shift: Shift.AFTERNOON,
    weekdays: LMV,
    franja: fr('14:00', '18:00'),
    cuadrilla: () => 'COOP-PAL',
    vehiculo: () => 'AD345EH',
  },
  {
    serviceType: 'REC-REC',
    route: 'R-RECI-BC',
    shift: Shift.AFTERNOON,
    weekdays: MJ,
    franja: fr('14:00', '18:00'),
    // Desde que la cooperativa de Belgrano quedó sin convenio, cubre la de Palermo.
    cuadrilla: (d) => (d < -6 ? 'COOP-BC' : 'COOP-PAL'),
    vehiculo: () => 'AD901EK',
  },
  {
    serviceType: 'REC-REC',
    route: 'R-RECI-CEN',
    shift: Shift.NIGHT,
    weekdays: LMV,
    franja: fr('21:00', '23:59'),
    cuadrilla: () => 'COOP-CEN',
    vehiculo: () => 'AF778GD',
  },
  {
    serviceType: 'BAR-MEC',
    route: 'R-BAR-CEN',
    shift: Shift.NIGHT,
    weekdays: LMV,
    franja: FRANJA.madrugada,
    cuadrilla: () => 'BAR-MEC',
    vehiculo: () => 'AE234FL',
  },
  {
    serviceType: 'BAR-MEC',
    route: 'R-BAR-SF',
    shift: Shift.NIGHT,
    weekdays: MJ,
    franja: fr('21:00', '23:59'),
    cuadrilla: () => 'BAR-MEC',
    vehiculo: (d) => (d <= ROTURA_BARREDORA ? 'AF890GN' : 'AF567GM'),
  },
  {
    serviceType: 'BAR-MEC',
    route: 'R-BAR-CAB',
    shift: Shift.NIGHT,
    // El sábado también: Cabildo es la avenida comercial con más tránsito peatonal del norte.
    weekdays: [1, 6],
    franja: fr('21:00', '23:59'),
    cuadrilla: () => 'BAR-MEC',
    vehiculo: (d) => (d <= ROTURA_BARREDORA ? 'AF890GN' : 'AF567GM'),
  },
  {
    serviceType: 'BAR-MAN',
    route: 'R-BAR-MAN-PAL',
    shift: Shift.MORNING,
    weekdays: MJ,
    franja: fr('09:45', '11:45'),
    cuadrilla: () => 'PAL-REC',
  },
  {
    serviceType: 'BAR-MAN',
    route: 'R-BAR-MAN-SNI',
    shift: Shift.NIGHT,
    weekdays: [4],
    franja: fr('21:00', '23:59'),
    cuadrilla: () => 'CEN-LIM',
  },
  {
    serviceType: 'HIG-LAV',
    route: 'R-LAV-CEN',
    shift: Shift.NIGHT,
    weekdays: [5],
    franja: fr('00:30', '04:00'),
    cuadrilla: () => 'CEN-LIM',
    vehiculo: () => 'AG123HP',
  },
  {
    serviceType: 'ARB-CENSO',
    route: 'R-ARB-CENSO',
    shift: Shift.MORNING,
    weekdays: [3],
    franja: fr('07:00', '10:00'),
    cuadrilla: () => 'ARBOLADO',
    vehiculo: () => 'AL997MJ',
  },
];

// ════════════════════════════════════════════════════════════
// COBERTURA REGIONAL
// ════════════════════════════════════════════════════════════

const deComuna = (n: number): string[] =>
  BARRIOS.filter((b) => b.comuna === n).map((b) => b.codigo);

/**
 * Las comunas que los recorridos escritos a mano no tocan. Cada región tiene su cuadrilla
 * de recolección y su compactador, y un recorrido semanal por comuna: así toda comuna tiene
 * recorridos y servicios sin multiplicar el volumen de la agenda.
 */
const REGIONES = [
  {
    clave: 'SUR-REC',
    name: 'Cuadrilla Municipal Sur — Recolección Comunas 1 (sur), 4 y 8',
    lider: '151',
    patente: 'AN123PQ',
    rutas: [
      { code: 'R-REC-C01S', zonas: ['san-telmo', 'constitucion'], dia: 6 },
      { code: 'R-REC-C04', zonas: deComuna(4), dia: 2 },
      { code: 'R-REC-C08', zonas: deComuna(8), dia: 4 },
    ],
  },
  {
    clave: 'OESTE-REC',
    name: 'Cuadrilla Municipal Oeste — Recolección Comunas 9, 10 y 11',
    lider: '161',
    patente: 'AN246PR',
    rutas: [
      { code: 'R-REC-C09', zonas: deComuna(9), dia: 1 },
      { code: 'R-REC-C10', zonas: deComuna(10), dia: 3 },
      { code: 'R-REC-C11', zonas: deComuna(11), dia: 5 },
    ],
  },
  {
    clave: 'CENTRO-REC',
    name: 'Cuadrilla Municipal Centro-Oeste — Recolección Comunas 3, 5, 6 y 7',
    lider: '171',
    patente: 'AN369PS',
    rutas: [
      { code: 'R-REC-C03', zonas: deComuna(3), dia: 2 },
      { code: 'R-REC-C05', zonas: deComuna(5), dia: 4 },
      { code: 'R-REC-C06', zonas: deComuna(6), dia: 1 },
      { code: 'R-REC-C07', zonas: deComuna(7), dia: 3 },
    ],
  },
  {
    clave: 'NORTE-REC',
    name: 'Cuadrilla Municipal Noroeste — Recolección Comunas 12, 13 (Núñez) y 15',
    lider: '181',
    patente: 'AN482PT',
    rutas: [
      { code: 'R-REC-C12', zonas: [...deComuna(12), 'nunez'], dia: 1 },
      { code: 'R-REC-C15', zonas: deComuna(15), dia: 3 },
    ],
  },
];

const FRANJA_REGIONAL = fr('06:00', '11:00');

for (const r of REGIONES) {
  VEHICLES.push({ plate: r.patente, vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 19 });
  CREWS.push({
    clave: r.clave,
    name: r.name,
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.MORNING,
    leaderUserId: r.lider,
    organizationId: null,
    members: [0, 1, 2, 3].map((i) => String(Number(r.lider) + i)),
    active: true,
    tipos: ['REC-DOM', 'CONT-VAC'],
    zonas: r.rutas.flatMap((x) => x.zonas),
  });
  for (const ruta of r.rutas) {
    const barrios = ruta.zonas.map((z) => BARRIOS.find((b) => b.codigo === z) as Barrio);
    const comunas = [...new Set(barrios.map((b) => b.comuna))].join(', ');
    ROUTES.push({
      code: ruta.code,
      name: `Recolección domiciliaria Comuna ${comunas} — ${barrios.map((b) => b.nombre).join(', ')}`,
      stops: barrios.map((b) => ({
        zone: b.codigo,
        min: Math.min(90, Math.floor(280 / barrios.length)),
      })),
    });
    FREQUENCIES.push({
      serviceType: 'REC-DOM',
      route: ruta.code,
      shift: Shift.MORNING,
      weekdays: [ruta.dia],
      franja: FRANJA_REGIONAL,
      cuadrilla: () => r.clave,
      vehiculo: () => r.patente,
    });
  }
}

/** La región que atiende una zona, si la atiende alguna. */
const regionDe = (zona: string) =>
  REGIONES.find((r) => r.rutas.some((x) => x.zonas.includes(zona)));

function diasDe(weekdays: number[]): number[] {
  const dias: number[] = [];
  for (let d = DESDE; d <= HASTA; d++) if (weekdays.includes(diaSemana(d))) dias.push(d);
  return dias;
}

/**
 * El estado de un servicio de recorrido según cuándo cae. Pasado: cerrado. Hoy:
 * la madrugada ya terminó, la mañana está en la calle, la tarde y la noche
 * todavía no salieron. Futuro: agendado.
 */
function estadoPorDefecto(d: number, franja: Franja, turno: Shift): ServiceStatus {
  if (d < 0) return ServiceStatus.COMPLETED;
  if (d > 0) return ServiceStatus.SCHEDULED;
  const inicio = franja[0][0];
  if (turno === Shift.NIGHT && inicio < 6) return ServiceStatus.COMPLETED;
  if (turno === Shift.MORNING && inicio < 9) return ServiceStatus.IN_PROGRESS;
  return ServiceStatus.SCHEDULED;
}

/**
 * Lo que se salió del libreto en los recorridos: una minoría, con motivos
 * reales. `dia` apunta a un día fijo (solo para recorridos diarios); `pasada`
 * a la n-ésima vez anterior a hoy, que existe siempre sea cual sea el día de la
 * semana en que se siembre.
 */
const INCIDENCIAS: {
  recorrido: string;
  dia?: number;
  pasada?: number;
  cambios: Partial<Plan>;
}[] = [
  {
    recorrido: 'R-REC-C13',
    dia: -11,
    cambios: {
      estado: ServiceStatus.PARTIALLY_COMPLETED,
      resultados: [
        {
          zona: 'belgrano',
          estado: ZoneResultStatus.NOT_SERVICED,
          motivo: NotServicedReason.WEATHER,
          notas: 'Granizo. Se suspendió la salida por seguridad del personal.',
          propuesta: -10,
        },
        {
          zona: 'colegiales',
          estado: ZoneResultStatus.NOT_SERVICED,
          motivo: NotServicedReason.WEATHER,
          notas: 'Granizo. Se suspendió la salida por seguridad del personal.',
          propuesta: -10,
        },
      ],
    },
  },
  {
    recorrido: 'R-REC-C13',
    dia: -9,
    cambios: {
      estado: ServiceStatus.PARTIALLY_COMPLETED,
      clave: 'rotura-compactador',
      resultados: [
        {
          zona: 'belgrano',
          estado: ZoneResultStatus.PARTIAL,
          motivo: NotServicedReason.VEHICLE_BREAKDOWN,
          notas:
            'Rotura de la caja compactadora sobre Av. Congreso. Quedó sin levantar el tramo de Arribeños.',
          propuesta: -8,
        },
        {
          zona: 'colegiales',
          estado: ZoneResultStatus.NOT_SERVICED,
          motivo: NotServicedReason.VEHICLE_BREAKDOWN,
          notas: 'El camión quedó fuera de servicio antes de llegar a Colegiales.',
          propuesta: -8,
        },
      ],
    },
  },
  {
    recorrido: 'R-REC-C13',
    dia: 0,
    cambios: {
      demoras: [
        {
          tipo: DelayType.START,
          minutos: 35,
          motivo: 'Corte de tránsito por obra en Av. Cabildo y Juramento.',
          estado: ServiceStatus.SCHEDULED,
          detectado: [0, 5, 40],
          finEstimado: [0, 11, 35],
          reportadoPor: '101',
        },
        {
          tipo: DelayType.DURATION,
          minutos: 50,
          motivo:
            'Volumen alto en el Barrio Chino: los comercios sacaron el cartón fuera de horario.',
          estado: ServiceStatus.IN_PROGRESS,
          detectado: [0, 8, 20],
          finEstimado: [0, 11, 50],
          reportadoPor: '101',
        },
      ],
    },
  },
  {
    recorrido: 'R-REC-PAL',
    dia: -5,
    cambios: {
      estado: ServiceStatus.PARTIALLY_COMPLETED,
      resultados: [
        {
          zona: 'palermo',
          estado: ZoneResultStatus.PARTIAL,
          motivo: NotServicedReason.EXCESS_VOLUME,
          notas:
            'Volumen muy por encima de lo habitual. Quedó sin levantar Honduras entre Serrano y Godoy Cruz.',
          propuesta: -4,
        },
      ],
    },
  },
  {
    recorrido: 'R-REC-RECO',
    dia: -8,
    cambios: {
      estado: ServiceStatus.PARTIALLY_COMPLETED,
      resultados: [
        {
          zona: 'recoleta',
          estado: ZoneResultStatus.PARTIAL,
          motivo: NotServicedReason.OTHER,
          notas: 'Acto en Plaza Francia con vallado municipal, sin aviso previo.',
          propuesta: -7,
        },
      ],
    },
  },
  {
    recorrido: 'R-REC-RECO',
    dia: 0,
    cambios: {
      demoras: [
        {
          tipo: DelayType.START,
          minutos: 50,
          motivo: 'Corte de Av. Santa Fe por obra de AySA entre Callao y Riobamba.',
          estado: ServiceStatus.SCHEDULED,
          detectado: [0, 7, 10],
          finEstimado: [0, 18, 50],
          reportadoPor: '121',
        },
      ],
    },
  },
  {
    recorrido: 'R-REC-SNI',
    dia: -6,
    cambios: {
      estado: ServiceStatus.PARTIALLY_COMPLETED,
      resultados: [
        {
          zona: 'san-nicolas',
          estado: ZoneResultStatus.PARTIAL,
          motivo: NotServicedReason.BLOCKED_ACCESS,
          notas:
            'Vallado por una marcha sobre Diagonal Norte. No se pudo ingresar entre Florida y Av. de Mayo.',
          propuesta: -5,
        },
        { zona: 'retiro', estado: ZoneResultStatus.SERVICED },
      ],
      demoras: [
        {
          tipo: DelayType.START,
          minutos: 40,
          motivo: 'Desvíos por la marcha; el camión no puede entrar al Microcentro.',
          estado: ServiceStatus.SCHEDULED,
          detectado: [0, 20, 30],
          finEstimado: [1, 0, 40],
          reportadoPor: '131',
        },
      ],
    },
  },
  { recorrido: 'R-REC-SNI', dia: -10, cambios: { cierreTarde: true } },
  { recorrido: 'R-REC-SNI', dia: -2, cambios: { cierreTarde: true } },
  {
    recorrido: 'R-REC-MON',
    dia: -4,
    cambios: {
      estado: ServiceStatus.PARTIALLY_COMPLETED,
      clave: 'recoleccion-mon-incidente',
      resultados: [
        {
          zona: 'montserrat',
          estado: ZoneResultStatus.NOT_SERVICED,
          motivo: NotServicedReason.SECURITY_INCIDENT,
          notas:
            'Incidente en la vía pública frente a Plaza de Mayo. Intervino la Policía de la Ciudad.',
          propuesta: -3,
        },
      ],
    },
  },
  {
    recorrido: 'R-RECI-PR',
    pasada: 1,
    cambios: {
      estado: ServiceStatus.PARTIALLY_COMPLETED,
      resultados: [
        { zona: 'palermo', estado: ZoneResultStatus.SERVICED },
        {
          zona: 'recoleta',
          estado: ZoneResultStatus.NOT_SERVICED,
          motivo: NotServicedReason.CREW_UNAVAILABLE,
          notas: 'Dos recuperadores con licencia médica y sin reemplazo en el turno.',
        },
      ],
    },
  },
  {
    recorrido: 'R-RECI-CEN',
    pasada: 2,
    cambios: {
      estado: ServiceStatus.PARTIALLY_COMPLETED,
      resultados: [
        { zona: 'san-nicolas', estado: ZoneResultStatus.SERVICED },
        {
          zona: 'montserrat',
          estado: ZoneResultStatus.PARTIAL,
          motivo: NotServicedReason.EXCESS_VOLUME,
          notas: 'El cartón de los grandes generadores superó la capacidad del camión.',
        },
        { zona: 'retiro', estado: ZoneResultStatus.SERVICED },
      ],
    },
  },
  {
    recorrido: 'R-BAR-CAB',
    pasada: 2,
    cambios: {
      estado: ServiceStatus.CANCELLED,
      motivo: 'Lluvia intensa: con la calzada anegada el barrido mecánico no se hace.',
    },
  },
  {
    // La barredora rompió el cepillo lateral en Santa Fe: se suspendió y quedó
    // en el taller. El supervisor todavía no decidió si se retoma o se cancela.
    recorrido: 'R-BAR-SF',
    pasada: 1,
    cambios: {
      estado: ServiceStatus.SUSPENDED,
      clave: 'barrido-sf-suspendido',
      motivo: 'Rotura del cepillo lateral de la barredora AF890GN a mitad del recorrido.',
      resultados: [{ zona: 'palermo', estado: ZoneResultStatus.SERVICED }],
    },
  },
  {
    recorrido: 'R-LAV-CEN',
    pasada: 1,
    cambios: {
      clave: 'hidrolavado-plaza-de-mayo',
      demoras: [
        {
          tipo: DelayType.DURATION,
          minutos: 60,
          motivo: 'Restos de pintura en el solado de Plaza de Mayo tras una movilización.',
          estado: ServiceStatus.IN_PROGRESS,
          detectado: [0, 2, 30],
          finEstimado: [0, 5, 0],
          reportadoPor: '141',
        },
      ],
    },
  },
  { recorrido: 'R-BAR-MAN-SNI', pasada: 1, cambios: { cierreTarde: true } },
  // El censo de hoy ya terminó cuando sale la poda.
  { recorrido: 'R-ARB-CENSO', dia: 0, cambios: { estado: ServiceStatus.COMPLETED } },
];

/** Lo que M7 contestó al rechazar el corte de Av. Juramento (va al inbox y al servicio). */
const RECHAZO_CORTE_JURAMENTO = 'superposición con la obra de renovación de Av. Juramento.';

/** Las franjas fijas de cada cuadrilla para los servicios puntuales. */
const SLOT: Record<string, Franja> = {
  'BEL-REC': fr('11:15', '13:00'),
  'PAL-REC': fr('12:00', '13:00'),
  ARBOLADO: fr('10:30', '13:00'),
  'EV-a': fr('07:00', '09:30'),
  'EV-b': fr('10:00', '12:30'),
  'COOP-PAL': fr('18:30', '20:30'),
  RECO: fr('18:15', '20:45'),
  'INSP-a': fr('14:00', '16:00'),
  'INSP-b': fr('16:30', '18:30'),
  'INSP-c': fr('19:00', '21:00'),
  'CEN-LIM': fr('04:15', '05:45'),
  'COOP-CEN': fr('00:30', '02:30'),
};

const {
  SCHEDULED,
  RESCHEDULED,
  IN_PROGRESS,
  SUSPENDED,
  COMPLETED,
  PARTIALLY_COMPLETED,
  CANCELLED,
} = ServiceStatus;
const { PLANNED, TICKET, WEATHER_ALERT, INSPECTION, MANUAL } = ServiceOrigin;

/** Un servicio puntual. `slot` es la cuadrilla o `cuadrilla-letra` si tiene más de una franja. */
function punto(
  tipo: string,
  d: number,
  slot: string,
  vehiculo: string | undefined,
  estado: ServiceStatus,
  destino: { tipo: Objetivo; codigo: string } | string,
  origen: ServiceOrigin,
  extra: Partial<Plan> = {},
): Plan {
  const asignado = !slot.startsWith('-');
  const clave = slot.replace(/^-/, '');
  return {
    tipo,
    dia: d,
    franja: SLOT[clave],
    cuadrilla: asignado ? clave.replace(/-[a-c]$/, '') : undefined,
    vehiculo: asignado ? vehiculo : undefined,
    estado,
    origen,
    ...(typeof destino === 'string' ? { zona: destino } : { objetivo: destino }),
    ...(origen === TICKET && { ticket: `${tipo}-${d}-${clave}` }),
    ...extra,
  };
}

const cont = (codigo: string) => ({ tipo: 'CONTAINER' as const, codigo });
const tree = (codigo: string) => ({ tipo: 'TREE' as const, codigo });
const verde = (nombre: string) => {
  const id = ESPACIO_POR_NOMBRE[nombre];
  if (id === undefined) throw new Error(`seed: espacio verde sin id del dataset: '${nombre}'`);
  return { tipo: 'GREEN_SPACE' as const, codigo: claveEspacio(id) };
};
const pv = (codigo: string) => ({ tipo: 'GREEN_POINT' as const, codigo });

/** La alerta de tormentas que dejó marcados para reprogramar los trabajos de Puerto Madero. */
const ALERTA_TORMENTA = {
  tipo: 'tormentas fuertes',
  severidad: Severity.HIGH,
  dia: 2,
  zonas: ['puerto-madero'],
};

/**
 * Los servicios puntuales: contenedores, puntos verdes, voluminosos, poda,
 * espacios verdes e inspecciones. Uno por cuadrilla y franja; el solapamiento
 * intencional lleva su nota de override.
 */
const PUNTOS: Plan[] = [
  // ── Vaciado de contenedores ──
  punto('CONT-VAC', -12, 'BEL-REC', 'AB456CE', COMPLETED, cont('CT-BEL-0009'), MANUAL, {
    notas: 'Último vaciado antes del retiro: la cuadra pasa a ser peatonal.',
  }),
  punto('CONT-VAC', -8, 'BEL-REC', 'AB456CE', COMPLETED, cont('CT-BEL-0003'), TICKET),
  punto('CONT-VAC', -5, 'BEL-REC', 'AB456CE', COMPLETED, cont('CT-COL-0001'), PLANNED),
  punto('CONT-VAC', -2, 'BEL-REC', 'AB456CE', COMPLETED, cont('CT-BEL-0001'), PLANNED),
  punto('CONT-VAC', -9, 'PAL-REC', 'AC012DG', COMPLETED, cont('CT-PAL-0001'), PLANNED),
  punto('CONT-VAC', -6, 'PAL-REC', 'AC012DG', COMPLETED, cont('CT-PAL-0004'), PLANNED),
  punto('CONT-VAC', -3, 'PAL-REC', 'AC012DG', COMPLETED, cont('CT-PAL-0011'), TICKET),
  punto('CONT-VAC', -1, 'PAL-REC', 'AC012DG', COMPLETED, cont('CT-PAL-0002'), PLANNED),
  punto('CONT-VAC', -7, 'CEN-LIM', 'AF556GC', COMPLETED, cont('CT-SNI-0001'), PLANNED),
  punto('CONT-VAC', -4, 'CEN-LIM', 'AF556GC', COMPLETED, cont('CT-MON-0001'), PLANNED),
  punto('CONT-VAC', -2, 'CEN-LIM', 'AF556GC', COMPLETED, cont('CT-SNI-0004'), PLANNED),
  punto('CONT-VAC', -1, 'CEN-LIM', 'AF556GC', PARTIALLY_COMPLETED, cont('CT-MON-0003'), PLANNED, {
    resultados: [
      {
        zona: 'montserrat',
        estado: ZoneResultStatus.NOT_SERVICED,
        motivo: NotServicedReason.BLOCKED_ACCESS,
        notas: 'Auto estacionado delante del contenedor sobre Perú. No se pudo levantar.',
        propuesta: 1,
      },
    ],
  }),
  punto('CONT-VAC', 0, 'BEL-REC', 'AB456CE', SCHEDULED, cont('CT-BEL-0003'), TICKET, {
    clave: 'vaciado-barrio-chino',
    notas: 'Reclamo por desborde reiterado sobre Arribeños.',
  }),
  punto('CONT-VAC', 0, 'CEN-LIM', 'AF556GC', COMPLETED, cont('CT-SNI-0005'), PLANNED),
  punto('CONT-VAC', 0, 'PAL-REC', 'AC012DG', SCHEDULED, cont('CT-PAL-0005'), PLANNED),
  punto('CONT-VAC', 1, 'PAL-REC', 'AC012DG', SCHEDULED, cont('CT-PAL-0010'), TICKET),
  punto('CONT-VAC', 1, 'CEN-LIM', 'AF556GC', SCHEDULED, cont('CT-SNI-0003'), MANUAL, {
    notas: 'Desborde por la salida de los teatros de Av. Corrientes.',
  }),
  // Sin cuadrilla todavía: la de Belgrano y Colegiales tiene el día completo.
  punto('CONT-VAC', 2, '-BEL-REC', undefined, SCHEDULED, cont('CT-COL-0003'), TICKET),
  punto('CONT-VAC', 3, 'CEN-LIM', 'AF556GC', SCHEDULED, cont('CT-MON-0005'), PLANNED),
  punto('CONT-VAC', 3, 'BEL-REC', 'AB456CE', SCHEDULED, cont('CT-BEL-0002'), PLANNED),
  punto('CONT-VAC', -11, 'BEL-REC', 'AB456CE', COMPLETED, cont('CT-BEL-0005'), PLANNED),
  punto('CONT-VAC', -10, 'BEL-REC', 'AB456CE', COMPLETED, cont('CT-BEL-0007'), PLANNED),
  punto('CONT-VAC', -7, 'BEL-REC', 'AB456CE', COMPLETED, cont('CT-COL-0005'), PLANNED),
  punto('CONT-VAC', -4, 'BEL-REC', 'AB456CE', COMPLETED, cont('CT-BEL-0006'), PLANNED),
  punto('CONT-VAC', -3, 'BEL-REC', 'AB456CE', COMPLETED, cont('CT-BEL-0004'), PLANNED),
  punto('CONT-VAC', 1, 'BEL-REC', 'AB456CE', SCHEDULED, cont('CT-BEL-0007'), PLANNED),
  punto('CONT-VAC', -9, 'RECO', 'AE112FA', COMPLETED, cont('CT-REC-0002'), PLANNED),
  punto('CONT-VAC', -7, 'RECO', 'AE112FA', COMPLETED, cont('CT-REC-0004'), PLANNED),
  punto('CONT-VAC', -4, 'RECO', 'AE112FA', COMPLETED, cont('CT-REC-0005'), TICKET),
  punto('CONT-VAC', -1, 'RECO', 'AE112FA', COMPLETED, cont('CT-REC-0001'), PLANNED),
  punto('CONT-VAC', 3, 'RECO', 'AE112FA', SCHEDULED, cont('CT-REC-0002'), PLANNED),
  punto('CONT-VAC', -6, 'CEN-LIM', 'AF556GC', COMPLETED, cont('CT-RET-0001'), PLANNED),
  punto('CONT-VAC', -3, 'CEN-LIM', 'AF556GC', COMPLETED, cont('CT-RET-0006'), PLANNED),
  // Sin cuadrilla todavía: la de Microcentro tiene la madrugada tomada.
  punto('CONT-VAC', 1, '-CEN-LIM', undefined, SCHEDULED, cont('CT-RET-0003'), TICKET, {
    notas: 'Desborde frente a la salida de la terminal de ómnibus.',
  }),
  // ── Puntos verdes (las cooperativas vacían las campanas) ──
  punto('CONT-VAC', -9, 'COOP-PAL', 'AD345EH', COMPLETED, pv('GP-PAL-01'), PLANNED),
  punto('CONT-VAC', -6, 'COOP-CEN', 'AF778GD', COMPLETED, pv('GP-SNI-01'), PLANNED),
  punto('CONT-VAC', -4, 'COOP-PAL', 'AD345EH', COMPLETED, pv('GP-REC-01'), PLANNED),
  punto('CONT-VAC', -2, 'COOP-PAL', 'AD345EH', COMPLETED, pv('GP-PAL-02'), PLANNED),
  punto('CONT-VAC', -1, 'COOP-CEN', 'AF778GD', COMPLETED, pv('GP-MON-01'), PLANNED),
  punto('CONT-VAC', 0, 'COOP-CEN', 'AF778GD', COMPLETED, pv('GP-PMA-01'), PLANNED),
  punto('CONT-VAC', -9, 'COOP-CEN', 'AF778GD', COMPLETED, pv('GP-RET-01'), PLANNED),
  punto('CONT-VAC', 2, 'COOP-CEN', 'AF778GD', SCHEDULED, pv('GP-RET-01'), PLANNED),
  punto('CONT-VAC', 1, 'COOP-PAL', 'AD345EH', SCHEDULED, pv('GP-COL-01'), PLANNED),
  punto('CONT-VAC', 3, 'COOP-PAL', 'AD345EH', SCHEDULED, pv('GP-BEL-01'), PLANNED),
  // ── Lavado de contenedores ──
  punto('CONT-LAV', -10, 'RECO', 'AK553LG', COMPLETED, cont('CT-REC-0001'), PLANNED),
  punto('CONT-LAV', -6, 'RECO', 'AK553LG', CANCELLED, cont('CT-REC-0007'), PLANNED, {
    motivo: 'Vereda ocupada por un volquete de obra. Se lava en la próxima rotación.',
  }),
  punto('CONT-LAV', -9, 'CEN-LIM', 'AK553LG', COMPLETED, cont('CT-RET-0002'), PLANNED),
  punto('CONT-LAV', -5, 'CEN-LIM', 'AK553LG', COMPLETED, cont('CT-SNI-0002'), PLANNED),
  punto('CONT-LAV', -3, 'RECO', 'AK553LG', COMPLETED, cont('CT-REC-0003'), PLANNED),
  punto('CONT-LAV', 2, 'RECO', 'AK553LG', SCHEDULED, cont('CT-REC-0005'), PLANNED),
  punto('CONT-LAV', 2, 'CEN-LIM', 'AK553LG', SCHEDULED, cont('CT-MON-0002'), PLANNED),
  // ── Voluminosos ──
  punto('REC-VOL', -11, 'RECO', 'AD678EJ', COMPLETED, 'recoleta', TICKET, {
    notas: 'Colchones y muebles en desuso frente a Ayacucho 1500.',
  }),
  punto('REC-VOL', -7, 'PAL-REC', 'AH221JA', COMPLETED, cont('CT-PAL-0006'), PLANNED),
  punto('REC-VOL', -4, 'PAL-REC', 'AH221JA', COMPLETED, 'palermo', TICKET, {
    notas: 'Restos de mudanza en la vereda de Honduras al 5800.',
  }),
  punto('REC-VOL', -2, 'RECO', 'AD678EJ', CANCELLED, 'recoleta', TICKET, {
    motivo: 'El vecino retiró los restos por su cuenta antes de la visita.',
  }),
  punto('REC-VOL', -1, 'BEL-REC', 'AH443JB', COMPLETED, 'colegiales', TICKET, {
    notas: 'Restos de obra embolsados en Virrey Loreto al 3400.',
  }),
  // A propósito se pisa con el vaciado del Barrio Chino, misma cuadrilla: la
  // base arranca con un solapamiento real y su nota (Issue #123).
  punto('REC-VOL', 0, 'BEL-REC', 'AH443JB', SCHEDULED, 'belgrano', TICKET, {
    franja: fr('11:30', '12:30'),
    notas: 'Heladera abandonada sobre la vereda de Mendoza al 2500.',
    override:
      'Se asigna igual: el vaciado del Barrio Chino termina antes y la heladera está obstruyendo la rampa de la esquina.',
  }),
  punto('REC-VOL', 0, 'RECO', 'AD678EJ', SCHEDULED, 'recoleta', TICKET, {
    notas: 'Restos de poda particular embolsados en Av. Las Heras y Av. Pueyrredón.',
  }),
  punto('REC-VOL', 1, 'RECO', 'AD678EJ', SCHEDULED, 'recoleta', TICKET),
  punto('REC-VOL', 2, '-PAL-REC', undefined, SCHEDULED, 'palermo', TICKET),
  // ── Poda ──
  punto('ARB-POD', -13, 'ARBOLADO', 'AH789JR', COMPLETED, tree('ARB-13-00103'), INSPECTION, {
    clave: 'poda-barrancas',
  }),
  punto('ARB-POD', -8, 'ARBOLADO', 'AH789JR', COMPLETED, tree('ARB-14-00304'), PLANNED, {
    clave: 'poda-thames',
  }),
  punto('ARB-POD', -6, 'ARBOLADO', 'AH789JR', COMPLETED, tree('ARB-02-00403'), PLANNED, {
    clave: 'poda-ayacucho',
  }),
  punto('ARB-POD', -3, 'ARBOLADO', 'AH789JR', COMPLETED, tree('ARB-13-00201'), PLANNED, {
    clave: 'poda-zapiola',
  }),
  punto('ARB-POD', -1, 'ARBOLADO', 'AH789JR', COMPLETED, tree('ARB-02-00405'), WEATHER_ALERT, {
    alerta: 'smn-alerta-tormentas-fuertes-amba',
    notas: 'Rama desprendida por la tormenta apoyada sobre el cableado de Agüero.',
  }),
  punto('ARB-POD', 0, 'ARBOLADO', 'AH789JR', IN_PROGRESS, tree('ARB-14-00307'), PLANNED, {
    clave: 'poda-malabia',
  }),
  punto('ARB-POD', 2, 'ARBOLADO', 'AH789JR', SCHEDULED, tree('ARB-13-00203'), INSPECTION, {
    clave: 'extraccion-colegiales',
    notas: 'Extracción de ejemplar seco en pie. Requiere corte total de Virrey Avilés.',
  }),
  punto('ARB-POD', 3, 'ARBOLADO', 'AH789JR', SCHEDULED, tree('ARB-14-00305'), INSPECTION, {
    clave: 'poda-figueroa-alcorta',
    notas: 'Poda de seguridad por contacto con el tendido eléctrico.',
  }),
  punto('ARB-POD', 4, 'ARBOLADO', 'AH789JR', RESCHEDULED, tree('ARB-13-00101'), PLANNED, {
    clave: 'poda-juramento',
    // Mismo texto que arma el consumidor de streetClosureRejected.
    motivo: `M7 rechazó el corte de calle solicitado: ${RECHAZO_CORTE_JURAMENTO}`,
  }),
  // ── Espacios verdes ──
  punto('EV-RIEGO', -11, 'EV-a', 'AK331LF', COMPLETED, verde('Paseo de la Costanera Sur'), PLANNED),
  punto(
    'EV-MANT',
    -12,
    'EV-b',
    'AE901FK',
    COMPLETED,
    verde('Parque Tres de Febrero (Bosques de Palermo)'),
    PLANNED,
  ),
  punto('EV-MANT', -11, 'EV-b', 'AE901FK', COMPLETED, verde('Plaza Intendente Alvear'), PLANNED),
  punto('EV-MANT', -10, 'EV-b', 'AE901FK', COMPLETED, verde('Barrancas de Belgrano'), PLANNED),
  punto('EV-RIEGO', -9, 'EV-a', 'AG456HQ', COMPLETED, verde('Plaza Italia'), PLANNED),
  punto('EV-MANT', -8, 'EV-b', 'AJ345KT', COMPLETED, verde('Plaza Mafalda'), PLANNED),
  punto('EV-RIEGO', -7, 'EV-a', 'AK331LF', COMPLETED, verde('Parque Mujeres Argentinas'), PLANNED),
  punto(
    'EV-MANT',
    -6,
    'EV-b',
    'AE901FK',
    COMPLETED,
    verde('Jardín Botánico Carlos Thays'),
    PLANNED,
  ),
  punto('EV-RIEGO', -5, 'EV-a', 'AG456HQ', COMPLETED, verde('El Rosedal de Palermo'), PLANNED),
  punto('EV-MANT', -5, 'EV-b', 'AJ345KT', CANCELLED, verde('Plaza Castelli'), PLANNED, {
    motivo: 'Feria de artesanos con permiso municipal ocupando la plaza.',
  }),
  punto('EV-MANT', -4, 'EV-b', 'AE901FK', COMPLETED, verde('Parque Micaela Bastidas'), PLANNED),
  punto('EV-MANT', -3, 'EV-b', 'AJ345KT', COMPLETED, verde('Plaza de Mayo'), PLANNED),
  punto('EV-RIEGO', -2, 'EV-a', 'AG456HQ', COMPLETED, verde('Plaza Manuel Belgrano'), PLANNED),
  punto('EV-MANT', -1, 'EV-b', 'AJ345KT', COMPLETED, verde('Plaza Lavalle'), PLANNED),
  punto('EV-RIEGO', 0, 'EV-a', 'AK331LF', COMPLETED, verde('Parque Micaela Bastidas'), PLANNED),
  punto(
    'EV-MANT',
    0,
    'EV-b',
    'AE901FK',
    IN_PROGRESS,
    verde('Parque Tres de Febrero (Bosques de Palermo)'),
    PLANNED,
    {
      notas: 'Corte de césped y limpieza de los lagos.',
      demoras: [
        {
          tipo: DelayType.DURATION,
          minutos: 40,
          motivo: 'La desmalezadora de mano se rompió; se sigue con una sola.',
          estado: ServiceStatus.IN_PROGRESS,
          detectado: [0, 10, 50],
          finEstimado: [0, 13, 10],
          reportadoPor: '501',
        },
      ],
    },
  ),
  punto('EV-RIEGO', 1, 'EV-a', 'AG456HQ', SCHEDULED, verde('Plaza Francia'), PLANNED),
  punto('EV-MANT', 1, 'EV-b', 'AJ345KT', SCHEDULED, verde('Plaza Vicente López'), PLANNED),
  punto('EV-RIEGO', 2, 'EV-a', 'AK331LF', SCHEDULED, verde('Parque Mujeres Argentinas'), PLANNED),
  punto('EV-MANT', 2, 'EV-b', 'AE901FK', SCHEDULED, verde('Paseo de la Costanera Sur'), PLANNED),
  punto('EV-RIEGO', 3, 'EV-a', 'AG456HQ', SCHEDULED, verde('Plaza Güemes'), PLANNED),
  punto('EV-MANT', 3, 'EV-b', 'AJ345KT', SCHEDULED, verde('Plaza de la República'), PLANNED),
  punto('EV-RIEGO', -10, 'EV-a', 'AG456HQ', COMPLETED, verde('Barrancas de Belgrano'), PLANNED),
  punto('EV-RIEGO', -6, 'EV-a', 'AG456HQ', COMPLETED, verde('Plaza Noruega'), PLANNED),
  punto('EV-RIEGO', -3, 'EV-a', 'AG456HQ', COMPLETED, verde('Plaza Castelli'), PLANNED),
  punto('EV-MANT', -14, 'EV-b', 'AJ345KT', COMPLETED, verde('Plaza San Martín'), PLANNED),
  punto(
    'EV-MANT',
    -9,
    'EV-b',
    'AE901FK',
    COMPLETED,
    verde('Plaza Fuerza Aérea Argentina'),
    PLANNED,
  ),
  punto('EV-RIEGO', -4, 'EV-a', 'AG456HQ', COMPLETED, verde('Plaza San Martín'), PLANNED),
  // ── Inspecciones ambientales ──
  punto('AMB-INSP', -14, 'INSP-a', undefined, COMPLETED, 'barracas', TICKET, {
    clave: 'insp-vuelco',
  }),
  punto('AMB-INSP', -4, 'INSP-c', undefined, COMPLETED, 'colegiales', INSPECTION, {
    clave: 'insp-olor-colegiales',
  }),
  punto('AMB-INSP', -3, 'INSP-b', undefined, COMPLETED, 'san-nicolas', INSPECTION, {
    clave: 'insp-lavalle',
  }),
  punto('AMB-INSP', -1, 'INSP-a', undefined, COMPLETED, 'villa-lugano', TICKET, {
    clave: 'insp-recoleta',
  }),
  punto('AMB-INSP', 0, 'INSP-b', undefined, SCHEDULED, 'montserrat', INSPECTION, {
    clave: 'insp-chile',
    notas: 'Constatar acopio de residuos en la vereda de Chile al 900.',
  }),
  punto('AMB-INSP', 2, 'INSP-c', undefined, SCHEDULED, 'caballito', TICKET, {
    clave: 'insp-ruido',
    notas: 'Medición de nivel sonoro en horario nocturno.',
  }),
];

/** ¿Tienen la cuadrilla y el vehículo libre esa franja ese día? Igual criterio que `verificar`. */
function libre(
  planes: Plan[],
  q: Pick<Plan, 'cuadrilla' | 'vehiculo' | 'dia' | 'franja'>,
): boolean {
  return !planes.some(
    (o) =>
      o.estado !== CANCELLED &&
      !o.override &&
      o.dia === q.dia &&
      ((q.cuadrilla && o.cuadrilla === q.cuadrilla) || (q.vehiculo && o.vehiculo === q.vehiculo)) &&
      minutos(o.franja[0]) < minutos(q.franja[1]) &&
      minutos(q.franja[0]) < minutos(o.franja[1]),
  );
}

/**
 * Un servicio puntual en cada comuna que los recorridos escritos a mano no cubren: vaciado de
 * un contenedor, mantenimiento o riego de una plaza real, inspección y poda. Cada uno cae en
 * el primer día libre a partir del preferido, así no pisa a nadie; los días preferidos se
 * reparten entre el pasado reciente y las próximas semanas.
 */
function puntualesRegionales(previos: Plan[]): Plan[] {
  const salida: Plan[] = [];
  const todos = () => [...previos, ...salida];
  const agregar = (
    base: Omit<Plan, 'dia' | 'estado' | 'origen'>,
    preferido: number,
    vehiculos: (string | undefined)[],
  ): void => {
    for (let d = preferido; d <= Math.min(preferido + 25, HASTA); d++) {
      for (const vehiculo of vehiculos) {
        const q = { ...base, vehiculo, dia: d };
        if (!libre(todos(), q)) continue;
        salida.push({ ...q, estado: d < 0 ? COMPLETED : SCHEDULED, origen: PLANNED });
        return;
      }
    }
    throw new Error(`seed: no hay un día libre para ${base.tipo} en ${zonasDe(base as Plan)}`);
  };

  const NUEVAS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15];
  NUEVAS.forEach((c, j) => {
    const zonas = deComuna(c);
    const zona = zonas[j % zonas.length];
    const region = regionDe(zona);
    if (!region) throw new Error(`seed: ninguna región atiende ${zona}`);

    const cont = CONTAINERS.find(
      (x) => x.zone === zona && (x.status ?? ContainerStatus.ACTIVE) === ContainerStatus.ACTIVE,
    );
    if (cont) {
      agregar(
        {
          tipo: 'CONT-VAC',
          franja: fr('11:15', '12:45'),
          cuadrilla: region.clave,
          objetivo: { tipo: 'CONTAINER', codigo: cont.code },
        },
        [-9, -6, -3, -1, 1, 2, 3, 4, 6, 8, 10][j],
        [region.patente],
      );
    }

    const plaza = ESPACIOS.filter(
      (e) => e.barrio === zonas[(j + 1) % zonas.length] && !e.nombreDerivado,
    ).sort((a, b) => b.areaM2 - a.areaM2)[0];
    if (plaza) {
      const riego = j % 2 === 0;
      agregar(
        {
          tipo: riego ? 'EV-RIEGO' : 'EV-MANT',
          franja: riego ? fr('07:00', '09:30') : fr('10:00', '12:30'),
          cuadrilla: 'EV',
          objetivo: { tipo: 'GREEN_SPACE', codigo: claveEspacio(plaza.id) },
        },
        [-11, -8, -5, -2, 0, 1, 2, 3, 5, 7, 9][j],
        riego ? ['AK331LF', 'AG456HQ'] : ['AJ345KT', 'AE901FK'],
      );
    }

    if (j % 2 === 0) {
      agregar(
        { tipo: 'AMB-INSP', franja: fr('14:00', '16:00'), cuadrilla: 'INSP', zona },
        [-10, -7, -4, -1, 2, 4][j / 2],
        [undefined],
      );
    }

    const arbol = TREES.find((t) => zonas.includes(t.zone) && t.surveyCode.includes('-9'));
    if (arbol && [4, 8, 10, 15].includes(c)) {
      agregar(
        {
          tipo: 'ARB-POD',
          franja: fr('10:30', '13:00'),
          cuadrilla: 'ARBOLADO',
          objetivo: { tipo: 'TREE', codigo: arbol.surveyCode },
        },
        { 4: -7, 8: -4, 10: 2, 15: 5 }[c] as number,
        ['AH789JR', 'AL775MH'],
      );
    }
  });
  return salida;
}

/** Las zonas de un plan: las paradas del recorrido o la zona del objetivo. */
export function zonasDe(p: Plan): string[] {
  if (p.recorrido) {
    const r = ROUTES.find((x) => x.code === p.recorrido);
    if (!r) throw new Error(`seed: no existe el recorrido '${p.recorrido}'`);
    return r.stops.map((s) => s.zone);
  }
  if (p.objetivo) return [zonaDelObjetivo(p.objetivo)];
  if (p.zona) return [p.zona];
  throw new Error(`seed: el servicio ${p.tipo} del día ${p.dia} no tiene zona`);
}

function zonaDelObjetivo(o: { tipo: Objetivo; codigo: string }): string {
  if (o.tipo === 'GREEN_SPACE') {
    const e = ESPACIOS.find((x) => claveEspacio(x.id) === o.codigo);
    if (!e) throw new Error(`seed: no existe el espacio verde '${o.codigo}'`);
    return e.barrio;
  }
  const item =
    o.tipo === 'CONTAINER'
      ? CONTAINERS.find((c) => c.code === o.codigo)
      : o.tipo === 'TREE'
        ? TREES.find((t) => t.surveyCode === o.codigo)
        : o.tipo === 'GREEN_POINT'
          ? GREEN_POINTS.find((g) => g.code === o.codigo)
          : undefined;
  if (!item) throw new Error(`seed: no existe el objetivo ${o.tipo} '${o.codigo}'`);
  return item.zone;
}

/** La planificación completa: frecuencias, incidencias y servicios puntuales. */
export function planificar(): Plan[] {
  const planes: Plan[] = [];

  for (const f of FREQUENCIES) {
    const dias = diasDe(f.weekdays);
    const delRecorrido: Plan[] = dias.map((d) => ({
      tipo: f.serviceType,
      dia: d,
      franja: f.franja,
      cuadrilla: f.cuadrilla(d),
      vehiculo: f.vehiculo?.(d),
      estado: estadoPorDefecto(d, f.franja, f.shift),
      origen: PLANNED,
      recorrido: f.route,
    }));

    const pasadas = delRecorrido.filter((p) => p.dia < 0).reverse();
    for (const inc of INCIDENCIAS.filter((i) => i.recorrido === f.route)) {
      const plan =
        inc.pasada !== undefined
          ? pasadas[inc.pasada - 1]
          : delRecorrido.find((p) => p.dia === inc.dia);
      // Un recorrido que no sale todos los días puede no tener servicio hoy.
      if (plan) Object.assign(plan, inc.cambios);
    }
    planes.push(...delRecorrido);
  }

  planes.push(...PUNTOS);
  planes.push(...puntualesRegionales(planes));

  // La alerta pasa por el mismo filtro que el consumidor: lo agendado ese día
  // en las zonas afectadas queda para reprogramar.
  for (const p of planes) {
    if (
      p.dia === ALERTA_TORMENTA.dia &&
      p.estado === SCHEDULED &&
      zonasDe(p).some((z) => ALERTA_TORMENTA.zonas.includes(z))
    ) {
      p.estado = RESCHEDULED;
      p.motivo = `Alerta meteorológica ${ALERTA_TORMENTA.tipo} (${ALERTA_TORMENTA.severidad})`;
    }
  }

  return planes.sort((a, b) => a.dia - b.dia || minutos(a.franja[0]) - minutos(b.franja[0]));
}

/** Un instante expresado como [días desde `base`, hora, minuto]. */
function relativo(base: number, [n, h, m]: [number, number, number]): Date {
  return momento(base + n, h, m);
}

/** `includes` sobre una lista de estados sin pelear con los tipos literales. */
function entre(estado: ServiceStatus, lista: ServiceStatus[]): boolean {
  return lista.includes(estado);
}

function minutos(hm: Hm): number {
  return hm[0] * 60 + hm[1];
}

/** Resultados por zona de un plan: los explícitos o, si cerró, todas atendidas. */
export function resultadosDe(p: Plan): ResultadoZona[] {
  if (p.resultados) return p.resultados;
  if (p.estado !== COMPLETED) return [];
  return zonasDe(p).map((zona) => ({ zona, estado: ZoneResultStatus.SERVICED }));
}

/**
 * Chequeo de coherencia de toda la planificación. Si algo no cierra, el seed
 * no escribe nada: es mejor que falle acá que una demo con una cuadrilla
 * nocturna barriendo a las tres de la tarde.
 */
export function verificar(planes: Plan[]): void {
  const errores: string[] = [];
  const crews = new Map(CREWS.map((c) => [c.clave, c]));
  const flota = new Map(VEHICLES.map((v) => [v.plate, v]));
  const tipos = new Map(SERVICE_TYPES.map((t) => [t.code, t]));
  const cerrado: ServiceStatus[] = [COMPLETED, PARTIALLY_COMPLETED];
  const enCalle: ServiceStatus[] = [IN_PROGRESS, SUSPENDED, ...cerrado];

  for (const p of planes) {
    const id = `${p.tipo} día ${p.dia} ${p.recorrido ?? p.objetivo?.codigo ?? p.zona}`;
    const tipo = tipos.get(p.tipo);
    const zonas = zonasDe(p);
    const [desde, hasta] = p.franja.map(minutos);

    if (!tipo) errores.push(`${id}: tipo desconocido`);
    if (desde >= hasta) errores.push(`${id}: franja invertida`);
    if ((tipo?.mode === ServiceMode.ROUTE) !== Boolean(p.recorrido))
      errores.push(`${id}: el modo del tipo no coincide con recorrido/punto`);

    if (p.cuadrilla) {
      const c = crews.get(p.cuadrilla);
      if (!c) errores.push(`${id}: cuadrilla '${p.cuadrilla}' inexistente`);
      else {
        if (!c.tipos.includes(p.tipo)) errores.push(`${id}: ${c.clave} no hace ${p.tipo}`);
        if (zonas.some((z) => !c.zonas.includes(z)))
          errores.push(`${id}: ${c.clave} no cubre ${zonas}`);
        if (c.bajaDesde !== undefined && p.dia >= c.bajaDesde)
          errores.push(`${id}: ${c.clave} no está disponible desde el día ${c.bajaDesde}`);
        const dentro = FRANJAS_TURNO[c.defaultShift].some(([a, b]) => desde >= a && hasta <= b);
        if (!dentro) errores.push(`${id}: franja fuera del turno ${c.defaultShift}`);
      }
    }

    if (p.vehiculo) {
      const v = flota.get(p.vehiculo);
      if (!v) errores.push(`${id}: vehículo '${p.vehiculo}' inexistente`);
      else {
        if (!VEHICULOS_APTOS[p.tipo].includes(v.vehicleType))
          errores.push(`${id}: ${v.vehicleType} no sirve para ${p.tipo}`);
        const baja = BAJA_VEHICULO[v.plate];
        if (v.active === false && (baja === undefined || p.dia >= baja))
          errores.push(`${id}: ${v.plate} está fuera de servicio`);
      }
      if (!p.cuadrilla) errores.push(`${id}: vehículo sin cuadrilla`);
    }

    if (entre(p.estado, enCalle)) {
      if (!p.cuadrilla) errores.push(`${id}: ${p.estado} sin cuadrilla`);
      if (tipo?.requiresVehicle && !p.vehiculo) errores.push(`${id}: ${p.tipo} exige vehículo`);
    }
    if (p.dia < 0 && p.estado === SCHEDULED) errores.push(`${id}: agendado en el pasado`);
    if (p.dia > 0 && entre(p.estado, enCalle)) errores.push(`${id}: ${p.estado} en el futuro`);
    if (entre(p.estado, [CANCELLED, SUSPENDED, RESCHEDULED]) && !p.motivo)
      errores.push(`${id}: ${p.estado} sin motivo`);
    if ((p.origen === TICKET) !== Boolean(p.ticket))
      errores.push(`${id}: ticket y origen no coinciden`);
    if (p.alerta && p.origen !== WEATHER_ALERT)
      errores.push(`${id}: alerta sin origen WEATHER_ALERT`);

    // Resultados por zona, igual que `complete` y `addZoneResult`.
    const res = resultadosDe(p);
    if (res.some((r) => !zonas.includes(r.zona))) errores.push(`${id}: resultado de zona ajena`);
    if (res.some((r) => (r.estado === ZoneResultStatus.SERVICED) === Boolean(r.motivo)))
      errores.push(`${id}: motivo mal cargado`);
    if (entre(p.estado, cerrado) && res.length !== zonas.length)
      errores.push(`${id}: cerrado sin resultado de todas sus zonas`);
    const todasAtendidas = res.every((r) => r.estado === ZoneResultStatus.SERVICED);
    if (p.estado === COMPLETED && !todasAtendidas)
      errores.push(`${id}: COMPLETED con zonas sin atender`);
    if (p.estado === PARTIALLY_COMPLETED && todasAtendidas)
      errores.push(`${id}: parcial sin zona pendiente`);
    if (!entre(p.estado, enCalle) && res.length > 0)
      errores.push(`${id}: resultados sin haber arrancado`);

    // Avisos de demora: START antes de arrancar, DURATION con la cuadrilla en la calle.
    for (const d of p.demoras ?? []) {
      const esperado = d.estado === SCHEDULED ? DelayType.START : DelayType.DURATION;
      if (d.tipo !== esperado)
        errores.push(`${id}: demora ${d.tipo} con el servicio en ${d.estado}`);
    }
    const vigente = p.demoras?.at(-1);
    if (vigente && entre(p.estado, [SCHEDULED, IN_PROGRESS]) && vigente.estado !== p.estado)
      errores.push(`${id}: el aviso vigente no corresponde al estado actual`);

    // Un contenedor fuera de uso no se vacía ni se lava.
    if (p.objetivo?.tipo === 'CONTAINER' && p.dia >= 0) {
      const c = CONTAINERS.find((x) => x.code === p.objetivo?.codigo);
      const utilizable: ContainerStatus[] = [ContainerStatus.ACTIVE, ContainerStatus.OVERFLOWED];
      if (c && !utilizable.includes(c.status ?? ContainerStatus.ACTIVE))
        errores.push(`${id}: el contenedor está ${c.status}`);
    }
  }

  // Solapamientos: una cuadrilla o un vehículo no puede estar en dos lados a
  // la vez. Lo cancelado no ocupa a nadie; el override está justificado.
  const ocupan = planes.filter((p) => p.estado !== CANCELLED && !p.override);
  for (const recurso of ['cuadrilla', 'vehiculo'] as const) {
    for (let i = 0; i < ocupan.length; i++) {
      for (let j = i + 1; j < ocupan.length; j++) {
        const a = ocupan[i];
        const b = ocupan[j];
        if (!a[recurso] || a[recurso] !== b[recurso] || a.dia !== b.dia) continue;
        if (
          minutos(a.franja[0]) < minutos(b.franja[1]) &&
          minutos(b.franja[0]) < minutos(a.franja[1])
        )
          errores.push(
            `${recurso} ${a[recurso]} doble asignado el día ${a.dia}: ${a.tipo} y ${b.tipo}`,
          );
      }
    }
  }

  // Cada recorrido tiene que entrar en la franja de su frecuencia.
  for (const f of FREQUENCIES) {
    const r = ROUTES.find((x) => x.code === f.route);
    const duracion = (r?.stops ?? []).reduce((total, s) => total + s.min, 0);
    const franja = minutos(f.franja[1]) - minutos(f.franja[0]);
    if (duracion > franja)
      errores.push(`${f.route}: las paradas suman ${duracion} min y la franja tiene ${franja}`);
  }

  errores.push(...verificarCobertura(planes));

  if (errores.length > 0) {
    throw new Error(`seed: la planificación no es coherente:\n  - ${errores.join('\n  - ')}`);
  }
}

/**
 * Tope de servicios del seed. Contra Supabase la transacción tarda unos 1,5 s por servicio
 * (710 tardaron ~17 min) y la transacción vence a la hora: no crecer sin medir de nuevo.
 */
export const TOPE_SERVICIOS = 800;

/** Reparto por comuna y por barrio: nada de la Ciudad queda sin recorridos, servicios ni inventario. */
export function verificarCobertura(planes: Plan[]): string[] {
  const errores: string[] = [];
  const comunaDe = new Map(BARRIOS.map((b) => [b.codigo, b.comuna]));
  const comunas = [...new Set(BARRIOS.map((b) => b.comuna))];

  if (planes.length > TOPE_SERVICIOS)
    errores.push(`${planes.length} servicios: supera el tope de ${TOPE_SERVICIOS}`);

  const conServicio = new Set(planes.flatMap(zonasDe).map((z) => comunaDe.get(z)));
  const conRecorrido = new Set(ROUTES.flatMap((r) => r.stops).map((s) => comunaDe.get(s.zone)));
  for (const c of comunas) {
    if (!conServicio.has(c)) errores.push(`comuna ${c}: sin servicios`);
    if (!conRecorrido.has(c)) errores.push(`comuna ${c}: sin recorridos`);
  }

  const cuenta = (items: { zone: string }[], barrio: string) =>
    items.filter((i) => i.zone === barrio).length;
  const espacios = new Set(ESPACIOS.map((e) => e.barrio));
  for (const b of BARRIOS) {
    if (cuenta(CONTAINERS, b.codigo) < MIN_CONTENEDORES)
      errores.push(`${b.codigo}: pocos contenedores`);
    if (cuenta(TREES, b.codigo) < MIN_ARBOLES) errores.push(`${b.codigo}: poco arbolado`);
    if (!cuenta(GREEN_POINTS, b.codigo)) errores.push(`${b.codigo}: sin punto verde`);
    if (!espacios.has(b.codigo)) errores.push(`${b.codigo}: sin espacios verdes`);
  }

  // Un punto fuera de su barrio no se dibuja en el mapa de su zona.
  for (const [que, items] of [
    ['contenedor', CONTAINERS.map((x) => ({ id: x.code, zone: x.zone, lat: x.lat, lng: x.lng }))],
    [
      'punto verde',
      GREEN_POINTS.map((x) => ({ id: x.code, zone: x.zone, lat: x.lat, lng: x.lng })),
    ],
    ['árbol', TREES.map((x) => ({ id: x.surveyCode, zone: x.zone, lat: x.lat, lng: x.lng }))],
  ] as const) {
    for (const i of items) {
      const poligono = POLIGONOS.get(i.zone);
      if (!poligono || !puntoEnGeometria([i.lng, i.lat], poligono))
        errores.push(`${que} ${i.id}: cae fuera del barrio ${i.zone}`);
    }
  }
  return errores;
}

// ════════════════════════════════════════════════════════════
// RECOLECCIÓN
// ════════════════════════════════════════════════════════════

/** Kg de un día normal, por recorrido y zona. */
const KG_BASE: Record<string, Record<string, number>> = {
  'R-REC-C13': { belgrano: 7800, colegiales: 3900 },
  'R-REC-PAL': { palermo: 9600 },
  'R-REC-RECO': { recoleta: 7200 },
  'R-REC-SNI': { 'san-nicolas': 6400, retiro: 3600 },
  'R-REC-MON': { montserrat: 5100 },
  'R-REC-PMA': { 'puerto-madero': 2300 },
  'R-RECI-PR': { palermo: 2100, recoleta: 1300 },
  'R-RECI-BC': { belgrano: 1500, colegiales: 800 },
  'R-RECI-CEN': { 'san-nicolas': 2600, montserrat: 1400, retiro: 1100 },
  'R-BAR-CEN': { 'san-nicolas': 900, montserrat: 700 },
  'R-BAR-SF': { palermo: 500, recoleta: 450, retiro: 350 },
  'R-BAR-CAB': { colegiales: 250, belgrano: 600 },
  'R-BAR-MAN-PAL': { palermo: 350 },
  'R-BAR-MAN-SNI': { 'san-nicolas': 600, retiro: 300 },
};

// Lo recolectado en las comunas nuevas: entre 2,5 y 5 t por barrio y pasada, determinístico.
for (const r of REGIONES) {
  for (const ruta of r.rutas) {
    KG_BASE[ruta.code] = Object.fromEntries(
      ruta.zonas.map((z) => [z, 2500 + (semillaDe(`kg-${z}`) % 2500)]),
    );
  }
}

/** Densidad aproximada en el camión, kg/m³, para derivar el volumen. */
const DENSIDAD: Record<WasteType, number> = {
  [WasteType.HOUSEHOLD]: 420,
  [WasteType.RECYCLABLE]: 160,
  [WasteType.MIXED]: 300,
  [WasteType.GREEN]: 220,
  [WasteType.BULKY]: 150,
};

/** Variación diaria de ±10 %, determinística. */
function variacion(d: number, i: number): number {
  return 1 + ((((d + 40) * 7 + i * 3) % 11) - 5) / 50;
}

/** El centro y el sur descargan en Pompeya; el norte y el oeste, en Colegiales. */
const COMUNAS_DEL_SUR = [1, 3, 4, 5, 6, 7, 8, 9];
const transferencia = (zona: string) =>
  CENTRO.includes(zona) ||
  COMUNAS_DEL_SUR.includes(BARRIOS.find((b) => b.codigo === zona)?.comuna ?? 0)
    ? 'DS-TR-POMPEYA'
    : 'DS-TR-COLEG';

/** Qué residuo y a qué destino, para lo que genera recolección. */
function destinoDe(p: Plan, zona: string): { residuo: WasteType; sitio: string } | null {
  switch (p.tipo) {
    case 'REC-DOM':
      return { residuo: WasteType.HOUSEHOLD, sitio: transferencia(zona) };
    case 'REC-REC':
      return { residuo: WasteType.RECYCLABLE, sitio: 'DS-CRC-VARELA' };
    case 'BAR-MEC':
    case 'BAR-MAN':
      return { residuo: WasteType.MIXED, sitio: transferencia(zona) };
    case 'REC-VOL':
      return { residuo: WasteType.BULKY, sitio: 'DS-NORTE3' };
    case 'ARB-POD':
    case 'EV-MANT':
      return { residuo: WasteType.GREEN, sitio: 'DS-COMP-SALD' };
    case 'CONT-VAC': {
      if (p.objetivo?.tipo === 'GREEN_POINT')
        return { residuo: WasteType.RECYCLABLE, sitio: 'DS-CRC-VARELA' };
      const c = CONTAINERS.find((x) => x.code === p.objetivo?.codigo);
      if (c?.containerType === ContainerType.RECYCLABLE)
        return { residuo: WasteType.RECYCLABLE, sitio: 'DS-CRC-VARELA' };
      if (c?.containerType === ContainerType.GREEN)
        return { residuo: WasteType.GREEN, sitio: 'DS-COMP-SALD' };
      if (c?.containerType === ContainerType.BULKY)
        return { residuo: WasteType.BULKY, sitio: 'DS-NORTE3' };
      return { residuo: WasteType.HOUSEHOLD, sitio: transferencia(zona) };
    }
    default:
      return null;
  }
}

/** Kg de un servicio puntual en un día normal. */
function kgPuntual(p: Plan): number {
  if (p.tipo === 'CONT-VAC') {
    if (p.objetivo?.tipo === 'GREEN_POINT') return 350;
    const c = CONTAINERS.find((x) => x.code === p.objetivo?.codigo);
    return Math.round((c?.capacityLiters ?? 2400) * 0.14);
  }
  return { 'REC-VOL': 600, 'ARB-POD': 900, 'EV-MANT': 400 }[p.tipo] ?? 0;
}

/**
 * Días de emisión de las actas sembradas. El número sale como en
 * `nextNoticeNumber`: ACTA-{año}-{correlativo dentro del año}.
 */
const DIAS_EMISION_ACTAS = [-26, -19, -17, -13, -2];

function numeroActa(emitida: number): string {
  if (!DIAS_EMISION_ACTAS.includes(emitida)) {
    throw new Error(
      `seed: el acta del día ${emitida} no está en DIAS_EMISION_ACTAS (${DIAS_EMISION_ACTAS.join(', ')}): sumá el día ahí para que el correlativo salga bien`,
    );
  }
  const anio = momento(emitida, 9).getUTCFullYear();
  const orden = DIAS_EMISION_ACTAS.filter(
    (d) => d <= emitida && momento(d, 9).getUTCFullYear() === anio,
  ).length;
  return `ACTA-${anio}-${String(orden).padStart(6, '0')}`;
}

// ════════════════════════════════════════════════════════════
// CARGA
// ════════════════════════════════════════════════════════════

/**
 * Busca un id ya cargado y explota con nombre y apellido si no está. Sin esto,
 * una referencia rota reaparece treinta líneas después como un error de Prisma
 * sobre una columna que no dice nada.
 */
function buscar<T>(mapa: Map<string, T>, clave: string, que: string): T {
  const valor = mapa.get(clave);
  if (valor === undefined) {
    throw new Error(`seed: no existe ${que} '${clave}'. Definidos: ${[...mapa.keys()].join(', ')}`);
  }
  return valor;
}

/** Los ids de los catálogos, por clave natural. */
interface Catalogo {
  tipos: Map<string, ServiceType>;
  zonas: Map<string, string>;
  recorridos: Map<string, string>;
  sitios: Map<string, string>;
  vehiculos: Map<string, string>;
  cuadrillas: Map<string, string>;
  contenedores: Map<string, string>;
  arboles: Map<string, string>;
  puntosVerdes: Map<string, string>;
  espaciosVerdes: Map<string, string>;
}

async function main() {
  const planes = planificar();
  verificar(planes);

  // ── Catálogos ──────────────────────────────────────────
  const tipos = new Map<string, ServiceType>();
  for (const st of SERVICE_TYPES) {
    const row = await prisma.serviceType.upsert({
      where: { code: st.code },
      update: st,
      create: st,
    });
    tipos.set(st.code, row);
  }

  // Las 48 zonas y las 15 comunas, con los UUID reales de M9 (snapshot). Idempotente.
  const sync = await syncZones(prisma, cargarSnapshot());
  if (sync.conflictos.length) {
    throw new Error(
      `seed: syncZones dejó zonas sin tocar por conflicto; resolvelas antes de sembrar: ${sync.conflictos.join('; ')}`,
    );
  }
  console.log(
    `seed: comunas +${sync.communes.creadas}/~${sync.communes.actualizadas}, zonas +${sync.zones.creadas}/~${sync.zones.actualizadas}`,
  );
  const zonas = new Map(
    (await prisma.zone.findMany({ where: { code: { in: TODAS_LAS_ZONAS } } })).map((z) => [
      z.code,
      z.id,
    ]),
  );
  const zoneId = (code: string): string => buscar(zonas, code, 'la zona');
  /** Las columnas de `green_point`: `wasteTypes` va en su propia tabla. */
  const filaPuntoVerde = (gp: PuntoVerdeSeed) => ({
    code: gp.code,
    name: gp.name,
    address: gp.address,
    lat: gp.lat,
    lng: gp.lng,
    zoneId: zoneId(gp.zone),
  });

  const recorridos = new Map<string, string>();
  for (const r of ROUTES) {
    const route = await prisma.route.upsert({
      where: { code: r.code },
      update: { name: r.name },
      create: { code: r.code, name: r.name },
    });
    recorridos.set(r.code, route.id);

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

  const sitios = new Map<string, string>();
  for (const ds of DISPOSAL_SITES) {
    const row = await prisma.disposalSite.upsert({
      where: { code: ds.code },
      update: ds,
      create: ds,
    });
    sitios.set(ds.code, row.id);
  }

  const vehiculos = new Map<string, string>();
  for (const v of VEHICLES) {
    const datos = { ...v, active: v.active ?? true };
    const row = await prisma.vehicle.upsert({
      where: { plate: v.plate },
      update: datos,
      create: datos,
    });
    vehiculos.set(v.plate, row.id);
  }

  // Crew no tiene clave única natural: se busca por nombre y se actualiza, así
  // una segunda corrida corrige el turno o el estado en vez de ignorarlo.
  const cuadrillas = new Map<string, string>();
  for (const c of CREWS) {
    const datos = {
      name: c.name,
      crewType: c.crewType,
      defaultShift: c.defaultShift,
      leaderUserId: c.leaderUserId,
      organizationId: c.organizationId,
      active: c.active,
    };
    const existing = await prisma.crew.findFirst({ where: { name: c.name } });
    const crew = existing
      ? await prisma.crew.update({ where: { id: existing.id }, data: datos })
      : await prisma.crew.create({ data: datos });
    cuadrillas.set(c.clave, crew.id);
    await prisma.crewMember.createMany({
      data: c.members.map((userId) => ({ crewId: crew.id, userId })),
      skipDuplicates: true,
    });
  }

  // ── Inventario urbano ──────────────────────────────────
  // Lo escrito a mano va por upsert (corrige datos en una segunda corrida); lo generado, que
  // son cientos de filas, por createMany: contra una base remota un upsert por fila tarda de más.
  for (const c of CONTAINERS_BASE) {
    const { zone, ...datos } = c;
    await prisma.container.upsert({
      where: { code: c.code },
      update: { ...datos, zoneId: zoneId(zone) },
      create: { ...datos, zoneId: zoneId(zone) },
    });
  }
  await prisma.container.createMany({
    data: INVENTARIO.contenedores.map(({ zone, ...datos }) => ({ ...datos, zoneId: zoneId(zone) })),
    skipDuplicates: true,
  });
  const contenedores = new Map(
    (await prisma.container.findMany({ select: { id: true, code: true } })).map((c) => [
      c.code,
      c.id,
    ]),
  );

  for (const gp of GREEN_POINTS_BASE) {
    const datos = filaPuntoVerde(gp);
    await prisma.greenPoint.upsert({
      where: { code: gp.code },
      update: datos,
      create: datos,
    });
  }
  await prisma.greenPoint.createMany({
    data: INVENTARIO.puntosVerdes.map(filaPuntoVerde),
    skipDuplicates: true,
  });
  const puntosVerdes = new Map(
    (await prisma.greenPoint.findMany({ select: { id: true, code: true } })).map((g) => [
      g.code,
      g.id,
    ]),
  );
  await prisma.greenPointWasteType.createMany({
    data: GREEN_POINTS.flatMap((gp) =>
      gp.wasteTypes.map((wasteType) => ({
        greenPointId: buscar(puntosVerdes, gp.code, 'el punto verde'),
        wasteType,
      })),
    ),
    skipDuplicates: true,
  });

  for (const t of TREES_BASE) {
    const { zone, ...datos } = t;
    await prisma.tree.upsert({
      where: { surveyCode: t.surveyCode },
      update: { ...datos, zoneId: zoneId(zone) },
      create: { ...datos, zoneId: zoneId(zone) },
    });
  }
  await prisma.tree.createMany({
    data: INVENTARIO.arboles.map(({ zone, ...datos }) => ({ ...datos, zoneId: zoneId(zone) })),
    skipDuplicates: true,
  });
  const arboles = new Map(
    (await prisma.tree.findMany({ select: { id: true, surveyCode: true } })).map((t) => [
      t.surveyCode,
      t.id,
    ]),
  );

  // GreenSpace no tiene clave natural: se identifica por zona y nombre. Se crean solo las
  // que faltan (un nombre puede repetirse en un barrio, así que se cuentan) y de una vez.
  const clave = (zona: string, nombre: string) => `${zona}|${nombre}`;
  const hay = new Map<string, number>();
  for (const g of await prisma.greenSpace.findMany({ select: { zoneId: true, name: true } })) {
    const k = clave(g.zoneId, g.name);
    hay.set(k, (hay.get(k) ?? 0) + 1);
  }
  const pedidos = new Map<string, number>();
  const nuevos: Prisma.GreenSpaceCreateManyInput[] = [];
  for (const e of ESPACIOS) {
    const k = clave(zoneId(e.barrio), e.nombre);
    const orden = (pedidos.get(k) ?? 0) + 1;
    pedidos.set(k, orden);
    if (orden <= (hay.get(k) ?? 0)) continue;
    nuevos.push({
      name: e.nombre,
      spaceType: TIPO_ESPACIO[e.clasificacion],
      zoneId: zoneId(e.barrio),
      lat: e.lat,
      lng: e.lng,
      areaM2: e.areaM2,
    });
  }
  await prisma.greenSpace.createMany({ data: nuevos });
  const filasEv = new Map<string, { id: string }[]>();
  for (const g of await prisma.greenSpace.findMany({
    select: { id: true, zoneId: true, name: true },
    orderBy: { createdAt: 'asc' },
  })) {
    const k = clave(g.zoneId, g.name);
    filasEv.set(k, [...(filasEv.get(k) ?? []), g]);
  }
  const espaciosVerdes = new Map<string, string>();
  const vistos = new Map<string, number>();
  for (const e of ESPACIOS) {
    const k = clave(zoneId(e.barrio), e.nombre);
    const orden = vistos.get(k) ?? 0;
    vistos.set(k, orden + 1);
    const fila = filasEv.get(k)?.[orden];
    if (fila) espaciosVerdes.set(claveEspacio(e.id), fila.id);
  }

  // ServiceFrequency no tiene clave única: se identifica por tipo, recorrido y turno.
  for (const f of FREQUENCIES) {
    const serviceTypeId = buscar(tipos, f.serviceType, 'el tipo de servicio').id;
    const routeId = buscar(recorridos, f.route, 'el recorrido');
    const existing = await prisma.serviceFrequency.findFirst({
      where: { serviceTypeId, routeId, shift: f.shift },
    });
    if (existing) continue;
    await prisma.serviceFrequency.create({
      data: {
        serviceTypeId,
        routeId,
        shift: f.shift,
        validFrom: dia(-120),
        weekdays: { createMany: { data: f.weekdays.map((weekday) => ({ weekday })) } },
      },
    });
  }

  // ── Operación ──────────────────────────────────────────
  //
  // Service no tiene clave natural: la idempotencia es por presencia. Si ya hay
  // servicios, lo operativo no se toca.
  if ((await prisma.service.count()) > 0) {
    console.log('seed: ya hay servicios cargados, no se siembra la operación.');
    await resumen();
    return;
  }

  const catalogo: Catalogo = {
    tipos,
    zonas,
    recorridos,
    sitios,
    vehiculos,
    cuadrillas,
    contenedores,
    arboles,
    puntosVerdes,
    espaciosVerdes,
  };

  // Todo en una transacción: si algo falla, la base queda con los catálogos y
  // sin operación, y la próxima corrida arranca limpia.
  await prisma.$transaction((tx) => sembrarOperacion(tx, planes, catalogo), {
    maxWait: 30_000,
    // La agenda llega hasta el fin de la cursada: contra una base remota son miles de inserciones en serie.
    timeout: 60 * 60_000,
  });

  await resumen();
}

type Tx = Prisma.TransactionClient;
type ServicioCreado = Prisma.ServiceGetPayload<{ include: { zones: true } }>;

interface Evento {
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
  status?: OutboxEventStatus;
  lastError?: string;
}

async function sembrarOperacion(tx: Tx, planes: Plan[], cat: Catalogo): Promise<void> {
  const zoneId = (code: string) => buscar(cat.zonas, code, 'la zona');
  const eventos: Evento[] = [];

  // Lo que llegó de afuera y explica el estado de lo sembrado. Todo procesado:
  // una fila sin `processedAt` el inbox la volvería a aplicar.
  const entrantes: Prisma.InboxEventCreateManyInput[] = [];
  const recibido = (
    clave: string,
    eventType: string,
    payload: Prisma.InputJsonValue,
    cuando: Date,
  ) =>
    entrantes.push({
      messageId: uuidDe(`inbox-${clave}`),
      eventType,
      payload,
      receivedAt: cuando,
      processedAt: new Date(cuando.getTime() + 1_500),
    });

  // ── Servicios ──────────────────────────────────────────
  const servicios = new Map<string, ServicioCreado>();
  const porPlan = new Map<Plan, ServicioCreado>();

  for (const p of planes) {
    const tipo = buscar(cat.tipos, p.tipo, 'el tipo de servicio');
    const zonas = zonasDe(p);
    const targetId = p.objetivo
      ? buscar(
          {
            CONTAINER: cat.contenedores,
            TREE: cat.arboles,
            GREEN_POINT: cat.puntosVerdes,
            GREEN_SPACE: cat.espaciosVerdes,
          }[p.objetivo.tipo],
          p.objetivo.codigo,
          'el objetivo',
        )
      : null;
    // La planificación semanal se carga con una semana de anticipación; lo que
    // nace de un reclamo, un par de días antes.
    const creado = momento(Math.min(p.dia, 0) - (p.origen === PLANNED ? 7 : 2), 9, 30);

    const service = await tx.service.create({
      data: {
        serviceTypeId: tipo.id,
        mode: p.recorrido ? ServiceMode.ROUTE : ServiceMode.POINT,
        routeId: p.recorrido ? buscar(cat.recorridos, p.recorrido, 'el recorrido') : null,
        targetType: p.objetivo?.tipo ?? null,
        targetId,
        scheduledDate: dia(p.dia),
        windowFrom: hora(...p.franja[0]),
        windowTo: hora(...p.franja[1]),
        crewId: p.cuadrilla ? buscar(cat.cuadrillas, p.cuadrilla, 'la cuadrilla') : null,
        vehicleId: p.vehiculo ? buscar(cat.vehiculos, p.vehiculo, 'el vehículo') : null,
        status: p.estado,
        statusReason: p.motivo ?? null,
        origin: p.origen,
        ticketId: p.ticket ? uuidDe(`ticket-m2-${p.ticket}`) : null,
        weatherAlertId: p.alerta ?? null,
        notes: p.notas ?? null,
        ...(p.override && {
          assignmentOverrideNote: p.override,
          assignmentOverrideBy: '1',
          assignmentOverrideAt: momento(p.dia, 7, 15),
        }),
        createdAt: creado,
        createdBy: p.origen === WEATHER_ALERT ? 'sistema' : '1',
        zones: {
          createMany: { data: zonas.map((z, i) => ({ zoneId: zoneId(z), sequence: i + 1 })) },
        },
      },
      include: { zones: true },
    });
    porPlan.set(p, service);
    if (p.clave) servicios.set(p.clave, service);

    // Resultados por zona y lo recolectado en cada una.
    const [, fin] = p.franja;
    const registrado = p.cierreTarde ? momento(p.dia + 1, 0, 45) : momento(p.dia, fin[0], fin[1]);
    for (const [i, r] of resultadosDe(p).entries()) {
      const zr = await tx.zoneResult.create({
        data: {
          serviceId: service.id,
          zoneId: zoneId(r.zona),
          status: r.estado,
          reason: r.motivo ?? null,
          proposedDate: r.propuesta !== undefined ? dia(r.propuesta) : null,
          notes: r.notas ?? null,
          recordedAt: registrado,
        },
      });

      if (r.estado === ZoneResultStatus.NOT_SERVICED) continue;
      const destino = destinoDe(p, r.zona);
      if (!destino) continue;
      const base = p.recorrido ? (KG_BASE[p.recorrido]?.[r.zona] ?? 0) : kgPuntual(p);
      const kg = Math.round(
        base * variacion(p.dia, i) * (r.estado === ZoneResultStatus.PARTIAL ? 0.55 : 1),
      );
      if (kg === 0) continue;
      await tx.collectionRecord.create({
        data: {
          serviceId: service.id,
          // En un servicio puntual el registro no cuelga de una zona.
          zoneResultId: p.recorrido ? zr.id : null,
          disposalSiteId: buscar(cat.sitios, destino.sitio, 'el destino'),
          wasteType: destino.residuo,
          weightKg: kg,
          volumeM3: Math.round((kg / DENSIDAD[destino.residuo]) * 100) / 100,
        },
      });
    }

    // Avisos de demora: el nuevo reemplaza al anterior, que queda en el historial.
    let anterior: string | null = null;
    for (const d of [...(p.demoras ?? [])].reverse()) {
      const aviso: { id: string } = await tx.serviceDelayNotice.create({
        data: {
          serviceId: service.id,
          delayType: d.tipo,
          delayMinutes: d.minutos,
          reason: d.motivo,
          newEstimatedEnd: d.finEstimado ? relativo(p.dia, d.finEstimado) : null,
          serviceStatus: d.estado,
          reportedBy: d.reportadoPor,
          detectedAt: relativo(p.dia, d.detectado),
          supersededById: anterior,
        },
      });
      anterior = aviso.id;
    }
  }

  const servicio = (clave: string) => buscar(servicios, clave, 'el servicio');

  // Lo que el outbox ya publicó de la operación: los cambios de
  // estado de los reclamos hacia M2.
  for (const [p, s] of porPlan) {
    if (!s.ticketId || p.dia < -5) continue;
    const ticket = (updateType: payloads.TicketUpdateType, cuando: Date, extra = {}) =>
      eventos.push({
        eventType: EventType.UPDATE_TICKET_STATUS,
        aggregateType: AggregateType.SERVICE,
        aggregateId: s.id,
        payload: {
          ...payloads.updateTicketStatus({
            ticketId: s.ticketId as string,
            updateType,
            updatedById: p.cuadrilla ? '1' : 'sistema',
            ...extra,
          }),
          updateOccurredAt: cuando.toISOString(),
        },
        occurredAt: cuando,
      });
    const [inicio, fin] = p.franja;
    if (entre(p.estado, [IN_PROGRESS, COMPLETED, PARTIALLY_COMPLETED])) {
      ticket('STARTED', momento(p.dia, ...inicio), {
        publicMessage: 'La cuadrilla comenzó a atender su reclamo.',
      });
    }
    if (p.estado === COMPLETED) {
      ticket('RESOLVED', momento(p.dia, ...fin), {
        publicMessage: 'El servicio se completó.',
        details: { resolution: { type: 'ACTION_COMPLETED' } },
      });
    }
    if (p.estado === CANCELLED) {
      ticket('REJECTED', momento(p.dia, ...inicio), {
        internalMessage: p.motivo,
        details: { cancellation: { reasonCode: 'OTHER' } },
      });
    }
  }

  // ── Censo de arbolado ──────────────────────────────────
  //
  // El estado sanitario varía como en la calle: la mayoría sanos, algunos
  // debilitados o enfermos, uno seco en pie. Los de riesgo alto o crítico son
  // los que salen hacia M3 y M7 como `treeRiskDetected`.
  const relevamientos: {
    arbol: string;
    dia: number;
    healthStatus: TreeHealthStatus;
    riskLevel: RiskLevel;
    riskType?: RiskType;
    suggestedIntervention?: TreeInterventionType;
    requiresStreetClosure?: boolean;
    requiresPublicWorks?: boolean;
    notes: string;
  }[] = [
    {
      arbol: 'ARB-13-00103',
      dia: -20,
      healthStatus: TreeHealthStatus.WEAKENED,
      riskLevel: RiskLevel.MEDIUM,
      riskType: RiskType.FALLING_BRANCH,
      suggestedIntervention: TreeInterventionType.SAFETY_PRUNING,
      notes: 'Rama seca sobre la senda peatonal de las Barrancas.',
    },
    {
      arbol: 'ARB-13-00101',
      dia: -10,
      healthStatus: TreeHealthStatus.WEAKENED,
      riskLevel: RiskLevel.MEDIUM,
      riskType: RiskType.FALLING_BRANCH,
      suggestedIntervention: TreeInterventionType.SAFETY_PRUNING,
      requiresStreetClosure: true,
      notes: 'Ramas bajas sobre la parada de colectivos de Av. Juramento.',
    },
    {
      arbol: 'ARB-13-00104',
      dia: -18,
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.NONE,
      notes: 'Sin observaciones.',
    },
    {
      arbol: 'ARB-13-00105',
      dia: -17,
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.LOW,
      riskType: RiskType.ROOT_UPLIFT,
      suggestedIntervention: TreeInterventionType.TREATMENT,
      notes: 'Raíces levantando la vereda de Superí.',
    },
    {
      arbol: 'ARB-13-00106',
      dia: -12,
      healthStatus: TreeHealthStatus.DISEASED,
      riskLevel: RiskLevel.MEDIUM,
      riskType: RiskType.PEST_INFESTATION,
      suggestedIntervention: TreeInterventionType.TREATMENT,
      notes: 'Cochinilla en ramas secundarias.',
    },
    {
      arbol: 'ARB-13-00201',
      dia: -18,
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.LOW,
      suggestedIntervention: TreeInterventionType.FORMATION_PRUNING,
      notes: 'Copa desbalanceada hacia la calzada.',
    },
    {
      arbol: 'ARB-13-00203',
      dia: -5,
      healthStatus: TreeHealthStatus.DEAD,
      riskLevel: RiskLevel.CRITICAL,
      riskType: RiskType.TRUNK_INSTABILITY,
      suggestedIntervention: TreeInterventionType.REMOVAL,
      requiresStreetClosure: true,
      notes: 'Ejemplar seco en pie, sin follaje ni brotación. Corteza desprendida en toda la base.',
    },
    {
      arbol: 'ARB-14-00304',
      dia: -15,
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.LOW,
      suggestedIntervention: TreeInterventionType.FORMATION_PRUNING,
      notes: 'Copa invadiendo el tendido de alumbrado.',
    },
    {
      arbol: 'ARB-14-00305',
      dia: -7,
      healthStatus: TreeHealthStatus.WEAKENED,
      riskLevel: RiskLevel.HIGH,
      riskType: RiskType.POWER_LINE_CONTACT,
      suggestedIntervention: TreeInterventionType.SAFETY_PRUNING,
      requiresStreetClosure: true,
      notes: 'Contacto con el tendido sobre Figueroa Alcorta. Requiere corte parcial.',
    },
    {
      arbol: 'ARB-14-00307',
      dia: -12,
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.LOW,
      suggestedIntervention: TreeInterventionType.FORMATION_PRUNING,
      notes: 'Ramas bajas sobre la entrada de un garaje.',
    },
    {
      arbol: 'ARB-14-00302',
      dia: -16,
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.NONE,
      notes: 'Ejemplar sano. El reclamo por el cartel se resuelve con poda de formación.',
    },
    {
      arbol: 'ARB-14-00306',
      dia: -14,
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.NONE,
      notes: 'Sin observaciones.',
    },
    {
      arbol: 'ARB-02-00402',
      dia: -9,
      healthStatus: TreeHealthStatus.DISEASED,
      riskLevel: RiskLevel.CRITICAL,
      riskType: RiskType.TRUNK_INSTABILITY,
      suggestedIntervention: TreeInterventionType.REMOVAL,
      requiresStreetClosure: true,
      requiresPublicWorks: true,
      notes: 'Pudrición basal. Inclinación creciente sobre la vereda de Av. Alvear.',
    },
    {
      arbol: 'ARB-02-00403',
      dia: -16,
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.LOW,
      suggestedIntervention: TreeInterventionType.FORMATION_PRUNING,
      notes: 'Copa tocando los balcones del primer piso.',
    },
    {
      arbol: 'ARB-02-00401',
      dia: -13,
      healthStatus: TreeHealthStatus.WEAKENED,
      riskLevel: RiskLevel.MEDIUM,
      riskType: RiskType.ROOT_UPLIFT,
      suggestedIntervention: TreeInterventionType.TREATMENT,
      notes: 'Raíz levantando el solado frente a la Basílica del Pilar.',
    },
    {
      arbol: 'ARB-02-00405',
      dia: -2,
      healthStatus: TreeHealthStatus.WEAKENED,
      riskLevel: RiskLevel.HIGH,
      riskType: RiskType.FALLING_BRANCH,
      suggestedIntervention: TreeInterventionType.SAFETY_PRUNING,
      notes: 'Rama quebrada por la tormenta, apoyada sobre el cableado.',
    },
    {
      arbol: 'ARB-01-00501',
      dia: -11,
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.NONE,
      notes: 'Lapacho joven en buen estado.',
    },
    {
      arbol: 'ARB-01-00502',
      dia: -11,
      healthStatus: TreeHealthStatus.WEAKENED,
      riskLevel: RiskLevel.LOW,
      suggestedIntervention: TreeInterventionType.TREATMENT,
      notes: 'Estrés hídrico: el riego automático del cantero no funciona.',
    },
    {
      arbol: 'ARB-01-00601',
      dia: -6,
      healthStatus: TreeHealthStatus.DISEASED,
      riskLevel: RiskLevel.HIGH,
      riskType: RiskType.FALLING_BRANCH,
      suggestedIntervention: TreeInterventionType.SAFETY_PRUNING,
      notes: 'Antracnosis avanzada; ramas secas sobre la entrada de Tribunales.',
    },
    {
      arbol: 'ARB-01-00701',
      dia: -19,
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.NONE,
      notes: 'Sin observaciones.',
    },
    {
      arbol: 'ARB-01-00702',
      dia: -19,
      healthStatus: TreeHealthStatus.WEAKENED,
      riskLevel: RiskLevel.MEDIUM,
      riskType: RiskType.SIGN_OBSTRUCTION,
      suggestedIntervention: TreeInterventionType.FORMATION_PRUNING,
      notes: 'La copa tapa el semáforo de Chacabuco y Moreno.',
    },
  ];

  relevamientos.push(
    {
      arbol: 'ARB-01-00801',
      dia: -15,
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.LOW,
      riskType: RiskType.ROOT_UPLIFT,
      suggestedIntervention: TreeInterventionType.TREATMENT,
      notes:
        'Gomero histórico. Raíces superficiales levantando el sendero; se sugiere tratamiento, no poda.',
    },
    {
      arbol: 'ARB-01-00802',
      dia: -15,
      healthStatus: TreeHealthStatus.WEAKENED,
      riskLevel: RiskLevel.MEDIUM,
      riskType: RiskType.FALLING_BRANCH,
      suggestedIntervention: TreeInterventionType.SAFETY_PRUNING,
      notes: 'Ombú con una rama principal agrietada sobre el sendero peatonal.',
    },
    {
      arbol: 'ARB-01-00803',
      dia: -15,
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.NONE,
      notes: 'Sin observaciones.',
    },
  );

  // Un ejemplar relevado en cada una de las comunas que el arbolado escrito a mano no toca.
  const COMUNAS_SIN_ARBOLADO = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 15];
  const muestraArboles = COMUNAS_SIN_ARBOLADO.map(
    (c) =>
      INVENTARIO.arboles.find(
        (t) => BARRIOS.find((b) => b.codigo === t.zone)?.comuna === c,
      ) as ArbolSeed,
  );
  const PATRONES: Omit<(typeof relevamientos)[number], 'arbol' | 'dia'>[] = [
    {
      healthStatus: TreeHealthStatus.WEAKENED,
      riskLevel: RiskLevel.HIGH,
      riskType: RiskType.FALLING_BRANCH,
      suggestedIntervention: TreeInterventionType.SAFETY_PRUNING,
      notes: 'Rama principal agrietada sobre la vereda.',
    },
    {
      healthStatus: TreeHealthStatus.DEAD,
      riskLevel: RiskLevel.CRITICAL,
      riskType: RiskType.TRUNK_INSTABILITY,
      suggestedIntervention: TreeInterventionType.REMOVAL,
      requiresStreetClosure: true,
      notes: 'Ejemplar seco en pie, sin brotación.',
    },
    {
      healthStatus: TreeHealthStatus.HEALTHY,
      riskLevel: RiskLevel.NONE,
      notes: 'Sin observaciones.',
    },
    {
      healthStatus: TreeHealthStatus.DISEASED,
      riskLevel: RiskLevel.MEDIUM,
      riskType: RiskType.PEST_INFESTATION,
      suggestedIntervention: TreeInterventionType.TREATMENT,
      notes: 'Cochinilla en ramas secundarias.',
    },
  ];
  muestraArboles.forEach((t, j) =>
    relevamientos.push({
      arbol: t.surveyCode,
      dia: -4 - ((j * 3) % 14),
      ...PATRONES[j % PATRONES.length],
    }),
  );

  for (const r of relevamientos) {
    const { arbol: codigo, dia: d, ...datos } = r;
    const survey = await tx.treeSurvey.create({
      data: {
        ...datos,
        requiresStreetClosure: datos.requiresStreetClosure ?? false,
        requiresPublicWorks: datos.requiresPublicWorks ?? false,
        treeId: buscar(cat.arboles, codigo, 'el árbol'),
        surveyedAt: momento(d, 10),
        inspectorId: '402',
      },
    });
    if (survey.riskLevel === RiskLevel.HIGH || survey.riskLevel === RiskLevel.CRITICAL) {
      const tree = await tx.tree.findUniqueOrThrow({ where: { id: survey.treeId } });
      eventos.push({
        eventType: EventType.TREE_RISK_DETECTED,
        aggregateType: AggregateType.TREE_SURVEY,
        aggregateId: survey.id,
        payload: payloads.treeRiskDetected(tree, survey),
        occurredAt: survey.surveyedAt,
      });
    }
  }

  // ── Intervenciones de arbolado ─────────────────────────
  //
  // Las podas no piden autorización; las extracciones sí, y solo lo autorizado
  // se programa en un servicio (docs/entidades/tree-intervention.md).
  const intervencion = async (datos: {
    tipo: TreeInterventionType;
    arbol: string;
    estado: TreeInterventionStatus;
    prioridad: Severity;
    servicio?: string;
    corte?: boolean;
    justificacion?: string;
    autorizada?: number;
  }) => {
    const arbolRow = TREES.find((t) => t.surveyCode === datos.arbol);
    const row = await tx.treeIntervention.create({
      data: {
        interventionType: datos.tipo,
        serviceId: datos.servicio ? servicio(datos.servicio).id : null,
        address: arbolRow?.address ?? null,
        requiresStreetClosure: datos.corte ?? false,
        status: datos.estado,
        priority: datos.prioridad,
        justification: datos.justificacion ?? null,
        // `authorize` fija authorizedAt siempre; el firmante solo lo exige la extracción.
        ...(datos.autorizada !== undefined && {
          authorizedByUserId: datos.tipo === TreeInterventionType.REMOVAL ? '701' : null,
          authorizedAt: momento(datos.autorizada, 11),
        }),
        trees: { createMany: { data: [{ treeId: buscar(cat.arboles, datos.arbol, 'el árbol') }] } },
      },
      include: { trees: true },
    });

    return row;
  };

  const { SAFETY_PRUNING, FORMATION_PRUNING, REMOVAL, TREATMENT, PLANTING } = TreeInterventionType;
  const { AUTHORIZED, REQUESTED, PENDING_AUTHORIZATION, REJECTED } = TreeInterventionStatus;

  await intervencion({
    tipo: SAFETY_PRUNING,
    arbol: 'ARB-13-00103',
    estado: AUTHORIZED,
    prioridad: Severity.MEDIUM,
    servicio: 'poda-barrancas',
    autorizada: -19,
  });
  await intervencion({
    tipo: FORMATION_PRUNING,
    arbol: 'ARB-14-00304',
    estado: AUTHORIZED,
    prioridad: Severity.LOW,
    servicio: 'poda-thames',
    autorizada: -14,
  });
  await intervencion({
    tipo: FORMATION_PRUNING,
    arbol: 'ARB-02-00403',
    estado: AUTHORIZED,
    prioridad: Severity.LOW,
    servicio: 'poda-ayacucho',
    autorizada: -15,
  });
  await intervencion({
    tipo: FORMATION_PRUNING,
    arbol: 'ARB-13-00201',
    estado: AUTHORIZED,
    prioridad: Severity.LOW,
    servicio: 'poda-zapiola',
    autorizada: -17,
  });
  await intervencion({
    tipo: FORMATION_PRUNING,
    arbol: 'ARB-14-00307',
    estado: AUTHORIZED,
    prioridad: Severity.LOW,
    servicio: 'poda-malabia',
    autorizada: -11,
  });
  const podaFigueroa = await intervencion({
    tipo: SAFETY_PRUNING,
    arbol: 'ARB-14-00305',
    estado: AUTHORIZED,
    prioridad: Severity.HIGH,
    servicio: 'poda-figueroa-alcorta',
    autorizada: -6,
    corte: true,
  });
  await intervencion({
    tipo: SAFETY_PRUNING,
    arbol: 'ARB-13-00101',
    estado: AUTHORIZED,
    prioridad: Severity.MEDIUM,
    servicio: 'poda-juramento',
    autorizada: -9,
    corte: true,
  });
  const extraccionColegiales = await intervencion({
    tipo: REMOVAL,
    arbol: 'ARB-13-00203',
    estado: AUTHORIZED,
    prioridad: Severity.CRITICAL,
    servicio: 'extraccion-colegiales',
    corte: true,
    autorizada: -3,
    justificacion:
      'Ejemplar seco en pie con riesgo de caída sobre la calzada. Se repone en la misma cazuela.',
  });
  const extraccionAlvear = await intervencion({
    tipo: REMOVAL,
    arbol: 'ARB-02-00402',
    estado: PENDING_AUTHORIZATION,
    prioridad: Severity.CRITICAL,
    corte: true,
    justificacion:
      'Pudrición basal avanzada con inclinación creciente sobre vereda de alto tránsito peatonal. Riesgo de caída.',
  });
  await intervencion({
    tipo: SAFETY_PRUNING,
    arbol: 'ARB-01-00601',
    estado: REQUESTED,
    prioridad: Severity.HIGH,
  });
  await intervencion({
    tipo: TREATMENT,
    arbol: 'ARB-13-00106',
    estado: AUTHORIZED,
    autorizada: -11,
    prioridad: Severity.MEDIUM,
  });
  await intervencion({
    tipo: PLANTING,
    arbol: 'ARB-13-00203',
    estado: REQUESTED,
    prioridad: Severity.LOW,
  });
  await intervencion({
    tipo: REMOVAL,
    arbol: 'ARB-14-00302',
    estado: REJECTED,
    prioridad: Severity.LOW,
    justificacion:
      'Pedido de extracción por obstrucción de cartel comercial. Rechazado: el ejemplar está sano y la obstrucción se resuelve con poda de formación.',
  });

  // ── Cortes de calle (M7) ───────────────────────────────
  const corte = async (datos: {
    motivo: string;
    origen: 'SERVICE' | 'TREE_INTERVENTION';
    origenId: string;
    tipo: StreetClosureType;
    desde: Date;
    hasta: Date;
    estado: StreetClosureRequestStatus;
    closureId?: string;
    calle: [string, string, string];
    creado: Date;
    fallo?: string;
  }) => {
    const row = await tx.streetClosureRequest.create({
      data: {
        reason: datos.motivo,
        sourceType: datos.origen,
        sourceId: datos.origenId,
        closureType: datos.tipo,
        closureFrom: datos.desde,
        closureTo: datos.hasta,
        status: datos.estado,
        closureId: datos.closureId ?? null,
        createdAt: datos.creado,
        streets: {
          createMany: {
            data: [
              { streetName: datos.calle[0], fromCross: datos.calle[1], toCross: datos.calle[2] },
            ],
          },
        },
      },
      include: { streets: true },
    });
    eventos.push({
      eventType: EventType.STREET_CLOSURE_REQUESTED,
      aggregateType: AggregateType.STREET_CLOSURE_REQUEST,
      aggregateId: row.id,
      payload: payloads.streetClosureRequested(row),
      occurredAt: datos.creado,
      ...(datos.fallo && { status: OutboxEventStatus.FAILED, lastError: datos.fallo }),
    });
    return row;
  };

  const corteFigueroa = await corte({
    motivo: 'Poda de seguridad sobre tendido eléctrico. Requiere hidroelevador en calzada.',
    origen: 'TREE_INTERVENTION',
    origenId: podaFigueroa.id,
    tipo: StreetClosureType.PARTIAL,
    desde: momento(3, 10, 30),
    hasta: momento(3, 13),
    estado: StreetClosureRequestStatus.APPROVED,
    closureId: uuidDe('cierre-m7-01184'),
    calle: ['Av. Pres. Figueroa Alcorta', 'Jerónimo Salguero', 'Cavia'],
    creado: momento(-6, 12),
  });
  const corteJuramento = await corte({
    motivo: 'Poda de seguridad sobre la parada de colectivos. Requiere hidroelevador en calzada.',
    origen: 'SERVICE',
    origenId: servicio('poda-juramento').id,
    tipo: StreetClosureType.PARTIAL,
    desde: momento(4, 10, 30),
    hasta: momento(4, 13),
    estado: StreetClosureRequestStatus.REJECTED,
    calle: ['Av. Juramento', 'Arcos', 'Cuba'],
    creado: momento(-5, 12),
  });
  await corte({
    motivo: 'Extracción de ejemplar seco en pie. Corte total de la calzada.',
    origen: 'TREE_INTERVENTION',
    origenId: extraccionColegiales.id,
    tipo: StreetClosureType.TOTAL,
    desde: momento(2, 10, 30),
    hasta: momento(2, 13),
    estado: StreetClosureRequestStatus.REQUESTED,
    calle: ['Virrey Avilés', 'Ramón Freire', 'Conde'],
    creado: momento(-2, 16),
  });
  await corte({
    motivo: 'Extracción de ejemplar con riesgo de caída. Corte total de la calzada.',
    origen: 'TREE_INTERVENTION',
    origenId: extraccionAlvear.id,
    tipo: StreetClosureType.TOTAL,
    desde: momento(9, 7),
    hasta: momento(9, 17),
    estado: StreetClosureRequestStatus.REQUESTED,
    calle: ['Av. Alvear', 'Rodríguez Peña', 'Av. Callao'],
    creado: momento(-8, 15),
    // M7 nunca lo recibió: por eso el corte sigue en REQUESTED sin respuesta.
    fallo:
      'Channel closed by server: 404 (NOT-FOUND): no exchange municipalidad.events. Se agotaron los 5 intentos.',
  });
  const hidrolavado = servicio('hidrolavado-plaza-de-mayo');
  const corteHidrolavado = await corte({
    motivo: 'Hidrolavado del solado de Plaza de Mayo y Av. de Mayo.',
    origen: 'SERVICE',
    origenId: hidrolavado.id,
    tipo: StreetClosureType.TOTAL,
    desde: new Date(hidrolavado.scheduledDate.getTime() + 3.5 * 3_600_000),
    hasta: new Date(hidrolavado.scheduledDate.getTime() + 7 * 3_600_000),
    estado: StreetClosureRequestStatus.ENDED,
    closureId: uuidDe('cierre-m7-01102'),
    calle: ['Av. de Mayo', 'Bolívar', 'Perú'],
    creado: new Date(hidrolavado.scheduledDate.getTime() - 3 * 86_400_000),
  });

  // ── Reparaciones derivadas a M3 ────────────────────────
  const reparacion = async (datos: {
    tipo: RepairDamageType;
    severidad: Severity;
    direccion: string;
    en: 'SERVICE' | 'INSPECTION';
    enId: string;
    riesgo: boolean;
    estado: RepairRequestStatus;
    ot?: string;
    pedida: Date;
  }) => {
    const row = await tx.repairRequest.create({
      data: {
        damageType: datos.tipo,
        severity: datos.severidad,
        address: datos.direccion,
        detectedInType: datos.en,
        detectedInId: datos.enId,
        publicSafetyRisk: datos.riesgo,
        status: datos.estado,
        workOrderId: datos.ot ?? null,
        requestedAt: datos.pedida,
        createdAt: datos.pedida,
      },
    });
    eventos.push({
      eventType: EventType.INFRASTRUCTURE_REPAIR_REQUESTED,
      aggregateType: AggregateType.REPAIR_REQUEST,
      aggregateId: row.id,
      payload: payloads.infrastructureRepairRequested(row),
      occurredAt: datos.pedida,
    });
    return row;
  };

  const reparacionArribenos = await reparacion({
    tipo: RepairDamageType.BROKEN_SIDEWALK,
    severidad: Severity.HIGH,
    direccion: 'Arribeños 2200',
    en: 'SERVICE',
    enId: servicio('rotura-compactador').id,
    riesgo: true,
    estado: RepairRequestStatus.IN_PROGRESS,
    ot: uuidDe('ot-m3-00742'),
    pedida: momento(-9, 10),
  });
  await reparacion({
    tipo: RepairDamageType.BLOCKED_DRAIN,
    severidad: Severity.MEDIUM,
    direccion: 'Av. Santa Fe 4200',
    en: 'SERVICE',
    enId: servicio('barrido-sf-suspendido').id,
    riesgo: false,
    estado: RepairRequestStatus.REQUESTED,
    pedida: momento(ROTURA_BARREDORA + 1, 1, 30),
  });
  await reparacion({
    tipo: RepairDamageType.BROKEN_PAVEMENT,
    severidad: Severity.MEDIUM,
    direccion: 'Av. de Mayo y Salta',
    en: 'SERVICE',
    enId: servicio('recoleccion-mon-incidente').id,
    riesgo: false,
    estado: RepairRequestStatus.REQUESTED,
    pedida: momento(-4, 6),
  });
  const reparacionPuente = await reparacion({
    tipo: RepairDamageType.DAMAGED_STRUCTURE,
    severidad: Severity.HIGH,
    direccion: 'Puente de la Mujer — acceso por Pierina Dealessi',
    en: 'SERVICE',
    enId: hidrolavado.id,
    riesgo: true,
    estado: RepairRequestStatus.IN_PROGRESS,
    ot: uuidDe('ot-m3-00788'),
    pedida: new Date(hidrolavado.scheduledDate.getTime() + 8 * 3_600_000),
  });

  // ── Derivaciones en otras comunas ──────────────────────
  //
  // Lo mismo que arriba, repartido por el resto de la Ciudad: cada ejemplar de riesgo alto o
  // crítico pide su intervención; el seco además pide el corte de calle a M7; y las cuadrillas
  // regionales derivan roturas de vereda a M3.
  let cortesNuevos = 0;
  for (const [j, t] of muestraArboles.entries()) {
    const patron = PATRONES[j % PATRONES.length];
    if (patron.riskLevel !== RiskLevel.HIGH && patron.riskLevel !== RiskLevel.CRITICAL) continue;
    const critico = patron.riskLevel === RiskLevel.CRITICAL;
    const interv = await intervencion({
      tipo: critico ? REMOVAL : SAFETY_PRUNING,
      arbol: t.surveyCode,
      estado: critico ? PENDING_AUTHORIZATION : REQUESTED,
      prioridad: critico ? Severity.CRITICAL : Severity.HIGH,
      corte: critico,
      justificacion: critico
        ? 'Ejemplar seco en pie con riesgo de caída sobre la vereda.'
        : undefined,
    });
    if (critico && cortesNuevos++ < 2) {
      await corte({
        motivo: 'Extracción de ejemplar con riesgo de caída. Corte total de la calzada.',
        origen: 'TREE_INTERVENTION',
        origenId: interv.id,
        tipo: StreetClosureType.TOTAL,
        desde: momento(8 + j, 8),
        hasta: momento(8 + j, 16),
        estado: StreetClosureRequestStatus.REQUESTED,
        calle: [t.address, 'a confirmar', 'a confirmar'],
        creado: momento(-1 - j, 15),
      });
    }
  }
  for (const region of ['SUR-REC', 'OESTE-REC', 'NORTE-REC']) {
    const delaRegion = [...porPlan].find(([p]) => p.cuadrilla === region);
    const cont = CONTAINERS.find(
      (c) => regionDe(c.zone)?.clave === region && c.code.startsWith('CT-'),
    );
    if (!delaRegion || !cont) continue;
    await reparacion({
      tipo: RepairDamageType.BROKEN_SIDEWALK,
      severidad: Severity.MEDIUM,
      direccion: cont.address,
      en: 'SERVICE',
      enId: delaRegion[1].id,
      riesgo: false,
      estado: RepairRequestStatus.REQUESTED,
      pedida: momento(-2 - REGIONES.findIndex((r) => r.clave === region), 11),
    });
  }

  // ── Control ambiental ──────────────────────────────────
  //
  // Los estados en reposo del expediente (todos menos SANCTIONED, que el
  // consumidor de M4 atraviesa sin detenerse), cada uno con lo que corresponde:
  // la inspección, el servicio que la ejecutó, el acta y la resolución de M4. Los
  // que llegan de un reclamo de M2 no traen coordenadas (la v1.6 de su
  // contrato sacó latitude/longitude); los de oficio sí.
  /** Una plaza o parque real del barrio como referencia del hallazgo (con sus coordenadas). */
  const lugar = (barrio: string, k = 0) => {
    const e =
      ESPACIOS.filter(
        (x) => x.barrio === barrio && !x.nombreDerivado && x.clasificacion !== 'PLAZOLETA',
      )
        .sort((a, b) => b.areaM2 - a.areaM2)
        .at(k) ?? (ESPACIOS.find((x) => x.barrio === barrio) as (typeof ESPACIOS)[number]);
    return { address: `Frente a ${e.nombre}`, lat: e.lat, lng: e.lng };
  };

  const denuncia = (
    status: EnvironmentalReportStatus,
    reportType: EnvironmentalReportType,
    address: string,
    creadoDia: number,
    extra: Partial<Prisma.EnvironmentalReportUncheckedCreateInput> = {},
  ) =>
    tx.environmentalReport.create({
      data: {
        reportType,
        address,
        status,
        priority: Severity.MEDIUM,
        createdAt: momento(creadoDia, 9),
        ...extra,
      },
    });

  const inspeccion = (
    reportId: string,
    extra: Partial<Prisma.EnvironmentalInspectionUncheckedCreateInput> = {},
  ) => tx.environmentalInspection.create({ data: { reportId, inspectorId: '601', ...extra } });

  /** Emite el acta como `issueNotice`: número correlativo del año, reincidencia y plazo de M4. */
  const acta = async (
    inspeccionRow: { id: string },
    report: EnvironmentalReport,
    violationType: ViolationType,
    emitida: number,
    suggestedAction: SuggestedAction,
    fallo?: string,
  ) => {
    const issuedAt = momento(emitida, 9);
    const establishmentId = uuidDe(`establecimiento-${report.address}`);
    const notice = await tx.violationNotice.create({
      data: {
        noticeNumber: numeroActa(emitida),
        inspectionId: inspeccionRow.id,
        issuedAt,
        establishmentId,
        violationType,
        severity: Severity.HIGH,
        suggestedAction,
        priorNoticeCount: await tx.violationNotice.count({ where: { establishmentId } }),
      },
    });
    await tx.environmentalReport.update({
      where: { id: report.id },
      data: { deadlineAt: new Date(issuedAt.getTime() + DIAS_PLAZO_SANCION * 86_400_000) },
    });
    const insp = await tx.environmentalInspection.findUniqueOrThrow({
      where: { id: inspeccionRow.id },
    });
    eventos.push({
      eventType: EventType.ENVIRONMENTAL_VIOLATION_DETECTED,
      aggregateType: AggregateType.VIOLATION_NOTICE,
      aggregateId: notice.id,
      payload: payloads.environmentalViolationDetected(notice, insp, report),
      occurredAt: notice.issuedAt,
      ...(fallo && { status: OutboxEventStatus.FAILED, lastError: fallo }),
    });
    return notice;
  };

  const ticketDe = (clave: string) => servicio(clave).ticketId as string;

  /**
   * La resolución de M4, tal como la aplica sanctions.consumer.ts: la multa
   * llega por commercialFineGenerated y la clausura (o su levantamiento, que
   * se registra como DISMISSED) por closureUpdate. El expediente pasa por
   * SANCTIONED y queda CLOSED en la misma transacción, así que SANCTIONED
   * nunca es un estado en reposo y no se siembra.
   */
  const resolucion = async (
    notice: { id: string; noticeNumber: string },
    decision: SanctionDecision,
    decidida: number,
    externalRef: string,
  ) => {
    const decidedAt = momento(decidida, 12);
    await tx.sanctionOutcome.create({
      data: { violationNoticeId: notice.id, decision, decidedAt, externalRef },
    });
    const multa = decision === SanctionDecision.FINE_ISSUED;
    recibido(
      `m4-${notice.noticeNumber}`,
      multa ? 'commercialFineGenerated' : 'closureUpdate',
      {
        sourceViolationId: notice.id,
        decidedAt: decidedAt.toISOString(),
        externalRef,
        ...(!multa && {
          status: decision === SanctionDecision.CLOSURE_ORDERED ? 'ORDERED' : 'LIFTED',
        }),
      },
      decidedAt,
    );
  };

  // Vuelco de escombros: reclamo → inspección → acta → multa.
  const vuelco = await denuncia(
    EnvironmentalReportStatus.CLOSED,
    EnvironmentalReportType.ILLEGAL_DUMPSITE,
    lugar('barracas').address,
    -16,
    {
      ...lugar('barracas'),
      ticketId: ticketDe('insp-vuelco'),
      reporterSnapshot: { isAnonymous: true },
      priority: Severity.HIGH,
    },
  );
  const inspVuelco = await inspeccion(vuelco.id, {
    serviceId: servicio('insp-vuelco').id,
    inspectedAt: momento(-14, 15),
    findings:
      'Acopio de residuos de obra sobre la vereda y la calzada, sin volquete habilitado. El responsable no exhibió contrato de transporte.',
    outcome: InspectionOutcome.VIOLATION_FOUND,
    nextStep: InspectionNextStep.NOTICE_TO_BE_ISSUED,
    conclusion: 'Infracción constatada. Corresponde labrar acta.',
    violationType: ViolationType.ILLEGAL_DUMPING,
    severity: Severity.HIGH,
    suggestedAction: SuggestedAction.FINE,
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
  });
  const actaVuelco = await acta(
    inspVuelco,
    vuelco,
    ViolationType.ILLEGAL_DUMPING,
    -13,
    SuggestedAction.FINE,
  );
  await resolucion(actaVuelco, SanctionDecision.FINE_ISSUED, -6, `M4-MUL-${ANIO}-02277`);

  // Ruido nocturno: la inspección está agendada para pasado mañana.
  const ruido = await denuncia(
    EnvironmentalReportStatus.INSPECTION_SCHEDULED,
    EnvironmentalReportType.NOISE,
    lugar('caballito').address,
    -3,
    {
      ...lugar('caballito'),
      ticketId: ticketDe('insp-ruido'),
      reporterSnapshot: { isAnonymous: false, citizenId: uuidDe('m1-citizen-ruido-honduras') },
      deadlineAt: momento(12, 23, 59),
    },
  );
  await inspeccion(ruido.id, { serviceId: servicio('insp-ruido').id });

  // De oficio, sin infracción: el olor venía de la red cloacal.
  const olorBelgrano = await denuncia(
    EnvironmentalReportStatus.NO_VIOLATION,
    EnvironmentalReportType.ODOR,
    'Av. Cabildo 2200',
    -10,
    {
      lat: -34.5613,
      lng: -58.4575,
      reporterSnapshot: { isAnonymous: false, citizenId: null },
      priority: Severity.LOW,
    },
  );
  await inspeccion(olorBelgrano.id, {
    inspectorId: '602',
    inspectedAt: momento(-8, 15),
    findings: 'Olor atribuible a la red cloacal, no a actividad comercial. Se deriva a AySA.',
    outcome: InspectionOutcome.NO_VIOLATION,
    nextStep: InspectionNextStep.CASE_CLOSED,
    conclusion: 'Sin infracción ambiental.',
    checklistItems: {
      createMany: {
        data: [
          { itemCode: 'EFL-01', label: 'Vuelco a la red sin tratamiento', result: true },
          { itemCode: 'EFL-02', label: 'Rejilla de captación limpia', result: true },
        ],
      },
    },
  });

  await denuncia(
    EnvironmentalReportStatus.RECEIVED,
    EnvironmentalReportType.DUMPING,
    lugar('flores').address,
    -1,
    {
      ...lugar('flores'),
      ticketId: uuidDe('ticket-m2-dumping-paraguay'),
      reporterSnapshot: { isAnonymous: true },
      deadlineAt: momento(15, 23, 59),
    },
  );
  await denuncia(
    EnvironmentalReportStatus.UNDER_REVIEW,
    EnvironmentalReportType.PEST_INFESTATION,
    lugar('liniers').address,
    -2,
    {
      ...lugar('liniers'),
      ticketId: uuidDe('ticket-m2-roedores-moreno'),
      reporterSnapshot: { isAnonymous: false, citizenId: uuidDe('m1-citizen-roedores-moreno') },
      deadlineAt: momento(13, 23, 59),
    },
  );
  await denuncia(
    EnvironmentalReportStatus.FORWARDED,
    EnvironmentalReportType.WATER_DISCHARGE,
    'Av. Alicia Moreau de Justo 400',
    -9,
    {
      lat: -34.6024,
      lng: -58.3674,
      description: 'Descarga con espuma al Dique 3 desde un conducto pluvial.',
      citizenResponse: 'La mancha aparece siempre después de la lluvia.',
    },
  );
  await denuncia(
    EnvironmentalReportStatus.DISMISSED,
    EnvironmentalReportType.NOISE,
    lugar('balvanera').address,
    -7,
    {
      ...lugar('balvanera'),
      ticketId: uuidDe('ticket-m2-ruido-alsina'),
      reporterSnapshot: { isAnonymous: true },
      priority: Severity.LOW,
    },
  );

  // Acopio de residuos en Montserrat: la inspección sale hoy.
  const acopio = await denuncia(
    EnvironmentalReportStatus.INSPECTION_SCHEDULED,
    EnvironmentalReportType.ILLEGAL_DUMPSITE,
    'Chile 900',
    -2,
    {
      lat: -34.6164,
      lng: -58.3787,
      reporterSnapshot: { isAnonymous: false, citizenId: null },
      deadlineAt: momento(9, 23, 59),
    },
  );
  await inspeccion(acopio.id, { serviceId: servicio('insp-chile').id });

  // Inconcluso: se fue a mirar y no alcanzó para decidir.
  const olorColegiales = await denuncia(
    EnvironmentalReportStatus.INSPECTED,
    EnvironmentalReportType.ODOR,
    'Ramón Freire 1200',
    -6,
    { lat: -34.5741, lng: -58.455, reporterSnapshot: { isAnonymous: false, citizenId: null } },
  );
  await inspeccion(olorColegiales.id, {
    inspectorId: '602',
    serviceId: servicio('insp-olor-colegiales').id,
    inspectedAt: momento(-4, 20),
    findings:
      'No se percibió olor durante la inspección. El vecino refiere que ocurre de madrugada. Se solicita nueva visita en horario nocturno.',
    outcome: InspectionOutcome.INCONCLUSIVE,
    nextStep: InspectionNextStep.REINSPECTION,
  });

  // Infracción constatada ayer; el acta todavía no se emitió.
  const basural = await denuncia(
    EnvironmentalReportStatus.VIOLATION_FOUND,
    EnvironmentalReportType.ILLEGAL_DUMPSITE,
    lugar('villa-lugano').address,
    -4,
    {
      ...lugar('villa-lugano'),
      ticketId: ticketDe('insp-recoleta'),
      reporterSnapshot: { isAnonymous: true },
      priority: Severity.HIGH,
    },
  );
  await inspeccion(basural.id, {
    serviceId: servicio('insp-recoleta').id,
    inspectedAt: momento(-1, 15),
    findings: 'Descarga de escombros sobre la vereda. Se identificó al responsable.',
    outcome: InspectionOutcome.VIOLATION_FOUND,
    nextStep: InspectionNextStep.NOTICE_TO_BE_ISSUED,
    violationType: ViolationType.ILLEGAL_DUMPING,
    severity: Severity.HIGH,
    suggestedAction: SuggestedAction.FORMAL_NOTICE,
  });

  /** Denuncia de oficio con inspección que terminó en acta. */
  const expediente = async (
    status: EnvironmentalReportStatus,
    address: string,
    coords: [number, number],
    violationType: ViolationType,
    inspeccionada: number,
    servicioClave?: string,
    fallo?: string,
  ) => {
    const rep = await denuncia(
      status,
      EnvironmentalReportType.ILLEGAL_DUMPSITE,
      address,
      inspeccionada - 3,
      {
        lat: coords[0],
        lng: coords[1],
        priority: Severity.HIGH,
      },
    );
    const insp = await inspeccion(rep.id, {
      serviceId: servicioClave ? servicio(servicioClave).id : null,
      inspectedAt: momento(inspeccionada, 15),
      findings: 'Infracción constatada en el domicilio, con registro fotográfico.',
      outcome: InspectionOutcome.VIOLATION_FOUND,
      nextStep: InspectionNextStep.NOTICE_TO_BE_ISSUED,
      violationType,
      severity: Severity.HIGH,
      suggestedAction: SuggestedAction.FINE,
    });
    const notice = await acta(
      insp,
      rep,
      violationType,
      inspeccionada + 1,
      SuggestedAction.FINE,
      fallo,
    );
    return { rep, insp, notice };
  };

  // Acta emitida y esperando a M4. El envío falló: sin broker, se agotaron los
  // intentos y la fila quedó en FAILED para reintentarla a mano.
  const lavalle = await expediente(
    EnvironmentalReportStatus.NOTICE_ISSUED,
    'Lavalle 700',
    [-34.6023, -58.3766],
    ViolationType.NO_WASTE_MANAGEMENT,
    -3,
    'insp-lavalle',
    'connect ECONNREFUSED: broker RabbitMQ no disponible. Se agotaron los 5 intentos.',
  );

  const clausura = await expediente(
    EnvironmentalReportStatus.CLOSED,
    'Humboldt 1900',
    [-34.5834, -58.4338],
    ViolationType.NO_WASTE_MANAGEMENT,
    -20,
  );
  await resolucion(clausura.notice, SanctionDecision.CLOSURE_ORDERED, -14, `M4-CLA-${ANIO}-00088`);

  const residuosPeligrosos = await expediente(
    EnvironmentalReportStatus.CLOSED,
    'Costa Rica 4700',
    [-34.5881, -58.4272],
    ViolationType.HAZARDOUS_WASTE,
    -18,
  );
  await resolucion(
    residuosPeligrosos.notice,
    SanctionDecision.FINE_ISSUED,
    -11,
    `M4-MUL-${ANIO}-02301`,
  );

  // Clausura levantada: el consumidor la registra como DISMISSED. Cerrado no
  // quiere decir sancionado.
  const desestimada = await expediente(
    EnvironmentalReportStatus.CLOSED,
    'Fitz Roy 2100',
    [-34.5809, -58.4327],
    ViolationType.ILLEGAL_DUMPING,
    -27,
  );
  await resolucion(desestimada.notice, SanctionDecision.DISMISSED, -22, `M4-CLA-${ANIO}-00051`);

  // Una derivación que salió de una inspección, no de un servicio.
  const reparacionLavalle = await reparacion({
    tipo: RepairDamageType.BROKEN_STREETLIGHT,
    severidad: Severity.LOW,
    direccion: 'Plaza Lavalle — Tucumán y Talcahuano',
    en: 'INSPECTION',
    enId: lavalle.insp.id,
    riesgo: false,
    estado: RepairRequestStatus.CLOSED,
    ot: uuidDe('ot-m3-00517'),
    pedida: momento(-3, 17),
  });

  // ── Contenedores dañados (M3) ──────────────────────────
  for (const c of CONTAINERS.filter((x) => x.status === ContainerStatus.DAMAGED)) {
    const row = await tx.container.findUniqueOrThrow({ where: { code: c.code } });
    const detectado = momento(-3 - (CONTAINERS.indexOf(c) % 5), 8);
    eventos.push({
      eventType: EventType.CONTAINER_DAMAGED,
      aggregateType: AggregateType.CONTAINER,
      aggregateId: row.id,
      payload: { ...payloads.containerDamaged(row), detectedAt: detectado.toISOString() },
      occurredAt: detectado,
    });
  }

  // ── Outbox ─────────────────────────────────────────────
  //
  // Sin PENDING a propósito: el despachador barre PENDING cada 10 s al
  // arrancar y publicaría hacia M2 tickets que no existen. Lo sembrado ya salió
  // (SENT) o se abandonó (FAILED), que es lo que muestra el estado de la cola
  // sin mandar nada al bus.
  await tx.outboxEvent.createMany({
    data: eventos.map((e) => {
      const fallido = e.status === OutboxEventStatus.FAILED;
      return {
        eventType: e.eventType,
        aggregateType: e.aggregateType,
        aggregateId: e.aggregateId,
        payload: e.payload as Prisma.InputJsonValue,
        status: fallido ? OutboxEventStatus.FAILED : OutboxEventStatus.SENT,
        attempts: fallido ? 5 : 1,
        lastError: e.lastError ?? null,
        occurredAt: e.occurredAt,
        publishedAt: fallido ? null : new Date(e.occurredAt.getTime() + 4_000),
      };
    }),
  });

  // ── Inbox ──────────────────────────────────────────────
  //
  // La ventana de la alerta va de 6 a 21 hora argentina: el consumidor compara
  // por día UTC, y un `to` pasadas las 21 caería en el día siguiente.
  recibido(
    'alerta-tormenta',
    'weatherAlertIssued',
    {
      alertType: ALERTA_TORMENTA.tipo,
      severity: ALERTA_TORMENTA.severidad,
      zoneIds: ALERTA_TORMENTA.zonas.map(zoneId),
      from: momento(ALERTA_TORMENTA.dia, 6).toISOString(),
      to: momento(ALERTA_TORMENTA.dia, 20, 59).toISOString(),
    },
    momento(0, 6, 5),
  );
  recibido(
    'corte-figueroa-aprobado',
    'streetClosureApproved',
    { closureRequestId: corteFigueroa.id, closureId: uuidDe('cierre-m7-01184') },
    momento(-5, 11),
  );
  recibido(
    'corte-juramento-rechazado',
    'streetClosureRejected',
    { closureRequestId: corteJuramento.id, rejectionReason: RECHAZO_CORTE_JURAMENTO },
    momento(-3, 16),
  );
  const diaHidrolavado = hidrolavado.scheduledDate.getTime();
  recibido(
    'corte-hidrolavado-aprobado',
    'streetClosureApproved',
    { closureRequestId: corteHidrolavado.id, closureId: uuidDe('cierre-m7-01102') },
    new Date(diaHidrolavado - 2 * 86_400_000 + 14 * 3_600_000),
  );
  recibido(
    'corte-hidrolavado-terminado',
    'streetClosureEnded',
    { closureRequestId: corteHidrolavado.id, closureId: uuidDe('cierre-m7-01102') },
    new Date(diaHidrolavado + 7.2 * 3_600_000),
  );
  recibido(
    'ot-arribenos',
    'workOrderScheduled',
    { sourceRequestId: reparacionArribenos.id, workOrderId: uuidDe('ot-m3-00742') },
    momento(-7, 10),
  );
  recibido(
    'ot-puente-de-la-mujer',
    'workOrderScheduled',
    { sourceRequestId: reparacionPuente.id, workOrderId: uuidDe('ot-m3-00788') },
    new Date(reparacionPuente.requestedAt.getTime() + 26 * 3_600_000),
  );
  recibido(
    'ot-plaza-lavalle-agendada',
    'workOrderScheduled',
    { sourceRequestId: reparacionLavalle.id, workOrderId: uuidDe('ot-m3-00517') },
    momento(-2, 10),
  );
  recibido(
    'ot-plaza-lavalle-completada',
    'workOrderCompleted',
    { sourceRequestId: reparacionLavalle.id, workOrderId: uuidDe('ot-m3-00517') },
    momento(-1, 15),
  );
  await tx.inboxEvent.createMany({ data: entrantes });
}

async function resumen() {
  const porEstado = await prisma.service.groupBy({ by: ['status'], _count: { _all: true } });
  // Roles de M6 de la demo. Directo a la tabla, sin auditoría: es dato de arranque.
  await prisma.userRoleAssignment.createMany({ data: rolesDeLaDemo(), skipDuplicates: true });

  console.table({
    userRoleAssignments: await prisma.userRoleAssignment.count(),
    zones: await prisma.zone.count(),
    zoneNeighborhoods: await prisma.zoneNeighborhood.count(),
    routes: await prisma.route.count(),
    frequencies: await prisma.serviceFrequency.count(),
    vehicles: await prisma.vehicle.count(),
    crews: await prisma.crew.count(),
    containers: await prisma.container.count(),
    greenPoints: await prisma.greenPoint.count(),
    trees: await prisma.tree.count(),
    greenSpaces: await prisma.greenSpace.count(),
    services: await prisma.service.count(),
    zoneResults: await prisma.zoneResult.count(),
    collectionRecords: await prisma.collectionRecord.count(),
    delayNotices: await prisma.serviceDelayNotice.count(),
    treeSurveys: await prisma.treeSurvey.count(),
    treeInterventions: await prisma.treeIntervention.count(),
    environmentalReports: await prisma.environmentalReport.count(),
    violationNotices: await prisma.violationNotice.count(),
    repairRequests: await prisma.repairRequest.count(),
    closureRequests: await prisma.streetClosureRequest.count(),
    outboxEvents: await prisma.outboxEvent.count(),
    inboxEvents: await prisma.inboxEvent.count(),
  });
  console.table(Object.fromEntries(porEstado.map((f) => [f.status, f._count._all])));
}

// Importable desde los specs sin tocar la base: solo corre como script.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
