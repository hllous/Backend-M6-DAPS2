import { z } from 'zod';

export const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT — placeholder hasta que M9 defina el claim set
  JWT_SECRET: z.string().min(8),
  JWT_EXPIRATION: z.coerce.number().default(3600),

  // Plazo que le damos a M4 para resolver un acta antes de cerrar el
  // expediente por vencimiento. Ver ReportDeadlineSweeper.
  SANCTION_DEADLINE_DAYS: z.coerce.number().int().positive().default(30),

  // Kafka — el transporte confirmado por M9, pero todavía sin broker expuesto.
  // Si KAFKA_BROKERS no está, los eventos se encolan en el outbox y se
  // registran en el log; la app arranca igual. Ver src/events/events.module.ts.
  KAFKA_BROKERS: z.string().optional(),
  KAFKA_CLIENT_ID: z.string().default('m6-ambiente'),
  KAFKA_GROUP_ID: z.string().default('m6-ambiente-group'),

  // Cloudflare R2 (S3-compatible) para evidencia/adjuntos — Issue #64.
  // Opcionales: sin credenciales la app arranca igual, pero POST /evidence
  // falla al subir. Ver src/modules/attachments/storage/r2-evidence-storage.service.ts.
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL_BASE: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;
