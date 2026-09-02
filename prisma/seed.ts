import {
  ContainerType,
  CrewType,
  DisposalSiteType,
  PrismaClient,
  ServiceCategory,
  ServiceMode,
  Shift,
  VehicleType,
} from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Datos mínimos para poder trabajar contra una base vacía: los catálogos sobre
 * los que se programa un Service y los recursos que lo ejecutan.
 *
 * Idempotente — todo va por upsert sobre el código único, así que se puede
 * correr las veces que haga falta sin duplicar nada.
 *
 * Los neighborhoodId son placeholders: el catálogo de barrios es de M9 y
 * todavía no lo expusieron (docs/bloqueantes.md).
 */

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
    code: 'BAR-MEC',
    name: 'Barrido mecánico',
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
    code: 'ARB-POD',
    name: 'Poda de arbolado',
    category: ServiceCategory.TREES,
    mode: ServiceMode.POINT,
    requiresVehicle: true,
  },
  {
    code: 'EV-RIEGO',
    name: 'Riego de espacio verde',
    category: ServiceCategory.GREEN_SPACES,
    mode: ServiceMode.POINT,
    requiresVehicle: true,
  },
  {
    code: 'AMB-INSP',
    name: 'Inspección ambiental',
    category: ServiceCategory.ENVIRONMENTAL_CONTROL,
    mode: ServiceMode.POINT,
    requiresVehicle: false,
  },
];

const ZONES = [
  { code: 'Z-NORTE', name: 'Zona Norte', neighborhoods: ['bo-001', 'bo-002'] },
  { code: 'Z-CENTRO', name: 'Zona Centro', neighborhoods: ['bo-003'] },
  { code: 'Z-SUR', name: 'Zona Sur', neighborhoods: ['bo-004', 'bo-005'] },
];

const DISPOSAL_SITES = [
  { code: 'DS-CEAMSE', name: 'Relleno sanitario Norte III', siteType: DisposalSiteType.LANDFILL },
  {
    code: 'DS-TRANS-1',
    name: 'Estación de transferencia Centro',
    siteType: DisposalSiteType.TRANSFER_STATION,
  },
  {
    code: 'DS-RECI-1',
    name: 'Planta de reciclado Sur',
    siteType: DisposalSiteType.RECYCLING_PLANT,
  },
];

const VEHICLES = [
  { plate: 'AA123BB', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 18 },
  { plate: 'AC456DD', vehicleType: VehicleType.COMPACTOR_TRUCK, capacity: 18 },
  { plate: 'AD789EE', vehicleType: VehicleType.SWEEPER, capacity: 4 },
  { plate: 'AE012FF', vehicleType: VehicleType.CRANE_TRUCK, capacity: 2 },
  { plate: 'AF345GG', vehicleType: VehicleType.WATER_TANKER, capacity: 10 },
];

const CREWS = [
  {
    name: 'Cuadrilla Norte — Recolección',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.MORNING,
    members: ['user-001', 'user-002', 'user-003'],
  },
  {
    name: 'Cuadrilla Centro — Barrido',
    crewType: CrewType.COOPERATIVE,
    defaultShift: Shift.MORNING,
    members: ['user-004', 'user-005'],
  },
  {
    name: 'Cuadrilla Arbolado',
    crewType: CrewType.MUNICIPAL,
    defaultShift: Shift.AFTERNOON,
    members: ['user-006', 'user-007'],
  },
];

async function main() {
  for (const st of SERVICE_TYPES) {
    await prisma.serviceType.upsert({
      where: { code: st.code },
      update: st,
      create: st,
    });
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

  // Recorrido que pasa por las tres zonas, en orden.
  const route = await prisma.route.upsert({
    where: { code: 'R-01' },
    update: { name: 'Recorrido troncal Norte-Centro-Sur' },
    create: { code: 'R-01', name: 'Recorrido troncal Norte-Centro-Sur' },
  });

  await prisma.routeStop.deleteMany({ where: { routeId: route.id } });
  await prisma.routeStop.createMany({
    data: ZONES.map((z, i) => ({
      routeId: route.id,
      zoneId: zones.get(z.code) as string,
      sequence: i + 1,
      estimatedDurationMin: 90,
    })),
  });

  for (const ds of DISPOSAL_SITES) {
    await prisma.disposalSite.upsert({ where: { code: ds.code }, update: ds, create: ds });
  }

  for (const v of VEHICLES) {
    await prisma.vehicle.upsert({ where: { plate: v.plate }, update: v, create: v });
  }

  // Crew no tiene campo único natural, así que se busca por nombre.
  for (const c of CREWS) {
    const existing = await prisma.crew.findFirst({ where: { name: c.name } });
    const crew =
      existing ??
      (await prisma.crew.create({
        data: { name: c.name, crewType: c.crewType, defaultShift: c.defaultShift },
      }));

    await prisma.crewMember.createMany({
      data: c.members.map((userId) => ({ crewId: crew.id, userId })),
      skipDuplicates: true,
    });
  }

  // Inventario mínimo para probar los endpoints de contenedores y arbolado.
  const zonaNorte = zones.get('Z-NORTE') as string;
  const zonaCentro = zones.get('Z-CENTRO') as string;

  for (const [i, zoneId] of [zonaNorte, zonaCentro, zonaNorte].entries()) {
    const code = `CT-${String(i + 1).padStart(4, '0')}`;
    await prisma.container.upsert({
      where: { code },
      update: {},
      create: {
        code,
        containerType: i === 1 ? ContainerType.RECYCLABLE : ContainerType.HOUSEHOLD,
        zoneId,
        capacityLiters: 1100,
        address: `Av. Siempreviva ${1000 + i * 100}`,
      },
    });
  }

  for (const [i, zoneId] of [zonaNorte, zonaCentro].entries()) {
    const surveyCode = `TR-${String(i + 1).padStart(5, '0')}`;
    await prisma.tree.upsert({
      where: { surveyCode },
      update: {},
      create: {
        surveyCode,
        species: i === 0 ? 'Fraxinus excelsior' : 'Jacaranda mimosifolia',
        zoneId,
        address: `Calle Falsa ${200 + i * 50}`,
        heightM: 8.5,
        diameterCm: 42.0,
      },
    });
  }

  const counts = {
    serviceTypes: await prisma.serviceType.count(),
    zones: await prisma.zone.count(),
    routeStops: await prisma.routeStop.count(),
    disposalSites: await prisma.disposalSite.count(),
    vehicles: await prisma.vehicle.count(),
    crews: await prisma.crew.count(),
    containers: await prisma.container.count(),
    trees: await prisma.tree.count(),
  };
  console.table(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
