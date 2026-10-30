import { NestExpressApplication } from '@nestjs/platform-express';
import { M6Role } from '@prisma/client';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Api,
  bearer,
  crearCuadrilla,
  crearTipoServicio,
  crearZona,
  createTestApp,
  grantRoles,
  hoy,
  seedActores,
  tokenFor,
  truncateAll,
} from './helpers';

/**
 * Contrato de las personas de demostración (#458): una por perfil, con el token
 * que firma el frontend. Los ids reales de la demo están en docs/seed.md; acá se
 * usan ids propios del e2e con la misma forma (rol de M1 + roles de M6).
 */
describe('Personas de demostración (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const get = (path: string, token: string) =>
    request(app.getHttpServer()).get(path).set(bearer(token));

  const LIDER = '9010';
  const INTEGRANTE = '9004';
  const AJENO = '9011';
  const SIN_ROL = '9900';
  const CIUDADANO = '9901';
  let cuadrillaId: string;
  let servicioId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await truncateAll(prisma);
    await seedActores(prisma);
    for (const u of [LIDER, AJENO]) await grantRoles(prisma, u, [M6Role.M6_CAMPO_CUADRILLA]);
    const oficina = Api.porRol(app);
    const zoneId = (await crearZona(oficina)).id;
    const serviceTypeId = (await crearTipoServicio(oficina, { mode: 'POINT' })).id;
    cuadrillaId = (await crearCuadrilla(oficina, [INTEGRANTE])).id;
    await oficina.patch(`/crews/${cuadrillaId}`, { leaderUserId: LIDER }).expect(200);
    await crearCuadrilla(oficina, [AJENO]);
    const servicio = await oficina
      .post('/services', {
        serviceTypeId,
        scheduledDate: hoy(),
        origin: 'PLANNED',
        zoneId,
        crewId: cuadrillaId,
      })
      .expect(201);
    servicioId = servicio.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /me: el líder y el integrante ven su cuadrilla con su rol', async () => {
    const lider = await get('/me', tokenFor('ADMINISTRATIVO', LIDER)).expect(200);
    expect(lider.body.crews).toEqual([
      { id: cuadrillaId, name: expect.any(String), role: 'LEADER' },
    ]);
    const integrante = await get('/me', tokenFor('ADMINISTRATIVO', INTEGRANTE)).expect(200);
    expect(integrante.body.crews[0]).toMatchObject({ id: cuadrillaId, role: 'MEMBER' });
    expect(Object.keys(integrante.body.crews[0]).sort()).toEqual(['id', 'name', 'role']);
  });

  it('GET /me: Oficina sin cuadrillas y el sin rol entra con roles vacíos', async () => {
    const ops = await get('/me', tokenFor('ADMINISTRATIVO', '9002')).expect(200);
    expect(ops.body).toMatchObject({ crews: [], isAssignedInspector: false });
    const sinRol = await get('/me', tokenFor('ADMINISTRATIVO', SIN_ROL)).expect(200);
    expect(sinRol.body).toMatchObject({ roles: [], crews: [] });
  });

  it('GET /me: el inspector se reconoce', async () => {
    const res = await get('/me', tokenFor('ADMINISTRATIVO', '9005')).expect(200);
    expect(res.body.isAssignedInspector).toBe(true);
  });

  it('Operaciones no autoriza una extracción: 403 ROLE_REQUIRED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/tree-interventions/${randomUUID()}/authorize`)
      .set(bearer(tokenFor('ADMINISTRATIVO', '9002')))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'ROLE_REQUIRED' });
  });

  it('Campo no opera el servicio de otra cuadrilla: 403 NOT_ASSIGNED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/services/${servicioId}/start`)
      .set(bearer(tokenFor('ADMINISTRATIVO', AJENO)));
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'NOT_ASSIGNED' });
  });

  it('el empleado sin rol recibe 403 en un GET', async () => {
    const res = await get('/zones', tokenFor('ADMINISTRATIVO', SIN_ROL));
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'ROLE_REQUIRED' });
  });

  it('el ciudadano queda afuera, también de GET /me', async () => {
    const token = tokenFor('CIUDADANO', CIUDADANO, 'CIUDADANO');
    expect((await get('/zones', token)).status).toBe(403);
    expect((await get('/me', token)).status).toBe(403);
  });
});
