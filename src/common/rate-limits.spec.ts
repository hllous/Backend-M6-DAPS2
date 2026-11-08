import configuration from '../config/configuration';
import { EVIDENCE_UPLOAD, INBOX_INGEST } from './rate-limits';

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
});
