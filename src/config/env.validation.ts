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

  // Kafka — confirmado por M9
  // KAFKA_BROKERS: z.string().optional(),
  // KAFKA_CLIENT_ID: z.string().optional(),
  // KAFKA_GROUP_ID: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;
