import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  ACTORES,
  Actor,
  Api,
  bearer,
  crearZona,
  createTestApp,
  seedActores,
  tokenDe,
  truncateAll,
  unique,
} from './helpers';

/**
 * Autorizar o rechazar una extracción exige M6_ADMIN (#456); las podas no
 * requieren autorización y las decide Operaciones. El rol de la ruta lo cubre
 * auth-roles: acá se prueba la regla del service, que depende del tipo.
 */
describe('Autorización de intervenciones sobre árboles (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let treeId: string;

  const http = () => request(app.getHttpServer());
  const como = (actor: Actor) => bearer(tokenDe(actor));

  async function crear(interventionType: string, solicita: Actor = 'operaciones') {
    const res = await http()
      .post('/tree-interventions')
      .set(como(solicita))
      .send({ interventionType, treeIds: [treeId] })
      .expect(201);
    return res.body.id as string;
  }

  /** Una extracción lista para decidir: solicitada y enviada a autorización. */
  async function extraccionPendiente(solicita: Actor = 'operaciones'): Promise<string> {
    const id = await crear('REMOVAL', solicita);
    await http()
      .post(`/tree-interventions/${id}/submit-for-authorization`)
      .set(como('operaciones'))
      .expect(200);
    return id;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await truncateAll(prisma);
    await seedActores(prisma);
    const zona = await crearZona(Api.porRol(app));
    const tree = await prisma.tree.create({
      data: { surveyCode: unique('ARB'), zoneId: zona.id },
    });
    treeId = tree.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Operaciones no autoriza una extracción: 403 ROLE_REQUIRED y sigue pendiente', async () => {
    const id = await extraccionPendiente();

    const res = await http()
      .post(`/tree-interventions/${id}/authorize`)
      .set(como('operaciones'))
      .send({});

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ statusCode: 403, code: 'ROLE_REQUIRED' });
    const fila = await prisma.treeIntervention.findUniqueOrThrow({ where: { id } });
    expect(fila.status).toBe('PENDING_AUTHORIZATION');
  });

  it('Operaciones no rechaza una extracción: 403 ROLE_REQUIRED', async () => {
    const id = await extraccionPendiente();

    const res = await http().post(`/tree-interventions/${id}/reject`).set(como('operaciones'));

    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ statusCode: 403, code: 'ROLE_REQUIRED' });
  });

  it('M6_ADMIN autoriza una extracción y la respuesta dice quién la solicitó y quién la autorizó', async () => {
    const id = await extraccionPendiente('operaciones');

    const res = await http()
      .post(`/tree-interventions/${id}/authorize`)
      .set(como('admin'))
      .send({ justification: 'Riesgo de caída' })
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'AUTHORIZED',
      requestedByUserId: ACTORES.operaciones.userId,
      authorizedByUserId: ACTORES.admin.userId,
    });
  });

  it('M6_ADMIN autoriza lo que él mismo solicitó y queda registrado', async () => {
    const id = await extraccionPendiente('admin');

    const res = await http()
      .post(`/tree-interventions/${id}/authorize`)
      .set(como('admin'))
      .send({})
      .expect(200);

    expect(res.body).toMatchObject({
      requestedByUserId: ACTORES.admin.userId,
      authorizedByUserId: ACTORES.admin.userId,
    });
  });

  it('una poda la autoriza Operaciones, sin M6_ADMIN', async () => {
    const id = await crear('SAFETY_PRUNING');

    const res = await http()
      .post(`/tree-interventions/${id}/authorize`)
      .set(como('operaciones'))
      .send({})
      .expect(200);

    expect(res.body).toMatchObject({
      status: 'AUTHORIZED',
      requestedByUserId: ACTORES.operaciones.userId,
      authorizedByUserId: ACTORES.operaciones.userId,
    });
  });
});
