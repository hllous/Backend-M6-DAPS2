import { Logger } from '@nestjs/common';
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

/**
 * Reglas del ServicesService que el análisis de mutación (#617) mostró sin
 * cobertura de comportamiento. Cada test lleva en el nombre la regla de negocio
 * que protege. Lo más valioso del archivo es `tx`: la transacción recibe un
 * cliente distinto del principal, así que si algo escribe o encola fuera de ella
 * los tests fallan. La fecha de "hoy" está fijada (nada depende del reloj real).
 */

const USER = '4242';
const ACTOR = { userId: USER, roles: [] };
const ACTOR_M1 = { userId: USER, actorId: '0b0b0b0b-1111-2222-3333-444444444444', roles: [] };
const SID = '11111111-1111-1111-1111-111111111111';
const TYPE = '22222222-2222-2222-2222-222222222222';
const ROUTE = '33333333-3333-3333-3333-333333333333';
const CREW = '44444444-4444-4444-4444-444444444444';
const VEHICLE = '55555555-5555-5555-5555-555555555555';
const SITE = '66666666-6666-6666-6666-666666666666';
const ZA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ZB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const OTHER = '77777777-7777-7777-7777-777777777777';
const HOY = '2026-09-10T15:00:00.000Z'; // 12:00 en Argentina
const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const dia = (ymd: string) => new Date(`${ymd}T00:00:00.000Z`);
const p2025 = () =>
  new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: '5.22.0' });

describe('ServicesService — reglas y contratos (mutación #617)', () => {
  let prisma: any;
  let tx: any;
  let outbox: any;
  let audit: any;
  let service: ServicesService;
  let enqueuedInTx: boolean[];
  let inTx: boolean;

  const row = (over: Record<string, unknown> = {}) => ({
    id: SID,
    serviceTypeId: TYPE,
    mode: ServiceMode.ROUTE,
    status: ServiceStatus.SCHEDULED,
    statusReason: null,
    statusNote: null,
    origin: ServiceOrigin.PLANNED,
    routeId: ROUTE,
    targetType: null,
    targetId: null,
    scheduledDate: dia('2026-09-15'),
    windowFrom: null,
    windowTo: null,
    crewId: CREW,
    vehicleId: null,
    ticketId: null,
    weatherAlertId: null,
    notes: null,
    createdBy: null,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    zones: [
      { zoneId: ZA, sequence: 1 },
      { zoneId: ZB, sequence: 2 },
    ],
    zoneResults: [],
    collectionRecords: [],
    inspection: null,
    ...over,
  });
  const tipo = (over: Record<string, unknown> = {}) => ({
    id: TYPE,
    code: 'REC-DOM',
    mode: ServiceMode.ROUTE,
    requiresVehicle: false,
    active: true,
    ...over,
  });
  const baseDto = {
    serviceTypeId: TYPE,
    scheduledDate: '2026-09-15',
    origin: ServiceOrigin.PLANNED,
    routeId: ROUTE,
  };
  const atendida = (zoneId: string) => ({ id: `zr-${zoneId}`, zoneId, status: 'SERVICED' });
  const ambasAtendidas = [atendida(ZA), atendida(ZB)];
  const etag = () => `W/"${row().updatedAt.getTime()}"`;
  /** Los eventos que salieron hacia el outbox, aplanados. */
  const eventos = () => outbox.enqueueMany.mock.calls.flatMap((c: any[]) => c[1]);
  const aviso = (over: Record<string, unknown> = {}) => ({
    id: 'dn-1',
    serviceId: SID,
    delayType: 'DURATION',
    delayMinutes: 25,
    reason: 'Tráfico',
    newEstimatedEnd: null,
    serviceStatus: ServiceStatus.IN_PROGRESS,
    reportedBy: USER,
    detectedAt: new Date('2026-09-15T08:00:00.000Z'),
    createdAt: new Date('2026-09-15T08:01:00.000Z'),
    supersededById: null,
    ...over,
  });

  beforeEach(() => {
    vi.useFakeTimers({ now: new Date(HOY), toFake: ['Date'] });
    inTx = false;
    enqueuedInTx = [];
    prisma = {
      serviceType: { findUnique: vi.fn().mockResolvedValue(tipo()) },
      route: {
        findUnique: vi.fn().mockResolvedValue({
          id: ROUTE,
          code: 'R-01',
          active: true,
          stops: [
            { zoneId: ZA, sequence: 1 },
            { zoneId: ZB, sequence: 2 },
          ],
        }),
      },
      container: {
        findUnique: vi.fn().mockResolvedValue({ zoneId: ZB }),
        update: vi.fn().mockResolvedValue({}),
      },
      containerStatusHistory: { create: vi.fn().mockResolvedValue(undefined) },
      crew: {
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn().mockResolvedValue({
          id: CREW,
          active: true,
          name: 'Norte',
          specialty: null,
          homeZoneId: null,
          homeZone: null,
          zoneAssignments: [],
        }),
      },
      vehicle: {
        findUnique: vi.fn().mockResolvedValue({ id: VEHICLE, active: true, plate: 'AA123BB' }),
      },
      disposalSite: {
        findUnique: vi.fn().mockResolvedValue({ id: SITE, code: 'DS-1', active: true }),
      },
      service: {
        create: vi.fn().mockImplementation(async () => row()),
        findUnique: vi.fn().mockImplementation(async () => row()),
        update: vi.fn().mockImplementation(async () => row()),
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      ticketM2State: { findUnique: vi.fn().mockResolvedValue(null) },
      serviceDelayNotice: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(aviso()),
        update: vi.fn().mockResolvedValue({}),
      },
      zoneResult: { create: vi.fn().mockResolvedValue({ id: 'zr1', zoneId: ZA }) },
      collectionRecord: {
        create: vi.fn().mockResolvedValue({
          id: 'cr1',
          wasteType: WasteType.HOUSEHOLD,
          disposalSiteId: SITE,
          zoneResultId: null,
          volumeM3: null,
          weightKg: null,
        }),
      },
    };
    tx = Object.create(prisma);
    prisma.$transaction = vi.fn(async (cb: (t: unknown) => unknown) => {
      inTx = true;
      try {
        return await cb(tx);
      } finally {
        inTx = false;
      }
    });
    outbox = {
      enqueue: vi.fn(),
      enqueueMany: vi.fn().mockImplementation(async () => {
        enqueuedInTx.push(inTx);
      }),
    };
    audit = { record: vi.fn().mockResolvedValue(undefined) };
    service = new ServicesService(
      prisma as unknown as PrismaService,
      outbox,
      { assertLinkable: vi.fn(), linkService: vi.fn() } as never,
      audit as never,
    );
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ─── Lectura ───────────────────────────────────────

  it('un rango de un solo día (desde == hasta) es válido', async () => {
    await service.findAll({
      page: 1,
      pageSize: 20,
      scheduledFrom: '2026-09-10',
      scheduledTo: '2026-09-10',
    } as any);

    expect(prisma.service.findMany.mock.calls[0][0].where.scheduledDate).toEqual({
      gte: dia('2026-09-10'),
      lte: dia('2026-09-10'),
    });
  });

  it('volumen y peso de una recolección salen como número, o null si no se midió', async () => {
    const registro = (volumeM3: unknown, weightKg: unknown) => ({
      id: 'cr',
      wasteType: WasteType.HOUSEHOLD,
      disposalSiteId: SITE,
      zoneResultId: null,
      volumeM3,
      weightKg,
    });
    prisma.service.findUnique.mockResolvedValue(
      row({
        collectionRecords: [
          registro(new Prisma.Decimal('2.5'), new Prisma.Decimal('1200')),
          registro(null, null),
        ],
      }),
    );

    const [medido, sinMedir] = await service.findCollectionRecords(SID);

    expect(medido).toMatchObject({ volumeM3: 2.5, weightKg: 1200 });
    expect(sinMedir).toMatchObject({ volumeM3: null, weightKg: null });
  });

  // ─── Programación ──────────────────────────────────

  it.each([
    [
      'un tipo de servicio inexistente',
      () => prisma.serviceType.findUnique.mockResolvedValue(null),
      `Tipo de servicio con id '${TYPE}' no encontrado`,
    ],
    [
      'un recorrido inexistente',
      () => prisma.route.findUnique.mockResolvedValue(null),
      `Recorrido con id '${ROUTE}' no encontrado`,
    ],
    [
      'un recorrido dado de baja',
      () =>
        prisma.route.findUnique.mockResolvedValue({
          id: ROUTE,
          code: 'R-01',
          active: false,
          stops: [{ zoneId: ZA, sequence: 1 }],
        }),
      "El recorrido 'R-01' está dado de baja y no admite programación",
    ],
  ])('programar con %s da error que nombra cuál es', async (_caso, preparar, mensaje) => {
    preparar();

    await expect(service.create(baseDto as any, ACTOR)).rejects.toThrow(mensaje);
    expect(prisma.service.create).not.toHaveBeenCalled();
  });

  it.each([
    [
      'ROUTE descarta el objetivo puntual y toma la ruta',
      tipo(),
      { targetType: ServiceTargetType.TREE, targetId: OTHER },
      {
        mode: ServiceMode.ROUTE,
        routeId: ROUTE,
        targetType: null,
        targetId: null,
        createdBy: USER,
      },
    ],
    [
      'POINT guarda el objetivo y deja routeId en null',
      tipo({ mode: ServiceMode.POINT }),
      { routeId: undefined, targetType: ServiceTargetType.CONTAINER, targetId: OTHER },
      {
        mode: ServiceMode.POINT,
        routeId: null,
        targetType: ServiceTargetType.CONTAINER,
        targetId: OTHER,
        createdBy: USER,
      },
    ],
  ])('modo %s y registra quién lo creó', async (_modo, tipoServicio, extra, esperado) => {
    prisma.serviceType.findUnique.mockResolvedValue(tipoServicio);

    await service.create({ ...baseDto, ...extra } as any, ACTOR);

    expect(prisma.service.create.mock.calls[0][0].data).toMatchObject(esperado);
  });

  it.each([
    [
      'al crear, una ventana con inicio igual al fin',
      () => service.create({ ...baseDto, windowFrom: '10:00', windowTo: '10:00' } as any, ACTOR),
    ],
    [
      'al editar solo el inicio, contra el fin ya guardado',
      () => {
        prisma.service.findUnique.mockResolvedValue(row({ windowTo: hora('10:00') }));
        return service.update(SID, { windowFrom: '11:00' }, ACTOR);
      },
    ],
    [
      'al confirmar una reprogramación con la ventana al revés',
      () => {
        prisma.service.findUnique.mockResolvedValue(row({ status: ServiceStatus.RESCHEDULED }));
        return service.confirmReschedule(
          SID,
          { scheduledDate: '2026-09-20', windowFrom: '12:00', windowTo: '08:00' } as any,
          ACTOR,
        );
      },
    ],
  ])('ventana inválida: %s da 400', async (_caso, ejecutar) => {
    await expect(ejecutar()).rejects.toThrow('La ventana horaria está invertida');
    expect(prisma.service.create).not.toHaveBeenCalled();
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  // ─── Edición, If-Match y concurrencia ──────────────

  // ADR-012: solo con If-Match concreto, un P2025 significa "versión vieja".
  it.each([
    ['un ETag concreto', etag(), 412],
    ['sin header', undefined, undefined],
    ['con "*"', '*', undefined],
  ])('el conflicto al escribir con %s %s', async (_caso, header, status) => {
    prisma.service.update.mockRejectedValue(p2025());

    const resultado = expect(service.update(SID, { notes: 'x' }, ACTOR, header)).rejects;

    if (status) await resultado.toMatchObject({ status });
    else await resultado.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it.each([
    ['editar con If-Match', () => service.update(SID, { notes: 'x' }, ACTOR, etag())],
    ['cancelar', () => service.cancel(SID, 'x', ACTOR)],
  ])('un error que no es P2025 al %s se propaga tal cual', async (_caso, ejecutar) => {
    const roto = new Error('base caída');
    prisma.service.update.mockRejectedValue(roto);

    await expect(ejecutar()).rejects.toBe(roto);
  });

  // ─── Cuadrilla y vehículo ──────────────────────────

  it('un servicio iniciado no cambia de cuadrilla (409)', async () => {
    prisma.service.findUnique.mockResolvedValue(row({ status: ServiceStatus.IN_PROGRESS }));

    await expect(service.assignCrew(SID, { crewId: CREW } as any, ACTOR)).rejects.toMatchObject({
      status: 409,
    });
    expect(prisma.service.update).not.toHaveBeenCalled();
  });

  it.each([
    ['sin vehículo no toca el que tenía', { crewId: CREW }, { crewId: CREW }],
    [
      'con vehículo lo asigna junto con la cuadrilla',
      { crewId: CREW, vehicleId: VEHICLE },
      { crewId: CREW, vehicleId: VEHICLE },
    ],
  ])('asignar cuadrilla %s', async (_caso, dto, esperado) => {
    await service.assignCrew(SID, dto as any, ACTOR);

    expect(prisma.service.update.mock.calls[0][0].data).toStrictEqual(esperado);
  });

  describe('conflictos de asignación', () => {
    const otro = (over: Record<string, unknown> = {}) => ({
      id: OTHER,
      status: ServiceStatus.IN_PROGRESS,
      scheduledDate: dia('2026-09-15'),
      windowFrom: hora('09:00'),
      windowTo: hora('12:30'),
      crewId: CREW,
      vehicleId: VEHICLE,
      serviceType: { name: 'Recolección domiciliaria' },
      crew: { name: 'Cuadrilla Norte' },
      vehicle: { plate: 'AA123BB' },
      ...over,
    });
    const choque = (resource: string, resourceId: string, resourceName: string) => ({
      resource,
      resourceId,
      resourceName,
      serviceId: OTHER,
      serviceStatus: ServiceStatus.IN_PROGRESS,
      serviceTypeName: 'Recolección domiciliaria',
      scheduledDate: '2026-09-15',
      windowFrom: '09:00',
      windowTo: '12:30',
    });

    it.each([
      [
        'cuadrilla: nombra a la cuadrilla',
        { crewId: CREW },
        {},
        choque('CREW', CREW, 'Cuadrilla Norte'),
      ],
      [
        'vehículo: nombra la patente',
        { vehicleId: VEHICLE },
        { crewId: null },
        choque('VEHICLE', VEHICLE, 'AA123BB'),
      ],
      [
        'vehículo sin datos: cae al id',
        { vehicleId: VEHICLE },
        { crewId: null, vehicle: null },
        choque('VEHICLE', VEHICLE, VEHICLE),
      ],
    ])(
      'el choque por %s, con servicio, estado, tipo, día y franja',
      async (_caso, dto, over, esperado) => {
        prisma.service.findMany.mockResolvedValue([otro(over)]);

        const res = await service.getAssignmentConflicts(SID, dto as any);

        expect(res.hasConflicts).toBe(true);
        expect(res.conflicts).toEqual([esperado]);
      },
    );

    it('el encaje de la cuadrilla usa la reubicación vigente el día del servicio', async () => {
      await service.getAssignmentConflicts(SID, { crewId: CREW } as any);

      const dia15 = dia('2026-09-15');
      expect(prisma.crew.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            zoneAssignments: expect.objectContaining({
              where: {
                validFrom: { lte: dia15 },
                OR: [{ validTo: null }, { validTo: { gte: dia15 } }],
              },
            }),
          }),
        }),
      );
    });
  });

  // ─── Auditoría: cada acción deja su fila, en la misma transacción ────

  it.each([
    ['CREATE', undefined, ServiceStatus.SCHEDULED, () => service.create(baseDto as any, ACTOR)],
    [
      'UPDATE',
      ServiceStatus.SCHEDULED,
      ServiceStatus.SCHEDULED,
      () => service.update(SID, { notes: 'n' }, ACTOR),
    ],
    [
      'ASSIGN_CREW',
      ServiceStatus.SCHEDULED,
      ServiceStatus.SCHEDULED,
      () => service.assignCrew(SID, { crewId: CREW } as any, ACTOR),
    ],
    ['START', ServiceStatus.SCHEDULED, ServiceStatus.IN_PROGRESS, () => service.start(SID, ACTOR)],
    [
      'SUSPEND',
      ServiceStatus.IN_PROGRESS,
      ServiceStatus.SUSPENDED,
      () => service.suspend(SID, ACTOR, 'LLUVIA'),
    ],
    [
      'RESUME',
      ServiceStatus.SUSPENDED,
      ServiceStatus.IN_PROGRESS,
      () => service.resume(SID, ACTOR),
    ],
    [
      'CANCEL',
      ServiceStatus.SCHEDULED,
      ServiceStatus.CANCELLED,
      () => service.cancel(SID, 'Sin presupuesto', ACTOR),
    ],
    [
      'RESCHEDULE',
      ServiceStatus.SCHEDULED,
      ServiceStatus.RESCHEDULED,
      () => service.reschedule(SID, 'Alerta meteorológica', ACTOR),
    ],
    [
      'CONFIRM_RESCHEDULE',
      ServiceStatus.RESCHEDULED,
      ServiceStatus.SCHEDULED,
      () => service.confirmReschedule(SID, { scheduledDate: '2026-09-20' } as any, ACTOR),
    ],
    [
      'COMPLETE',
      ServiceStatus.IN_PROGRESS,
      ServiceStatus.COMPLETED,
      () => service.complete(SID, {} as any, ACTOR),
    ],
  ])(
    '%s audita la transición (desde %s, hasta %s) con el cliente de la transacción',
    async (accion, desde, hasta, ejecutar) => {
      if (desde) {
        prisma.service.findUnique.mockResolvedValue(
          row({ status: desde, zoneResults: ambasAtendidas }),
        );
      }

      await ejecutar();

      const [cliente, fila] = audit.record.mock.calls[0];
      expect(cliente).toBe(tx);
      expect(fila).toMatchObject({
        entityType: 'SERVICE',
        entityId: SID,
        action: accion,
        toStatus: hasta,
        actor: ACTOR,
      });
      if (desde) expect(fila.fromStatus).toBe(desde);
    },
  );

  // ─── Avisos a M2 (updateTicketStatus) en la misma transacción ────

  // #303: agendar cuenta como tomar la gestión del reclamo.
  it.each([
    [
      'al crear un servicio de reclamo ROUTED avisa STARTED',
      ServiceStatus.SCHEDULED,
      'ROUTED',
      () =>
        service.create(
          { ...baseDto, origin: ServiceOrigin.TICKET, ticketId: 'TCK-1' } as any,
          ACTOR_M1,
        ),
      { updateType: 'STARTED' },
    ],
    [
      'al iniciar avisa STARTED',
      ServiceStatus.SCHEDULED,
      'ROUTED',
      () => service.start(SID, ACTOR_M1),
      { updateType: 'STARTED' },
    ],
    [
      'al cancelar avisa REJECTED con el motivo como mensaje interno',
      ServiceStatus.SCHEDULED,
      'ROUTED',
      () => service.cancel(SID, 'Sin presupuesto', ACTOR_M1),
      { updateType: 'REJECTED', internalMessage: 'Sin presupuesto' },
    ],
    [
      'al completar avisa RESOLVED con resolución ACTION_COMPLETED',
      ServiceStatus.IN_PROGRESS,
      'IN_PROGRESS',
      () => service.complete(SID, {} as any, ACTOR_M1),
      { updateType: 'RESOLVED', details: { resolution: { type: 'ACTION_COMPLETED' } } },
    ],
    [
      'al confirmar la reprogramación avisa STARTED',
      ServiceStatus.RESCHEDULED,
      'ROUTED',
      () => service.confirmReschedule(SID, { scheduledDate: '2026-09-22' } as any, ACTOR_M1),
      { updateType: 'STARTED' },
    ],
    [
      'una demora en curso avisa PROGRESS con el motivo',
      ServiceStatus.IN_PROGRESS,
      'IN_PROGRESS',
      () =>
        service.addDelayNotice(
          SID,
          { delayType: 'DURATION', delayMinutes: 25, reason: 'Tráfico' } as any,
          USER,
          ACTOR_M1.actorId,
        ),
      { updateType: 'PROGRESS', internalMessage: 'Tráfico' },
    ],
  ])('%s', async (_caso, estado, estadoM2, ejecutar, esperado) => {
    const conTicket = row({ status: estado, ticketId: 'TCK-1', zoneResults: ambasAtendidas });
    prisma.service.findUnique.mockResolvedValue(conTicket);
    prisma.service.create.mockResolvedValue(conTicket);
    prisma.ticketM2State.findUnique.mockResolvedValue({ status: estadoM2 });

    await ejecutar();

    expect(eventos()).toHaveLength(1);
    expect(eventos()[0]).toMatchObject({
      eventType: 'updateTicketStatus',
      aggregateId: SID,
      payload: { ticketId: 'TCK-1', ...esperado },
    });
    expect(outbox.enqueueMany.mock.calls[0][0]).toBe(tx);
    expect(enqueuedInTx).toEqual([true]);
  });

  // ─── Reprogramación ────────────────────────────────

  it.each([
    ['ayer', HOY, '2026-09-09', false],
    ['hoy', HOY, '2026-09-10', true],
    // 02:00 UTC del 10 son las 23:00 del 9 en Argentina: ahí "hoy" todavía es el 9.
    [
      'hoy en Argentina aunque en UTC ya sea mañana',
      '2026-09-10T02:00:00.000Z',
      '2026-09-09',
      true,
    ],
  ])('reprogramar para %s: la fecha %s%s', async (_caso, ahora, fecha, valida) => {
    vi.setSystemTime(new Date(ahora));
    prisma.service.findUnique.mockResolvedValue(row({ status: ServiceStatus.RESCHEDULED }));

    const accion = service.confirmReschedule(SID, { scheduledDate: fecha } as any, ACTOR);

    if (valida) await expect(accion).resolves.toBeDefined();
    else {
      await expect(accion).rejects.toThrow(
        `La fecha reprogramada (${fecha}) no puede ser anterior a hoy`,
      );
      expect(prisma.service.update).not.toHaveBeenCalled();
    }
  });

  it.each([
    ['no manda franja: conserva la vigente', {}, {}],
    [
      'manda ambas',
      { windowFrom: '07:00', windowTo: '09:00' },
      { windowFrom: hora('07:00'), windowTo: hora('09:00') },
    ],
    [
      'manda solo el inicio: no pisa el fin',
      { windowFrom: '07:00' },
      { windowFrom: hora('07:00') },
    ],
    ['manda solo el fin: no pisa el inicio', { windowTo: '09:00' }, { windowTo: hora('09:00') }],
  ])('al confirmar la reprogramación, si %s', async (_caso, franja, guardado) => {
    prisma.service.findUnique.mockResolvedValue(row({ status: ServiceStatus.RESCHEDULED }));

    await service.confirmReschedule(SID, { scheduledDate: '2026-09-20', ...franja } as any, ACTOR);

    expect(prisma.service.update.mock.calls[0][0].data).toStrictEqual({
      status: ServiceStatus.SCHEDULED,
      scheduledDate: dia('2026-09-20'),
      ...guardado,
    });
  });

  // ─── Cierre sobre el contenedor ────────────────────

  it('un contenedor en reubicación sin coordenadas nuevas las deja en null', async () => {
    prisma.service.findUnique.mockResolvedValue(
      row({
        status: ServiceStatus.IN_PROGRESS,
        mode: ServiceMode.POINT,
        targetType: ServiceTargetType.CONTAINER,
        targetId: OTHER,
        zones: [{ zoneId: ZA, sequence: 1 }],
        zoneResults: [atendida(ZA)],
      }),
    );
    prisma.container.findUnique.mockResolvedValue({
      id: OTHER,
      code: 'CT-0001',
      status: ContainerStatus.RELOCATING,
      zoneId: ZA,
    });

    await service.complete(
      SID,
      { containerLocation: { address: 'Calle Nueva 100' } } as any,
      ACTOR,
    );

    expect(prisma.container.update.mock.calls[0][0].data).toStrictEqual({
      status: ContainerStatus.ACTIVE,
      address: 'Calle Nueva 100',
      lat: null,
      lng: null,
    });
  });

  // ─── Resultado por zona y recolección ──────────────

  it('la fecha propuesta de una zona no atendida se trunca al día', async () => {
    prisma.service.findUnique.mockResolvedValue(row({ status: ServiceStatus.IN_PROGRESS }));

    await service.addZoneResult(
      SID,
      {
        zoneId: ZA,
        status: ZoneResultStatus.NOT_SERVICED,
        reason: 'BLOCKED_ACCESS',
        proposedDate: '2026-09-20T18:00:00.000Z',
      } as any,
      USER,
    );

    expect(prisma.zoneResult.create.mock.calls[0][0].data.proposedDate).toEqual(dia('2026-09-20'));
  });

  it.each([ServiceStatus.COMPLETED, ServiceStatus.PARTIALLY_COMPLETED])(
    'se puede registrar una recolección sobre un servicio %s (cerrado)',
    async (status) => {
      prisma.service.findUnique.mockResolvedValue(row({ status }));

      await expect(
        service.addCollectionRecord(
          SID,
          { disposalSiteId: SITE, wasteType: WasteType.HOUSEHOLD } as any,
          USER,
        ),
      ).resolves.toBeDefined();
    },
  );

  // ─── Pertenencia ───────────────────────────────────

  it('quien no es de la cuadrilla recibe 403 NOT_ASSIGNED antes de cualquier regla de estado', async () => {
    prisma.crew.count.mockResolvedValue(0);
    prisma.service.findUnique.mockResolvedValue(row({ status: ServiceStatus.COMPLETED }));

    await expect(service.start(SID, ACTOR)).rejects.toMatchObject({
      status: 403,
      response: { code: 'NOT_ASSIGNED' },
    });
    expect(prisma.service.update).not.toHaveBeenCalled();
  });
});
