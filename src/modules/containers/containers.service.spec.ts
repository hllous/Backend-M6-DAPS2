import { ConflictException, NotFoundException } from '@nestjs/common';
import { Container, ContainerStatus as C, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OutboxService } from '../../events/outbox/outbox.service';
import { CONTAINER_TRANSITIONS, ContainersService } from './containers.service';

const ID = '22222222-2222-2222-2222-222222222222';
const ESTADOS = Object.keys(CONTAINER_TRANSITIONS) as C[];

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: '5.22.0' });
}

describe('ContainersService', () => {
  let prisma: any;
  let outbox: any;
  let service: ContainersService;

  const contenedor = (over: Partial<Container> = {}): Container =>
    ({
      id: ID,
      code: 'CT-0001',
      containerType: 'HOUSEHOLD',
      zoneId: 'z-centro',
      address: 'Av. Mitre 1200',
      lat: new Prisma.Decimal('-34.6037'),
      lng: new Prisma.Decimal('-58.3816'),
      capacityLiters: 1100,
      status: C.ACTIVE,
      damageType: null,
      severity: null,
      requiresPublicWorks: null,
      createdAt: new Date('2026-08-01T10:00:00.000Z'),
      updatedAt: new Date('2026-08-02T10:00:00.000Z'),
      ...over,
    }) as Container;

  beforeEach(() => {
    prisma = {
      container: {
        create: jest.fn().mockResolvedValue(contenedor()),
        findUnique: jest.fn().mockResolvedValue(contenedor()),
        findMany: jest.fn().mockResolvedValue([contenedor()]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(contenedor(data))),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    outbox = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new ContainersService(
      prisma as unknown as PrismaService,
      outbox as unknown as OutboxService,
    );
  });

  /** Deja el contenedor en `desde` y corre la acción. */
  function desde(estado: C) {
    prisma.container.findUnique.mockResolvedValue(contenedor({ status: estado }));
  }

  // ─── La tabla de transiciones ───────────────────────

  describe('CONTAINER_TRANSITIONS', () => {
    it('cubre los seis estados', () => {
      expect(ESTADOS).toHaveLength(6);
    });

    it('nunca apunta a un estado que no existe', () => {
      for (const estado of ESTADOS) {
        for (const destino of CONTAINER_TRANSITIONS[estado]) {
          expect(ESTADOS).toContain(destino);
        }
      }
    });

    /** El contenedor se retira, no se borra: el histórico lo sigue apuntando. */
    it('REMOVED es el único estado sin salida', () => {
      expect(CONTAINER_TRANSITIONS.REMOVED).toEqual([]);
      for (const estado of ESTADOS.filter((e) => e !== C.REMOVED)) {
        expect(CONTAINER_TRANSITIONS[estado].length).toBeGreaterThan(0);
      }
    });

    /** Se retira lo que no se puede reparar, así que hay que pasar por DAMAGED. */
    it('solo se llega a REMOVED desde DAMAGED', () => {
      const origenes = ESTADOS.filter((e) => CONTAINER_TRANSITIONS[e].includes(C.REMOVED));
      expect(origenes).toEqual([C.DAMAGED]);
    });

    it('desde cualquier estado vivo se puede volver a ACTIVE', () => {
      for (const estado of [C.OVERFLOWED, C.UNDER_REPAIR, C.RELOCATING]) {
        expect(CONTAINER_TRANSITIONS[estado]).toContain(C.ACTIVE);
      }
    });
  });

  // ─── Las transiciones ───────────────────────────────

  describe('transiciones', () => {
    it('reportOverflow lleva de ACTIVE a OVERFLOWED', async () => {
      desde(C.ACTIVE);
      const dto = await service.reportOverflow(ID);
      expect(dto.status).toBe(C.OVERFLOWED);
    });

    it('empty vuelve a ACTIVE y limpia los datos del daño', async () => {
      desde(C.OVERFLOWED);
      await service.empty(ID);

      expect(prisma.container.update.mock.calls[0][0].data).toEqual({
        status: C.ACTIVE,
        damageType: null,
        severity: null,
        requiresPublicWorks: null,
      });
    });

    it('completeRepair también limpia los datos del daño', async () => {
      desde(C.UNDER_REPAIR);
      await service.completeRepair(ID);

      expect(prisma.container.update.mock.calls[0][0].data).toMatchObject({
        status: C.ACTIVE,
        damageType: null,
      });
    });

    it('confirmRelocation guarda la ubicación nueva', async () => {
      desde(C.RELOCATING);
      await service.confirmRelocation(ID, { address: 'Belgrano 900', lat: -34.6, lng: -58.4 });

      expect(prisma.container.update.mock.calls[0][0].data).toEqual({
        status: C.ACTIVE,
        address: 'Belgrano 900',
        lat: -34.6,
        lng: -58.4,
      });
    });

    it('una reubicación sin coordenadas las deja nulas, no undefined', async () => {
      desde(C.RELOCATING);
      await service.confirmRelocation(ID, { address: 'Belgrano 900' } as any);

      expect(prisma.container.update.mock.calls[0][0].data).toMatchObject({
        lat: null,
        lng: null,
      });
    });

    it('startRepair y remove salen los dos de DAMAGED', async () => {
      desde(C.DAMAGED);
      await expect(service.startRepair(ID)).resolves.toMatchObject({ status: C.UNDER_REPAIR });

      desde(C.DAMAGED);
      await expect(service.remove(ID)).resolves.toMatchObject({ status: C.REMOVED });
    });

    it('el 409 nombra las transiciones válidas desde donde está', async () => {
      desde(C.ACTIVE);

      await expect(service.startRepair(ID)).rejects.toBeInstanceOf(ConflictException);
      await service.startRepair(ID).catch((error: Error) => {
        expect(error.message).toContain('OVERFLOWED');
        expect(error.message).toContain('DAMAGED');
      });
    });

    it('un contenedor retirado no se mueve más', async () => {
      desde(C.REMOVED);

      await expect(service.reportOverflow(ID)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.container.update).not.toHaveBeenCalled();
    });

    it('una transición sobre un contenedor inexistente da 404', async () => {
      prisma.container.findUnique.mockResolvedValue(null);

      await expect(service.reportOverflow(ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each(ESTADOS)('desde %s, el guard respeta la tabla', async (estado) => {
      const acciones: [C, (s: ContainersService) => Promise<unknown>][] = [
        [C.OVERFLOWED, (s) => s.reportOverflow(ID)],
        [
          C.DAMAGED,
          (s) => s.reportDamage(ID, { damageType: 'STRUCTURAL', severity: 'HIGH' } as any),
        ],
        [C.UNDER_REPAIR, (s) => s.startRepair(ID)],
        [C.RELOCATING, (s) => s.relocate(ID)],
        [C.REMOVED, (s) => s.remove(ID)],
      ];

      for (const [destino, accion] of acciones) {
        desde(estado);
        const permitida = CONTAINER_TRANSITIONS[estado].includes(destino);
        const promesa = accion(service);
        if (permitida) {
          await expect(promesa).resolves.toBeDefined();
        } else {
          await expect(promesa).rejects.toBeInstanceOf(ConflictException);
        }
      }
    });
  });

  // ─── El evento hacia M3 ─────────────────────────────

  describe('reportDamage', () => {
    it('guarda el daño y publica containerDamaged', async () => {
      desde(C.ACTIVE);
      await service.reportDamage(ID, {
        damageType: 'STRUCTURAL',
        severity: 'HIGH',
        requiresPublicWorks: true,
      } as any);

      expect(prisma.container.update.mock.calls[0][0].data).toMatchObject({
        status: C.DAMAGED,
        damageType: 'STRUCTURAL',
        severity: 'HIGH',
        requiresPublicWorks: true,
      });
      expect(outbox.enqueue).toHaveBeenCalledTimes(1);
      const [, entrada] = outbox.enqueue.mock.calls[0];
      expect(entrada).toMatchObject({
        eventType: 'containerDamaged',
        aggregateType: 'CONTAINER',
        aggregateId: ID,
      });
    });

    it('sin requiresPublicWorks explícito asume false, no null', async () => {
      desde(C.ACTIVE);
      await service.reportDamage(ID, { damageType: 'VANDALIZED', severity: 'LOW' } as any);

      expect(prisma.container.update.mock.calls[0][0].data.requiresPublicWorks).toBe(false);
    });

    /**
     * Es el punto del patrón outbox: si el evento se publicara fuera de la
     * transacción habría dos fallas posibles —daño sin aviso a M3, y aviso sin
     * daño— y las dos son peores que fallar entera.
     */
    it('el evento se encola en la misma transacción que el cambio de estado', async () => {
      desde(C.ACTIVE);
      await service.reportDamage(ID, { damageType: 'BURNT', severity: 'CRITICAL' } as any);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      const [tx] = outbox.enqueue.mock.calls[0];
      expect(tx).toBe(prisma);
    });

    it('las transiciones sin evento no tocan el outbox', async () => {
      desde(C.ACTIVE);
      await service.reportOverflow(ID);

      expect(outbox.enqueue).not.toHaveBeenCalled();
    });
  });

  // ─── CRUD ───────────────────────────────────────────

  describe('create', () => {
    it('nace ACTIVE', async () => {
      await service.create({
        code: 'CT-9',
        containerType: 'HOUSEHOLD',
        zoneId: 'z',
        capacityLiters: 1100,
      } as any);

      expect(prisma.container.create.mock.calls[0][0].data.status).toBe(C.ACTIVE);
    });

    it('un código repetido da 409, no un error de Prisma', async () => {
      prisma.container.create.mockRejectedValue(prismaError('P2002'));

      await expect(service.create({ code: 'CT-0001' } as any)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    /** La zona es una FK: si no existe, es un 404 del recurso apuntado. */
    it('una zona inexistente da 404', async () => {
      prisma.container.create.mockRejectedValue(prismaError('P2003'));

      await expect(service.create({ zoneId: 'no-existe' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un error que no es de Prisma se propaga tal cual', async () => {
      prisma.container.create.mockRejectedValue(new Error('la base se cayó'));

      await expect(service.create({} as any)).rejects.toThrow('la base se cayó');
    });
  });

  describe('update', () => {
    it('solo escribe los campos que vienen en el DTO', async () => {
      await service.update(ID, { address: 'Nueva 100' } as any);

      expect(prisma.container.update.mock.calls[0][0].data).toEqual({ address: 'Nueva 100' });
    });

    it('no deja cambiar el código ni el estado', async () => {
      await service.update(ID, { code: 'OTRO', status: C.REMOVED } as any);

      expect(prisma.container.update.mock.calls[0][0].data).toEqual({});
    });

    it('mover a una zona inexistente da 404', async () => {
      prisma.container.update.mockRejectedValue(prismaError('P2003'));

      await expect(service.update(ID, { zoneId: 'no-existe' } as any)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('actualizar un contenedor inexistente da 404', async () => {
      prisma.container.findUnique.mockResolvedValue(null);

      await expect(service.update(ID, {} as any)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll y findOne', () => {
    it('acumula los filtros que vienen', async () => {
      await service.findAll({
        page: 1,
        pageSize: 20,
        status: C.DAMAGED,
        containerType: 'RECYCLABLE',
        zoneId: 'z-sur',
        search: 'mitre',
      } as any);

      expect(prisma.container.findMany.mock.calls[0][0].where).toEqual({
        status: C.DAMAGED,
        containerType: 'RECYCLABLE',
        zoneId: 'z-sur',
        address: { contains: 'mitre', mode: 'insensitive' },
      });
    });

    it('findOne da 404 si no está', async () => {
      prisma.container.findUnique.mockResolvedValue(null);

      await expect(service.findOne(ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('coordenadas en la respuesta', () => {
    it('las convierte a número', async () => {
      const dto = await service.findOne(ID);

      expect(dto.lat).toBe(-34.6037);
      expect(dto.lng).toBe(-58.3816);
    });

    it('las ausentes viajan como null', async () => {
      prisma.container.findUnique.mockResolvedValue(contenedor({ lat: null, lng: null }));

      const dto = await service.findOne(ID);

      expect(dto.lat).toBeNull();
      expect(dto.lng).toBeNull();
    });

    /**
     * Un cero es un valor válido, no la ausencia de valor. Convertirlo con un
     * chequeo de verdad lo publicaría como `null` y el contenedor aparecería
     * sin ubicación en el mapa.
     */
    it('una coordenada en cero NO se publica como null', async () => {
      prisma.container.findUnique.mockResolvedValue(
        contenedor({ lat: new Prisma.Decimal(0), lng: new Prisma.Decimal(0) }),
      );

      const dto = await service.findOne(ID);

      expect(dto.lat).toBe(0);
      expect(dto.lng).toBe(0);
    });
  });
});
