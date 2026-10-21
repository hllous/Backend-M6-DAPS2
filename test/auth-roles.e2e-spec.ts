import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import { M6Role } from '@prisma/client';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  ACTORES,
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
  type Fila = {
    grupo: string;
    method: 'post' | 'put' | 'get';
    path: string;
    permitidos: Actor[];
    body?: Record<string, unknown>;
  };
  const TODOS: Actor[] = ['admin', 'operaciones', 'ambiental', 'cuadrilla', 'inspector', 'auditor'];
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
    { grupo: 'lectura', method: 'get', path: '/zones', permitidos: TODOS },
    { grupo: 'recursos (crews)', method: 'post', path: '/crews', permitidos: ['admin'] },
    {
      grupo: 'inventario (green-spaces)',
      method: 'post',
      path: '/green-spaces',
      permitidos: ['admin', 'operaciones'],
    },
    {
      grupo: 'inventario (green-points)',
      method: 'post',
      path: '/green-points',
      permitidos: ['admin', 'operaciones'],
    },
    {
      grupo: 'role-assignments (lectura)',
      method: 'get',
      path: '/role-assignments/1',
      permitidos: ['admin'],
    },
    {
      grupo: 'role-assignments (alta)',
      method: 'put',
      path: '/role-assignments/9999',
      permitidos: ['admin'],
      body: { roles: [] },
    },
    {
      grupo: 'acta (emitir)',
      method: 'post',
      path: `/environmental-inspections/${U}/violation-notice`,
      permitidos: ['admin', 'ambiental'],
    },
    {
      grupo: 'acta (leer, Nivel 2)',
      method: 'get',
      path: `/environmental-inspections/${U}/violation-notice`,
      permitidos: ['admin', 'ambiental', 'inspector', 'auditor'],
    },
    {
      grupo: 'respuesta de M7 (approve)',
      method: 'post',
      path: `/street-closure-requests/${U}/approve`,
      permitidos: ['admin'],
    },
    {
      grupo: 'respuesta de M3 (close)',
      method: 'post',
      path: `/repair-requests/${U}/close`,
      permitidos: ['admin'],
    },
    // La evidencia depende del ownerType: el rol se chequea en el service, antes que el archivo.
    ...(['INSPECTION', 'SERVICE', 'ZONE_RESULT', 'CONTAINER'] as const).map((ownerType): Fila => ({
      grupo: `evidencia ${ownerType}`,
      method: 'post',
      path: '/evidence',
      permitidos: [ownerType === 'INSPECTION' ? 'inspector' : 'cuadrilla'],
      body: { ownerType, ownerId: U },
    })),
  ];

  const llamar = (
    m: Fila['method'],
    path: string,
    auth: { Authorization: string },
    body: Record<string, unknown> = {},
  ) => (m === 'get' ? http().get(path).set(auth) : http()[m](path).set(auth).send(body));

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await truncateAll(prisma);
    await seedActores(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe.each(MATRIZ)('$grupo: $method $path', ({ method, path, permitidos, body }) => {
    it('sin token da 401', async () => {
      await (
        method === 'get'
          ? http().get(path)
          : http()
              [method](path)
              .send(body ?? {})
      ).expect(401);
    });

    it.each(TODOS)('actor %s', async (actor) => {
      const res = await llamar(method, path, bearer(tokenDe(actor)), body);
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

  describe('POST /environmental-reports: ticketId solo con Oficina Ambiental', () => {
    const alta = (actor: Actor, ticketId?: string) =>
      http()
        .post('/environmental-reports')
        .set(bearer(tokenDe(actor)))
        .send({ reportType: 'NOISE', ...(ticketId && { ticketId }) });

    it.each([
      ['admin', 201],
      ['ambiental', 201],
      ['inspector', 400],
    ] as [Actor, number][])('%s con ticketId: %s', async (actor, status) => {
      const res = await alta(actor, unique('TCK'));
      expect(res.status).toBe(status);
      if (status === 400) expect(res.body.message).toMatch(/Oficina Ambiental/);
    });

    it.each(['admin', 'ambiental', 'inspector'] as Actor[])(
      '%s sin ticketId (de oficio): 201',
      async (actor) => {
        await alta(actor).expect(201);
      },
    );

    it.each(['operaciones', 'cuadrilla', 'auditor'] as Actor[])('%s: 403', async (actor) => {
      await alta(actor).expect(403);
    });
  });

  describe('inspectorId al programar la inspección', () => {
    it('solo se asigna a quien tiene M6_CAMPO_INSPECTOR (400 si no) y se guarda', async () => {
      const exp = await http()
        .post('/environmental-reports')
        .set(bearer(tokenDe('ambiental')))
        .send({ reportType: 'NOISE' })
        .expect(201);
      await http()
        .post(`/environmental-reports/${exp.body.id}/start-review`)
        .set(bearer(tokenDe('ambiental')))
        .expect(200);
      const programar = (inspectorId: string) =>
        http()
          .post(`/environmental-reports/${exp.body.id}/inspections`)
          .set(bearer(tokenDe('ambiental')))
          .send({ inspectorId });

      const sinRol = await programar(ACTORES.cuadrilla.userId).expect(400);
      expect(sinRol.body.message).toMatch(/rol de inspector/);
      await programar('no-numerico').expect(400);

      const ok = await programar(ACTORES.inspector.userId).expect(201);
      expect(ok.body.inspectorId).toBe(ACTORES.inspector.userId);
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
