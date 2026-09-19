import { BadRequestException, ConflictException } from '@nestjs/common';
import { DelayType, ServiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../../events/outbox/outbox.service';
import { ServicesService } from './services.service';
import { ConflictResource } from './dto';

const SERVICE_ID = '11111111-1111-1111-1111-111111111111';
const OTRO_ID = '22222222-2222-2222-2222-222222222222';
const CREW = '33333333-3333-3333-3333-333333333333';
const VEHICLE = '44444444-4444-4444-4444-444444444444';
const ACTOR = 'planificador-7';

/** `@db.Time` vive sobre la época; `HH:mm` se convierte así. */
const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

describe('ServicesService — demora y doble reserva', () => {
  let prisma: any;
  let outbox: any;
  let service: ServicesService;

  const servicio = (over: Record<string, unknown> = {}) => ({
    id: SERVICE_ID,
    serviceTypeId: 'st-1',
    mode: 'ROUTE',
    status: ServiceStatus.SCHEDULED,
    scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
    windowFrom: hora('06:00'),
    windowTo: hora('11:00'),
    crewId: null,
    vehicleId: null,
    ticketId: null,
    statusReason: null,
    zones: [],
    zoneResults: [],
    collectionRecords: [],
    ...over,
  });

  /** Otro servicio del mismo día que ya tiene tomada la cuadrilla. */
  const ocupado = (over: Record<string, unknown> = {}) => ({
    id: OTRO_ID,
    status: ServiceStatus.SCHEDULED,
    scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
    windowFrom: hora('09:00'),
    windowTo: hora('13:00'),
    crewId: CREW,
    vehicleId: null,
    serviceType: { name: 'Recolección domiciliaria' },
    crew: { name: 'Cuadrilla Centro 1' },
    vehicle: null,
    ...over,
  });

  beforeEach(() => {
    prisma = {
      service: {
        findUnique: jest.fn().mockResolvedValue(servicio()),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(({ data }: any) => Promise.resolve(servicio(data))),
      },
      crew: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: CREW, active: true, name: 'Cuadrilla Centro 1' }),
      },
      vehicle: {
        findUnique: jest.fn().mockResolvedValue({ id: VEHICLE, active: true, plate: 'AB123CD' }),
      },
      serviceDelayNotice: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(({ data }: any) =>
          Promise.resolve({
            id: 'aviso-1',
            supersededById: null,
            createdAt: new Date('2026-09-15T11:10:00.000Z'),
            ...data,
          }),
        ),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    outbox = { enqueue: jest.fn(), enqueueMany: jest.fn() };
    service = new ServicesService(
      prisma as unknown as PrismaService,
      outbox as unknown as OutboxService,
    );
  });

  // ─── #123: doble reserva ────────────────────────────

  describe('solapamiento al asignar', () => {
    it('sin otro servicio ese día no hay conflicto y se asigna', async () => {
      await service.assignCrew(SERVICE_ID, { crewId: CREW });

      expect(prisma.service.update.mock.calls[0][0].data.crewId).toBe(CREW);
    });

    /**
     * Es el punto del issue: avisar, no bloquear. Sin la nota rebota, pero el
     * mensaje dice que se puede asignar igual.
     */
    it('con solapamiento y sin nota rebota, y el mensaje dice cómo seguir', async () => {
      prisma.service.findMany.mockResolvedValue([ocupado()]);

      await expect(service.assignCrew(SERVICE_ID, { crewId: CREW })).rejects.toBeInstanceOf(
        ConflictException,
      );
      await service.assignCrew(SERVICE_ID, { crewId: CREW }).catch((e: Error) => {
        expect(e.message).toContain('overrideNote');
        expect(e.message).toContain('Cuadrilla Centro 1');
      });
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('con solapamiento y nota se asigna, y la nota queda con quién y cuándo', async () => {
      prisma.service.findMany.mockResolvedValue([ocupado()]);

      await service.assignCrew(
        SERVICE_ID,
        { crewId: CREW, overrideNote: 'Lo coordiné con el jefe de cuadrilla por radio' },
        ACTOR,
      );

      const { data } = prisma.service.update.mock.calls[0][0];
      expect(data.assignmentOverrideNote).toContain('jefe de cuadrilla');
      expect(data.assignmentOverrideBy).toBe(ACTOR);
      expect(data.assignmentOverrideAt).toBeInstanceOf(Date);
    });

    /**
     * Guardar la nota sin solapamiento dejaría rastro de un override que nunca
     * ocurrió, y el historial diría que alguien forzó algo que estaba libre.
     */
    it('una nota sin solapamiento no se guarda', async () => {
      await service.assignCrew(SERVICE_ID, { crewId: CREW, overrideNote: 'por las dudas' }, ACTOR);

      const { data } = prisma.service.update.mock.calls[0][0];
      expect(data.assignmentOverrideNote).toBeUndefined();
    });

    it('los servicios cerrados o cancelados no ocupan a nadie', async () => {
      await service.getAssignmentConflicts(SERVICE_ID, { crewId: CREW });

      const [[args]] = prisma.service.findMany.mock.calls;
      expect(args.where.status.in).toEqual([
        ServiceStatus.SCHEDULED,
        ServiceStatus.RESCHEDULED,
        ServiceStatus.IN_PROGRESS,
        ServiceStatus.SUSPENDED,
      ]);
    });

    it('el propio servicio no se cuenta como conflicto consigo mismo', async () => {
      await service.getAssignmentConflicts(SERVICE_ID, { crewId: CREW });

      expect(prisma.service.findMany.mock.calls[0][0].where.id).toEqual({ not: SERVICE_ID });
    });

    describe('la regla de solapamiento', () => {
      it('franjas que se pisan son conflicto', async () => {
        prisma.service.findMany.mockResolvedValue([
          ocupado({ windowFrom: hora('09:00'), windowTo: hora('13:00') }),
        ]);

        const r = await service.getAssignmentConflicts(SERVICE_ID, { crewId: CREW });

        expect(r.hasConflicts).toBe(true);
        expect(r.conflicts[0]).toMatchObject({
          resource: ConflictResource.CREW,
          resourceName: 'Cuadrilla Centro 1',
          serviceId: OTRO_ID,
          windowFrom: '09:00',
        });
      });

      /** 06:00-11:00 y 11:00-14:00 se tocan pero no se pisan. */
      it('franjas contiguas no son conflicto', async () => {
        prisma.service.findMany.mockResolvedValue([
          ocupado({ windowFrom: hora('11:00'), windowTo: hora('14:00') }),
        ]);

        const r = await service.getAssignmentConflicts(SERVICE_ID, { crewId: CREW });

        expect(r.hasConflicts).toBe(false);
      });

      it('franjas separadas no son conflicto', async () => {
        prisma.service.findMany.mockResolvedValue([
          ocupado({ windowFrom: hora('14:00'), windowTo: hora('18:00') }),
        ]);

        expect(
          (await service.getAssignmentConflicts(SERVICE_ID, { crewId: CREW })).hasConflicts,
        ).toBe(false);
      });

      /**
       * Suponer lo contrario haría desaparecer el aviso justo en el caso donde
       * menos información hay.
       */
      it('sin franja se asume todo el día, así que hay conflicto', async () => {
        prisma.service.findUnique.mockResolvedValue(servicio({ windowFrom: null, windowTo: null }));
        prisma.service.findMany.mockResolvedValue([
          ocupado({ windowFrom: hora('14:00'), windowTo: hora('18:00') }),
        ]);

        expect(
          (await service.getAssignmentConflicts(SERVICE_ID, { crewId: CREW })).hasConflicts,
        ).toBe(true);
      });

      it('si el otro no tiene franja, también', async () => {
        prisma.service.findMany.mockResolvedValue([ocupado({ windowFrom: null, windowTo: null })]);

        expect(
          (await service.getAssignmentConflicts(SERVICE_ID, { crewId: CREW })).hasConflicts,
        ).toBe(true);
      });
    });

    it('detecta el vehículo igual que la cuadrilla', async () => {
      prisma.service.findMany.mockResolvedValue([
        ocupado({ crewId: null, vehicleId: VEHICLE, crew: null, vehicle: { plate: 'AB123CD' } }),
      ]);

      const r = await service.getAssignmentConflicts(SERVICE_ID, { vehicleId: VEHICLE });

      expect(r.conflicts[0]).toMatchObject({
        resource: ConflictResource.VEHICLE,
        resourceName: 'AB123CD',
      });
    });

    it('sin cuadrilla ni vehículo que evaluar no consulta nada', async () => {
      const r = await service.getAssignmentConflicts(SERVICE_ID, {});

      expect(r.hasConflicts).toBe(false);
      expect(prisma.service.findMany).not.toHaveBeenCalled();
    });
  });

  // ─── #122: aviso de demora ──────────────────────────

  describe('aviso de demora', () => {
    const aviso = (over: Record<string, unknown> = {}) => ({
      delayType: DelayType.START,
      delayMinutes: 90,
      reason: 'Corte de calle imprevisto',
      ...over,
    });

    /** Es lo que distingue un aviso de un cambio de estado. */
    it('no toca el estado del servicio', async () => {
      await service.addDelayNotice(SERVICE_ID, aviso(), ACTOR);

      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it('guarda el estado en el que estaba y quién lo reportó', async () => {
      await service.addDelayNotice(SERVICE_ID, aviso(), ACTOR);

      expect(prisma.serviceDelayNotice.create.mock.calls[0][0].data).toMatchObject({
        serviceStatus: ServiceStatus.SCHEDULED,
        reportedBy: ACTOR,
        delayMinutes: 90,
      });
    });

    it('sin detectedAt usa el momento del aviso', async () => {
      const antes = Date.now();

      await service.addDelayNotice(SERVICE_ID, aviso(), ACTOR);

      const { detectedAt } = prisma.serviceDelayNotice.create.mock.calls[0][0].data;
      expect(detectedAt.getTime()).toBeGreaterThanOrEqual(antes);
    });

    it('respeta un detectedAt anterior: el retraso se detecta en la calle, se carga después', async () => {
      await service.addDelayNotice(
        SERVICE_ID,
        aviso({ detectedAt: '2026-09-15T10:00:00.000Z' }),
        ACTOR,
      );

      expect(prisma.serviceDelayNotice.create.mock.calls[0][0].data.detectedAt).toEqual(
        new Date('2026-09-15T10:00:00.000Z'),
      );
    });

    // ─── El tipo tiene que coincidir con el momento ──

    it('un servicio que no arrancó admite START', async () => {
      await expect(
        service.addDelayNotice(SERVICE_ID, aviso({ delayType: DelayType.START })),
      ).resolves.toBeDefined();
    });

    it('un servicio en curso admite DURATION', async () => {
      prisma.service.findUnique.mockResolvedValue(servicio({ status: ServiceStatus.IN_PROGRESS }));

      await expect(
        service.addDelayNotice(SERVICE_ID, aviso({ delayType: DelayType.DURATION })),
      ).resolves.toBeDefined();
    });

    /**
     * La combinación cruzada dejaría entrar datos que después nadie sabe leer:
     * un DURATION sobre un servicio que todavía no empezó no significa nada.
     */
    it('un servicio que no arrancó rechaza DURATION', async () => {
      await expect(
        service.addDelayNotice(SERVICE_ID, aviso({ delayType: DelayType.DURATION })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('un servicio en curso rechaza START', async () => {
      prisma.service.findUnique.mockResolvedValue(servicio({ status: ServiceStatus.IN_PROGRESS }));

      await expect(
        service.addDelayNotice(SERVICE_ID, aviso({ delayType: DelayType.START })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
      ServiceStatus.COMPLETED,
      ServiceStatus.PARTIALLY_COMPLETED,
      ServiceStatus.CANCELLED,
      ServiceStatus.SUSPENDED,
      ServiceStatus.RESCHEDULED,
    ])('un servicio en %s no se puede demorar', async (status) => {
      prisma.service.findUnique.mockResolvedValue(servicio({ status }));

      await expect(service.addDelayNotice(SERVICE_ID, aviso())).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    // ─── Historial ──────────────────────────────────

    /** Un aviso emitido no se corrige: se emite otro. El mismo criterio que el acta. */
    it('un aviso nuevo reemplaza al vigente en vez de pisarlo', async () => {
      prisma.serviceDelayNotice.findFirst.mockResolvedValue({ id: 'aviso-viejo' });

      await service.addDelayNotice(SERVICE_ID, aviso());

      expect(prisma.serviceDelayNotice.update).toHaveBeenCalledWith({
        where: { id: 'aviso-viejo' },
        data: { supersededById: 'aviso-1' },
      });
    });

    it('el primero no reemplaza a nadie', async () => {
      await service.addDelayNotice(SERVICE_ID, aviso());

      expect(prisma.serviceDelayNotice.update).not.toHaveBeenCalled();
    });

    it('el reemplazo y el alta van en la misma transacción', async () => {
      prisma.serviceDelayNotice.findFirst.mockResolvedValue({ id: 'aviso-viejo' });

      await service.addDelayNotice(SERVICE_ID, aviso());

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('el historial sale del más reciente al más viejo', async () => {
      await service.findDelayNotices(SERVICE_ID);

      expect(prisma.serviceDelayNotice.findMany.mock.calls[0][0].orderBy).toEqual({
        detectedAt: 'desc',
      });
    });

    it('active sale de si fue reemplazado', async () => {
      prisma.serviceDelayNotice.findMany.mockResolvedValue([
        {
          id: 'a',
          serviceId: SERVICE_ID,
          delayType: DelayType.START,
          delayMinutes: 30,
          reason: 'x',
          newEstimatedEnd: null,
          serviceStatus: ServiceStatus.SCHEDULED,
          reportedBy: null,
          detectedAt: new Date(),
          createdAt: new Date(),
          supersededById: null,
        },
        {
          id: 'b',
          serviceId: SERVICE_ID,
          delayType: DelayType.START,
          delayMinutes: 15,
          reason: 'y',
          newEstimatedEnd: null,
          serviceStatus: ServiceStatus.SCHEDULED,
          reportedBy: null,
          detectedAt: new Date(),
          createdAt: new Date(),
          supersededById: 'a',
        },
      ]);

      const r = await service.findDelayNotices(SERVICE_ID);

      expect(r.map((x) => x.active)).toEqual([true, false]);
    });

    // ─── Hacia M2 ───────────────────────────────────

    /**
     * Al vecino se le dice que se demora, no por qué: el motivo es operativo
     * interno, igual que `findings` en la inspección.
     */
    it('un servicio nacido de un reclamo avisa a M2, con el motivo como interno', async () => {
      prisma.service.findUnique.mockResolvedValue(
        servicio({ ticketId: 'TCK-1', status: ServiceStatus.IN_PROGRESS }),
      );

      await service.addDelayNotice(SERVICE_ID, aviso({ delayType: DelayType.DURATION }), ACTOR);

      const [[, eventos]] = outbox.enqueueMany.mock.calls;
      expect(eventos).toHaveLength(1);
      expect(eventos[0].payload).toMatchObject({
        ticketId: 'TCK-1',
        updateType: 'PROGRESS',
        internalMessage: 'Corte de calle imprevisto',
      });
      expect(eventos[0].payload.publicMessage).not.toContain('Corte de calle');
    });

    /**
     * #146: antes de arrancar, el ticket sigue `ROUTED` en M2 y §8.2 solo
     * acepta `PROGRESS` desde `IN_PROGRESS`. El aviso se registra igual.
     */
    it('una demora antes de arrancar se registra pero no se proyecta a M2', async () => {
      prisma.service.findUnique.mockResolvedValue(servicio({ ticketId: 'TCK-1' }));

      await service.addDelayNotice(SERVICE_ID, aviso({ delayType: DelayType.START }), ACTOR);

      expect(prisma.serviceDelayNotice.create).toHaveBeenCalled();
      expect(outbox.enqueueMany).toHaveBeenCalledWith(prisma, []);
    });

    it('una detección de oficio no avisa a nadie', async () => {
      await service.addDelayNotice(SERVICE_ID, aviso(), ACTOR);

      expect(outbox.enqueueMany).toHaveBeenCalledWith(prisma, []);
    });
  });
});
