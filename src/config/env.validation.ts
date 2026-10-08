import { z } from 'zod';

/**
 * Una URL AMQP que se pueda loguear sin filtrar la clave. Si la clave trae `/`,
 * `?`, `#` o `@` sin percent-encoding, el parser corta la userinfo en otro lado
 * y el resto de la clave queda en el path o el query, que `brokerHost()` sí
 * loguea. El `@` fuera de la userinfo es la señal.
 */
function validarUrlAmqp(value: string, ctx: z.RefinementCtx): void {
  let url: URL;
  try {
    url = new URL(value);
    if (!url.hostname) throw new Error('sin host');
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'RABBITMQ_URL no es una URL válida' });
    return;
  }
  if (url.protocol !== 'amqp:' && url.protocol !== 'amqps:') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'RABBITMQ_URL debe empezar con amqp:// o amqps://',
    });
  }
  if (`${url.pathname}${url.search}${url.hash}`.includes('@')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'RABBITMQ_URL: la clave tiene caracteres especiales sin percent-encoding (/ ? # @)',
    });
  }
}

export const envSchema = z
  .object({
    // Server
    PORT: z.coerce.number().default(3000),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

    // Database
    DATABASE_URL: z.string().url(),

    // Origenes que pueden llamar a la API desde un navegador, separados por
    // coma. Sin la variable se aceptan todos, que es lo que hace falta en
    // desarrollo. El JWT viaja en un header y no en una cookie, asi que esto no
    // cierra un CSRF: es higiene, no un limite de seguridad.
    CORS_ORIGINS: z.string().optional(),

    // JWT — placeholder hasta que M1 publique su contrato de firma y claims
    JWT_SECRET: z.string().min(8),
    JWT_EXPIRATION: z.coerce.number().default(3600),

    // Plazo que le damos a M4 para resolver un acta antes de cerrar el
    // expediente por vencimiento. Ver ReportDeadlineSweeper.
    SANCTION_DEADLINE_DAYS: z.coerce.number().int().positive().default(30),

    // RabbitMQ — el bus del Core (M9). Sin RABBITMQ_URL los eventos se encolan
    // en el outbox y se registran en el log, no hay consumidor, y la app arranca
    // igual. Exchange y cola los crea el Core: M6 solo los verifica en modo
    // pasivo, así que los nombres tienen que coincidir con los suyos. Ver ADR-006
    // y el contrato de M9 en docs/bloqueantes.md.
    // Vacía cuenta como ausente: un `RABBITMQ_URL=` en el panel no debe tumbar el arranque.
    RABBITMQ_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().superRefine(validarUrlAmqp).optional(),
    ),
    // Donde publican todos los módulos (fanout): el Core rutea por suscripción.
    RABBITMQ_EXCHANGE: z.string().min(1).default('muni.inbox'),
    // La cola de M6, que el Core crea al registrar nuestras suscripciones.
    RABBITMQ_QUEUE: z.string().min(1).default('q.ambiente'),
    // 1 = de a un mensaje. El orden igual no está garantizado (un reintento del
    // Core vuelve después de los que venían atrás), pero no lo empeoramos.
    RABBITMQ_PREFETCH: z.coerce.number().int().positive().default(1),

    // Identificador de M6 ante el Core: va como `sourceModule` en el sobre y
    // tiene que coincidir con el módulo del token, o el Core responde 403.
    CORE_MODULE_ID: z.string().min(1).max(60).default('ambiente'),

    // Cloudflare R2 (S3-compatible) para evidencia/adjuntos — Issue #64.
    // Opcionales: sin credenciales la app arranca igual, pero POST /evidence
    // falla al subir. Ver src/modules/attachments/storage/r2-evidence.storage.ts.
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET: z.string().optional(),
    R2_PUBLIC_URL_BASE: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    // En producción la clave no viaja en claro.
    if (env.NODE_ENV === 'production' && /^amqp:/i.test(env.RABBITMQ_URL ?? '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RABBITMQ_URL'],
        message: 'En producción RABBITMQ_URL tiene que ser amqps://',
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;
