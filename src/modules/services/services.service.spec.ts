import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ContainerStatus,
  Prisma,
  ServiceMode,
  ServiceOrigin,
  ServiceStatus,
  WasteType,
  ZoneResultStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from './services.service';
import { EnvironmentalInspectionsService } from '../environmental-inspections/environmental-inspections.service';
import { ServiceTargetType } from './dto';
import { erroresUpdateTicketStatus } from '../../events/update-ticket-status-schema.testing';

const USER_ID = '4242';

const ACTOR = { userId: USER_ID, roles: [] };
const SERVICE_ID = '11111111-1111-1111-1111-111111111111';
const TYPE_ID = '22222222-2222-2222-2222-222222222222';
const ROUTE_ID = '33333333-3333-3333-3333-333333333333';
const CREW_ID = '44444444-4444-4444-4444-444444444444';
const VEHICLE_ID = '55555555-5555-5555-5555-555555555555';
const SITE_ID = '66666666-6666-6666-6666-666666666666';
const ZONE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ZONE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const CONTAINER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const INSPECTION_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('ServicesService', () => {
  let prisma: any;
  let outbox: any;
  let audit: any;
  let service: ServicesService;

  const serviceRow = (over: Record<string, unknown> = {}) => ({
    id: SERVICE_ID,
    serviceTypeId: TYPE_ID,
    mode: ServiceMode.ROUTE,
    status: ServiceStatus.SCHEDULED,
    statusReason: null,
    statusNote: null,
    origin: ServiceOrigin.PLANNED,
    routeId: ROUTE_ID,
    targetType: null,
    targetId: null,
    scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
    windowFrom: null,
    windowTo: null,
    crewId: CREW_ID,
    vehicleId: null,
    ticketId: null,
    weatherAlertId: null,
    notes: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    zones: [
      { zoneId: ZONE_A, sequence: 1 },
      { zoneId: ZONE_B, sequence: 2 },
    ],
    zoneResults: [],
    collectionRecords: [],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      serviceType: {
        findUnique: jest.fn().mockResolvedValue({
          id: TYPE_ID,
          code: 'REC-DOM',
          mode: ServiceMode.ROUTE,
          requiresVehicle: false,
          active: true,
        }),
      },
      route: {
        findUnique: jest.fn().mockResolvedValue({
          id: ROUTE_ID,
          code: 'R-01',
          active: true,
          stops: [
            { zoneId: ZONE_A, sequence: 1 },
            { zoneId: ZONE_B, sequence: 2 },
          ],
        }),
      },
      zone: { findUnique: jest.fn().mockResolvedValue({ id: ZONE_A }) },
      container: {
        findUnique: jest.fn().mockResolvedValue({ zoneId: ZONE_B }),
        update: jest.fn(async (args: unknown) => args),
      },
      containerStatusHistory: { create: jest.fn().mockResolvedValue(undefined) },
      tree: { findUnique: jest.fn() },
      greenSpace: { findUnique: jest.fn() },
      greenPoint: { findUnique: jest.fn() },
      crew: {
        count: jest.fn().mockResolvedValue(1),
        // Sin zona ni especialidad cargadas: no hay avisos de encaje (#455).
        findUnique: jest.fn().mockResolvedValue({
          id: CREW_ID,
          active: true,
          name: 'Norte',
          specialty: null,
          homeZoneId: null,
          zoneAssignments: [],
        }),
      },
      vehicle: {
        findUnique: jest.fn().mockResolvedValue({ id: VEHICLE_ID, active: true, plate: 'AA123BB' }),
      },
      disposalSite: {
        findUnique: jest.fn().mockResolvedValue({ id: SITE_ID, code: 'DS-1', active: true }),
      },
      service: {
        create: jest.fn().mockResolvedValue(serviceRow()),
        findUnique: jest.fn().mockResolvedValue(serviceRow()),
        update: jest.fn().mockResolvedValue(serviceRow()),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      outboxEvent: { create: jest.fn(), createMany: jest.fn() },
      // Estado del ticket en M2 (#303): sin dato por defecto.
      ticketM2State: { findUnique: jest.fn().mockResolvedValue(null) },
      environmentalInspection: {
        findUnique: jest.fn().mockResolvedValue({ serviceId: null, outcome: null }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      // El $transaction real acepta un array de operaciones o un callback.
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
      zoneResult: { create: jest.fn().mockResolvedValue({ id: 'zr1', zoneId: ZONE_A }) },
      collectionRecord: {
        create: jest.fn().mockResolvedValue({
          id: 'cr1',
          wasteType: WasteType.HOUSEHOLD,
          disposalSiteId: SITE_ID,
          zoneResultId: null,
          volumeM3: null,
          weightKg: null,
        }),
      },
    };
    outbox = { enqueue: jest.fn(), enqueueMany: jest.fn() };
    // La regla del vínculo vive en el módulo de inspecciones: se usa la real
    // sobre el mismo prisma mockeado; reports y config no se tocan en el alta.
    const inspections = new EnvironmentalInspectionsService(
      prisma as unknown as PrismaService,
      outbox as never,
      {} as never,
      {} as never,
      {} as never,
    );
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new ServicesService(
      prisma as unknown as PrismaService,
      outbox,
      inspections,
      audit as never,
    );
  });

  const baseDto = {
    serviceTypeId: TYPE_ID,
    scheduledDate: '2026-09-15',
    origin: ServiceOrigin.PLANNED,
    routeId: ROUTE_ID,
  };

  // ─── Programación ────────────────────────────────

  describe('programación', () => {
    it('copia el modo del ServiceType, no lo recibe del DTO', async () => {
      prisma.serviceType.findUnique.mockResolvedValue({
        id: TYPE_ID,
        code: 'CONT-VAC',
        mode: ServiceMode.POINT,
        requiresVehicle: false,
        active: true,
      });

      await service.create(
        {
          ...baseDto,
          routeId: undefined,
          targetType: ServiceTargetType.CONTAINER,
          targetId: CONTAINER_ID,
        },
        ACTOR,
      );

      expect(prisma.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mode: ServiceMode.POINT, routeId: null }),
        }),
      );
    });

    it('copia las zonas del recorrido como snapshot, con su sequence', async () => {
      await service.create(baseDto, ACTOR);

      const { data } = prisma.service.create.mock.calls[0][0];
      expect(data.zones).toEqual({
        createMany: {
          data: [
            { zoneId: ZONE_A, sequence: 1 },
            { zoneId: ZONE_B, sequence: 2 },
          ],
        },
      });
    });

    it('deriva la zona de un POINT desde el bien del inventario', async () => {
      prisma.serviceType.findUnique.mockResolvedValue({
        id: TYPE_ID,
        code: 'CONT-VAC',
        mode: ServiceMode.POINT,
        requiresVehicle: false,
        active: true,
      });

      await service.create(
        {
          ...baseDto,
          routeId: undefined,
          targetType: ServiceTargetType.CONTAINER,
          targetId: CONTAINER_ID,
        },
        ACTOR,
      );

      expect(prisma.container.findUnique).toHaveBeenCalledWith({
        where: { id: CONTAINER_ID },
        select: { zoneId: true },
      });
      const { data } = prisma.service.create.mock.calls[0][0];
      expect(data.zones.createMany.data).toEqual([{ zoneId: ZONE_B, sequence: 1 }]);
    });

    it('rechaza un ROUTE sin routeId', async () => {
      await expect(service.create({ ...baseDto, routeId: undefined }, ACTOR)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza un recorrido sin paradas cargadas', async () => {
      prisma.route.findUnique.mockResolvedValue({
        id: ROUTE_ID,
        code: 'R-01',
        active: true,
        stops: [],
      });

      await expect(service.create(baseDto, ACTOR)).rejects.toThrow(BadRequestException);
    });

    it('rechaza un POINT sin objetivo ni zona', async () => {
      prisma.serviceType.findUnique.mockResolvedValue({
        id: TYPE_ID,
        code: 'CONT-VAC',
        mode: ServiceMode.POINT,
        requiresVehicle: false,
        active: true,
      });

      await expect(service.create({ ...baseDto, routeId: undefined }, ACTOR)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('exige ticketId cuando el origen es TICKET', async () => {
      await expect(
        service.create({ ...baseDto, origin: ServiceOrigin.TICKET }, ACTOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza ticketId con cualquier otro origen', async () => {
      await expect(
        service.create({ ...baseDto, origin: ServiceOrigin.PLANNED, ticketId: 'TCK-1' }, ACTOR),
      ).rejects.toThrow(BadRequestException);
    });

    describe('vínculo con la inspección y la alerta (#218)', () => {
      const pointType = () =>
        prisma.serviceType.findUnique.mockResolvedValue({
          id: TYPE_ID,
          code: 'AMB-INSP',
          mode: ServiceMode.POINT,
          requiresVehicle: false,
          active: true,
        });
      const inspeccionDto = {
        ...baseDto,
        routeId: undefined,
        zoneId: ZONE_A,
        origin: ServiceOrigin.INSPECTION,
        inspectionId: INSPECTION_ID,
      };

      it.each([
        ['inspectionId', { inspectionId: INSPECTION_ID }],
        ['weatherAlertId', { weatherAlertId: 'ALERTA-1' }],
      ])('rechaza %s con un origen que no le corresponde', async (_campo, extra) => {
        await expect(service.create({ ...baseDto, ...extra }, ACTOR)).rejects.toThrow(
          BadRequestException,
        );
        expect(prisma.service.create).not.toHaveBeenCalled();
      });

      it('con origin = INSPECTION o WEATHER_ALERT el id no es obligatorio', async () => {
        await service.create({ ...baseDto, origin: ServiceOrigin.WEATHER_ALERT }, ACTOR);
        await service.create({ ...baseDto, origin: ServiceOrigin.INSPECTION }, ACTOR);
        expect(prisma.service.create).toHaveBeenCalledTimes(2);
        expect(prisma.environmentalInspection.updateMany).not.toHaveBeenCalled();
      });

      it('guarda weatherAlertId y lo devuelve', async () => {
        prisma.service.create.mockResolvedValue(
          serviceRow({ origin: ServiceOrigin.WEATHER_ALERT, weatherAlertId: 'ALERTA-1' }),
        );

        const res = await service.create(
          {
            ...baseDto,
            origin: ServiceOrigin.WEATHER_ALERT,
            weatherAlertId: 'ALERTA-1',
          },
          ACTOR,
        );

        expect(prisma.service.create.mock.calls[0][0].data.weatherAlertId).toBe('ALERTA-1');
        expect(res.weatherAlertId).toBe('ALERTA-1');
        expect(res.inspectionId).toBeNull();
      });

      it('fija el vínculo en la inspección, en la misma transacción, y lo devuelve', async () => {
        pointType();

        const res = await service.create(inspeccionDto, ACTOR);

        expect(prisma.environmentalInspection.updateMany).toHaveBeenCalledWith({
          where: { id: INSPECTION_ID, serviceId: null, outcome: null },
          data: { serviceId: SERVICE_ID },
        });
        expect(prisma.service.create.mock.calls[0][0].data).not.toHaveProperty('inspectionId');
        expect(res.inspectionId).toBe(INSPECTION_ID);
      });

      it('404 si la inspección no existe', async () => {
        pointType();
        prisma.environmentalInspection.findUnique.mockResolvedValue(null);

        await expect(service.create(inspeccionDto, ACTOR)).rejects.toThrow(NotFoundException);
        expect(prisma.service.create).not.toHaveBeenCalled();
      });

      it('409 si la inspección ya tiene servicio', async () => {
        pointType();
        prisma.environmentalInspection.findUnique.mockResolvedValue({
          serviceId: 'otro',
          outcome: null,
        });

        await expect(service.create(inspeccionDto, ACTOR)).rejects.toThrow(ConflictException);
        expect(prisma.service.create).not.toHaveBeenCalled();
      });

      it('409 si la inspección ya fue cerrada, aunque no tenga servicio', async () => {
        pointType();
        prisma.environmentalInspection.findUnique.mockResolvedValue({
          serviceId: null,
          outcome: 'NO_VIOLATION',
        });

        await expect(service.create(inspeccionDto, ACTOR)).rejects.toThrow(/ya fue cerrada/);
        expect(prisma.service.create).not.toHaveBeenCalled();
      });

      it('guarda un weatherAlertId o ticketId vacío como null', async () => {
        await service.create(
          {
            ...baseDto,
            origin: ServiceOrigin.WEATHER_ALERT,
            weatherAlertId: '',
          },
          ACTOR,
        );
        await service.create({ ...baseDto, origin: ServiceOrigin.PLANNED, ticketId: '' }, ACTOR);

        expect(prisma.service.create.mock.calls[0][0].data.weatherAlertId).toBeNull();
        expect(prisma.service.create.mock.calls[1][0].data.ticketId).toBeNull();
      });

      it('409 si otra alta tomó la inspección entre el chequeo y la transacción', async () => {
        pointType();
        prisma.environmentalInspection.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.create(inspeccionDto, ACTOR)).rejects.toThrow(ConflictException);
        expect(outbox.enqueue).not.toHaveBeenCalled();
      });

      it('400 si el tipo de servicio es ROUTE', async () => {
        await expect(
          service.create(
            {
              ...baseDto,
              origin: ServiceOrigin.INSPECTION,
              inspectionId: INSPECTION_ID,
            },
            ACTOR,
          ),
        ).rejects.toThrow(BadRequestException);
        expect(prisma.service.create).not.toHaveBeenCalled();
      });

      it('el detalle lee inspectionId del lado de la inspección', async () => {
        prisma.service.findUnique.mockResolvedValue(
          serviceRow({ inspection: { id: INSPECTION_ID } }),
        );

        expect((await service.findOne(SERVICE_ID)).inspectionId).toBe(INSPECTION_ID);
      });
    });

    it('rechaza una ventana horaria invertida', async () => {
      await expect(
        service.create({ ...baseDto, windowFrom: '14:00', windowTo: '08:00' }, ACTOR),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza un tipo de servicio dado de baja', async () => {
      prisma.serviceType.findUnique.mockResolvedValue({
        id: TYPE_ID,
        code: 'REC-DOM',
        mode: ServiceMode.ROUTE,
        requiresVehicle: false,
        active: false,
      });

      await expect(service.create(baseDto, ACTOR)).rejects.toThrow(BadRequestException);
    });

    it('rechaza una cuadrilla dada de baja', async () => {
      prisma.crew.findUnique.mockResolvedValue({ id: CREW_ID, active: false, name: 'Norte' });

      await expect(service.create({ ...baseDto, crewId: CREW_ID }, ACTOR)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('solapamiento al programar (#179)', () => {
    const at = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
    const dtoConRecursos = {
      ...baseDto,
      scheduledDate: '2026-09-30',
      windowFrom: '09:00',
      windowTo: '11:00',
      crewId: CREW_ID,
      vehicleId: VEHICLE_ID,
    };
    const otro = (over: Record<string, unknown> = {}) => ({
      id: 'other-1',
      status: ServiceStatus.SCHEDULED,
      scheduledDate: new Date('2026-09-30T00:00:00.000Z'),
      windowFrom: at('08:00'),
      windowTo: at('12:00'),
      crewId: CREW_ID,
      vehicleId: null,
      serviceType: { name: 'Recolección' },
      crew: { name: 'Norte' },
      vehicle: null,
      ...over,
    });

    it('sin solapamiento crea el servicio', async () => {
      await service.create(dtoConRecursos, ACTOR);

      expect(prisma.service.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.service.create).toHaveBeenCalled();
    });

    describe('encaje de la cuadrilla (#455)', () => {
      const crewDe = (over: Record<string, unknown>) => ({
        id: CREW_ID,
        active: true,
        name: 'Norte',
        specialty: null,
        homeZoneId: null,
        homeZone: null,
        zoneAssignments: [],
        ...over,
      });

      it('cuadrilla de una zona que el recorrido no toca: pide nota y no crea', async () => {
        prisma.crew.findUnique.mockResolvedValue(
          crewDe({ homeZoneId: 'zona-ajena', homeZone: { name: 'Palermo' } }),
        );

        await expect(service.create(dtoConRecursos, ACTOR)).rejects.toThrow(
          /Palermo.*overrideNote/,
        );
        expect(prisma.service.create).not.toHaveBeenCalled();
      });

      it('con nota crea igual y la deja guardada', async () => {
        prisma.crew.findUnique.mockResolvedValue(
          crewDe({ homeZoneId: 'zona-ajena', homeZone: { name: 'Palermo' } }),
        );

        await service.create(
          { ...dtoConRecursos, overrideNote: 'Refuerzo coordinado con la zona' },
          { userId: 'planificador-1', roles: [] },
        );

        expect(prisma.service.create.mock.calls[0][0].data).toMatchObject({
          assignmentOverrideNote: 'Refuerzo coordinado con la zona',
          assignmentOverrideBy: 'planificador-1',
        });
      });

      it('cuadrilla de la zona del recorrido y especialidad correcta: crea sin nota', async () => {
        prisma.crew.findUnique.mockResolvedValue(
          crewDe({ homeZoneId: ZONE_B, specialty: 'COLLECTION' }),
        );

        await service.create(dtoConRecursos, ACTOR);

        expect(prisma.service.create).toHaveBeenCalled();
      });

      it('especialidad que no corresponde al tipo REC-DOM: pide nota', async () => {
        prisma.crew.findUnique.mockResolvedValue(crewDe({ specialty: 'SWEEPING' }));

        await expect(service.create(dtoConRecursos, ACTOR)).rejects.toThrow(ConflictException);
      });
    });

    it('rechaza con 409 si la cuadrilla se solapa, sin crear ni encolar', async () => {
      prisma.service.findMany.mockResolvedValue([otro()]);

      await expect(service.create(dtoConRecursos, ACTOR)).rejects.toThrow(ConflictException);
      await expect(service.create(dtoConRecursos, ACTOR)).rejects.toThrow(
        /se solapa con 1 servicio/,
      );
      expect(prisma.service.create).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si el vehículo se solapa', async () => {
      prisma.service.findMany.mockResolvedValue([otro({ crewId: null, vehicleId: VEHICLE_ID })]);

      await expect(service.create({ ...dtoConRecursos, crewId: undefined }, ACTOR)).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('no cuenta una franja que no se pisa', async () => {
      prisma.service.findMany.mockResolvedValue([
        otro({ windowFrom: at('12:00'), windowTo: at('14:00') }),
      ]);

      await service.create(dtoConRecursos, ACTOR);

      expect(prisma.service.create).toHaveBeenCalled();
    });

    it('solo consulta servicios que ocupan recursos (no cancelados ni completados)', async () => {
      await service.create(dtoConRecursos, ACTOR);

      const { where } = prisma.service.findMany.mock.calls[0][0];
      expect([...where.status.in].sort()).toEqual(
        [
          ServiceStatus.SCHEDULED,
          ServiceStatus.RESCHEDULED,
          ServiceStatus.IN_PROGRESS,
          ServiceStatus.SUSPENDED,
        ].sort(),
      );
    });

    it.each([
      ['posterior', '11:00', '13:00'],
      ['anterior', '07:00', '09:00'],
    ])('una franja contigua %s no es solapamiento', async (_n, from, to) => {
      prisma.service.findMany.mockResolvedValue([otro({ windowFrom: at(from), windowTo: at(to) })]);

      await service.create(dtoConRecursos, ACTOR);

      expect(prisma.service.create).toHaveBeenCalled();
    });

    it('un dto sin franja se asume todo el día y choca con un servicio con franja', async () => {
      prisma.service.findMany.mockResolvedValue([otro()]);

      await expect(
        service.create({ ...dtoConRecursos, windowFrom: undefined, windowTo: undefined }, ACTOR),
      ).rejects.toThrow(ConflictException);
    });

    it.each([
      ['windowFrom', { windowFrom: null }],
      ['windowTo', { windowTo: null }],
    ])('un servicio existente sin %s se asume todo el día', async (_n, over) => {
      prisma.service.findMany.mockResolvedValue([otro(over)]);

      await expect(service.create(dtoConRecursos, ACTOR)).rejects.toThrow(ConflictException);
    });

    it('filtra por la fecha del dto y al crear no excluye ningún id', async () => {
      await service.create(dtoConRecursos, ACTOR);

      const { where } = prisma.service.findMany.mock.calls[0][0];
      expect(where.scheduledDate).toEqual(new Date('2026-09-30T00:00:00.000Z'));
      expect(where.id).toBeUndefined();
    });

    it('assignCrew sí excluye el propio servicio', async () => {
      await service.assignCrew(SERVICE_ID, { crewId: CREW_ID }, ACTOR);

      const { where } = prisma.service.findMany.mock.calls[0][0];
      expect(where.id).toEqual({ not: SERVICE_ID });
    });

    it('con overrideNote crea igual y guarda la nota', async () => {
      prisma.service.findMany.mockResolvedValue([otro()]);

      await service.create(
        { ...dtoConRecursos, overrideNote: 'Lo coordiné con el jefe de cuadrilla' },
        { userId: 'user-1', roles: [] },
      );

      const { data } = prisma.service.create.mock.calls[0][0];
      expect(data.assignmentOverrideNote).toBe('Lo coordiné con el jefe de cuadrilla');
      expect(data.assignmentOverrideBy).toBe('user-1');
      expect(data.assignmentOverrideAt).toBeInstanceOf(Date);
    });

    it('overrideNote sin solapamiento no deja rastro', async () => {
      await service.create({ ...dtoConRecursos, overrideNote: 'por las dudas, nota' }, ACTOR);

      const { data } = prisma.service.create.mock.calls[0][0];
      expect(data.assignmentOverrideNote).toBeUndefined();
    });

    it('sin crewId ni vehicleId no consulta conflictos', async () => {
      await service.create(baseDto, ACTOR);

      expect(prisma.service.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── Máquina de estados ──────────────────────────

  describe('máquina de estados', () => {
    it('no deja iniciar sin cuadrilla asignada: nadie es de su cuadrilla (403 NOT_ASSIGNED)', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ crewId: null }));

      const error = await service.start(SERVICE_ID, ACTOR).catch((e) => e);

      expect(error).toBeInstanceOf(ForbiddenException);
      expect(error.getResponse()).toMatchObject({ code: 'NOT_ASSIGNED' });
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('no deja iniciar sin vehiculo si el tipo lo exige', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ crewId: CREW_ID }));
      prisma.serviceType.findUnique.mockResolvedValue({
        code: 'REC-DOM',
        requiresVehicle: true,
      });

      await expect(service.start(SERVICE_ID, ACTOR)).rejects.toThrow(ConflictException);
    });

    it('inicia cuando hay cuadrilla y el tipo no exige vehiculo', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ crewId: CREW_ID }));

      await service.start(SERVICE_ID, ACTOR);

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ServiceStatus.IN_PROGRESS }),
        }),
      );
    });

    it('rechaza una transicion invalida nombrando las validas', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ status: ServiceStatus.COMPLETED }));

      await expect(service.cancel(SERVICE_ID, 'x', ACTOR)).rejects.toThrow(/es un estado final/);
    });

    it('suspender guarda el motivo', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.IN_PROGRESS }),
      );

      await service.suspend(SERVICE_ID, ACTOR, 'Rotura del camión');

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ServiceStatus.SUSPENDED,
            statusReason: 'Rotura del camión',
            statusNote: null,
          }),
        }),
      );
    });

    it('suspender con nota de solo espacios la guarda como null', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.IN_PROGRESS }),
      );

      await service.suspend(SERVICE_ID, ACTOR, 'Rotura', '   ');

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ statusNote: null }) }),
      );
    });

    it('reanudar y cancelar desde SUSPENDED limpian statusNote', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.SUSPENDED, statusNote: 'x' }),
      );

      await service.resume(SERVICE_ID, ACTOR);
      await service.cancel(SERVICE_ID, 'motivo', ACTOR);

      for (const [arg] of prisma.service.update.mock.calls) {
        expect(arg.data.statusNote).toBeNull();
      }
      expect(prisma.service.update).toHaveBeenCalledTimes(2);
    });

    it('suspender guarda la nota opcional', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.IN_PROGRESS }),
      );

      await service.suspend(SERVICE_ID, ACTOR, 'Rotura', 'Sin frenos');

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ statusNote: 'Sin frenos' }),
        }),
      );
    });

    it.each([
      ServiceStatus.SCHEDULED,
      ServiceStatus.RESCHEDULED,
      ServiceStatus.IN_PROGRESS,
      ServiceStatus.COMPLETED,
      ServiceStatus.CANCELLED,
    ])('reanudar desde %s da 409 y no escribe (no saltea el chequeo de start)', async (status) => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ status }));

      await expect(service.resume(SERVICE_ID, ACTOR)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('reanudar escribe condicionado al estado leído', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ status: ServiceStatus.SUSPENDED }));

      await service.resume(SERVICE_ID, ACTOR);

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SERVICE_ID, status: ServiceStatus.SUSPENDED } }),
      );
    });

    it('si el estado cambió entre la lectura y la escritura da 409', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ status: ServiceStatus.SUSPENDED }));
      prisma.service.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5.22.0' }),
      );

      await expect(service.resume(SERVICE_ID, ACTOR)).rejects.toBeInstanceOf(ConflictException);
    });

    it('reanudar limpia el motivo de la suspension', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.SUSPENDED, statusReason: 'Rotura' }),
      );

      await service.resume(SERVICE_ID, ACTOR);

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ServiceStatus.IN_PROGRESS,
            statusReason: null,
          }),
        }),
      );
    });

    it('confirm-reschedule vuelve a SCHEDULED con la fecha nueva', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.RESCHEDULED }),
      );

      await service.confirmReschedule(SERVICE_ID, { scheduledDate: '2099-09-22' }, ACTOR);

      const { data } = prisma.service.update.mock.calls[0][0];
      expect(data.status).toBe(ServiceStatus.SCHEDULED);
      expect(data.scheduledDate.toISOString().slice(0, 10)).toBe('2099-09-22');
    });

    it('confirmar con una fecha pasada da 400 y no transiciona', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.RESCHEDULED }),
      );

      await expect(
        service.confirmReschedule(SERVICE_ID, { scheduledDate: '2020-01-01' }, ACTOR),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('confirmar con la fecha de hoy (Argentina) es válido', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.RESCHEDULED }),
      );
      const hoy = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);

      await service.confirmReschedule(SERVICE_ID, { scheduledDate: hoy }, ACTOR);

      expect(prisma.service.update).toHaveBeenCalled();
    });

    /**
     * El sistema mete servicios en RESCHEDULED solo: lo hacen el rechazo de un
     * corte de M7 y la alerta meteorológica. Si el motivo es definitivo,
     * cancelar es la decisión correcta y tiene que salir directo — antes había
     * que confirmar una reprogramación a una fecha inventada para poder
     * cancelar después, y eso ensuciaba el dato.
     */
    it('un servicio reprogramado se puede cancelar sin inventar una fecha', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.RESCHEDULED }),
      );

      await service.cancel(SERVICE_ID, 'M7 rechazó el corte: hay obra por dos meses', ACTOR);

      const { data } = prisma.service.update.mock.calls[0][0];
      expect(data.status).toBe(ServiceStatus.CANCELLED);
      expect(data.statusReason).toContain('obra por dos meses');
    });

    /**
     * Es la transición que `tickets.consumer` ya hacía por `updateMany` cuando
     * el vecino cancela el reclamo en M2. Antes de este arreglo, M2 podía
     * cancelar un servicio reprogramado y el operador municipal no.
     */
    it.each([ServiceStatus.SCHEDULED, ServiceStatus.RESCHEDULED, ServiceStatus.SUSPENDED])(
      'se puede cancelar desde %s',
      async (desde) => {
        prisma.service.findUnique.mockResolvedValue(serviceRow({ status: desde }));

        await expect(service.cancel(SERVICE_ID, 'motivo', ACTOR)).resolves.toBeDefined();
      },
    );

    it.each([
      ServiceStatus.IN_PROGRESS,
      ServiceStatus.COMPLETED,
      ServiceStatus.PARTIALLY_COMPLETED,
      ServiceStatus.CANCELLED,
    ])('no se puede cancelar desde %s', async (desde) => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ status: desde }));

      await expect(service.cancel(SERVICE_ID, 'motivo', ACTOR)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  // ─── Cierre calculado ────────────────────────────

  describe('cierre', () => {
    it('cierra COMPLETED cuando todas las zonas quedaron SERVICED', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({
          status: ServiceStatus.IN_PROGRESS,
          zoneResults: [
            { id: 'r1', zoneId: ZONE_A, status: ZoneResultStatus.SERVICED },
            { id: 'r2', zoneId: ZONE_B, status: ZoneResultStatus.SERVICED },
          ],
        }),
      );

      await service.complete(SERVICE_ID, {}, ACTOR);

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ServiceStatus.COMPLETED }),
        }),
      );
    });

    it('cierra PARTIALLY_COMPLETED si alguna zona no se atendio', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({
          status: ServiceStatus.IN_PROGRESS,
          zoneResults: [
            { id: 'r1', zoneId: ZONE_A, status: ZoneResultStatus.SERVICED },
            { id: 'r2', zoneId: ZONE_B, status: ZoneResultStatus.NOT_SERVICED },
          ],
        }),
      );

      await service.complete(SERVICE_ID, {}, ACTOR);

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ServiceStatus.PARTIALLY_COMPLETED }),
        }),
      );
    });

    it('no deja cerrar si falta el resultado de alguna zona', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({
          status: ServiceStatus.IN_PROGRESS,
          zoneResults: [{ id: 'r1', zoneId: ZONE_A, status: ZoneResultStatus.SERVICED }],
        }),
      );

      await expect(service.complete(SERVICE_ID, {}, ACTOR)).rejects.toThrow(ConflictException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    describe('contenedor al cerrar (#199)', () => {
      const closable = () =>
        serviceRow({
          status: ServiceStatus.IN_PROGRESS,
          mode: ServiceMode.POINT,
          routeId: null,
          targetType: ServiceTargetType.CONTAINER,
          targetId: CONTAINER_ID,
          zones: [{ zoneId: ZONE_A, sequence: 1 }],
          zoneResults: [{ id: 'r1', zoneId: ZONE_A, status: ZoneResultStatus.SERVICED }],
        });
      const containerIn = (status: ContainerStatus) => ({
        id: CONTAINER_ID,
        code: 'C-1',
        status,
      });

      it.each([ContainerStatus.OVERFLOWED, ContainerStatus.UNDER_REPAIR])(
        'escribe el contenedor condicionado por el estado leído (%s)',
        async (status) => {
          prisma.service.findUnique.mockResolvedValue(closable());
          prisma.container.findUnique.mockResolvedValue(containerIn(status));

          await service.complete(SERVICE_ID, {}, ACTOR);

          expect(prisma.container.update).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { id: CONTAINER_ID, status },
              data: expect.objectContaining({ status: ContainerStatus.ACTIVE }),
            }),
          );
        },
      );

      it('en RELOCATING también condiciona por el estado leído', async () => {
        prisma.service.findUnique.mockResolvedValue(closable());
        prisma.container.findUnique.mockResolvedValue(containerIn(ContainerStatus.RELOCATING));

        await service.complete(
          SERVICE_ID,
          { containerLocation: { address: 'Av. Nueva 100' } },
          ACTOR,
        );

        expect(prisma.container.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { id: CONTAINER_ID, status: ContainerStatus.RELOCATING },
          }),
        );
      });

      it('da 409 y no encola eventos si el contenedor cambió de estado', async () => {
        prisma.service.findUnique.mockResolvedValue(closable());
        prisma.container.findUnique.mockResolvedValue(containerIn(ContainerStatus.OVERFLOWED));
        prisma.container.update.mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5.22.0' }),
        );

        await expect(service.complete(SERVICE_ID, {}, ACTOR)).rejects.toThrow(ConflictException);
        expect(outbox.enqueueMany).not.toHaveBeenCalled();
      });

      it('el service.update del cierre lleva el estado leído en el where', async () => {
        prisma.service.findUnique.mockResolvedValue(closable());
        prisma.container.findUnique.mockResolvedValue(containerIn(ContainerStatus.OVERFLOWED));

        await service.complete(SERVICE_ID, {}, ACTOR);

        expect(prisma.service.update).toHaveBeenCalledWith(
          expect.objectContaining({ where: { id: SERVICE_ID, status: ServiceStatus.IN_PROGRESS } }),
        );
      });

      it('da 409 y no toca el contenedor si el P2025 viene del service.update', async () => {
        prisma.service.findUnique.mockResolvedValue(closable());
        prisma.container.findUnique.mockResolvedValue(containerIn(ContainerStatus.OVERFLOWED));
        prisma.service.update.mockRejectedValue(
          new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5.22.0' }),
        );

        await expect(service.complete(SERVICE_ID, {}, ACTOR)).rejects.toThrow(ConflictException);
        expect(prisma.container.update).not.toHaveBeenCalled();
        expect(outbox.enqueueMany).not.toHaveBeenCalled();
      });

      describe('historial de estados del contenedor (#475)', () => {
        it.each([
          [ContainerStatus.OVERFLOWED, {}],
          [ContainerStatus.UNDER_REPAIR, {}],
          [ContainerStatus.RELOCATING, { containerLocation: { address: 'Av. Nueva 100' } }],
        ])('cerrar desde %s deja una fila hacia ACTIVE', async (origen, dto) => {
          prisma.service.findUnique.mockResolvedValue(closable());
          prisma.container.findUnique.mockResolvedValue(containerIn(origen));

          await service.complete(SERVICE_ID, dto, ACTOR);

          expect(prisma.containerStatusHistory.create).toHaveBeenCalledTimes(1);
          expect(prisma.containerStatusHistory.create).toHaveBeenCalledWith({
            data: {
              containerId: CONTAINER_ID,
              fromStatus: origen,
              toStatus: ContainerStatus.ACTIVE,
            },
          });
        });

        it('si el contenedor no transiciona (ACTIVE) no deja fila', async () => {
          prisma.service.findUnique.mockResolvedValue(closable());
          prisma.container.findUnique.mockResolvedValue(containerIn(ContainerStatus.ACTIVE));

          await service.complete(SERVICE_ID, {}, ACTOR);

          expect(prisma.containerStatusHistory.create).not.toHaveBeenCalled();
        });

        it('un cierre parcial no transiciona el contenedor ni deja fila', async () => {
          prisma.service.findUnique.mockResolvedValue({
            ...closable(),
            zoneResults: [{ id: 'r1', zoneId: ZONE_A, status: ZoneResultStatus.NOT_SERVICED }],
          });
          prisma.container.findUnique.mockResolvedValue(containerIn(ContainerStatus.OVERFLOWED));

          await service.complete(SERVICE_ID, {}, ACTOR);

          expect(prisma.containerStatusHistory.create).not.toHaveBeenCalled();
        });

        it('un conflicto de concurrencia en el contenedor (409) no deja fila', async () => {
          prisma.service.findUnique.mockResolvedValue(closable());
          prisma.container.findUnique.mockResolvedValue(containerIn(ContainerStatus.OVERFLOWED));
          prisma.container.update.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('x', {
              code: 'P2025',
              clientVersion: '5.22.0',
            }),
          );

          await expect(service.complete(SERVICE_ID, {}, ACTOR)).rejects.toThrow(ConflictException);
          expect(prisma.containerStatusHistory.create).not.toHaveBeenCalled();
        });

        it('si falla la fila del historial el cierre entero falla', async () => {
          prisma.service.findUnique.mockResolvedValue(closable());
          prisma.container.findUnique.mockResolvedValue(containerIn(ContainerStatus.OVERFLOWED));
          prisma.containerStatusHistory.create.mockRejectedValue(new Error('db caída'));

          await expect(service.complete(SERVICE_ID, {}, ACTOR)).rejects.toThrow('db caída');
          expect(outbox.enqueueMany).not.toHaveBeenCalled();
        });
      });

      it('no traduce a 409 los errores que no son P2025', async () => {
        prisma.service.findUnique.mockResolvedValue(closable());
        prisma.container.findUnique.mockResolvedValue(containerIn(ContainerStatus.OVERFLOWED));
        prisma.container.update.mockRejectedValue(new Error('db caída'));

        await expect(service.complete(SERVICE_ID, {}, ACTOR)).rejects.toThrow('db caída');
      });
    });
  });

  // ─── Resultado por zona ──────────────────────────

  describe('resultado por zona', () => {
    beforeEach(() => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.IN_PROGRESS }),
      );
    });

    it('exige motivo cuando la zona no quedo SERVICED', async () => {
      await expect(
        service.addZoneResult(
          SERVICE_ID,
          {
            zoneId: ZONE_A,
            status: ZoneResultStatus.NOT_SERVICED,
          },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza motivo cuando la zona quedo SERVICED', async () => {
      await expect(
        service.addZoneResult(
          SERVICE_ID,
          {
            zoneId: ZONE_A,
            status: ZoneResultStatus.SERVICED,
            reason: 'WEATHER' as never,
          },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza una zona que no pertenece al servicio', async () => {
      await expect(
        service.addZoneResult(
          SERVICE_ID,
          {
            zoneId: '99999999-9999-9999-9999-999999999999',
            status: ZoneResultStatus.SERVICED,
          },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza una zona que ya tiene resultado', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({
          status: ServiceStatus.IN_PROGRESS,
          zoneResults: [{ id: 'r1', zoneId: ZONE_A, status: ZoneResultStatus.SERVICED }],
        }),
      );

      await expect(
        service.addZoneResult(
          SERVICE_ID,
          {
            zoneId: ZONE_A,
            status: ZoneResultStatus.SERVICED,
          },
          USER_ID,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('no admite resultados si el servicio no esta en IN_PROGRESS', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow());

      await expect(
        service.addZoneResult(
          SERVICE_ID,
          {
            zoneId: ZONE_A,
            status: ZoneResultStatus.SERVICED,
          },
          USER_ID,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── Recolección ─────────────────────────────────

  describe('registro de recolección', () => {
    beforeEach(() => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.IN_PROGRESS }),
      );
    });

    it('rechaza un sitio de disposicion dado de baja', async () => {
      prisma.disposalSite.findUnique.mockResolvedValue({
        id: SITE_ID,
        code: 'DS-1',
        active: false,
      });

      await expect(
        service.addCollectionRecord(
          SERVICE_ID,
          {
            wasteType: WasteType.HOUSEHOLD,
            disposalSiteId: SITE_ID,
          },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('devuelve 404 si el sitio de disposicion no existe', async () => {
      prisma.disposalSite.findUnique.mockResolvedValue(null);

      await expect(
        service.addCollectionRecord(
          SERVICE_ID,
          {
            wasteType: WasteType.HOUSEHOLD,
            disposalSiteId: SITE_ID,
          },
          USER_ID,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza un zoneResultId de otro servicio', async () => {
      await expect(
        service.addCollectionRecord(
          SERVICE_ID,
          {
            wasteType: WasteType.HOUSEHOLD,
            disposalSiteId: SITE_ID,
            zoneResultId: '99999999-9999-9999-9999-999999999999',
          },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('no admite registros sobre un servicio que no arranco', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow());

      await expect(
        service.addCollectionRecord(
          SERVICE_ID,
          {
            wasteType: WasteType.HOUSEHOLD,
            disposalSiteId: SITE_ID,
          },
          USER_ID,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── Programación hacia M2 (#303) ─────────────────

  describe('programación informada a M2 (#303)', () => {
    const TICKET_ID = '77777777-7777-4777-8777-777777777777';
    const ticketDto = { ...baseDto, origin: ServiceOrigin.TICKET, ticketId: TICKET_ID };

    /** Los updateTicketStatus que se encolaron en todas las llamadas. */
    const hacia = () =>
      [
        ...outbox.enqueue.mock.calls.map(([, e]: [unknown, unknown]) => [e]),
        ...outbox.enqueueMany.mock.calls.map(([, es]: [unknown, unknown[]]) => es),
      ]
        .flat()
        .filter((e) => e.eventType === 'updateTicketStatus')
        .map((e) => e.payload);

    const conTicketEn = (status: string | null) =>
      prisma.ticketM2State.findUnique.mockResolvedValue(status ? { status } : null);

    beforeEach(() => {
      prisma.service.create.mockResolvedValue(
        serviceRow({
          origin: ServiceOrigin.TICKET,
          ticketId: TICKET_ID,
          windowFrom: new Date('1970-01-01T08:00:00.000Z'),
          windowTo: new Date('1970-01-01T12:30:00.000Z'),
          scheduledDate: new Date('2026-10-21T00:00:00.000Z'),
        }),
      );
    });

    /** M7 solo consume streetClosureRequested: el alta no emite urbanServiceScheduled (#345). */
    it('el alta solo encola el aviso a M2, nunca urbanServiceScheduled', async () => {
      await service.create(ticketDto, ACTOR);

      expect(outbox.enqueue).not.toHaveBeenCalled();
      const encolados = outbox.enqueueMany.mock.calls.flatMap(([, es]: [unknown, unknown[]]) => es);
      expect(encolados.map((e: { eventType: string }) => e.eventType)).toEqual([
        'updateTicketStatus',
      ]);
    });

    it('un servicio sin ticketId no publica nada hacia M2', async () => {
      prisma.service.create.mockResolvedValue(serviceRow());

      await service.create(baseDto, ACTOR);

      expect(hacia()).toEqual([]);
      expect(prisma.ticketM2State.findUnique).not.toHaveBeenCalled();
    });

    it.each(['ROUTED', null])(
      'agendar con el ticket en %s manda STARTED con la programación',
      async (estado) => {
        conTicketEn(estado);

        await service.create(ticketDto, { userId: 'user-1', roles: [] });

        const [p] = hacia();
        expect(hacia()).toHaveLength(1);
        expect(p).toMatchObject({
          ticketId: TICKET_ID,
          updateType: 'STARTED',
          publicMessage:
            'Su servicio fue programado para el miércoles 21 de octubre de 2026, entre las 08:00 y las 12:30 hs.',
        });
      },
    );

    it('agendar con el ticket IN_PROGRESS manda PROGRESS', async () => {
      conTicketEn('IN_PROGRESS');

      await service.create(ticketDto, ACTOR);

      expect(hacia()).toEqual([expect.objectContaining({ updateType: 'PROGRESS' })]);
    });

    it.each(['IN_REVIEW', 'PENDING_INFORMATION', 'RESOLVED', 'CLOSED', 'CANCELLED', 'DUPLICATE'])(
      'agendar con el ticket en %s no publica (M2 lo rechazaría)',
      async (estado) => {
        conTicketEn(estado);

        await service.create(ticketDto, ACTOR);

        expect(hacia()).toEqual([]);
      },
    );

    it('no manda la cuadrilla ni las notas', async () => {
      conTicketEn('ROUTED');
      prisma.service.create.mockResolvedValue(
        serviceRow({
          ticketId: TICKET_ID,
          crewId: CREW_ID,
          notes: 'portón trasero',
          scheduledDate: new Date('2026-10-21T00:00:00.000Z'),
        }),
      );

      await service.create(ticketDto, ACTOR);

      const texto = JSON.stringify(hacia());
      expect(texto).not.toContain(CREW_ID);
      expect(texto).not.toContain('portón');
      expect(hacia()[0]).not.toHaveProperty('progress');
      expect(hacia()[0]).not.toHaveProperty('details');
    });

    it.each(['ROUTED', 'IN_PROGRESS'])(
      'el aviso con el ticket en %s valida contra el schema de updateTicketStatus',
      async (estado) => {
        conTicketEn(estado);

        await service.create(ticketDto, ACTOR);

        expect(erroresUpdateTicketStatus(hacia()[0])).toEqual([]);
      },
    );

    it('el estado se lee con el cliente de la transacción', async () => {
      conTicketEn('ROUTED');
      const tx = { ...prisma, ticketM2State: { findUnique: jest.fn().mockResolvedValue(null) } };
      prisma.$transaction.mockImplementationOnce((fn: (t: unknown) => unknown) => fn(tx));

      await service.create(ticketDto, ACTOR);

      expect(tx.ticketM2State.findUnique).toHaveBeenCalled();
      expect(prisma.ticketM2State.findUnique).not.toHaveBeenCalled();
    });

    // #485: updatedBy.id es el actorId UUID de M1; el sub (userId, numérico) no viaja nunca.
    describe('updatedBy.id del aviso a M2', () => {
      const ACTOR_UUID = '3f2b8c1e-9a4d-4e6b-8c7d-1a2b3c4d5e6f';
      const conUuid = { userId: USER_ID, actorId: ACTOR_UUID, roles: [] };
      const sinUuid = { userId: USER_ID, roles: [] };
      const ticketServicio = (over: Record<string, unknown> = {}) =>
        serviceRow({
          ticketId: TICKET_ID,
          crewId: CREW_ID,
          origin: ServiceOrigin.TICKET,
          scheduledDate: new Date('2026-10-21T00:00:00.000Z'),
          ...over,
        });
      const accion = (
        nombre: string,
        actor: { userId: string; actorId?: string; roles: never[] },
      ) => {
        switch (nombre) {
          case 'create':
            return service.create(ticketDto, actor);
          case 'start':
            prisma.service.findUnique.mockResolvedValue(ticketServicio());
            return service.start(SERVICE_ID, actor);
          case 'cancel':
            prisma.service.findUnique.mockResolvedValue(
              ticketServicio({ status: ServiceStatus.SCHEDULED }),
            );
            return service.cancel(SERVICE_ID, 'Lluvia', actor);
          default:
            prisma.service.findUnique.mockResolvedValue(
              ticketServicio({ status: ServiceStatus.RESCHEDULED }),
            );
            return service.confirmReschedule(SERVICE_ID, { scheduledDate: '2099-09-22' }, actor);
        }
      };

      it.each(['create', 'start', 'cancel', 'confirmReschedule'])(
        '%s manda el actorId como updatedBy.id, no el sub',
        async (nombre) => {
          conTicketEn('ROUTED');

          await accion(nombre, conUuid);

          expect(hacia()).toHaveLength(1);
          expect(hacia()[0]).toMatchObject({
            updatedBy: { type: 'EXTERNAL_USER', id: ACTOR_UUID },
          });
          expect(JSON.stringify(hacia())).not.toContain(USER_ID);
        },
      );

      it.each(['create', 'start', 'cancel', 'confirmReschedule'])(
        '%s sin actorId en el token manda updatedBy.id null',
        async (nombre) => {
          conTicketEn('ROUTED');

          await accion(nombre, sinUuid);

          expect(hacia()).toHaveLength(1);
          expect(hacia()[0]).toMatchObject({ updatedBy: { id: null } });
        },
      );
    });

    describe('reprogramar', () => {
      const reprogramado = (over: Record<string, unknown> = {}) =>
        serviceRow({
          status: ServiceStatus.RESCHEDULED,
          ticketId: TICKET_ID,
          windowFrom: new Date('1970-01-01T08:00:00.000Z'),
          windowTo: new Date('1970-01-01T12:00:00.000Z'),
          ...over,
        });

      it('reschedule sin fecha nueva no publica nada', async () => {
        prisma.service.findUnique.mockResolvedValue(
          serviceRow({ ticketId: TICKET_ID, status: ServiceStatus.SCHEDULED }),
        );
        conTicketEn('IN_PROGRESS');

        await service.reschedule(SERVICE_ID, 'lluvia', ACTOR);

        expect(hacia()).toEqual([]);
      });

      it('confirmar la fecha nueva con el ticket IN_PROGRESS manda PROGRESS', async () => {
        prisma.service.findUnique.mockResolvedValue(reprogramado());
        conTicketEn('IN_PROGRESS');

        await service.confirmReschedule(
          SERVICE_ID,
          { scheduledDate: '2099-09-22', windowFrom: '09:00', windowTo: '11:00' },
          { userId: 'user-1', roles: [] },
        );

        expect(hacia()).toEqual([
          expect.objectContaining({
            updateType: 'PROGRESS',
            publicMessage:
              'Su servicio fue reprogramado para el martes 22 de septiembre de 2099, entre las 09:00 y las 11:00 hs.',
          }),
        ]);
      });

      it('sin franja nueva usa la que ya tenía el servicio', async () => {
        prisma.service.findUnique.mockResolvedValue(reprogramado());
        conTicketEn('ROUTED');

        await service.confirmReschedule(SERVICE_ID, { scheduledDate: '2099-09-22' }, ACTOR);

        expect(hacia()[0]).toMatchObject({
          updateType: 'STARTED',
          publicMessage: expect.stringContaining('entre las 08:00 y las 12:00 hs'),
        });
      });

      it('con el ticket pendiente de información no publica', async () => {
        prisma.service.findUnique.mockResolvedValue(reprogramado());
        conTicketEn('PENDING_INFORMATION');

        await service.confirmReschedule(SERVICE_ID, { scheduledDate: '2099-09-22' }, ACTOR);

        expect(hacia()).toEqual([]);
        expect(prisma.service.update).toHaveBeenCalled();
      });

      it('sin ticketId no publica', async () => {
        prisma.service.findUnique.mockResolvedValue(reprogramado({ ticketId: null }));

        await service.confirmReschedule(SERVICE_ID, { scheduledDate: '2099-09-22' }, ACTOR);

        expect(hacia()).toEqual([]);
      });
    });

    describe('iniciar el servicio', () => {
      const iniciable = () =>
        serviceRow({ crewId: CREW_ID, ticketId: TICKET_ID, origin: ServiceOrigin.TICKET });

      it('con el ticket ya IN_PROGRESS manda PROGRESS y no repite STARTED', async () => {
        prisma.service.findUnique.mockResolvedValue(iniciable());
        conTicketEn('IN_PROGRESS');

        await service.start(SERVICE_ID, ACTOR);

        expect(hacia()).toEqual([
          expect.objectContaining({
            updateType: 'PROGRESS',
            publicMessage: 'La cuadrilla comenzó a atender su reclamo.',
          }),
        ]);
      });

      it.each(['ROUTED', null])('con el ticket en %s manda STARTED', async (e) => {
        prisma.service.findUnique.mockResolvedValue(iniciable());
        conTicketEn(e);

        await service.start(SERVICE_ID, ACTOR);

        expect(hacia()).toEqual([expect.objectContaining({ updateType: 'STARTED' })]);
      });

      // M2 solo acepta STARTED desde ROUTED (#396): el servicio arranca igual, sin aviso.
      it.each(['IN_REVIEW', 'PENDING_INFORMATION', 'RESOLVED', 'CANCELLED'])(
        'con el ticket en %s inicia el servicio y no publica',
        async (e) => {
          prisma.service.findUnique.mockResolvedValue(iniciable());
          conTicketEn(e);

          await service.start(SERVICE_ID, ACTOR);

          expect(prisma.service.update).toHaveBeenCalled();
          expect(hacia()).toEqual([]);
        },
      );
    });
  });

  // ─── Edición ─────────────────────────────────────

  it('no deja editar un servicio ya iniciado', async () => {
    prisma.service.findUnique.mockResolvedValue(serviceRow({ status: ServiceStatus.IN_PROGRESS }));

    await expect(service.update(SERVICE_ID, { notes: 'x' }, ACTOR)).rejects.toThrow(
      ConflictException,
    );
  });

  describe('auditoría (#460)', () => {
    it('programar audita el alta con el actor del token', async () => {
      await service.create(baseDto, ACTOR);

      expect(audit.record).toHaveBeenCalledWith(prisma, {
        entityType: 'SERVICE',
        entityId: expect.any(String),
        action: 'CREATE',
        toStatus: ServiceStatus.SCHEDULED,
        actor: ACTOR,
      });
    });

    it('cada transición audita estados, actor y el motivo que ya se pide', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ status: ServiceStatus.SCHEDULED }));

      await service.cancel(SERVICE_ID, 'Lluvia', ACTOR);

      expect(audit.record).toHaveBeenCalledWith(prisma, {
        entityType: 'SERVICE',
        entityId: SERVICE_ID,
        action: 'CANCEL',
        fromStatus: ServiceStatus.SCHEDULED,
        toStatus: ServiceStatus.CANCELLED,
        actor: ACTOR,
        note: 'Lluvia',
      });
    });

    it('una transición inválida no deja constancia', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ status: ServiceStatus.COMPLETED }));

      await expect(service.cancel(SERVICE_ID, 'x', ACTOR)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(audit.record).not.toHaveBeenCalled();
    });
  });
});
