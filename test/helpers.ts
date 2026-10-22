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
import { M6Role, OutboxEventStatus } from '@prisma/client';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { listRoutes, RouteRoles } from '../src/auth/route-roles';
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
const E2E_SECRET = Buffer.alloc(32, 9);
process.env.JWT_SECRET = E2E_SECRET.toString('base64');
process.env.JWT_ISSUER = 'modulo1-ciudadanos';
process.env.NODE_ENV ??= 'test';

// Como M1: la clave se usa decodificada de base64.
const jwt = new JwtService({ secret: E2E_SECRET });

/** Un access token con el contrato de M1: `iss`, `typ`, `sub` numérico, `sub_type` y `rol` único. */
export function tokenFor(
  rol = 'ADMINISTRATIVO',
  sub = '1',
  subType: 'EMPLEADO' | 'CIUDADANO' = 'EMPLEADO',
): string {
  return jwt.sign(
    { sub, sub_type: subType, rol, typ: 'access' },
    { expiresIn: '15m', issuer: process.env.JWT_ISSUER },
  );
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
  // role_assignment_audit tiene un trigger que prohíbe TRUNCATE (append-only).
  // `replica` lo salta, pero solo en esta transacción (SET LOCAL) y pide
  // superusuario: lo es el usuario del contenedor de los e2e y el del CI.
  await prisma.$transaction([
    prisma.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`),
    prisma.$executeRawUnsafe(`TRUNCATE TABLE ${lista} RESTART IDENTITY CASCADE`),
  ]);
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

// ─── Roles de M6 ─────────────────────────────────────
// Con el RolesGuard global, un token sin filas en user_role_assignment recibe 403
// en todo. Un usuario real tiene UN grupo (Oficina y Campo no conviven, ADR-005),
// así que los flujos que cruzan grupos (alta de catálogo -> programar -> ejecutar)
// necesitan varios actores.

export type Actor = 'admin' | 'operaciones' | 'ambiental' | 'cuadrilla' | 'inspector' | 'auditor';

/** Rol de M1 que admite el rol de M6 de cada actor (ver M1RoleAdapter). */
export const ACTORES: Record<Actor, { userId: string; m1Role: string; role: M6Role }> = {
  admin: { userId: '9001', m1Role: 'RESPONSABLE_AREA', role: M6Role.M6_ADMIN },
  operaciones: { userId: '9002', m1Role: 'ADMINISTRATIVO', role: M6Role.M6_OFICINA_OPERACIONES },
  ambiental: { userId: '9003', m1Role: 'ADMINISTRATIVO', role: M6Role.M6_OFICINA_AMBIENTAL },
  cuadrilla: { userId: '9004', m1Role: 'ADMINISTRATIVO', role: M6Role.M6_CAMPO_CUADRILLA },
  inspector: { userId: '9005', m1Role: 'ADMINISTRATIVO', role: M6Role.M6_CAMPO_INSPECTOR },
  auditor: { userId: '9006', m1Role: 'AUDITOR', role: M6Role.M6_AUDITOR },
};

/** Escribe filas en user_role_assignment (lo que haría un M6_ADMIN con PUT /role-assignments). */
export async function grantRoles(
  prisma: PrismaService,
  userId: string,
  roles: M6Role[],
): Promise<void> {
  await prisma.userRoleAssignment.createMany({
    data: roles.map((role) => ({ userId, role })),
    skipDuplicates: true,
  });
}

/** Un usuario por rol, listos para `Api.porRol`. `truncateAll` borra las filas: sembrar después. */
export async function seedActores(prisma: PrismaService): Promise<void> {
  for (const a of Object.values(ACTORES)) await grantRoles(prisma, a.userId, [a.role]);
}

export function tokenDe(actor: Actor): string {
  const a = ACTORES[actor];
  return tokenFor(a.m1Role, a.userId);
}

let rutas: (RouteRoles & { re: RegExp })[] | undefined;
/** El actor que puede llamar a método+ruta, según la metadata de @Roles (el auditor nunca escribe). */
function actorPara(method: string, path: string): Actor {
  rutas ??= listRoutes(AppModule).map((r) => ({
    ...r,
    re: new RegExp(`^${r.path.replace(/:[^/]+/g, '[^/]+')}$`),
  }));
  const pathname = path.split('?')[0];
  const ruta = rutas.find((r) => r.method === method && r.re.test(pathname));
  if (!ruta?.roles?.length) return 'admin';
  // Prefiere admin; si no, el primero de Oficina/Campo que figure.
  const orden: Actor[] = ['admin', 'operaciones', 'ambiental', 'cuadrilla', 'inspector'];
  return orden.find((a) => ruta.roles?.includes(ACTORES[a].role)) ?? 'admin';
}

/**
 * Cliente HTTP autenticado contra la app, para no repetir el header en cada pedido.
 *
 * Con un token, manda siempre ese. Con `Api.porRol`, cada pedido va con el actor
 * que la ruta admite, para los flujos que cruzan grupos. El guard igual corre de
 * verdad: si la matriz cambia, el pedido sale con otro actor, no se saltea nada.
 * La matriz en sí la verifica auth-roles.e2e-spec.ts con roles escritos a mano.
 */
export class Api {
  constructor(
    private readonly app: NestExpressApplication,
    private readonly token: string | null,
  ) {}

  static porRol(app: NestExpressApplication): Api {
    return new Api(app, null);
  }

  private auth(method: string, path: string) {
    return bearer(this.token ?? tokenDe(actorPara(method, path)));
  }

  post(path: string, body?: unknown) {
    return request(this.app.getHttpServer())
      .post(path)
      .set(this.auth('POST', path))
      .send(body ?? {});
  }

  put(path: string, body?: unknown) {
    return request(this.app.getHttpServer())
      .put(path)
      .set(this.auth('PUT', path))
      .send(body ?? {});
  }

  patch(path: string, body?: unknown) {
    return request(this.app.getHttpServer())
      .patch(path)
      .set(this.auth('PATCH', path))
      .send(body ?? {});
  }

  get(path: string) {
    return request(this.app.getHttpServer()).get(path).set(this.auth('GET', path));
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

/**
 * Una cuadrilla con sus integrantes. Sin argumentos, el actor `cuadrilla` es
 * integrante: Campo solo opera los servicios de su cuadrilla (#365).
 */
export async function crearCuadrilla(
  api: Api,
  integrantes: string[] = [ACTORES.cuadrilla.userId],
): Promise<{ id: string }> {
  const res = await api
    .post('/crews', {
      name: `Cuadrilla ${unique('CR')}`,
      crewType: 'MUNICIPAL',
      defaultShift: 'MORNING',
    })
    .expect(201);
  if (integrantes.length > 0) {
    await api.post(`/crews/${res.body.id}/members`, { userIds: integrantes }).expect(201);
  }
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
