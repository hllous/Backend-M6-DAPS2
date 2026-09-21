/**
 * Infraestructura común de los e2e.
 *
 * Los e2e corren contra un Postgres de verdad y **truncan todas las tablas**
 * entre suites, así que lo primero que hace este módulo es negarse a arrancar
 * si `DATABASE_URL` no apunta a una base local. Sin ese guard, un
 * `npm run test:e2e` sin variables de entorno tomaría el `.env` del repo —que
 * apunta a la base desplegada— y la vaciaría.
 */
import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { OutboxEventStatus } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { OutboxDispatcher } from '../src/events/outbox/outbox-dispatcher.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { assertBaseLocal } from './guard-database-url';

assertBaseLocal(process.env.DATABASE_URL);

// Asignacion incondicional, no '??=': el import de AppModule (arriba) ya evaluo
// ConfigModule.forRoot(), que volco el .env del repo a process.env. Con '??=' los
// e2e locales firmaban con el secreto del entorno desplegado, o sea que cada
// corrida acunaba bearers validos contra la API real. El secreto solo tiene que
// coincidir consigo mismo: lo usan tokenFor() y la JwtStrategy en este proceso.
process.env.JWT_SECRET = 'e2e-jwt-secret-sin-valor-real';
process.env.NODE_ENV ??= 'test';

const jwt = new JwtService({ secret: process.env.JWT_SECRET });

/** Un token HS256 con los claims que espera `JwtStrategy`: `sub` y `roles`. */
export function tokenFor(roles: string[] = [], sub = 'e2e-user'): string {
  return jwt.sign({ sub, roles }, { expiresIn: '1h' });
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

/**
 * El dispatcher real barre el outbox cada 10 s con `@Interval`. En un e2e eso
 * son consultas contra la base durante toda la corrida y un timer que Jest ve
 * como handle abierto, además de vaciar la cola que las suites verifican.
 */
const outboxDispatcherStub: Pick<OutboxDispatcher, 'dispatchPending' | 'dispatchOne' | 'stats'> = {
  dispatchPending: async () => undefined,
  dispatchOne: async () => undefined,
  stats: async () => ({
    [OutboxEventStatus.PENDING]: 0,
    [OutboxEventStatus.SENT]: 0,
    [OutboxEventStatus.FAILED]: 0,
  }),
};

/** La app completa, con la misma configuración que `main.ts`. Cerrarla con `app.close()`. */
export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(OutboxDispatcher)
    .useValue(outboxDispatcherStub)
    .compile();

  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>());
  await app.init();
  return app;
}

/**
 * Deja la base vacía. Un solo TRUNCATE con CASCADE: enumerar las tablas en
 * orden de FK sería una lista que hay que mantener a mano cada vez que alguien
 * agrega un modelo.
 */
export async function truncateAll(prisma: PrismaService): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;

  const lista = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`);
}

// ─── Datos por suite ────────────────────────────────
// Lo mínimo para que un caso corra. El seed de prisma/ no se usa: arma un
// escenario de demo entero y ata los tests a datos que no controlan.

let contador = 0;
/** Códigos únicos dentro de la corrida: `code` es @unique en casi todo catálogo. */
export function unique(prefijo: string): string {
  contador += 1;
  return `${prefijo}-${contador.toString().padStart(4, '0')}`;
}

/** Cliente HTTP autenticado contra la app, para no repetir el header en cada pedido. */
export class Api {
  constructor(
    private readonly app: NestExpressApplication,
    private readonly token: string,
  ) {}

  post(path: string, body?: unknown) {
    return request(this.app.getHttpServer())
      .post(path)
      .set(bearer(this.token))
      .send(body ?? {});
  }

  put(path: string, body?: unknown) {
    return request(this.app.getHttpServer())
      .put(path)
      .set(bearer(this.token))
      .send(body ?? {});
  }

  patch(path: string, body?: unknown) {
    return request(this.app.getHttpServer())
      .patch(path)
      .set(bearer(this.token))
      .send(body ?? {});
  }

  get(path: string) {
    return request(this.app.getHttpServer()).get(path).set(bearer(this.token));
  }
}

export async function crearZona(api: Api): Promise<{ id: string; code: string }> {
  const code = unique('ZN');
  const res = await api.post('/zones', { code, name: `Zona ${code}` }).expect(201);
  return res.body;
}

export async function crearRuta(api: Api, zoneIds: string[]): Promise<{ id: string }> {
  const code = unique('RT');
  const res = await api.post('/routes', { code, name: `Recorrido ${code}` }).expect(201);
  await api
    .put(`/routes/${res.body.id}/stops`, {
      stops: zoneIds.map((zoneId) => ({ zoneId, estimatedDurationMin: 60 })),
    })
    .expect(200);
  return res.body;
}

export async function crearTipoServicio(
  api: Api,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; code: string }> {
  const code = unique('TS');
  const res = await api
    .post('/service-types', {
      code,
      name: `Tipo ${code}`,
      category: 'WASTE_COLLECTION',
      mode: 'ROUTE',
      ...overrides,
    })
    .expect(201);
  return res.body;
}

export async function crearCuadrilla(api: Api): Promise<{ id: string }> {
  const res = await api
    .post('/crews', {
      name: `Cuadrilla ${unique('CR')}`,
      crewType: 'MUNICIPAL',
      defaultShift: 'MORNING',
    })
    .expect(201);
  return res.body;
}

export async function crearContenedor(api: Api, zoneId: string): Promise<{ id: string }> {
  const code = unique('CT');
  const res = await api
    .post('/containers', {
      code,
      containerType: 'HOUSEHOLD',
      zoneId,
      capacityLiters: 1100,
      address: 'Av. Siempre Viva 742',
    })
    .expect(201);
  return res.body;
}

/** Hoy en formato YYYY-MM-DD, que es lo que aceptan los `scheduledDate`. */
export function hoy(): string {
  return new Date().toISOString().slice(0, 10);
}
