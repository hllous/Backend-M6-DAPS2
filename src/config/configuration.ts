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
      expirationSeconds: parsed.JWT_EXPIRATION,
    },
    sanctionDeadlineDays: parsed.SANCTION_DEADLINE_DAYS,
    kafka: {
      brokers: parsed.KAFKA_BROKERS,
      clientId: parsed.KAFKA_CLIENT_ID,
      groupId: parsed.KAFKA_GROUP_ID,
    },
    r2: {
      accountId: parsed.R2_ACCOUNT_ID,
      accessKeyId: parsed.R2_ACCESS_KEY_ID,
      secretAccessKey: parsed.R2_SECRET_ACCESS_KEY,
      bucket: parsed.R2_BUCKET,
      publicUrlBase: parsed.R2_PUBLIC_URL_BASE,
    },
  };
};
