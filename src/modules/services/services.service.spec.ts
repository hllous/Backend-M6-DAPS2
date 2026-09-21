import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
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
import { ServiceTargetType } from './dto';

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
  let service: ServicesService;

  const serviceRow = (over: Record<string, unknown> = {}) => ({
    id: SERVICE_ID,
    serviceTypeId: TYPE_ID,
    mode: ServiceMode.ROUTE,
    status: ServiceStatus.SCHEDULED,
    statusReason: null,
    origin: ServiceOrigin.PLANNED,
    routeId: ROUTE_ID,
    targetType: null,
    targetId: null,
    scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
    windowFrom: null,
    windowTo: null,
    crewId: null,
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
      tree: { findUnique: jest.fn() },
      greenSpace: { findUnique: jest.fn() },
      greenPoint: { findUnique: jest.fn() },
      crew: {
        findUnique: jest.fn().mockResolvedValue({ id: CREW_ID, active: true, name: 'Norte' }),
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
      environmentalInspection: {
        findUnique: jest.fn().mockResolvedValue({ serviceId: null }),
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
    service = new ServicesService(prisma as unknown as PrismaService, outbox);
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

      await service.create({
        ...baseDto,
        routeId: undefined,
        targetType: ServiceTargetType.CONTAINER,
        targetId: CONTAINER_ID,
      });

      expect(prisma.service.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mode: ServiceMode.POINT, routeId: null }),
        }),
      );
    });

    it('copia las zonas del recorrido como snapshot, con su sequence', async () => {
      await service.create(baseDto);

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

      await service.create({
        ...baseDto,
        routeId: undefined,
        targetType: ServiceTargetType.CONTAINER,
        targetId: CONTAINER_ID,
      });

      expect(prisma.container.findUnique).toHaveBeenCalledWith({
        where: { id: CONTAINER_ID },
        select: { zoneId: true },
      });
      const { data } = prisma.service.create.mock.calls[0][0];
      expect(data.zones.createMany.data).toEqual([{ zoneId: ZONE_B, sequence: 1 }]);
    });

    it('rechaza un ROUTE sin routeId', async () => {
      await expect(service.create({ ...baseDto, routeId: undefined })).rejects.toThrow(
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

      await expect(service.create(baseDto)).rejects.toThrow(BadRequestException);
    });

    it('rechaza un POINT sin objetivo ni zona', async () => {
      prisma.serviceType.findUnique.mockResolvedValue({
        id: TYPE_ID,
        code: 'CONT-VAC',
        mode: ServiceMode.POINT,
        requiresVehicle: false,
        active: true,
      });

      await expect(service.create({ ...baseDto, routeId: undefined })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('exige ticketId cuando el origen es TICKET', async () => {
      await expect(service.create({ ...baseDto, origin: ServiceOrigin.TICKET })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza ticketId con cualquier otro origen', async () => {
      await expect(
        service.create({ ...baseDto, origin: ServiceOrigin.PLANNED, ticketId: 'TCK-1' }),
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
        await expect(service.create({ ...baseDto, ...extra })).rejects.toThrow(BadRequestException);
        expect(prisma.service.create).not.toHaveBeenCalled();
      });

      it('con origin = INSPECTION o WEATHER_ALERT el id no es obligatorio', async () => {
        await service.create({ ...baseDto, origin: ServiceOrigin.WEATHER_ALERT });
        await service.create({ ...baseDto, origin: ServiceOrigin.INSPECTION });
        expect(prisma.service.create).toHaveBeenCalledTimes(2);
        expect(prisma.environmentalInspection.updateMany).not.toHaveBeenCalled();
      });

      it('guarda weatherAlertId y lo devuelve', async () => {
        prisma.service.create.mockResolvedValue(
          serviceRow({ origin: ServiceOrigin.WEATHER_ALERT, weatherAlertId: 'ALERTA-1' }),
        );

        const res = await service.create({
          ...baseDto,
          origin: ServiceOrigin.WEATHER_ALERT,
          weatherAlertId: 'ALERTA-1',
        });

        expect(prisma.service.create.mock.calls[0][0].data.weatherAlertId).toBe('ALERTA-1');
        expect(res.weatherAlertId).toBe('ALERTA-1');
        expect(res.inspectionId).toBeNull();
      });

      it('fija el vínculo en la inspección, en la misma transacción, y lo devuelve', async () => {
        pointType();

        const res = await service.create(inspeccionDto);

        expect(prisma.environmentalInspection.updateMany).toHaveBeenCalledWith({
          where: { id: INSPECTION_ID, serviceId: null },
          data: { serviceId: SERVICE_ID },
        });
        expect(prisma.service.create.mock.calls[0][0].data).not.toHaveProperty('inspectionId');
        expect(res.inspectionId).toBe(INSPECTION_ID);
      });

      it('404 si la inspección no existe', async () => {
        pointType();
        prisma.environmentalInspection.findUnique.mockResolvedValue(null);

        await expect(service.create(inspeccionDto)).rejects.toThrow(NotFoundException);
        expect(prisma.service.create).not.toHaveBeenCalled();
      });

      it('409 si la inspección ya tiene servicio', async () => {
        pointType();
        prisma.environmentalInspection.findUnique.mockResolvedValue({ serviceId: 'otro' });

        await expect(service.create(inspeccionDto)).rejects.toThrow(ConflictException);
        expect(prisma.service.create).not.toHaveBeenCalled();
      });

      it('409 si otra alta tomó la inspección entre el chequeo y la transacción', async () => {
        pointType();
        prisma.environmentalInspection.updateMany.mockResolvedValue({ count: 0 });

        await expect(service.create(inspeccionDto)).rejects.toThrow(ConflictException);
        expect(outbox.enqueue).not.toHaveBeenCalled();
      });

      it('400 si el tipo de servicio es ROUTE', async () => {
        await expect(
          service.create({
            ...baseDto,
            origin: ServiceOrigin.INSPECTION,
            inspectionId: INSPECTION_ID,
          }),
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
        service.create({ ...baseDto, windowFrom: '14:00', windowTo: '08:00' }),
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

      await expect(service.create(baseDto)).rejects.toThrow(BadRequestException);
    });

    it('rechaza una cuadrilla dada de baja', async () => {
      prisma.crew.findUnique.mockResolvedValue({ id: CREW_ID, active: false, name: 'Norte' });

      await expect(service.create({ ...baseDto, crewId: CREW_ID })).rejects.toThrow(
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
      await service.create(dtoConRecursos);

      expect(prisma.service.findMany).toHaveBeenCalledTimes(1);
      expect(prisma.service.create).toHaveBeenCalled();
    });

    it('rechaza con 409 si la cuadrilla se solapa, sin crear ni encolar', async () => {
      prisma.service.findMany.mockResolvedValue([otro()]);

      await expect(service.create(dtoConRecursos)).rejects.toThrow(ConflictException);
      await expect(service.create(dtoConRecursos)).rejects.toThrow(/se solapa con 1 servicio/);
      expect(prisma.service.create).not.toHaveBeenCalled();
      expect(outbox.enqueue).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si el vehículo se solapa', async () => {
      prisma.service.findMany.mockResolvedValue([otro({ crewId: null, vehicleId: VEHICLE_ID })]);

      await expect(service.create({ ...dtoConRecursos, crewId: undefined })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.service.create).not.toHaveBeenCalled();
    });

    it('no cuenta una franja que no se pisa', async () => {
      prisma.service.findMany.mockResolvedValue([
        otro({ windowFrom: at('12:00'), windowTo: at('14:00') }),
      ]);

      await service.create(dtoConRecursos);

      expect(prisma.service.create).toHaveBeenCalled();
    });

    it('solo consulta servicios que ocupan recursos (no cancelados ni completados)', async () => {
      await service.create(dtoConRecursos);

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

      await service.create(dtoConRecursos);

      expect(prisma.service.create).toHaveBeenCalled();
    });

    it('un dto sin franja se asume todo el día y choca con un servicio con franja', async () => {
      prisma.service.findMany.mockResolvedValue([otro()]);

      await expect(
        service.create({ ...dtoConRecursos, windowFrom: undefined, windowTo: undefined }),
      ).rejects.toThrow(ConflictException);
    });

    it.each([
      ['windowFrom', { windowFrom: null }],
      ['windowTo', { windowTo: null }],
    ])('un servicio existente sin %s se asume todo el día', async (_n, over) => {
      prisma.service.findMany.mockResolvedValue([otro(over)]);

      await expect(service.create(dtoConRecursos)).rejects.toThrow(ConflictException);
    });

    it('filtra por la fecha del dto y al crear no excluye ningún id', async () => {
      await service.create(dtoConRecursos);

      const { where } = prisma.service.findMany.mock.calls[0][0];
      expect(where.scheduledDate).toEqual(new Date('2026-09-30T00:00:00.000Z'));
      expect(where.id).toBeUndefined();
    });

    it('assignCrew sí excluye el propio servicio', async () => {
      await service.assignCrew(SERVICE_ID, { crewId: CREW_ID });

      const { where } = prisma.service.findMany.mock.calls[0][0];
      expect(where.id).toEqual({ not: SERVICE_ID });
    });

    it('con overrideNote crea igual y guarda la nota', async () => {
      prisma.service.findMany.mockResolvedValue([otro()]);

      await service.create(
        { ...dtoConRecursos, overrideNote: 'Lo coordiné con el jefe de cuadrilla' },
        'user-1',
      );

      const { data } = prisma.service.create.mock.calls[0][0];
      expect(data.assignmentOverrideNote).toBe('Lo coordiné con el jefe de cuadrilla');
      expect(data.assignmentOverrideBy).toBe('user-1');
      expect(data.assignmentOverrideAt).toBeInstanceOf(Date);
    });

    it('overrideNote sin solapamiento no deja rastro', async () => {
      await service.create({ ...dtoConRecursos, overrideNote: 'por las dudas, nota' });

      const { data } = prisma.service.create.mock.calls[0][0];
      expect(data.assignmentOverrideNote).toBeUndefined();
    });

    it('sin crewId ni vehicleId no consulta conflictos', async () => {
      await service.create(baseDto);

      expect(prisma.service.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── Máquina de estados ──────────────────────────

  describe('máquina de estados', () => {
    it('no deja iniciar sin cuadrilla asignada', async () => {
      await expect(service.start(SERVICE_ID)).rejects.toThrow(ConflictException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('no deja iniciar sin vehiculo si el tipo lo exige', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ crewId: CREW_ID }));
      prisma.serviceType.findUnique.mockResolvedValue({
        code: 'REC-DOM',
        requiresVehicle: true,
      });

      await expect(service.start(SERVICE_ID)).rejects.toThrow(ConflictException);
    });

    it('inicia cuando hay cuadrilla y el tipo no exige vehiculo', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ crewId: CREW_ID }));

      await service.start(SERVICE_ID);

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ServiceStatus.IN_PROGRESS }),
        }),
      );
    });

    it('rechaza una transicion invalida nombrando las validas', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ status: ServiceStatus.COMPLETED }));

      await expect(service.cancel(SERVICE_ID, 'x')).rejects.toThrow(/es un estado final/);
    });

    it('suspender guarda el motivo', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.IN_PROGRESS }),
      );

      await service.suspend(SERVICE_ID, 'Rotura del camión');

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ServiceStatus.SUSPENDED,
            statusReason: 'Rotura del camión',
          }),
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

      await expect(service.resume(SERVICE_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('reanudar escribe condicionado al estado leído', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ status: ServiceStatus.SUSPENDED }));

      await service.resume(SERVICE_ID);

      expect(prisma.service.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SERVICE_ID, status: ServiceStatus.SUSPENDED } }),
      );
    });

    it('si el estado cambió entre la lectura y la escritura da 409', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ status: ServiceStatus.SUSPENDED }));
      prisma.service.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5.22.0' }),
      );

      await expect(service.resume(SERVICE_ID)).rejects.toBeInstanceOf(ConflictException);
    });

    it('reanudar limpia el motivo de la suspension', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.SUSPENDED, statusReason: 'Rotura' }),
      );

      await service.resume(SERVICE_ID);

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

      await service.confirmReschedule(SERVICE_ID, { scheduledDate: '2099-09-22' });

      const { data } = prisma.service.update.mock.calls[0][0];
      expect(data.status).toBe(ServiceStatus.SCHEDULED);
      expect(data.scheduledDate.toISOString().slice(0, 10)).toBe('2099-09-22');
    });

    it('confirmar con una fecha pasada da 400 y no transiciona', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.RESCHEDULED }),
      );

      await expect(
        service.confirmReschedule(SERVICE_ID, { scheduledDate: '2020-01-01' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('confirmar con la fecha de hoy (Argentina) es válido', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.RESCHEDULED }),
      );
      const hoy = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);

      await service.confirmReschedule(SERVICE_ID, { scheduledDate: hoy });

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

      await service.cancel(SERVICE_ID, 'M7 rechazó el corte: hay obra por dos meses');

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

        await expect(service.cancel(SERVICE_ID, 'motivo')).resolves.toBeDefined();
      },
    );

    it.each([
      ServiceStatus.IN_PROGRESS,
      ServiceStatus.COMPLETED,
      ServiceStatus.PARTIALLY_COMPLETED,
      ServiceStatus.CANCELLED,
    ])('no se puede cancelar desde %s', async (desde) => {
      prisma.service.findUnique.mockResolvedValue(serviceRow({ status: desde }));

      await expect(service.cancel(SERVICE_ID, 'motivo')).rejects.toBeInstanceOf(ConflictException);
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

      await service.complete(SERVICE_ID);

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

      await service.complete(SERVICE_ID);

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

      await expect(service.complete(SERVICE_ID)).rejects.toThrow(ConflictException);
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

          await service.complete(SERVICE_ID);

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

        await service.complete(SERVICE_ID, { containerLocation: { address: 'Av. Nueva 100' } });

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

        await expect(service.complete(SERVICE_ID)).rejects.toThrow(ConflictException);
        expect(outbox.enqueueMany).not.toHaveBeenCalled();
      });

      it('el service.update del cierre lleva el estado leído en el where', async () => {
        prisma.service.findUnique.mockResolvedValue(closable());
        prisma.container.findUnique.mockResolvedValue(containerIn(ContainerStatus.OVERFLOWED));

        await service.complete(SERVICE_ID);

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

        await expect(service.complete(SERVICE_ID)).rejects.toThrow(ConflictException);
        expect(prisma.container.update).not.toHaveBeenCalled();
        expect(outbox.enqueueMany).not.toHaveBeenCalled();
      });

      it('no traduce a 409 los errores que no son P2025', async () => {
        prisma.service.findUnique.mockResolvedValue(closable());
        prisma.container.findUnique.mockResolvedValue(containerIn(ContainerStatus.OVERFLOWED));
        prisma.container.update.mockRejectedValue(new Error('db caída'));

        await expect(service.complete(SERVICE_ID)).rejects.toThrow('db caída');
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
        service.addZoneResult(SERVICE_ID, {
          zoneId: ZONE_A,
          status: ZoneResultStatus.NOT_SERVICED,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza motivo cuando la zona quedo SERVICED', async () => {
      await expect(
        service.addZoneResult(SERVICE_ID, {
          zoneId: ZONE_A,
          status: ZoneResultStatus.SERVICED,
          reason: 'WEATHER' as never,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza una zona que no pertenece al servicio', async () => {
      await expect(
        service.addZoneResult(SERVICE_ID, {
          zoneId: '99999999-9999-9999-9999-999999999999',
          status: ZoneResultStatus.SERVICED,
        }),
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
        service.addZoneResult(SERVICE_ID, {
          zoneId: ZONE_A,
          status: ZoneResultStatus.SERVICED,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('no admite resultados si el servicio no esta en IN_PROGRESS', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow());

      await expect(
        service.addZoneResult(SERVICE_ID, {
          zoneId: ZONE_A,
          status: ZoneResultStatus.SERVICED,
        }),
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
        service.addCollectionRecord(SERVICE_ID, {
          wasteType: WasteType.HOUSEHOLD,
          disposalSiteId: SITE_ID,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('devuelve 404 si el sitio de disposicion no existe', async () => {
      prisma.disposalSite.findUnique.mockResolvedValue(null);

      await expect(
        service.addCollectionRecord(SERVICE_ID, {
          wasteType: WasteType.HOUSEHOLD,
          disposalSiteId: SITE_ID,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rechaza un zoneResultId de otro servicio', async () => {
      await expect(
        service.addCollectionRecord(SERVICE_ID, {
          wasteType: WasteType.HOUSEHOLD,
          disposalSiteId: SITE_ID,
          zoneResultId: '99999999-9999-9999-9999-999999999999',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('no admite registros sobre un servicio que no arranco', async () => {
      prisma.service.findUnique.mockResolvedValue(serviceRow());

      await expect(
        service.addCollectionRecord(SERVICE_ID, {
          wasteType: WasteType.HOUSEHOLD,
          disposalSiteId: SITE_ID,
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── Edición ─────────────────────────────────────

  it('no deja editar un servicio ya iniciado', async () => {
    prisma.service.findUnique.mockResolvedValue(serviceRow({ status: ServiceStatus.IN_PROGRESS }));

    await expect(service.update(SERVICE_ID, { notes: 'x' })).rejects.toThrow(ConflictException);
  });
});
