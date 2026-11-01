import { envSchema } from './env.validation';

export default () => {
  const parsed = envSchema.parse(process.env);
  return {
    port: parsed.PORT,
    nodeEnv: parsed.NODE_ENV,
    database: {
      url: parsed.DATABASE_URL,
    },
    jwt: {
      secret: parsed.JWT_SECRET,
      issuer: parsed.JWT_ISSUER,
    },
    // Ids como string, sin ceros a la izquierda ('007' y '7' son el mismo `sub` de M1).
    bootstrapAdminUserIds: (parsed.M6_BOOTSTRAP_ADMIN_USER_IDS?.split(',') ?? []).map((id) =>
      BigInt(id.trim()).toString(),
    ),
    sanctionDeadlineDays: parsed.SANCTION_DEADLINE_DAYS,
    indicators: {
      minSample: parsed.INDICATORS_MIN_SAMPLE,
      reportDeadlineBusinessDays: parsed.INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS,
      targets: {
        coveragePct: parsed.INDICATORS_TARGET_COVERAGE_PCT,
        compliancePct: parsed.INDICATORS_TARGET_COMPLIANCE_PCT,
        resolutionBusinessDays: parsed.INDICATORS_TARGET_RESOLUTION_BUSINESS_DAYS,
        schedulingDeviationPct: parsed.INDICATORS_TARGET_SCHEDULING_DEVIATION_PCT,
        landfillDiversionPct: parsed.INDICATORS_TARGET_LANDFILL_DIVERSION_PCT ?? null,
        reportsWithinDeadlinePct: parsed.INDICATORS_TARGET_REPORTS_WITHIN_DEADLINE_PCT,
        reportsOverduePct: parsed.INDICATORS_TARGET_REPORTS_OVERDUE_PCT,
      },
    },
    rabbitmq: {
      url: parsed.RABBITMQ_URL,
      exchange: parsed.RABBITMQ_EXCHANGE,
      queue: parsed.RABBITMQ_QUEUE,
      prefetch: parsed.RABBITMQ_PREFETCH,
    },
    core: {
      moduleId: parsed.CORE_MODULE_ID,
      apiUrl: parsed.CORE_API_URL,
      moduleSecret: parsed.CORE_MODULE_SECRET,
      subscriptionMaxAttempts: parsed.CORE_SUBSCRIPTION_MAX_ATTEMPTS,
      registerOnBoot: parsed.CORE_REGISTER_ON_BOOT,
    },
    corsOrigins: parsed.CORS_ORIGINS?.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    r2: {
      accountId: parsed.R2_ACCOUNT_ID,
      accessKeyId: parsed.R2_ACCESS_KEY_ID,
      secretAccessKey: parsed.R2_SECRET_ACCESS_KEY,
      bucket: parsed.R2_BUCKET,
      publicUrlBase: parsed.R2_PUBLIC_URL_BASE,
    },
  };
};
