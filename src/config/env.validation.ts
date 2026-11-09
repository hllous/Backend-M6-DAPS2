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

/** Valor del .env.example: público, así que en producción no protege nada. */
const JWT_SECRET_EJEMPLO = 'Q0hBTkdFX01FX2xvY2FsX2Rldl9zZWNyZXRfbTZfMzJieXRlcw==';

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

    // JWT de M1: HMAC (HS256, HS384 o HS512) con la clave simétrica compartida (`APP_JWT_SECRET` de M1),
    // en BASE64 y de al menos 256 bits. Nunca en el repo.
    JWT_SECRET: z
      .string()
      // Base64 estándar (no base64url) y con relleno completo: es lo que decodifica M1.
      .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'JWT_SECRET tiene que estar en base64 estándar')
      .refine((v) => v.length % 4 === 0, 'JWT_SECRET: largo inválido para base64')
      .refine(
        (v) => Buffer.from(v, 'base64').length >= 32,
        'JWT_SECRET: mínimo 256 bits (32 bytes)',
      ),
    // `iss` que exigimos en el token.
    JWT_ISSUER: z.string().min(1).default('modulo1-ciudadanos'),

    // Secreto compartido con el BFF del frontend (header `X-M6-BFF-Key`). Con él
    // el límite de tasa del portal cuenta la IP del vecino que reenvía el BFF en
    // `X-Forwarded-For`; sin él, o con otro valor, cuenta `req.ip`. Vacía cuenta
    // como ausente. Mínimo 32 caracteres: es un secreto, no una etiqueta (#470).
    BFF_SHARED_KEY: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().trim().min(32, 'BFF_SHARED_KEY: mínimo 32 caracteres').optional(),
    ),

    // Límite de tasa global por IP (y por endpoint) para todo lo autenticado. Generoso a
    // propósito: frena abuso y fuerza bruta, no el uso normal de un operador (#568).
    THROTTLE_LIMIT: z.coerce.number().int().min(1).default(600),
    THROTTLE_TTL_MS: z.coerce.number().int().min(1000).default(60_000),

    // Ids de M1 (`sub`, numéricos) de los M6_ADMIN iniciales, separados por coma.
    // Sin ellos nadie puede asignar roles (ADR-008). Además necesitan el rol
    // RESPONSABLE_AREA en M1. Vacía cuenta como ausente.
    M6_BOOTSTRAP_ADMIN_USER_IDS: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .string()
        .regex(
          /^\s*\d{1,20}(\s*,\s*\d{1,20})*\s*$/,
          'M6_BOOTSTRAP_ADMIN_USER_IDS: lista de ids numéricos separados por coma',
        )
        .optional(),
    ),

    // Plazo que le damos a M4 para resolver un acta antes de cerrar el
    // expediente por vencimiento. Ver ReportDeadlineSweeper.
    SANCTION_DEADLINE_DAYS: z.coerce.number().int().positive().default(30),

    // Metas del tablero de indicadores (docs/api/endpoints.md, sección indicators).
    // Los valores por defecto son los que definió el equipo el 29/10 (#461).
    INDICATORS_TARGET_COVERAGE_PCT: z.coerce.number().min(0).max(100).default(95),
    INDICATORS_TARGET_COMPLIANCE_PCT: z.coerce.number().min(0).max(100).default(90),
    // Días hábiles (lunes a viernes) entre el alta y el cierre de la denuncia.
    INDICATORS_TARGET_RESOLUTION_BUSINESS_DAYS: z.coerce.number().positive().default(5),
    INDICATORS_TARGET_SCHEDULING_DEVIATION_PCT: z.coerce.number().min(0).max(100).default(10),
    // Sin meta acordada todavía: vacía o ausente = no hay meta (el tablero no la dibuja).
    INDICATORS_TARGET_LANDFILL_DIVERSION_PCT: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.coerce.number().min(0).max(100).optional(),
    ),
    // Plazo objetivo de resolución de una denuncia, en días hábiles (#475). Es un
    // plazo único para todos los tipos: supuesto de M6 hasta que M2 acuerde el
    // suyo. Lo comparten "resueltos dentro del plazo" y "pendientes vencidos".
    INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS: z.coerce.number().positive().default(5),
    // Resueltos dentro del plazo ÷ resueltos: se cumple con ≥ 85 %.
    INDICATORS_TARGET_REPORTS_WITHIN_DEADLINE_PCT: z.coerce.number().min(0).max(100).default(85),
    // Abiertos que superaron el plazo ÷ abiertos: se cumple con ≤ 10 %.
    INDICATORS_TARGET_REPORTS_OVERDUE_PCT: z.coerce.number().min(0).max(100).default(10),
    // Debajo de esta cantidad de programados el porcentaje de una zona o tipo de
    // servicio se marca `lowSample`: 2 de 2 no es un 100 % que merezca festejo.
    INDICATORS_MIN_SAMPLE: z.coerce.number().int().positive().default(5),

    // RabbitMQ — el bus del Core (M9). Sin RABBITMQ_URL los eventos se encolan
    // en el outbox y se registran en el log, no hay consumidor, y la app arranca
    // igual. Exchange y cola los crea el Core: M6 solo los verifica en modo
    // pasivo, así que los nombres tienen que coincidir con los suyos. Ver ADR-006
    // y la issue #257.
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

    // Días que se conserva una fila procesada de `inbox_event` antes de purgarla.
    // 0 = no purgar nunca. Pasado el plazo, un reenvío del mismo eventId ya no se
    // detecta como duplicado. Las filas pendientes o fallidas no se tocan.
    // Vacía es inválida: Number('') es 0 y apagaría la purga sin avisar.
    INBOX_RETENTION_DAYS: z.preprocess(
      (v) => (v === '' ? NaN : v),
      z.coerce.number().int().min(0).default(180),
    ),

    // Identificador de M6 ante el Core: va como `sourceModule` en el sobre y
    // tiene que coincidir con el módulo del token, o el Core responde 403.
    CORE_MODULE_ID: z.string().min(1).max(60).default('ambiente'),
    // API REST del Core (catálogo, auditoría, DLQ). Opcional hasta que M9
    // publique la URL de cada ambiente: sin ella el CoreClient queda
    // deshabilitado y la app arranca igual. Vacía cuenta como ausente.
    CORE_API_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .string()
        .url()
        .refine((v) => /^https?:\/\//i.test(v), 'CORE_API_URL debe empezar con http:// o https://')
        .optional(),
    ),
    // Catálogo de barrios desde un JSON (local y CI, donde no hay M9). Vacía cuenta
    // como ausente. Prohibida en producción: ahí el catálogo es el real o no hay.
    NEIGHBORHOODS_CATALOG_FILE: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().min(1).optional(),
    ),
    // URL de M1 para consultas de identidad (ADR-009). Opcional: sin ella el
    // cliente queda deshabilitado. Vacía cuenta como ausente. Va el Bearer del
    // Core, por eso en producción tiene que ser https.
    M1_BASE_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z
        .string()
        .url()
        .refine((v) => /^https?:\/\//i.test(v), 'M1_BASE_URL debe empezar con http:// o https://')
        // El Bearer del Core viaja a esta URL: nada de credenciales, query ni hash.
        .refine((v) => {
          const u = new URL(v);
          return !u.username && !u.password && !/[?#]/.test(v);
        }, 'M1_BASE_URL no puede llevar credenciales, query ni hash')
        .optional(),
    ),
    // Secret de máquina con el que pedimos el token de módulo. Lo entrega M9;
    // nunca se loguea ni va en un mensaje de error. Uno en blanco ("  ") no
    // pasa; largo mínimo no se exige porque M9 no lo fijó.
    CORE_MODULE_SECRET: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().trim().min(1).optional(),
    ),

    // Registro en el catálogo del Core (src/core/core-registry.service.ts).
    // 4 = la cadena de reintentos de la guía común del Core: cuatro intentos totales.
    CORE_SUBSCRIPTION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(4),
    // 'false' apaga la sincronización al arrancar (el script core:register sigue andando).
    CORE_REGISTER_ON_BOOT: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(['true', 'false', '1', '0']))
      .default('true')
      .transform((v) => v === 'true' || v === '1'),

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
    // Secretos que están en el repo (ejemplo, tests, openapi: Buffer.alloc(32[, 9]))
    // o cualquiera de un solo byte repetido. El mensaje no imprime el valor.
    if (env.NODE_ENV === 'production') {
      const bytes = Buffer.from(env.JWT_SECRET, 'base64');
      if (env.JWT_SECRET === JWT_SECRET_EJEMPLO || bytes.every((b) => b === bytes[0])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRET'],
          message:
            'En producción JWT_SECRET no puede ser un valor de ejemplo ni de un byte repetido: usar el de M1',
        });
      }
    }
    // En producción la clave no viaja en claro.
    if (env.NODE_ENV === 'production' && /^amqp:/i.test(env.RABBITMQ_URL ?? '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RABBITMQ_URL'],
        message: 'En producción RABBITMQ_URL tiene que ser amqps://',
      });
    }
    // M9 va a verificar el usuario AMQP contra el sourceModule: guest no es un módulo.
    if (
      env.NODE_ENV === 'production' &&
      env.RABBITMQ_URL &&
      /^guest$/i.test(new URL(env.RABBITMQ_URL).username)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RABBITMQ_URL'],
        message: 'En producción RABBITMQ_URL no puede usar el usuario guest',
      });
    }
    // El secret viaja en el body del pedido de token.
    if (env.NODE_ENV === 'production' && /^http:/i.test(env.CORE_API_URL ?? '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORE_API_URL'],
        message: 'En producción CORE_API_URL tiene que ser https://',
      });
    }
    if (env.NODE_ENV === 'production' && /^http:/i.test(env.M1_BASE_URL ?? '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['M1_BASE_URL'],
        message: 'En producción M1_BASE_URL tiene que ser https://',
      });
    }
    if (env.NODE_ENV === 'production' && env.NEIGHBORHOODS_CATALOG_FILE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['NEIGHBORHOODS_CATALOG_FILE'],
        message:
          'NEIGHBORHOODS_CATALOG_FILE es solo para local y CI: en producción el catálogo es el de M9',
      });
    }
    if (env.CORE_API_URL && !env.CORE_MODULE_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORE_MODULE_SECRET'],
        message: 'Con CORE_API_URL hace falta CORE_MODULE_SECRET para pedir el token de módulo',
      });
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;
