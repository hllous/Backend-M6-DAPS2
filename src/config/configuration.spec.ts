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
