import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { EVIDENCE_STORAGE } from '../src/modules/attachments/storage/evidence-storage.interface';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  ACTORES,
  Api,
  bearer,
  crearTipoServicio,
  crearZona,
  createTestApp,
  hoy,
  seedActores,
  tokenFor,
  truncateAll,
} from './helpers';

/**
 * Criterios de seguridad que se prueban en vivo (#569): inyección SQL y XSS en
 * campos de texto, mass assignment, 413 de la subida y que la CSP llegue por HTTP.
 *
 * Postura de la API: Prisma parametriza todo, así que un payload SQL es solo texto;
 * y como devuelve JSON (nunca HTML), un `<script>` se guarda tal cual y no se ejecuta.
 * Estos casos fijan eso: ni 500 ni efectos, y el dato vuelve idéntico.
 */
describe('Seguridad de entrada (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let api: Api;

  const PAYLOADS = ["'; DROP TABLE zone;--", "' OR 1=1--", '<script>alert(1)</script>'];

  beforeAll(async () => {
    app = await createTestApp((b) =>
      b.overrideProvider(EVIDENCE_STORAGE).useValue({
        upload: async ({ key }: { key: string }) => ({ url: `https://storage.test/${key}` }),
        remove: async () => undefined,
      }),
    );
    prisma = app.get(PrismaService);
    api = Api.porRol(app);
    await truncateAll(prisma);
    await seedActores(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe.each(PAYLOADS)('payload %s', (payload) => {
    it('zona: el nombre se guarda como texto y la tabla sigue viva', async () => {
      const res = await api.post('/zones', {
        code: `Z${Math.floor(Math.random() * 1e6)}`,
        name: payload,
      });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe(payload);
      await expect(prisma.zone.count()).resolves.toBeGreaterThan(0);
      // Una condición `OR 1=1` inyectada en el filtro devolvería todo, no cero.
      const lista = await api.get(`/zones?search=${encodeURIComponent(payload)}`);
      expect(lista.status).toBe(200);
      expect(lista.body.data.every((z: { name: string }) => z.name.includes(payload))).toBe(true);
    });

    it('expediente ambiental: dirección y descripción se guardan como texto', async () => {
      const res = await api.post('/environmental-reports', {
        reportType: 'ILLEGAL_DUMPSITE',
        address: payload,
        description: payload,
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ address: payload, description: payload });
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('servicio: las notas se guardan como texto', async () => {
      const zona = await crearZona(api);
      const tipo = await crearTipoServicio(api, { mode: 'POINT' });
      const res = await api.post('/services', {
        serviceTypeId: tipo.id,
        scheduledDate: hoy(),
        origin: 'PLANNED',
        zoneId: zona.id,
        notes: payload,
      });
      expect(res.status).toBe(201);
      expect(res.body.notes).toBe(payload);
    });
  });

  describe('mass assignment', () => {
    let serviceId: string;

    beforeAll(async () => {
      const zona = await crearZona(api);
      const tipo = await crearTipoServicio(api, { mode: 'POINT' });
      const res = await api
        .post('/services', {
          serviceTypeId: tipo.id,
          scheduledDate: hoy(),
          origin: 'PLANNED',
          zoneId: zona.id,
        })
        .expect(201);
      serviceId = res.body.id;
    });

    it.each([
      { status: 'COMPLETED' },
      { role: 'M6_ADMIN' },
      { id: '00000000-0000-4000-8000-000000000000' },
      { notes: 'ok', status: 'COMPLETED', crewId: '00000000-0000-4000-8000-000000000000' },
    ])('PATCH /services/:id rechaza %j con 400 y no persiste', async (body) => {
      const antes = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
      const res = await api.patch(`/services/${serviceId}`, body);
      expect(res.status).toBe(400);
      const despues = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
      expect(despues).toEqual(antes);
    });

    it('PATCH /zones/:id rechaza campos fuera del DTO con 400', async () => {
      const zona = await crearZona(api);
      const res = await api.patch(`/zones/${zona.id}`, { code: 'HACK', createdAt: '2000-01-01' });
      expect(res.status).toBe(400);
      const fila = await prisma.zone.findUniqueOrThrow({ where: { id: zona.id } });
      expect(fila.code).toBe(zona.code);
    });

    it('un rol enviado en el body no escala privilegios', async () => {
      const res = await request(app.getHttpServer())
        .post('/zones')
        .set(bearer(tokenFor('CIUDADANO', '777', 'CIUDADANO')))
        .send({ code: 'ESC-1', name: 'x', role: 'M6_ADMIN' });
      // El RolesGuard corta antes que el ValidationPipe: sin rol de M6 no se llega al body.
      expect(res.status).toBe(403);
      await expect(prisma.zone.count({ where: { code: 'ESC-1' } })).resolves.toBe(0);
    });
  });

  describe('subida de evidencia', () => {
    it('un archivo de más de 10 MB responde 413 (lo corta multer)', async () => {
      const grande = Buffer.alloc(10 * 1024 * 1024 + 1, 1);
      const res = await request(app.getHttpServer())
        .post('/evidence')
        .set(bearer(tokenFor('ADMINISTRATIVO', ACTORES.cuadrilla.userId)))
        .set('Idempotency-Key', '11111111-1111-4111-8111-111111111111')
        .field('ownerType', 'SERVICE')
        .field('ownerId', '00000000-0000-4000-8000-000000000000')
        .attach('file', grande, { filename: 'grande.jpg', contentType: 'image/jpeg' });
      expect(res.status).toBe(413);
    });
  });

  describe('Content-Security-Policy', () => {
    it('la API manda una CSP restrictiva', async () => {
      const res = await request(app.getHttpServer()).get('/services');
      expect(res.headers['content-security-policy']).toBe(
        "default-src 'none'; frame-ancestors 'none'",
      );
    });

    // Swagger no se monta en createTestApp (404): solo se prueba que el middleware
    // no agrega CSP en esa ruta. Que Swagger UI renderice no está verificado en e2e.
    it('el middleware no agrega CSP en /api/docs (aunque acá responda 404)', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs');
      expect(res.headers['content-security-policy']).toBeUndefined();
    });
  });
});
