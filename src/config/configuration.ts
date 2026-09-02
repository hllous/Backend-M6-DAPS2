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
    kafka: {
      brokers: parsed.KAFKA_BROKERS,
      clientId: parsed.KAFKA_CLIENT_ID,
      groupId: parsed.KAFKA_GROUP_ID,
    },
  };
};
