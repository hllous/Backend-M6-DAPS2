import 'reflect-metadata';
import configuration from '../config/configuration';
import { InboxController } from '../events/inbox/inbox.controller';
import { AttachmentsController } from '../modules/attachments/attachments.controller';
import { EVIDENCE_UPLOAD, INBOX_INGEST } from './rate-limits';

// Claves que escribe @Throttle({ default }) de @nestjs/throttler: si el decorador se borra, no hay metadato.
const limitDe = (handler: object): unknown =>
  Reflect.getMetadata('THROTTLER:LIMITdefault', handler);
const ttlDe = (handler: object): unknown => Reflect.getMetadata('THROTTLER:TTLdefault', handler);

describe('límites de tasa (#568)', () => {
  it('los endpoints sensibles son más estrictos que el global por defecto', () => {
    const prev = process.env;
    process.env = {
      ...prev,
      DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      JWT_SECRET: Buffer.alloc(32, 1).toString('base64'),
    };
    delete process.env.THROTTLE_LIMIT;
    delete process.env.THROTTLE_TTL_MS;
    try {
      const { throttle } = configuration();
      expect(throttle).toEqual({ limit: 600, ttl: 60_000 });
      expect(INBOX_INGEST.limit).toBeLessThan(throttle.limit);
      expect(EVIDENCE_UPLOAD.limit).toBeLessThan(INBOX_INGEST.limit);
    } finally {
      process.env = prev;
    }
  });

  it('POST /events/inbox lleva su @Throttle', () => {
    const h = InboxController.prototype.ingest;
    expect(limitDe(h)).toBe(INBOX_INGEST.limit);
    expect(ttlDe(h)).toBe(INBOX_INGEST.ttl);
  });

  it('POST /evidence lleva su @Throttle', () => {
    const h = AttachmentsController.prototype.upload;
    expect(limitDe(h)).toBe(EVIDENCE_UPLOAD.limit);
    expect(ttlDe(h)).toBe(EVIDENCE_UPLOAD.ttl);
  });
});
