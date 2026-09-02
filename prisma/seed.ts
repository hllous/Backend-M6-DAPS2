import {
  ContainerType,
  CrewType,
  DisposalSiteType,
  PrismaClient,
  ServiceCategory,
  ServiceMode,
  ServiceOrigin,
  ServiceStatus,
  Shift,
  VehicleType,
  WasteType,
  ZoneResultStatus,
  NotServicedReason,
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

  // Punto verde de entrega voluntaria, con los residuos que acepta.
  const greenPoint = await prisma.greenPoint.upsert({
    where: { code: 'GP-0001' },
    update: {},
    create: {
      code: 'GP-0001',
      name: 'Punto verde Plaza Mitre',
      zoneId: zonaCentro,
      address: 'Av. Mitre 1200',
    },
  });
  await prisma.greenPointWasteType.createMany({
    data: [WasteType.RECYCLABLE, WasteType.GREEN].map((wasteType) => ({
      greenPointId: greenPoint.id,
      wasteType,
    })),
    skipDuplicates: true,
  });

  // Frecuencia: recolección domiciliaria sobre R-01, martes y viernes, mañana.
  // ServiceFrequency no tiene clave única natural, así que se busca por la
  // combinación que la identifica en la práctica.
  const recDom = await prisma.serviceType.findUnique({ where: { code: 'REC-DOM' } });
  if (recDom) {
    const existingFrequency = await prisma.serviceFrequency.findFirst({
      where: { serviceTypeId: recDom.id, routeId: route.id, shift: Shift.MORNING },
    });
    if (!existingFrequency) {
      await prisma.serviceFrequency.create({
        data: {
          serviceTypeId: recDom.id,
          routeId: route.id,
          shift: Shift.MORNING,
          validFrom: new Date('2026-09-01T00:00:00.000Z'),
          weekdays: { createMany: { data: [{ weekday: 2 }, { weekday: 5 }] } },
        },
      });
    }
  }

  // Servicios de ejemplo, uno por estado interesante.
  //
  // Service no tiene clave unica natural, asi que la idempotencia es por
  // presencia: si ya hay servicios cargados, no se toca nada.
  if ((await prisma.service.count()) === 0 && recDom) {
    const contVac = await prisma.serviceType.findUnique({ where: { code: 'CONT-VAC' } });
    const crew = await prisma.crew.findFirst({ where: { name: 'Cuadrilla Norte — Recolección' } });
    const vehicle = await prisma.vehicle.findUnique({ where: { plate: 'AA123BB' } });
    const site = await prisma.disposalSite.findUnique({ where: { code: 'DS-CEAMSE' } });
    const container = await prisma.container.findUnique({ where: { code: 'CT-0001' } });

    const routeZones = ZONES.map((z, i) => ({
      zoneId: zones.get(z.code) as string,
      sequence: i + 1,
    }));

    // 1. Programado, sin cuadrilla todavia.
    await prisma.service.create({
      data: {
        serviceTypeId: recDom.id,
        mode: ServiceMode.ROUTE,
        status: ServiceStatus.SCHEDULED,
        origin: ServiceOrigin.PLANNED,
        routeId: route.id,
        scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
        windowFrom: new Date('1970-01-01T06:00:00.000Z'),
        windowTo: new Date('1970-01-01T12:00:00.000Z'),
        zones: { createMany: { data: routeZones } },
      },
    });

    // 2. En ejecucion, con cuadrilla y vehiculo.
    await prisma.service.create({
      data: {
        serviceTypeId: recDom.id,
        mode: ServiceMode.ROUTE,
        status: ServiceStatus.IN_PROGRESS,
        origin: ServiceOrigin.PLANNED,
        routeId: route.id,
        scheduledDate: new Date('2026-09-02T00:00:00.000Z'),
        crewId: crew?.id ?? null,
        vehicleId: vehicle?.id ?? null,
        zones: { createMany: { data: routeZones } },
      },
    });

    // 3. Cerrado parcial: una zona quedo sin atender, con su motivo y su
    //    registro de recoleccion asociado.
    const partial = await prisma.service.create({
      data: {
        serviceTypeId: recDom.id,
        mode: ServiceMode.ROUTE,
        status: ServiceStatus.PARTIALLY_COMPLETED,
        origin: ServiceOrigin.PLANNED,
        routeId: route.id,
        scheduledDate: new Date('2026-08-29T00:00:00.000Z'),
        crewId: crew?.id ?? null,
        vehicleId: vehicle?.id ?? null,
        zones: { createMany: { data: routeZones } },
      },
    });

    const servicedZones = routeZones.slice(0, 2);
    for (const z of servicedZones) {
      await prisma.zoneResult.create({
        data: { serviceId: partial.id, zoneId: z.zoneId, status: ZoneResultStatus.SERVICED },
      });
    }
    const blocked = routeZones[2];
    await prisma.zoneResult.create({
      data: {
        serviceId: partial.id,
        zoneId: blocked.zoneId,
        status: ZoneResultStatus.NOT_SERVICED,
        reason: NotServicedReason.BLOCKED_ACCESS,
        notes: 'Camion de mudanza bloqueando la cuadra.',
      },
    });

    if (site) {
      await prisma.collectionRecord.create({
        data: {
          serviceId: partial.id,
          disposalSiteId: site.id,
          wasteType: WasteType.HOUSEHOLD,
          volumeM3: 18.5,
          weightKg: 4200,
        },
      });
    }

    // 4. Puntual nacido de un reclamo de M2.
    if (contVac && container) {
      await prisma.service.create({
        data: {
          serviceTypeId: contVac.id,
          mode: ServiceMode.POINT,
          status: ServiceStatus.SCHEDULED,
          origin: ServiceOrigin.TICKET,
          ticketId: 'TCK-2026-004821',
          targetType: 'CONTAINER',
          targetId: container.id,
          scheduledDate: new Date('2026-09-04T00:00:00.000Z'),
          zones: { createMany: { data: [{ zoneId: container.zoneId, sequence: 1 }] } },
        },
      });
    }
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
    greenPoints: await prisma.greenPoint.count(),
    frequencies: await prisma.serviceFrequency.count(),
    services: await prisma.service.count(),
    zoneResults: await prisma.zoneResult.count(),
  };
  console.table(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
