import { z } from 'zod';

export const envSchema = z.object({
  // Server
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database
  DATABASE_URL: z.string().url(),

  // JWT — placeholder hasta que M1 publique su contrato de firma y claims
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
});

export type EnvConfig = z.infer<typeof envSchema>;
