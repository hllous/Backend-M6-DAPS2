import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ServiceMode, ServiceOrigin, ServiceStatus, WasteType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from './services.service';
import { ServiceTargetType } from './dto';

/**
 * #152: los tramos de `ServicesService` que no tocaba ningún spec — listado,
 * actualización, registro de recolección y los helpers que resuelven la zona y
 * validan los recursos. El resto del servicio ya está cubierto por
 * `services.service.spec.ts` (programación y estados),
 * `services-delay-assignment.spec.ts` (demora y solapamiento) y
 * `services-container-close.spec.ts` (cierre).
 */
const SERVICE_ID = '11111111-1111-1111-1111-111111111111';
const TYPE_ID = '22222222-2222-2222-2222-222222222222';
const ROUTE_ID = '33333333-3333-3333-3333-333333333333';
const CREW_ID = '44444444-4444-4444-4444-444444444444';
const VEHICLE_ID = '55555555-5555-5555-5555-555555555555';
const SITE_ID = '66666666-6666-6666-6666-666666666666';
const ZONE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const TARGET_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('ServicesService — consultas, edición, recolección e inventario', () => {
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
    notes: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    zones: [{ zoneId: ZONE_A, sequence: 1 }],
    zoneResults: [],
    collectionRecords: [],
    ...over,
  });

  /** El DTO de paginación expone skip/take como getters; acá alcanza con fijarlos. */
  const query = (over: Record<string, unknown> = {}) =>
    ({ page: 1, pageSize: 20, skip: 0, take: 20, ...over }) as any;

  beforeEach(() => {
    prisma = {
      serviceType: {
        findUnique: jest.fn().mockResolvedValue({
          id: TYPE_ID,
          code: 'CONT-VAC',
          mode: ServiceMode.POINT,
          requiresVehicle: false,
          active: true,
        }),
      },
      route: { findUnique: jest.fn() },
      zone: { findUnique: jest.fn().mockResolvedValue({ id: ZONE_A }) },
      container: { findUnique: jest.fn().mockResolvedValue({ zoneId: ZONE_A }) },
      tree: { findUnique: jest.fn().mockResolvedValue({ zoneId: ZONE_A }) },
      greenSpace: { findUnique: jest.fn().mockResolvedValue({ zoneId: ZONE_A }) },
      greenPoint: { findUnique: jest.fn().mockResolvedValue({ zoneId: ZONE_A }) },
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
        findMany: jest.fn().mockResolvedValue([serviceRow()]),
        count: jest.fn().mockResolvedValue(1),
      },
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
      $transaction: jest.fn((arg: unknown) =>
        typeof arg === 'function'
          ? (arg as (tx: unknown) => unknown)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      ),
    };
    outbox = { enqueue: jest.fn(), enqueueMany: jest.fn() };
    service = new ServicesService(prisma as unknown as PrismaService, outbox);
  });

  // ─── Listado ──────────────────────────────────────

  describe('findAll', () => {
    it('scheduledFrom posterior a scheduledTo da 400', async () => {
      await expect(
        service.findAll(query({ scheduledFrom: '2026-12-01', scheduledTo: '2026-01-01' })),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.service.findMany).not.toHaveBeenCalled();
    });

    it('sin filtros no arma ningún where', async () => {
      await service.findAll(query());

      expect(prisma.service.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('traduce cada filtro simple a su campo', async () => {
      await service.findAll(
        query({
          status: ServiceStatus.SCHEDULED,
          serviceTypeId: TYPE_ID,
          mode: ServiceMode.ROUTE,
          origin: ServiceOrigin.TICKET,
          crewId: CREW_ID,
          vehicleId: VEHICLE_ID,
          ticketId: 'TCK-1',
        }),
      );

      expect(prisma.service.findMany.mock.calls[0][0].where).toEqual({
        status: ServiceStatus.SCHEDULED,
        serviceTypeId: TYPE_ID,
        mode: ServiceMode.ROUTE,
        origin: ServiceOrigin.TICKET,
        crewId: CREW_ID,
        vehicleId: VEHICLE_ID,
        ticketId: 'TCK-1',
      });
    });

    /** La zona no es un campo del servicio: viaja en la tabla de zonas del snapshot. */
    it('filtra por zona a través de las zonas del servicio', async () => {
      await service.findAll(query({ zoneId: ZONE_A }));

      expect(prisma.service.findMany.mock.calls[0][0].where.zones).toEqual({
        some: { zoneId: ZONE_A },
      });
    });

    it.each([
      ['solo desde', { scheduledFrom: '2026-09-01' }, { gte: true, lte: false }],
      ['solo hasta', { scheduledTo: '2026-09-30' }, { gte: false, lte: true }],
      [
        'rango completo',
        { scheduledFrom: '2026-09-01', scheduledTo: '2026-09-30' },
        { gte: true, lte: true },
      ],
    ])('acota por fecha: %s', async (_caso, filtro, esperado) => {
      await service.findAll(query(filtro));

      const { scheduledDate } = prisma.service.findMany.mock.calls[0][0].where;
      expect('gte' in scheduledDate).toBe(esperado.gte);
      expect('lte' in scheduledDate).toBe(esperado.lte);
    });

    it('devuelve el total y la página pedida', async () => {
      const result = await service.findAll(query());

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('findOne devuelve el servicio mapeado', async () => {
      expect(await service.findOne(SERVICE_ID)).toMatchObject({ id: SERVICE_ID });
    });

    it('findOne de un id inexistente da 404', async () => {
      prisma.service.findUnique.mockResolvedValue(null);

      await expect(service.findOne(SERVICE_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── Edición ──────────────────────────────────────

  describe('update', () => {
    it('solo manda los campos presentes en el DTO', async () => {
      await service.update(SERVICE_ID, { notes: 'Entrar por Rivadavia' });

      expect(prisma.service.update.mock.calls[0][0].data).toEqual({
        notes: 'Entrar por Rivadavia',
      });
    });

    it('valida el vehículo antes de asignarlo', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(null);

      await expect(service.update(SERVICE_ID, { vehicleId: VEHICLE_ID })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('rechaza un vehículo dado de baja', async () => {
      prisma.vehicle.findUnique.mockResolvedValue({
        id: VEHICLE_ID,
        active: false,
        plate: 'AA123BB',
      });

      await expect(service.update(SERVICE_ID, { vehicleId: VEHICLE_ID })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    /** La ventana nueva se compara contra la que ya tiene, no contra nada. */
    it('rechaza una ventana invertida contra la hora ya guardada', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ windowFrom: new Date('1970-01-01T14:00:00.000Z') }),
      );

      await expect(service.update(SERVICE_ID, { windowTo: '08:00' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('un servicio ya iniciado no se edita', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({ status: ServiceStatus.IN_PROGRESS }),
      );

      await expect(service.update(SERVICE_ID, { notes: 'tarde' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    describe('solapamiento', () => {
      const t = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
      const OTHER = '99999999-9999-9999-9999-999999999999';
      const NOTA = 'Lo coordiné con el jefe de cuadrilla por radio';
      /** Servicio propio con cuadrilla y franja 13-15; el otro ocupa 08-10. */
      const propio = (over: Record<string, unknown> = {}) =>
        serviceRow({ crewId: CREW_ID, windowFrom: t('13:00'), windowTo: t('15:00'), ...over });
      const otro = (from: string, to: string, over: Record<string, unknown> = {}) => ({
        id: OTHER,
        status: ServiceStatus.SCHEDULED,
        scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
        crewId: CREW_ID,
        vehicleId: null,
        windowFrom: t(from),
        windowTo: t(to),
        serviceType: { name: 'Barrido' },
        crew: { name: 'Norte' },
        vehicle: null,
        ...over,
      });

      beforeEach(() => {
        prisma.service.findUnique.mockResolvedValue(propio());
        prisma.service.findMany.mockResolvedValue([otro('08:00', '10:00')]);
      });

      it('ventana que pisa a otro servicio de la cuadrilla da 409 y no escribe', async () => {
        await expect(
          service.update(SERVICE_ID, { windowFrom: '09:00', windowTo: '11:00' }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.service.update).not.toHaveBeenCalled();
      });

      it('parcial: solo windowTo usa windowFrom y cuadrilla vigentes', async () => {
        prisma.service.findUnique.mockResolvedValue(propio({ windowFrom: t('08:30') }));

        await expect(service.update(SERVICE_ID, { windowTo: '11:00' })).rejects.toBeInstanceOf(
          ConflictException,
        );
        const { where } = prisma.service.findMany.mock.calls[0][0];
        expect(where.id).toEqual({ not: SERVICE_ID });
        expect(where.OR).toEqual([{ crewId: CREW_ID }]);
      });

      it('solo el vehículo a uno ocupado da 409', async () => {
        prisma.service.findMany.mockResolvedValue([
          otro('13:00', '15:00', {
            crewId: null,
            vehicleId: VEHICLE_ID,
            vehicle: { plate: 'AA1' },
          }),
        ]);

        await expect(service.update(SERVICE_ID, { vehicleId: VEHICLE_ID })).rejects.toBeInstanceOf(
          ConflictException,
        );
        expect(prisma.service.findMany.mock.calls[0][0].where.OR).toEqual([
          { vehicleId: VEHICLE_ID },
        ]);
      });

      it('franja contigua no es solapamiento', async () => {
        await service.update(SERVICE_ID, { windowFrom: '10:00', windowTo: '12:00' });

        expect(prisma.service.update).toHaveBeenCalledTimes(1);
        expect(prisma.service.update.mock.calls[0][0].data.assignmentOverrideNote).toBeUndefined();
      });

      it('con overrideNote acepta y guarda nota, autor y fecha', async () => {
        await service.update(
          SERVICE_ID,
          { windowFrom: '09:00', windowTo: '11:00', overrideNote: NOTA },
          'user-1',
        );

        const { data } = prisma.service.update.mock.calls[0][0];
        expect(data.assignmentOverrideNote).toBe(NOTA);
        expect(data.assignmentOverrideBy).toBe('user-1');
        expect(data.assignmentOverrideAt).toBeInstanceOf(Date);
      });

      it('sin solapamiento la overrideNote no se guarda', async () => {
        await service.update(SERVICE_ID, { windowFrom: '10:00', overrideNote: NOTA });

        expect(prisma.service.update.mock.calls[0][0].data.assignmentOverrideNote).toBeUndefined();
      });

      it('vehicleId null quita el vehículo sin chequearlo', async () => {
        prisma.service.findUnique.mockResolvedValue(propio({ vehicleId: VEHICLE_ID }));
        prisma.service.findMany.mockResolvedValue([
          otro('13:00', '15:00', { crewId: null, vehicleId: VEHICLE_ID }),
        ]);

        await service.update(SERVICE_ID, { vehicleId: null } as never);

        expect(prisma.service.findMany.mock.calls[0]?.[0].where.OR ?? []).not.toContainEqual({
          vehicleId: VEHICLE_ID,
        });
        expect(prisma.service.update).toHaveBeenCalledTimes(1);
      });

      it('sin vehicleId en el body usa el vehículo vigente', async () => {
        prisma.service.findUnique.mockResolvedValue(propio({ vehicleId: VEHICLE_ID }));

        await expect(
          service.update(SERVICE_ID, { windowFrom: '09:00', windowTo: '11:00' }),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prisma.service.findMany.mock.calls[0][0].where.OR).toEqual([
          { crewId: CREW_ID },
          { vehicleId: VEHICLE_ID },
        ]);
      });

      it('sin franja vigente cuenta como todo el día al cambiar solo el vehículo', async () => {
        prisma.service.findUnique.mockResolvedValue(
          serviceRow({ windowFrom: null, windowTo: null }),
        );
        prisma.service.findMany.mockResolvedValue([
          otro('08:00', '10:00', { crewId: null, vehicleId: VEHICLE_ID }),
        ]);

        await expect(service.update(SERVICE_ID, { vehicleId: VEHICLE_ID })).rejects.toBeInstanceOf(
          ConflictException,
        );
      });

      it('un PATCH de solo notas no consulta conflictos', async () => {
        await service.update(SERVICE_ID, { notes: 'x' });

        expect(prisma.service.findMany).not.toHaveBeenCalled();
      });
    });
  });

  // ─── Registro de recolección ──────────────────────

  describe('addCollectionRecord', () => {
    const enCurso = () => serviceRow({ status: ServiceStatus.IN_PROGRESS });
    const dto = { wasteType: WasteType.HOUSEHOLD, disposalSiteId: SITE_ID };

    it('registra la recolección de un servicio iniciado', async () => {
      prisma.service.findUnique.mockResolvedValue(enCurso());

      await service.addCollectionRecord(SERVICE_ID, dto);

      expect(prisma.collectionRecord.create.mock.calls[0][0].data).toMatchObject({
        serviceId: SERVICE_ID,
        disposalSiteId: SITE_ID,
        wasteType: WasteType.HOUSEHOLD,
      });
    });

    it('no se registra sobre un servicio que todavía no arrancó', async () => {
      await expect(service.addCollectionRecord(SERVICE_ID, dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('el sitio de disposición tiene que existir', async () => {
      prisma.service.findUnique.mockResolvedValue(enCurso());
      prisma.disposalSite.findUnique.mockResolvedValue(null);

      await expect(service.addCollectionRecord(SERVICE_ID, dto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un sitio dado de baja no puede recibir residuos', async () => {
      prisma.service.findUnique.mockResolvedValue(enCurso());
      prisma.disposalSite.findUnique.mockResolvedValue({
        id: SITE_ID,
        code: 'DS-1',
        active: false,
      });

      await expect(service.addCollectionRecord(SERVICE_ID, dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    /** Sin esto, una recolección podría colgarse del resultado de otro servicio. */
    it('el resultado de zona tiene que ser de este servicio', async () => {
      prisma.service.findUnique.mockResolvedValue(enCurso());

      await expect(
        service.addCollectionRecord(SERVICE_ID, { ...dto, zoneResultId: 'de-otro' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('acepta el resultado de zona propio', async () => {
      prisma.service.findUnique.mockResolvedValue(
        serviceRow({
          status: ServiceStatus.IN_PROGRESS,
          zoneResults: [{ id: 'zr1', zoneId: ZONE_A }],
        }),
      );

      await service.addCollectionRecord(SERVICE_ID, { ...dto, zoneResultId: 'zr1' });

      expect(prisma.collectionRecord.create.mock.calls[0][0].data.zoneResultId).toBe('zr1');
    });
  });

  // ─── Lecturas de las relaciones ───────────────────

  it('findZoneResults devuelve los resultados del servicio', async () => {
    prisma.service.findUnique.mockResolvedValue(
      serviceRow({ zoneResults: [{ id: 'zr1', zoneId: ZONE_A }] }),
    );

    expect(await service.findZoneResults(SERVICE_ID)).toHaveLength(1);
  });

  it('findCollectionRecords devuelve los registros del servicio', async () => {
    prisma.service.findUnique.mockResolvedValue(
      serviceRow({
        collectionRecords: [
          {
            id: 'cr1',
            wasteType: WasteType.HOUSEHOLD,
            disposalSiteId: SITE_ID,
            zoneResultId: null,
            volumeM3: null,
            weightKg: null,
          },
        ],
      }),
    );

    expect(await service.findCollectionRecords(SERVICE_ID)).toHaveLength(1);
  });

  // ─── Zona de un servicio POINT ────────────────────

  describe('la zona de un POINT', () => {
    const point = {
      serviceTypeId: TYPE_ID,
      scheduledDate: '2026-09-15',
      origin: ServiceOrigin.PLANNED,
    };

    it('targetType sin targetId se rechaza', async () => {
      await expect(
        service.create({ ...point, targetType: ServiceTargetType.CONTAINER }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('targetId sin targetType se rechaza', async () => {
      await expect(service.create({ ...point, targetId: TARGET_ID })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('sin objetivo, la zona suelta tiene que existir', async () => {
      prisma.zone.findUnique.mockResolvedValue(null);

      await expect(service.create({ ...point, zoneId: ZONE_A })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('sin objetivo, se ubica por la zona suelta', async () => {
      await service.create({ ...point, zoneId: ZONE_A });

      expect(prisma.service.create.mock.calls[0][0].data.zones.createMany.data).toEqual([
        { zoneId: ZONE_A, sequence: 1 },
      ]);
    });

    it.each([
      [ServiceTargetType.CONTAINER, 'container'],
      [ServiceTargetType.TREE, 'tree'],
      [ServiceTargetType.GREEN_SPACE, 'greenSpace'],
      [ServiceTargetType.GREEN_POINT, 'greenPoint'],
    ])('con objetivo %s, la zona sale del bien', async (targetType, modelo) => {
      await service.create({ ...point, targetType, targetId: TARGET_ID });

      expect(prisma[modelo].findUnique).toHaveBeenCalledWith({
        where: { id: TARGET_ID },
        select: { zoneId: true },
      });
    });

    it('un objetivo inexistente da 404', async () => {
      prisma.tree.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...point, targetType: ServiceTargetType.TREE, targetId: TARGET_ID }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── Recursos ─────────────────────────────────────

  describe('validación de recursos al programar', () => {
    const point = {
      serviceTypeId: TYPE_ID,
      scheduledDate: '2026-09-15',
      origin: ServiceOrigin.PLANNED,
      zoneId: ZONE_A,
    };

    it('una cuadrilla inexistente da 404', async () => {
      prisma.crew.findUnique.mockResolvedValue(null);

      await expect(service.create({ ...point, crewId: CREW_ID })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un vehículo inexistente da 404', async () => {
      prisma.vehicle.findUnique.mockResolvedValue(null);

      await expect(service.create({ ...point, vehicleId: VEHICLE_ID })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un vehículo dado de baja se rechaza', async () => {
      prisma.vehicle.findUnique.mockResolvedValue({
        id: VEHICLE_ID,
        active: false,
        plate: 'AA123BB',
      });

      await expect(service.create({ ...point, vehicleId: VEHICLE_ID })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
