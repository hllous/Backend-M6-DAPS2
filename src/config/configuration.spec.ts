import configuration from './configuration';

/** El mínimo que el esquema exige para poder construir la config. */
const BASE = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  JWT_SECRET: 'un-secreto-de-desarrollo',
};

function config(extra: Record<string, string> = {}) {
  const previo = process.env;
  process.env = { ...BASE, ...extra } as NodeJS.ProcessEnv;
  try {
    return configuration();
  } finally {
    process.env = previo;
  }
}

describe('configuration — CORS', () => {
  /**
   * Es lo que veníamos haciendo y lo que hace falta en desarrollo: si la
   * variable no está, la API no se cierra sola.
   */
  it('sin CORS_ORIGINS no hay lista: se aceptan todos', () => {
    expect(config().corsOrigins).toBeUndefined();
  });

  it('parte la lista por coma', () => {
    expect(
      config({ CORS_ORIGINS: 'https://a.vercel.app,https://b.vercel.app' }).corsOrigins,
    ).toEqual(['https://a.vercel.app', 'https://b.vercel.app']);
  });

  /** Una variable de entorno pegada a mano suele venir con espacios. */
  it('tolera espacios alrededor de cada origen', () => {
    expect(config({ CORS_ORIGINS: ' https://a.app , https://b.app ' }).corsOrigins).toEqual([
      'https://a.app',
      'https://b.app',
    ]);
  });

  /**
   * Una coma de más dejaría un origen vacío en la lista, y una lista con un
   * elemento vacío no es lo mismo que no tener lista.
   */
  it('descarta los vacíos que deja una coma de más', () => {
    expect(config({ CORS_ORIGINS: 'https://a.app,,' }).corsOrigins).toEqual(['https://a.app']);
  });

  it('una lista vacía no restringe nada', () => {
    expect(config({ CORS_ORIGINS: '  ,  ' }).corsOrigins).toEqual([]);
  });
});

describe('configuration — RabbitMQ', () => {
  it('sin RABBITMQ_URL no hay bus, y los nombres son los del Core', () => {
    expect(config().rabbitmq).toEqual({
      url: undefined,
      exchange: 'muni.inbox',
      queue: 'q.ambiente',
      prefetch: 1,
    });
    expect(config().core.moduleId).toBe('ambiente');
  });

  /** Un `RABBITMQ_URL=` vacío en el panel de Render no debe tumbar el arranque. */
  it('una URL vacía cuenta como ausente', () => {
    expect(config({ RABBITMQ_URL: '' }).rabbitmq.url).toBeUndefined();
  });

  it('toma la URL y los overrides', () => {
    expect(
      config({
        RABBITMQ_URL: 'amqps://m6:clave@bus:5671/muni',
        RABBITMQ_QUEUE: 'q.otra',
        RABBITMQ_PREFETCH: '5',
      }).rabbitmq,
    ).toEqual(
      expect.objectContaining({
        url: 'amqps://m6:clave@bus:5671/muni',
        queue: 'q.otra',
        prefetch: 5,
      }),
    );
  });

  it('rechaza una URL que no es amqp:// ni amqps://', () => {
    expect(() => config({ RABBITMQ_URL: 'http://bus:5672' })).toThrow();
  });

  it('rechaza algo que no es una URL', () => {
    expect(() => config({ RABBITMQ_URL: 'amqp://' })).toThrow(/no es una URL/);
    expect(() => config({ RABBITMQ_URL: 'bus:5672' })).toThrow();
  });

  /** Una clave con `/` sin encodear corre el `@` al path, y el path se loguea. */
  it('rechaza una clave con caracteres especiales sin percent-encoding', () => {
    expect(() => config({ RABBITMQ_URL: 'amqp://m6:12/secreto@bus:5672/muni' })).toThrow(
      /percent-encoding/,
    );
    expect(config({ RABBITMQ_URL: 'amqp://m6:12%2Fsecreto@bus:5672/muni' }).rabbitmq.url).toBe(
      'amqp://m6:12%2Fsecreto@bus:5672/muni',
    );
  });

  it('en producción exige amqps://', () => {
    expect(() => config({ NODE_ENV: 'production', RABBITMQ_URL: 'amqp://m6:c@bus' })).toThrow(
      /amqps/,
    );
    expect(config({ NODE_ENV: 'production', RABBITMQ_URL: 'amqps://m6:c@bus' }).rabbitmq.url).toBe(
      'amqps://m6:c@bus',
    );
    expect(config({ NODE_ENV: 'production' }).rabbitmq.url).toBeUndefined();
  });

  /** Es el `sourceModule` del sobre: el Core lo limita a 60 caracteres. */
  it('rechaza un CORE_MODULE_ID vacío o de más de 60', () => {
    expect(() => config({ CORE_MODULE_ID: '' })).toThrow();
    expect(() => config({ CORE_MODULE_ID: 'x'.repeat(61) })).toThrow();
  });
});
