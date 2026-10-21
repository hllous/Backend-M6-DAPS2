import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import { M6Role } from '@prisma/client';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Actor,
  bearer,
  createTestApp,
  grantRoles,
  seedActores,
  tokenDe,
  tokenFor,
  truncateAll,
  unique,
} from './helpers';

/**
 * Matriz de roles de M6 (#161, #235, ADR-008) contra la app y la base reales.
 *
 * La matriz está escrita a mano acá, a propósito: no se deriva de la metadata
 * de @Roles, porque entonces un cambio equivocado del decorador pasaría el test.
 * Cada fila es un endpoint representativo de su grupo.
 */
describe('Roles de M6: matriz por rol (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  const U = randomUUID();
  type Fila = { grupo: string; method: 'post' | 'get'; path: string; permitidos: Actor[] };
  const MATRIZ: Fila[] = [
    { grupo: 'catálogos', method: 'post', path: '/zones', permitidos: ['admin'] },
    {
      grupo: 'operaciones',
      method: 'post',
      path: '/tree-interventions',
      permitidos: ['admin', 'operaciones'],
    },
    {
      grupo: 'ambiental',
      method: 'post',
      path: `/environmental-reports/${U}/start-review`,
      permitidos: ['admin', 'ambiental'],
    },
    {
      grupo: 'cuadrilla',
      method: 'post',
      path: `/services/${U}/start`,
      permitidos: ['cuadrilla'],
    },
    {
      grupo: 'inspector',
      method: 'post',
      path: `/environmental-inspections/${U}/complete`,
      permitidos: ['inspector'],
    },
    { grupo: 'inbox', method: 'post', path: '/events/inbox', permitidos: ['admin'] },
    {
      grupo: 'lectura',
      method: 'get',
      path: '/zones',
      permitidos: ['admin', 'operaciones', 'ambiental', 'cuadrilla', 'inspector', 'auditor'],
    },
  ];
  const ACTORES: Actor[] = [
    'admin',
    'operaciones',
    'ambiental',
    'cuadrilla',
    'inspector',
    'auditor',
  ];

  const llamar = (m: 'post' | 'get', path: string, auth: { Authorization: string }) =>
    m === 'get' ? http().get(path).set(auth) : http().post(path).set(auth).send({});

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await truncateAll(prisma);
    await seedActores(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe.each(MATRIZ)('$grupo: $method $path', ({ method, path, permitidos }) => {
    it('sin token da 401', async () => {
      await (method === 'get' ? http().get(path) : http().post(path).send({})).expect(401);
    });

    it.each(ACTORES)('actor %s', async (actor) => {
      const res = await llamar(method, path, bearer(tokenDe(actor)));
      if (permitidos.includes(actor)) {
        // Pasó el guard: lo que sigue es validación o 404 del recurso, nunca 401/403.
        expect([401, 403]).not.toContain(res.status);
        expect(res.status).toBeLessThan(500);
      } else {
        expect(res.status).toBe(403);
        expect(res.body).toMatchObject({ statusCode: 403, code: 'ROLE_REQUIRED' });
      }
    });
  });

  it('un GET permitido devuelve 200 y el auditor lee pero no escribe', async () => {
    const auditor = bearer(tokenDe('auditor'));
    await http().get('/zones').set(auditor).expect(200);
    await http().get('/me').set(auditor).expect(200);
    await http().post('/zones').set(auditor).send({ code: 'A', name: 'A' }).expect(403);
    await http().post('/events/inbox').set(auditor).send({}).expect(403);
  });

  it('el 403 por rol no revela qué rol faltaba', async () => {
    const res = await http()
      .post('/zones')
      .set(bearer(tokenDe('cuadrilla')))
      .send({})
      .expect(403);
    expect(JSON.stringify(res.body)).not.toContain('M6_');
  });

  describe('quien no es personal con rol de M6', () => {
    const sinAcceso: [string, string, 'EMPLEADO' | 'CIUDADANO'][] = [
      ['ciudadano (sub_type CIUDADANO)', 'CIUDADANO', 'CIUDADANO'],
      ['vecino con el rol viejo PERSONA', 'PERSONA', 'CIUDADANO'],
      ['SERVICIO (sin rol de M6)', 'SERVICIO', 'EMPLEADO'],
      ['MESA_ENTRADAS (sin acceso por decisión del PO)', 'MESA_ENTRADAS', 'EMPLEADO'],
      ['un rol de M1 desconocido', 'HACKER', 'EMPLEADO'],
      ['ADMINISTRATIVO sin ninguna fila', 'ADMINISTRATIVO', 'EMPLEADO'],
    ];

    it.each(sinAcceso)('%s: 403 en lectura y en escritura', async (_n, rol, subType) => {
      // Aunque la base tenga un M6_ADMIN para ese id, el rol de M1 no lo deja valer.
      const sub = '777';
      if (rol !== 'ADMINISTRATIVO') await grantRoles(prisma, sub, [M6Role.M6_ADMIN]);
      const auth = bearer(tokenFor(rol, sub, subType));
      await http().get('/zones').set(auth).expect(403);
      await http().get('/events/handlers').set(auth).expect(403);
      await http().post('/zones').set(auth).send({ code: 'X', name: 'X' }).expect(403);
      await prisma.userRoleAssignment.deleteMany({ where: { userId: sub } });
    });

    it('GET /me sí responde a un empleado sin roles: es cómo el frontend se entera', async () => {
      const res = await http()
        .get('/me')
        .set(bearer(tokenFor('ADMINISTRATIVO', '778')))
        .expect(200);
      expect(res.body.roles).toEqual([]);
    });
  });

  describe('el rol de M1 es un techo sobre la fila', () => {
    afterEach(async () => {
      await prisma.userRoleAssignment.deleteMany({ where: { userId: { in: ['801', '802'] } } });
    });

    it('ADMINISTRATIVO con fila M6_ADMIN NO es admin: la fila queda dormida', async () => {
      await grantRoles(prisma, '801', [M6Role.M6_ADMIN]);
      await http()
        .post('/zones')
        .set(bearer(tokenFor('ADMINISTRATIVO', '801')))
        .send({ code: unique('ZD'), name: 'Dormida' })
        .expect(403);
    });

    it('RESPONSABLE_AREA con fila M6_ADMIN es admin', async () => {
      await grantRoles(prisma, '802', [M6Role.M6_ADMIN]);
      await http()
        .post('/zones')
        .set(bearer(tokenFor('RESPONSABLE_AREA', '802')))
        .send({ code: unique('ZA'), name: 'Despierta' })
        .expect(201);
    });
  });

  describe('endpoints públicos', () => {
    it.each(['/health', '/public/zones', '/public/services', '/public/green-points'])(
      '%s responde sin token',
      async (path) => {
        await http().get(path).expect(200);
      },
    );
  });
});
