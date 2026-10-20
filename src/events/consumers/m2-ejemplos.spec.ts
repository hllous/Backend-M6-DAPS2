import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { globalPipes } from '../../configure-app';
import { InboxService } from '../inbox/inbox.service';
import { IngestEventDto } from '../inbox/ingest-event.dto';
import { EJEMPLOS_M2_VALIDOS, PAQUETE_M2_PRESENTE } from '../m2-contract.testing';
import { TicketsConsumer } from './tickets.consumer';

/**
 * El otro sentido del contrato con M2: sus ejemplos válidos (v1.78) tienen que
 * pasar por NUESTRO inbox sin romper. Como el paquete no se versiona, sin él
 * el spec se saltea (ver `m2-contract.testing.ts` y docs/testing.md).
 *
 * Todos los ejemplos de M2 traen `responsibleAreaId: "M3"`, así que cada uno
 * corre dos veces: tal cual (ajeno, se descarta) y reasignado a "M6" (nuestro).
 */
const archivos = (prefijo: string): string[] =>
  PAQUETE_M2_PRESENTE && fs.existsSync(EJEMPLOS_M2_VALIDOS)
    ? fs
        .readdirSync(EJEMPLOS_M2_VALIDOS)
        .filter((n) => n.startsWith(prefijo) && n.endsWith('.json'))
    : [];

const leer = (f: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(EJEMPLOS_M2_VALIDOS, f), 'utf-8'));

// `.each` no admite una tabla vacía ni salteado; el test de arriba es el que falla si no hay ejemplos.
const VACIO = '(sin ejemplos)';

const describeM2 = PAQUETE_M2_PRESENTE ? describe : describe.skip;

describeM2('ejemplos válidos de M2 v1.78 contra nuestro inbox', () => {
  const ticketUpdated = archivos('ticketUpdated_');
  const ticketCreated = archivos('ticketCreated');
  let prisma: any;
  let inbox: InboxService;
  let outbox: { enqueue: jest.Mock; enqueueMany: jest.Mock };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterAll(() => jest.restoreAllMocks());

  beforeEach(() => {
    prisma = {
      environmentalReport: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'r1', reportType: 'OTHER' }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      service: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      ticketM2State: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      inboxEvent: {
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(prisma)),
    };
    inbox = new InboxService(prisma as unknown as PrismaService);
    outbox = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      enqueueMany: jest.fn().mockResolvedValue(undefined),
    };
    new TicketsConsumer(prisma as unknown as PrismaService, inbox, outbox as never).onModuleInit();
  });

  /** Pasa el sobre por el `ValidationPipe` real: el del bus (tolerante) o el de `POST /events/inbox`. */
  const sobre = async (raw: Record<string, unknown>, forbidNonWhitelisted: boolean) => {
    const pipe = globalPipes({ forbidNonWhitelisted })[1];
    return (await pipe.transform(raw, {
      type: 'body',
      metatype: IngestEventDto,
    })) as unknown as Parameters<InboxService['ingest']>[0];
  };

  it('el directorio de ejemplos existe y trae los de ticketCreated y ticketUpdated', () => {
    expect(fs.existsSync(EJEMPLOS_M2_VALIDOS)).toBe(true);
    // Lo que trae el paquete v1.78: que no pase con un solo ejemplo.
    expect(ticketUpdated.length).toBeGreaterThanOrEqual(18);
    expect(ticketCreated.length).toBeGreaterThanOrEqual(2);
    // Para el resumen: cuántos corrieron.
    console.info(
      `Ejemplos de M2 v1.78: ${ticketCreated.length} ticketCreated + ${ticketUpdated.length} ticketUpdated (cada uno como M3 y como M6)`,
    );
  });

  describe.each(ticketUpdated.length ? ticketUpdated : [VACIO])('%s', (archivo) => {
    // Sin ejemplos (paquete ausente) el bloque se saltea; no se lee nada acá.
    const raw = archivo === VACIO ? {} : leer(archivo);
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

  it.each(ticketCreated.length ? ticketCreated : [VACIO])(
    '%s: sin handler, se ignora sin persistir contenido',
    async (archivo) => {
      const r = await inbox.ingest(await sobre(leer(archivo), false));

      expect(r.status).toBe('ignored');
      expect(prisma.inboxEvent.create.mock.calls[0][0].data.payload).toEqual({
        redacted: expect.any(String),
      });
      expect(prisma.environmentalReport.create).not.toHaveBeenCalled();
    },
  );
});
