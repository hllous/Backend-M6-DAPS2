import { NestExpressApplication } from '@nestjs/platform-express';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Api,
  bearer,
  crearRuta,
  crearTipoServicio,
  crearZona,
  createTestApp,
  hoy,
  seedActores,
  tokenDe,
  truncateAll,
} from './helpers';

/**
 * Idempotency-Key opcional en los POST de creación (#592, ADR-013).
 * Zonas para el contrato general; cortes de calle para el outbox (publican
 * `streetClosureRequested`).
 */
describe('Idempotency-Key (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let servicioId: string;

  const post = (
    path: string,
    body: object,
    key?: string,
    actor: 'admin' | 'operaciones' = 'admin',
  ) => {
    const r = request(app.getHttpServer())
      .post(path)
      .set(bearer(tokenDe(actor)));
    if (key !== undefined) r.set('Idempotency-Key', key);
    return r.send(body);
  };

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    const api = Api.porRol(app);
    await truncateAll(prisma);
    await seedActores(prisma);
    const rutaId = (await crearRuta(api, [(await crearZona(api)).id])).id;
    const tipoId = (await crearTipoServicio(api, { mode: 'ROUTE' })).id;
    servicioId = (
      await api
        .post('/services', {
          serviceTypeId: tipoId,
          routeId: rutaId,
          scheduledDate: hoy(),
          origin: 'PLANNED',
        })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.idempotencyRecord.deleteMany();
  });

  it('misma clave y mismo cuerpo: un solo recurso y la misma respuesta', async () => {
    const body = { code: 'IDEM-1', name: 'Zona idempotente' };
    const a = await post('/zones', body, 'clave-1').expect(201);
    const b = await post('/zones', { name: 'Zona idempotente', code: 'IDEM-1' }, 'clave-1').expect(
      201,
    );

    expect(a.headers['idempotency-replayed']).toBeUndefined();
    expect(b.headers['idempotency-replayed']).toBe('true');
    expect(b.body).toEqual(a.body);
    await expect(prisma.zone.count({ where: { code: 'IDEM-1' } })).resolves.toBe(1);
  });

  it('misma clave con otro cuerpo: 422 y no se crea nada', async () => {
    await post('/zones', { code: 'IDEM-2', name: 'Uno' }, 'clave-2').expect(201);
    await post('/zones', { code: 'IDEM-2B', name: 'Otro' }, 'clave-2').expect(422);
    await expect(prisma.zone.count({ where: { code: 'IDEM-2B' } })).resolves.toBe(0);
  });

  it('dos requests concurrentes con la misma clave crean un solo recurso', async () => {
    const body = { code: 'IDEM-3', name: 'Carrera' };
    const [a, b] = await Promise.all([
      post('/zones', body, 'clave-3'),
      post('/zones', body, 'clave-3'),
    ]);
    // El perdedor ve la primera todavía en curso (409) o ya terminada (replay 201); nunca un segundo alta.
    const [primero, segundo] = [a.status, b.status].sort();
    expect(primero).toBe(201);
    expect([201, 409]).toContain(segundo);
    await expect(prisma.zone.count({ where: { code: 'IDEM-3' } })).resolves.toBe(1);
  });

  it('sin clave se comporta como siempre: el duplicado da 409', async () => {
    const body = { code: 'IDEM-4', name: 'Sin clave' };
    await post('/zones', body).expect(201);
    await post('/zones', body).expect(409);
    await expect(prisma.idempotencyRecord.count()).resolves.toBe(0);
  });

  it('clave de más de 255 caracteres da 400 y no crea nada', async () => {
    await post('/zones', { code: 'IDEM-5', name: 'x' }, 'a'.repeat(256)).expect(400);
    await expect(prisma.zone.count({ where: { code: 'IDEM-5' } })).resolves.toBe(0);
  });

  it('una respuesta de error no se guarda: la clave sirve para reintentar', async () => {
    await post('/zones', { code: 'IDEM-6' }, 'clave-6').expect(400);
    await expect(prisma.idempotencyRecord.count()).resolves.toBe(0);
    await post('/zones', { code: 'IDEM-6', name: 'Ahora sí' }, 'clave-6').expect(201);
  });

  it('el replay no vuelve a escribir en el outbox', async () => {
    const corte = {
      sourceType: 'SERVICE',
      sourceId: servicioId,
      reason: 'Trabajo sobre la calzada',
      sections: [
        { streetName: 'Belgrano', fromCross: 'Mitre', toCross: 'San Martín', direction: 'BOTH' },
      ],
      closureType: 'PARTIAL',
      requestedFrom: new Date(Date.now() + 86_400_000).toISOString(),
      requestedTo: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    };
    const a = await post('/street-closure-requests', corte, 'clave-8', 'operaciones').expect(201);
    const b = await post('/street-closure-requests', corte, 'clave-8', 'operaciones').expect(201);

    expect(b.headers['idempotency-replayed']).toBe('true');
    expect(b.body).toEqual(a.body);
    await expect(prisma.streetClosureRequest.count()).resolves.toBe(1);
    await expect(
      prisma.outboxEvent.count({ where: { eventType: 'streetClosureRequested' } }),
    ).resolves.toBe(1);
  });

  it('un registro en curso y viejo se puede retomar; uno reciente da 409', async () => {
    const body = { code: 'IDEM-9', name: 'Retomar' };
    const scope = '9001|POST|/zones';
    const requestHash = (
      await import('../src/common/idempotency/idempotency.interceptor')
    ).hashBody(body);
    await prisma.idempotencyRecord.create({ data: { scope, key: 'clave-9', requestHash } });
    await post('/zones', body, 'clave-9').expect(409);

    await prisma.idempotencyRecord.updateMany({
      data: { createdAt: new Date(Date.now() - 120_000) },
    });
    await post('/zones', body, 'clave-9').expect(201);
  });
});
