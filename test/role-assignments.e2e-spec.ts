import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { bearer, createTestApp, tokenFor, truncateAll } from './helpers';

/**
 * Asignación de roles de M6 (#161, ADR-008) contra la base real.
 *
 * El admin inicial sale de M6_BOOTSTRAP_ADMIN_USER_IDS, que se fija ANTES de
 * crear la app (la lee la configuración al construirse). Con 100 como admin de
 * bootstrap, el "último admin" se prueba vaciando el set: se limpia a 0 más abajo.
 */
describe('Roles de M6 (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  const http = () => request(app.getHttpServer());

  // 100 = RESPONSABLE_AREA y admin de bootstrap. 200 = ADMINISTRATIVO (destinatario).
  const admin = () => bearer(tokenFor('RESPONSABLE_AREA', '100'));
  const destinatario = () => bearer(tokenFor('ADMINISTRATIVO', '200'));

  beforeAll(async () => {
    process.env.M6_BOOTSTRAP_ADMIN_USER_IDS = '100';
    app = await createTestApp();
    prisma = app.get(PrismaService);
    await truncateAll(prisma);
  });

  afterAll(async () => {
    delete process.env.M6_BOOTSTRAP_ADMIN_USER_IDS;
    await app.close();
  });

  it('GET /me: sin asignaciones el rol de M1 no da roles de M6; el bootstrap sí', async () => {
    const res = await http().get('/me').set(destinatario()).expect(200);
    expect(res.body).toEqual({
      userId: '200',
      subType: 'EMPLEADO',
      m1Role: 'ADMINISTRATIVO',
      roles: [],
    });
    const adm = await http().get('/me').set(admin()).expect(200);
    expect(adm.body.roles).toEqual(['M6_ADMIN']);
  });

  it('solo M6_ADMIN usa /role-assignments (403 para los demás)', async () => {
    await http().get('/role-assignments/200').set(destinatario()).expect(403);
    await http()
      .put('/role-assignments/200')
      .set(destinatario())
      .send({ roles: ['M6_ADMIN'] })
      .expect(403);
    await http().get('/role-assignments/200').expect(401);
  });

  it('PUT asigna, rige en la próxima request y deja auditoría', async () => {
    await http()
      .put('/role-assignments/200')
      .set(admin())
      .send({ roles: ['M6_OFICINA_OPERACIONES', 'M6_OFICINA_AMBIENTAL'] })
      .expect(200);

    const me = await http().get('/me').set(destinatario()).expect(200);
    expect(me.body.roles).toEqual(['M6_OFICINA_OPERACIONES', 'M6_OFICINA_AMBIENTAL']);

    const audit = await prisma.roleAssignmentAudit.findMany({ where: { targetUserId: '200' } });
    expect(audit).toHaveLength(2);
    expect(audit.every((a) => a.actorUserId === '100' && a.action === 'GRANT')).toBe(true);

    const list = await http().get('/role-assignments').set(admin()).expect(200);
    expect(list.body.data).toEqual([
      { userId: '200', roles: ['M6_OFICINA_OPERACIONES', 'M6_OFICINA_AMBIENTAL'] },
    ]);
  });

  it('un rol asignado que el rol de M1 no permite no es efectivo', async () => {
    // El AUDITOR de M1 solo admite M6_AUDITOR: M6_ADMIN queda en la tabla pero no rige.
    await http()
      .put('/role-assignments/300')
      .set(admin())
      .send({ roles: ['M6_ADMIN'] })
      .expect(200);
    const me = await http()
      .get('/me')
      .set(bearer(tokenFor('AUDITOR', '300')))
      .expect(200);
    expect(me.body.roles).toEqual([]);
  });

  it('exclusividad Oficina/Campo: 400 y no cambia nada', async () => {
    await http()
      .put('/role-assignments/200')
      .set(admin())
      .send({ roles: ['M6_OFICINA_OPERACIONES', 'M6_CAMPO_CUADRILLA'] })
      .expect(400);
    const res = await http().get('/role-assignments/200').set(admin()).expect(200);
    expect(res.body.roles).toEqual(['M6_OFICINA_OPERACIONES', 'M6_OFICINA_AMBIENTAL']);
  });

  it('un admin de bootstrap no puede recibir roles de Campo (400)', async () => {
    await http()
      .put('/role-assignments/100')
      .set(admin())
      .send({ roles: ['M6_CAMPO_INSPECTOR'] })
      .expect(400);
    expect(await prisma.userRoleAssignment.count({ where: { userId: '100' } })).toBe(0);
  });

  it('una fila de Campo cargada a mano no le quita Oficina al admin de bootstrap', async () => {
    await prisma.userRoleAssignment.create({ data: { userId: '100', role: 'M6_CAMPO_INSPECTOR' } });
    const me = await http().get('/me').set(admin()).expect(200);
    expect(me.body.roles).toEqual(['M6_ADMIN']);
    await prisma.userRoleAssignment.deleteMany({ where: { userId: '100' } });
  });

  it('RESPONSABLE_AREA sin fila ni bootstrap no administra roles (403)', async () => {
    await http()
      .get('/role-assignments')
      .set(bearer(tokenFor('RESPONSABLE_AREA', '600')))
      .expect(403);
  });

  it('rol inexistente, repetido o id no numérico: 400', async () => {
    await http()
      .put('/role-assignments/200')
      .set(admin())
      .send({ roles: ['SUPERUSER'] })
      .expect(400);
    await http()
      .put('/role-assignments/200')
      .set(admin())
      .send({ roles: ['M6_AUDITOR', 'M6_AUDITOR'] })
      .expect(400);
    await http().get('/role-assignments/abc').set(admin()).expect(400);
  });

  it('DELETE quita todo, audita REVOKE y es idempotente', async () => {
    await http().delete('/role-assignments/200').set(admin()).expect(204);
    await http().delete('/role-assignments/200').set(admin()).expect(204);
    const revokes = await prisma.roleAssignmentAudit.count({
      where: { targetUserId: '200', action: 'REVOKE' },
    });
    expect(revokes).toBe(2);
    const me = await http().get('/me').set(destinatario()).expect(200);
    expect(me.body.roles).toEqual([]);
  });

  it('la auditoría es append-only: el trigger rechaza UPDATE, DELETE y TRUNCATE', async () => {
    await expect(prisma.$executeRawUnsafe('TRUNCATE "role_assignment_audit"')).rejects.toThrow(
      /append-only/,
    );
    await expect(prisma.roleAssignmentAudit.deleteMany({})).rejects.toThrow(/append-only/);
    await expect(
      prisma.roleAssignmentAudit.updateMany({ data: { actorUserId: 'x' } }),
    ).rejects.toThrow(/append-only/);
  });

  it('no deja el sistema sin M6_ADMIN cuando no hay admins de bootstrap', async () => {
    // Con bootstrap, el último admin de la tabla se puede quitar: 300 queda con la fila de arriba.
    await http().delete('/role-assignments/300').set(admin()).expect(204);

    // Sin bootstrap (se reconstruye la app), el único admin de la tabla no se puede quitar.
    await app.close();
    delete process.env.M6_BOOTSTRAP_ADMIN_USER_IDS;
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const rr = bearer(tokenFor('RESPONSABLE_AREA', '400'));
    await prisma.userRoleAssignment.create({ data: { userId: '400', role: 'M6_ADMIN' } });

    const res = await http().delete('/role-assignments/400').set(rr).expect(409);
    expect(res.body.message).toMatch(/último M6_ADMIN/);
    // Pero con otro admin en la tabla sí se puede.
    await prisma.userRoleAssignment.create({ data: { userId: '500', role: 'M6_ADMIN' } });
    await http().delete('/role-assignments/400').set(rr).expect(204);
  });
});
