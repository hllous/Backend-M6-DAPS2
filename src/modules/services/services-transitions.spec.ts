import { ConflictException } from '@nestjs/common';
import { ServiceMode, ServiceOrigin, ServiceStatus as S } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService, VALID_TRANSITIONS } from './services.service';

/**
 * #570: toda transición que VALID_TRANSITIONS no permite devuelve 409 y no
 * escribe nada (ni servicio, ni outbox, ni auditoría). Los pares salen de la
 * tabla importada: si cambia, el complemento cambia con ella.
 */
describe('ServicesService — transiciones inválidas (409)', () => {
  const ID = '11111111-1111-1111-1111-111111111111';
  const ACTOR = { userId: '4242', roles: [] };
  const ESTADOS = Object.keys(VALID_TRANSITIONS) as S[];

  let prisma: any;
  let outbox: any;
  let audit: any;
  let service: ServicesService;

  const row = (status: S, over: Record<string, unknown> = {}) => ({
    id: ID,
    serviceTypeId: 'st-1',
    mode: ServiceMode.POINT,
    status,
    origin: ServiceOrigin.PLANNED,
    crewId: 'crew-1',
    vehicleId: null,
    ticketId: null,
    scheduledDate: new Date('2099-01-01T00:00:00.000Z'),
    windowFrom: null,
    windowTo: null,
    zones: [{ zoneId: 'z1', sequence: 1 }],
    zoneResults: [{ zoneId: 'z1', status: 'SERVICED' }],
    collectionRecords: [],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      service: { findUnique: jest.fn(), update: jest.fn() },
      serviceType: {
        findUnique: jest.fn().mockResolvedValue({ code: 'X', requiresVehicle: false }),
      },
      crew: { count: jest.fn().mockResolvedValue(1) },
      $transaction: jest.fn(),
    };
    outbox = { enqueue: jest.fn(), enqueueMany: jest.fn() };
    audit = { record: jest.fn() };
    service = new ServicesService(
      prisma as unknown as PrismaService,
      outbox,
      {} as never,
      audit as never,
    );
  });

  const acciones: Record<string, { to: S; run: () => Promise<unknown> }> = {
    start: { to: S.IN_PROGRESS, run: () => service.start(ID, ACTOR) },
    suspend: { to: S.SUSPENDED, run: () => service.suspend(ID, ACTOR, 'lluvia') },
    cancel: { to: S.CANCELLED, run: () => service.cancel(ID, 'duplicado', ACTOR) },
    reschedule: { to: S.RESCHEDULED, run: () => service.reschedule(ID, 'lluvia', ACTOR) },
    confirmReschedule: {
      to: S.SCHEDULED,
      run: () => service.confirmReschedule(ID, { scheduledDate: '2099-02-01' } as never, ACTOR),
    },
    complete: { to: S.COMPLETED, run: () => service.complete(ID, {}, ACTOR) },
  };

  const casos: [string, S, S][] = Object.entries(acciones).flatMap(([nombre, { to }]) =>
    ESTADOS.filter((from) => !VALID_TRANSITIONS[from].includes(to)).map(
      (from) => [nombre, from, to] as [string, S, S],
    ),
  );

  const sinEscrituras = () => {
    expect(prisma.service.update).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
    expect(outbox.enqueueMany).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  };

  it.each(casos)('%s desde %s hacia %s: 409 y no escribe nada', async (nombre, from) => {
    prisma.service.findUnique.mockResolvedValue(row(from));

    const p = acciones[nombre].run();

    await expect(p).rejects.toBeInstanceOf(ConflictException);
    await expect(p).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining(`'${from}'`),
    });
    sinEscrituras();
  });

  it.each(ESTADOS.filter((f) => !VALID_TRANSITIONS[f].includes(S.PARTIALLY_COMPLETED)))(
    'complete con una zona parcial desde %s (hacia PARTIALLY_COMPLETED): 409 y no escribe nada',
    async (from) => {
      prisma.service.findUnique.mockResolvedValue(
        row(from, { zoneResults: [{ zoneId: 'z1', status: 'PARTIAL' }] }),
      );

      await expect(service.complete(ID, {}, ACTOR)).rejects.toBeInstanceOf(ConflictException);
      sinEscrituras();
    },
  );

  // resume tiene su propia guarda (solo desde SUSPENDED): SCHEDULED→IN_PROGRESS
  // es válido en la tabla pero no por resume.
  it.each(ESTADOS.filter((e) => e !== S.SUSPENDED))(
    'resume desde %s: 409 y no escribe nada',
    async (from) => {
      prisma.service.findUnique.mockResolvedValue(row(from));

      const p = service.resume(ID, ACTOR);

      await expect(p).rejects.toBeInstanceOf(ConflictException);
      await expect(p).rejects.toMatchObject({ status: 409 });
      sinEscrituras();
    },
  );
});
