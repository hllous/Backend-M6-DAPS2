import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  ACTORES,
  Api,
  crearContenedor,
  crearZona,
  createTestApp,
  seedActores,
  tokenDe,
  truncateAll,
} from './helpers';

/**
 * Auditoría de dominio (#460) contra la base real: la fila cae en la misma
 * transacción que el cambio, el actor sale del token y la tabla no se reescribe.
 */
describe('Auditoría de dominio (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let api: Api;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    api = Api.porRol(app);
    await truncateAll(prisma);
    await seedActores(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('cada transición del contenedor deja una fila con el actor del token', async () => {
    const zona = await crearZona(api);
    const contenedor = await crearContenedor(api, zona.id);
    await api.post(`/containers/${contenedor.id}/report-overflow`).expect(200);

    const res = await api.get(`/audit?entityType=CONTAINER&entityId=${contenedor.id}`).expect(200);

    // Del más nuevo al más viejo: el desborde que reportó la cuadrilla y el alta (Api.porRol prefiere admin donde la ruta lo admite).
    expect(res.body.data).toMatchObject([
      {
        action: 'REPORT_OVERFLOW',
        fromStatus: 'ACTIVE',
        toStatus: 'OVERFLOWED',
        actorUserId: ACTORES.cuadrilla.userId,
        actorRoles: ['M6_CAMPO_CUADRILLA'],
      },
      { action: 'CREATE', toStatus: 'ACTIVE', actorUserId: ACTORES.admin.userId },
    ]);
  });

  it('una transición rechazada (409) no deja fila', async () => {
    const zona = await crearZona(api);
    const contenedor = await crearContenedor(api, zona.id);
    await api.post(`/containers/${contenedor.id}/empty`).expect(409);

    const filas = await prisma.domainAuditLog.count({ where: { entityId: contenedor.id } });
    expect(filas).toBe(1); // solo el alta
  });

  it('solo M6_ADMIN y M6_AUDITOR consultan', async () => {
    const como = (actor: keyof typeof ACTORES) => new Api(app, tokenDe(actor));
    await como('auditor').get('/audit').expect(200);
    await como('admin').get('/audit').expect(200);
    await como('operaciones').get('/audit').expect(403);
    await como('cuadrilla').get('/audit').expect(403);
  });

  it('la tabla es de solo agregado: ni UPDATE ni DELETE', async () => {
    await expect(prisma.$executeRaw`UPDATE "domain_audit_log" SET "note" = 'x'`).rejects.toThrow(
      /append-only/,
    );
    await expect(prisma.$executeRaw`DELETE FROM "domain_audit_log"`).rejects.toThrow(/append-only/);
  });
});
