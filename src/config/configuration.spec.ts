import configuration from './configuration';

/** El mínimo que el esquema exige para poder construir la config. */
const BASE = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
  // Bytes distintos: en producción un byte repetido se rechaza.
  JWT_SECRET: Buffer.from(Array.from({ length: 32 }, (_, i) => i * 7 + 1)).toString('base64'),
};

/** Producción con lo que exige siempre (CORS_ORIGINS, #642). */
const PROD = { NODE_ENV: 'production', CORS_ORIGINS: 'https://m6.vercel.app' };

function config(extra: Record<string, string> = {}) {
  const previo = process.env;
  process.env = { ...BASE, ...extra } as NodeJS.ProcessEnv;
  try {
    return configuration();
  } finally {
    process.env = previo;
  }
}

describe('configuration — admins de bootstrap', () => {
  it('sin la variable (o vacía) no hay admins', () => {
    expect(config().bootstrapAdminUserIds).toEqual([]);
    expect(config({ M6_BOOTSTRAP_ADMIN_USER_IDS: '' }).bootstrapAdminUserIds).toEqual([]);
  });

  it('parsea la lista, tolera espacios y normaliza ceros a la izquierda', () => {
    expect(
      config({ M6_BOOTSTRAP_ADMIN_USER_IDS: '1, 042 ,9007199254740993' }).bootstrapAdminUserIds,
    ).toEqual(['1', '42', '9007199254740993']);
  });

  it.each(['abc', '1,,2', '1,', ',1', '1;2', '-1', '1.5'])('rechaza %p', (v) => {
    expect(() => config({ M6_BOOTSTRAP_ADMIN_USER_IDS: v })).toThrow(/ids numéricos/);
  });
});

describe('configuration — JWT', () => {
  it('el emisor por defecto es el de M1', () => {
    expect(config().jwt.issuer).toBe('modulo1-ciudadanos');
    expect(config({ JWT_ISSUER: 'otro' }).jwt.issuer).toBe('otro');
  });

  it('rechaza un secreto que no es base64 o tiene menos de 256 bits', () => {
    expect(() => config({ JWT_SECRET: 'un secreto con espacios' })).toThrow(/base64/);
    expect(() => config({ JWT_SECRET: Buffer.alloc(31).toString('base64') })).toThrow(/256/);
    expect(() => config({ JWT_SECRET: '' })).toThrow();
  });

  it('exige base64 estándar: rechaza base64url, largo no múltiplo de 4 y espacios o saltos', () => {
    const buf = Buffer.alloc(33, 0xfb); // 0xfb.. produce `+` y `/` en estándar
    expect(config({ JWT_SECRET: buf.toString('base64') }).jwt.secret).toBe(buf.toString('base64'));
    expect(() => config({ JWT_SECRET: buf.toString('base64url') })).toThrow(/base64/);
    expect(() =>
      config({ JWT_SECRET: Buffer.alloc(32, 7).toString('base64').slice(0, -1) }),
    ).toThrow(/largo|base64/);
    const ok = Buffer.alloc(32, 7).toString('base64');
    expect(() => config({ JWT_SECRET: ` ${ok}` })).toThrow(/base64/);
    expect(() => config({ JWT_SECRET: `${ok.slice(0, 8)}\n${ok.slice(8)}` })).toThrow(/base64/);
  });

  it('en producción rechaza secretos públicos o de un byte repetido, sin imprimirlos', () => {
    const ejemplo = 'Q0hBTkdFX01FX2xvY2FsX2Rldl9zZWNyZXRfbTZfMzJieXRlcw==';
    for (const s of [
      ejemplo,
      Buffer.alloc(32).toString('base64'),
      Buffer.alloc(32, 9).toString('base64'),
      Buffer.alloc(40, 0x41).toString('base64'),
    ]) {
      let msg = '';
      try {
        config({ ...PROD, JWT_SECRET: s });
      } catch (e) {
        msg = String(e);
      }
      expect(msg).toMatch(/JWT_SECRET no puede ser/);
      expect(msg).not.toContain(s);
    }
    // Fuera de producción el de ejemplo sigue sirviendo, y uno real pasa en producción.
    expect(config({ JWT_SECRET: ejemplo }).jwt.secret).toBe(ejemplo);
    const real = Buffer.from(Array.from({ length: 32 }, (_, i) => i * 7 + 1)).toString('base64');
    expect(config({ ...PROD, JWT_SECRET: real }).jwt.secret).toBe(real);
  });
});

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

  /** En producción, sin lista el CORS quedaría abierto a cualquier origen (#642). */
  it.each([undefined, '', '  ', ' , '])('en producción rechaza CORS_ORIGINS %p', (v) => {
    const env: Record<string, string> = { NODE_ENV: 'production' };
    if (v !== undefined) env.CORS_ORIGINS = v;
    expect(() => config(env)).toThrow(/CORS_ORIGINS es obligatoria/);
  });

  it('en producción acepta una lista y fuera de producción sigue siendo opcional', () => {
    expect(config(PROD).corsOrigins).toEqual(['https://m6.vercel.app']);
    expect(config({ NODE_ENV: 'development' }).corsOrigins).toBeUndefined();
    expect(config({ NODE_ENV: 'test', CORS_ORIGINS: '' }).corsOrigins).toEqual([]);
  });

  /** El navegador compara el Origin exacto: cualquier otra forma deja afuera al frontend. */
  it.each(['*', 'null', 'https://x.app/', 'x.app', 'https://x.app/path', 'https://a.app,*'])(
    'rechaza el formato de CORS_ORIGINS %p en cualquier entorno',
    (v) => {
      expect(() => config({ CORS_ORIGINS: v })).toThrow(/CORS_ORIGINS tiene una entrada inválida/);
      expect(() => config({ ...PROD, CORS_ORIGINS: v })).toThrow(
        /CORS_ORIGINS tiene una entrada inválida/,
      );
    },
  );

  it('el error nombra la entrada inválida', () => {
    expect(() => config({ CORS_ORIGINS: 'https://a.app,https://x.app/' })).toThrow(
      /entrada inválida \(https:\/\/x\.app\/\)/,
    );
  });

  it.each([
    ['https://M6.app', 'https://m6.app'],
    ['https://x.app:443', 'https://x.app'],
  ])('si %s parsea pero no es la forma que manda el navegador, sugiere %s', (entrada, forma) => {
    expect(() => config({ CORS_ORIGINS: entrada })).toThrow(`¿quisiste decir ${forma}?`);
  });

  it('sin forma normalizada no sugiere nada', () => {
    expect(() => config({ CORS_ORIGINS: '*' })).not.toThrow(/quisiste/);
  });

  it('en producción exige https://, fuera de producción acepta http://localhost', () => {
    expect(() => config({ ...PROD, CORS_ORIGINS: 'http://x.app' })).toThrow(
      /CORS_ORIGINS solo acepta orígenes https:\/\/, y http:\/\/x\.app no lo es/,
    );
    expect(config({ CORS_ORIGINS: 'http://localhost:3001' }).corsOrigins).toEqual([
      'http://localhost:3001',
    ]);
  });

  it.each([
    ['https://x.app', ['https://x.app']],
    ['https://a.app,https://b.app:8443', ['https://a.app', 'https://b.app:8443']],
    [' https://a.app , https://b.app:8443 ', ['https://a.app', 'https://b.app:8443']],
  ])('en producción acepta CORS_ORIGINS %p', (v, esperado) => {
    expect(config({ ...PROD, CORS_ORIGINS: v }).corsOrigins).toEqual(esperado);
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

  it('en producción rechaza el usuario guest', () => {
    expect(() => config({ ...PROD, RABBITMQ_URL: 'amqps://guest:guest@bus:5671/muni' })).toThrow(
      /guest/,
    );
  });

  it('en producción exige amqps://', () => {
    expect(() => config({ ...PROD, RABBITMQ_URL: 'amqp://m6:c@bus' })).toThrow(/amqps/);
    expect(config({ ...PROD, RABBITMQ_URL: 'amqps://m6:c@bus' }).rabbitmq.url).toBe(
      'amqps://m6:c@bus',
    );
    expect(config(PROD).rabbitmq.url).toBeUndefined();
  });

  /** Es el `sourceModule` del sobre: el Core lo limita a 60 caracteres. */
  it('rechaza un CORE_MODULE_ID vacío o de más de 60', () => {
    expect(() => config({ CORE_MODULE_ID: '' })).toThrow();
    expect(() => config({ CORE_MODULE_ID: 'x'.repeat(61) })).toThrow();
  });
});

describe('configuration — Core', () => {
  /** Hasta que M9 publique la URL de cada ambiente, la app arranca sin Core. */
  it('sin CORE_API_URL no hay Core ni hace falta el secret', () => {
    expect(config().core).toEqual({
      moduleId: 'ambiente',
      apiUrl: undefined,
      moduleSecret: undefined,
      subscriptionMaxAttempts: 4,
      registerOnBoot: true,
    });
    expect(config({ CORE_API_URL: '', CORE_MODULE_SECRET: '' }).core.apiUrl).toBeUndefined();
  });

  it('toma la URL y el secret', () => {
    expect(
      config({ CORE_API_URL: 'http://localhost:4000', CORE_MODULE_SECRET: 's3cr3t' }).core,
    ).toMatchObject({
      moduleId: 'ambiente',
      apiUrl: 'http://localhost:4000',
      moduleSecret: 's3cr3t',
    });
  });

  it('maxAttempts y el registro al arrancar se configuran', () => {
    const core = config({
      CORE_SUBSCRIPTION_MAX_ATTEMPTS: '6',
      CORE_REGISTER_ON_BOOT: 'false',
    }).core;
    expect(core.subscriptionMaxAttempts).toBe(6);
    expect(core.registerOnBoot).toBe(false);
    expect(() => config({ CORE_SUBSCRIPTION_MAX_ATTEMPTS: '0' })).toThrow();
    expect(() => config({ CORE_REGISTER_ON_BOOT: 'quizas' })).toThrow();
    expect(config({ CORE_REGISTER_ON_BOOT: ' FALSE ' }).core.registerOnBoot).toBe(false);
    expect(config({ CORE_REGISTER_ON_BOOT: '0' }).core.registerOnBoot).toBe(false);
    expect(config({ CORE_REGISTER_ON_BOOT: '1' }).core.registerOnBoot).toBe(true);
  });

  it('con CORE_API_URL exige CORE_MODULE_SECRET', () => {
    expect(() => config({ CORE_API_URL: 'https://core.app' })).toThrow(/CORE_MODULE_SECRET/);
    expect(() => config({ CORE_API_URL: 'https://core.app', CORE_MODULE_SECRET: '' })).toThrow(
      /CORE_MODULE_SECRET/,
    );
  });

  it('un secret en blanco no pasa', () => {
    expect(() => config({ CORE_API_URL: 'https://core.app', CORE_MODULE_SECRET: '   ' })).toThrow(
      /CORE_MODULE_SECRET/,
    );
    expect(() => config({ CORE_MODULE_SECRET: ' ' })).toThrow(/CORE_MODULE_SECRET/);
  });

  it('rechaza algo que no es una URL http(s)', () => {
    const conSecret = { CORE_MODULE_SECRET: 's' };
    expect(() => config({ ...conSecret, CORE_API_URL: 'core.app' })).toThrow();
    expect(() => config({ ...conSecret, CORE_API_URL: 'ftp://core.app' })).toThrow(/http/);
  });

  /** El secret viaja en el body del pedido de token. */
  it('en producción exige https://', () => {
    const prod = { ...PROD, CORE_MODULE_SECRET: 's' };
    expect(() => config({ ...prod, CORE_API_URL: 'http://core.app' })).toThrow(/https/);
    expect(config({ ...prod, CORE_API_URL: 'https://core.app' }).core.apiUrl).toBe(
      'https://core.app',
    );
  });
});

describe('configuration — catálogo de barrios local', () => {
  it('sin la variable (o vacía) no hay archivo', () => {
    expect(config().neighborhoodsCatalogFile).toBeUndefined();
    expect(config({ NEIGHBORHOODS_CATALOG_FILE: '' }).neighborhoodsCatalogFile).toBeUndefined();
  });

  it('se acepta fuera de producción y se rechaza en producción', () => {
    const ruta = 'prisma/data/m9-barrios.json';
    expect(config({ NEIGHBORHOODS_CATALOG_FILE: ruta }).neighborhoodsCatalogFile).toBe(ruta);
    expect(() => config({ ...PROD, NEIGHBORHOODS_CATALOG_FILE: ruta })).toThrow(
      /NEIGHBORHOODS_CATALOG_FILE/,
    );
  });
});

describe('configuration — M1', () => {
  it('M1_BASE_URL es opcional: ausente o vacía no hay cliente', () => {
    expect(config().m1.baseUrl).toBeUndefined();
    expect(config({ M1_BASE_URL: '' }).m1.baseUrl).toBeUndefined();
  });

  it('toma la URL y rechaza lo que no es http(s)', () => {
    expect(config({ M1_BASE_URL: 'https://m1.app' }).m1.baseUrl).toBe('https://m1.app');
    expect(() => config({ M1_BASE_URL: 'm1.app' })).toThrow();
    expect(() => config({ M1_BASE_URL: 'ftp://m1.app' })).toThrow(/http/);
  });

  it.each([
    'https://user:pass@m1.app',
    'https://m1.app/?token=x',
    'https://m1.app/#frag',
    'https://m1.app?',
    'https://m1.app#',
  ])('rechaza credenciales, query o hash: %s', (url) => {
    expect(() => config({ M1_BASE_URL: url })).toThrow();
  });

  it('en producción exige https://', () => {
    expect(() => config({ ...PROD, M1_BASE_URL: 'http://m1.app' })).toThrow(/https/);
    expect(config({ ...PROD, M1_BASE_URL: 'https://m1.app' }).m1.baseUrl).toBe('https://m1.app');
  });
});

describe('configuration — metas de los indicadores (#473, #475)', () => {
  it('por defecto son las que definió el equipo el 29/10', () => {
    expect(config().indicators).toEqual({
      minSample: 5,
      reportDeadlineBusinessDays: 5,
      targets: {
        coveragePct: 95,
        compliancePct: 90,
        resolutionBusinessDays: 5,
        schedulingDeviationPct: 10,
        landfillDiversionPct: null,
        reportsWithinDeadlinePct: 85,
        reportsOverduePct: 10,
      },
    });
  });

  it('INBOX_RETENTION_DAYS: default 180, 0 apaga la purga y vacío o negativo se rechaza', () => {
    expect(config().inboxRetentionDays).toBe(180);
    expect(config({ INBOX_RETENTION_DAYS: '0' }).inboxRetentionDays).toBe(0);
    expect(config({ INBOX_RETENTION_DAYS: '30' }).inboxRetentionDays).toBe(30);
    expect(() => config({ INBOX_RETENTION_DAYS: '' })).toThrow();
    expect(() => config({ INBOX_RETENTION_DAYS: '-1' })).toThrow();
  });

  it('se pueden cambiar por variable de entorno', () => {
    const { indicators } = config({
      INDICATORS_TARGET_COVERAGE_PCT: '97.5',
      INDICATORS_TARGET_COMPLIANCE_PCT: '92',
      INDICATORS_TARGET_RESOLUTION_BUSINESS_DAYS: '4',
      INDICATORS_TARGET_SCHEDULING_DEVIATION_PCT: '8',
      INDICATORS_TARGET_LANDFILL_DIVERSION_PCT: '30',
      INDICATORS_MIN_SAMPLE: '10',
      INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS: '3',
      INDICATORS_TARGET_REPORTS_WITHIN_DEADLINE_PCT: '90',
      INDICATORS_TARGET_REPORTS_OVERDUE_PCT: '5',
    });

    expect(indicators).toEqual({
      minSample: 10,
      reportDeadlineBusinessDays: 3,
      targets: {
        coveragePct: 97.5,
        compliancePct: 92,
        resolutionBusinessDays: 4,
        schedulingDeviationPct: 8,
        landfillDiversionPct: 30,
        reportsWithinDeadlinePct: 90,
        reportsOverduePct: 5,
      },
    });
  });

  it('la meta del relleno vacía cuenta como no definida', () => {
    expect(
      config({ INDICATORS_TARGET_LANDFILL_DIVERSION_PCT: '' }).indicators.targets
        .landfillDiversionPct,
    ).toBeNull();
  });

  it.each([
    ['INDICATORS_TARGET_COVERAGE_PCT', '101'],
    ['INDICATORS_TARGET_COVERAGE_PCT', '-1'],
    ['INDICATORS_TARGET_COMPLIANCE_PCT', 'abc'],
    ['INDICATORS_TARGET_SCHEDULING_DEVIATION_PCT', '150'],
    ['INDICATORS_TARGET_LANDFILL_DIVERSION_PCT', '120'],
    ['INDICATORS_TARGET_RESOLUTION_BUSINESS_DAYS', '0'],
    ['INDICATORS_MIN_SAMPLE', '0'],
    ['INDICATORS_MIN_SAMPLE', '2.5'],
    ['INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS', '0'],
    ['INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS', '-3'],
    ['INDICATORS_REPORT_DEADLINE_BUSINESS_DAYS', 'cinco'],
    ['INDICATORS_TARGET_REPORTS_WITHIN_DEADLINE_PCT', '101'],
    ['INDICATORS_TARGET_REPORTS_WITHIN_DEADLINE_PCT', '-1'],
    ['INDICATORS_TARGET_REPORTS_OVERDUE_PCT', '150'],
    ['INDICATORS_TARGET_REPORTS_OVERDUE_PCT', 'abc'],
  ])('rechaza %s=%p', (nombre, valor) => {
    expect(() => config({ [nombre]: valor })).toThrow();
  });
});

describe('configuration — BFF_SHARED_KEY', () => {
  it('sin la variable (o vacía) no hay clave: el throttler no confía en el header', () => {
    expect(config().bffSharedKey).toBeUndefined();
    expect(config({ BFF_SHARED_KEY: '' }).bffSharedKey).toBeUndefined();
  });

  it('acepta una clave de 32 caracteres o más y rechaza una más corta', () => {
    expect(config({ BFF_SHARED_KEY: 'a'.repeat(32) }).bffSharedKey).toBe('a'.repeat(32));
    expect(() => config({ BFF_SHARED_KEY: 'a'.repeat(31) })).toThrow(/BFF_SHARED_KEY/);
  });
});
