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

  // RabbitMQ — sujeto a confirmación de M9
  // RABBITMQ_URL: z.string().url().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;
