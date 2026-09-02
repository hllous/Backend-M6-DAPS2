import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
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

describe('ServicesService', () => {
  let prisma: any;
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
      $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
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
    service = new ServicesService(prisma as unknown as PrismaService);
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

      await service.confirmReschedule(SERVICE_ID, { scheduledDate: '2026-09-22' });

      const { data } = prisma.service.update.mock.calls[0][0];
      expect(data.status).toBe(ServiceStatus.SCHEDULED);
      expect(data.scheduledDate.toISOString().slice(0, 10)).toBe('2026-09-22');
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
