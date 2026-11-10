import { AuditService } from '../../common/audit/audit.service';
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { globalPipes } from '../../configure-app';
import { InboxService } from '../inbox/inbox.service';
import { IngestEventDto } from '../inbox/ingest-event.dto';
import { TicketsConsumer } from './tickets.consumer';
import type { Mock } from 'vitest';

/**
 * El otro sentido del contrato con M2: sobres de ejemplo (copiados del paquete
 * v1.78, selección mínima en `test/fixtures/m2/`) tienen que pasar por NUESTRO
 * inbox sin romper. Cubren cada updateType con rama propia en el consumer (ver el README del directorio).
 *
 * Todos traen `responsibleAreaId: "M3"`, así que cada uno corre dos veces:
 * tal cual (ajeno, se descarta) y reasignado a "M6" (nuestro).
 */
const EJEMPLOS_M2 = path.join(__dirname, '../../../test/fixtures/m2');

const archivos = (prefijo: string): string[] =>
  fs.readdirSync(EJEMPLOS_M2).filter((n) => n.startsWith(prefijo) && n.endsWith('.json'));

const leer = (f: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(EJEMPLOS_M2, f), 'utf-8'));

describe('ejemplos de M2 v1.78 contra nuestro inbox', () => {
  const ticketUpdated = archivos('ticketUpdated_');
  const ticketCreated = archivos('ticketCreated');
  let prisma: any;
  let inbox: InboxService;
  let outbox: { enqueue: Mock; enqueueMany: Mock };

  beforeAll(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });
  afterAll(() => vi.restoreAllMocks());

  beforeEach(() => {
    prisma = {
      environmentalReport: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([{ id: 'rep-1', status: 'UNDER_REVIEW' }]),
        create: vi.fn().mockResolvedValue({ id: 'r1', reportType: 'OTHER' }),
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      service: {
        findMany: vi.fn().mockResolvedValue([{ id: 'srv-1', status: 'SCHEDULED' }]),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      ticketM2State: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue({}),
      },
      inboxEvent: {
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    inbox = new InboxService(prisma as unknown as PrismaService);
    outbox = {
      enqueue: vi.fn().mockResolvedValue(undefined),
      enqueueMany: vi.fn().mockResolvedValue(undefined),
    };
    new TicketsConsumer(
      prisma as unknown as PrismaService,
      inbox,
      outbox as never,
      { record: vi.fn() } as unknown as AuditService,
    ).onModuleInit();
  });

  /** Pasa el sobre por el `ValidationPipe` real: el del bus (tolerante) o el de `POST /events/inbox`. */
  const sobre = async (raw: Record<string, unknown>, forbidNonWhitelisted: boolean) => {
    const pipe = globalPipes({ forbidNonWhitelisted })[1];
    return (await pipe.transform(raw, {
      type: 'body',
      metatype: IngestEventDto,
    })) as unknown as Parameters<InboxService['ingest']>[0];
  };

  it('los fixtures traen ticketCreated y ticketUpdated', () => {
    expect(ticketUpdated).toHaveLength(12);
    expect(ticketCreated).toHaveLength(2);
  });

  describe.each(ticketUpdated)('%s', (archivo) => {
    const raw = leer(archivo);
    const data = (raw.data ?? {}) as Record<string, unknown>;
    const details = (data.details ?? {}) as Record<string, any>;
    const reclasificacion =
      details.informationResponse?.purpose === 'RECLASSIFICATION' ||
      details.informationRequest?.purpose === 'RECLASSIFICATION';

    it.each([true, false])(
      'de otra área: se descarta sin persistir contenido (HTTP estricto=%s)',
      async (estricto) => {
        const r = await inbox.ingest(await sobre(raw, estricto));

        expect(r.status).toBe('processed');
        expect(prisma.inboxEvent.create.mock.calls[0][0].data.payload).toEqual({
          redacted: expect.any(String),
        });
        expect(prisma.environmentalReport.create).not.toHaveBeenCalled();
        expect(prisma.environmentalReport.update).not.toHaveBeenCalled();
        expect(prisma.ticketM2State.upsert).not.toHaveBeenCalled();
        expect(outbox.enqueue).not.toHaveBeenCalled();
        expect(prisma.service.updateMany).not.toHaveBeenCalled();
        if (data.updateType === 'ROUTED') {
          // Único efecto legítimo: cerrar el expediente devuelto (cerrarDevuelto),
          // sin nada del contenido del ticket ajeno.
          for (const [arg] of prisma.environmentalReport.updateMany.mock.calls) {
            expect(arg.data).toEqual({ status: 'CLOSED' });
          }
        } else {
          expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
          expect(prisma.environmentalReport.findFirst).not.toHaveBeenCalled();
        }
      },
    );

    it('reasignado a M6: se acepta y no lanza', async () => {
      const nuestro = { ...raw, data: { ...data, responsibleAreaId: 'M6' } };
      // Un expediente previo, para que los datos que lo pisan tengan dónde caer.
      prisma.environmentalReport.findFirst.mockResolvedValue({
        id: 'r1',
        status: 'UNDER_REVIEW',
        ticketId: data.ticketId,
      });

      const r = await inbox.ingest(await sobre(nuestro, false));

      expect(r.status).toBe('processed');
      expect(prisma.inboxEvent.create.mock.calls[0][0].data.payload).toEqual(nuestro.data);
      if (reclasificacion) {
        // El mensaje de reclasificación es entre M2 y el vecino: no toca el expediente.
        expect(prisma.environmentalReport.update).not.toHaveBeenCalled();
        expect(prisma.environmentalReport.updateMany).not.toHaveBeenCalled();
        expect(prisma.environmentalReport.create).not.toHaveBeenCalled();
        expect(outbox.enqueue).not.toHaveBeenCalled();
        expect(outbox.enqueueMany).not.toHaveBeenCalled();
        // Sí se guarda el `currentStatus` que informa M2 (#303, es campo común); nada más.
        for (const [arg] of prisma.ticketM2State.upsert.mock.calls) {
          expect(arg.create.source).toBe('RECEIVED');
        }
      }
    });
  });

  it.each(ticketCreated)('%s: sin handler, se ignora sin persistir contenido', async (archivo) => {
    const r = await inbox.ingest(await sobre(leer(archivo), false));

    expect(r.status).toBe('ignored');
    expect(prisma.inboxEvent.create.mock.calls[0][0].data.payload).toEqual({
      redacted: expect.any(String),
    });
    expect(prisma.environmentalReport.create).not.toHaveBeenCalled();
  });
});
