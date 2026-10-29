import { randomUUID } from 'node:crypto';
import { NestExpressApplication } from '@nestjs/platform-express';
import { M6Role } from '@prisma/client';
import * as request from 'supertest';
import { EVIDENCE_STORAGE } from '../src/modules/attachments/storage/evidence-storage.interface';
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
 * Pertenencia de Campo (#365, ADR-008): la cuadrilla opera solo los servicios de
 * su cuadrilla y el inspector solo las inspecciones que se le asignaron (o las
 * que no tienen asignado). El rol ya lo cubre auth-roles; acá se prueba que
 * tener el rol no alcanza.
 */
describe('Pertenencia de Campo (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let oficina: Api;

  // Dos cuadrillas. A: integrante 9004 y líder 9010. B: integrante 9011.
  const INTEGRANTE_A = '9004';
  const LIDER_A = '9010';
  const INTEGRANTE_B = '9011';
  const campo = (userId: string) => new Api(app, tokenFor('ADMINISTRATIVO', userId));

  let cuadrillaA: string;
  let cuadrillaB: string;
  let zoneId: string;
  let serviceTypeId: string;
  let disposalSiteId: string;

  const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 2, 3, 4, 5, 6, 0xff, 0xd9]);

  async function servicioDe(crewId: string | null, { iniciado = true } = {}): Promise<string> {
    const creado = await oficina
      .post('/services', {
        serviceTypeId,
        scheduledDate: hoy(),
        origin: 'PLANNED',
        zoneId,
        // Varios servicios de la misma cuadrilla el mismo día se pisan: se pasa por la advertencia.
        ...(crewId && { crewId, overrideNote: 'Prueba e2e de pertenencia, mismo día' }),
      })
      .expect(201);
    if (iniciado && crewId) {
      const dueño = crewId === cuadrillaB ? INTEGRANTE_B : INTEGRANTE_A;
      await campo(dueño).post(`/services/${creado.body.id}/start`).expect(200);
    }
    return creado.body.id;
  }

  const prohibido = (res: request.Response) => {
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ statusCode: 403, code: 'NOT_ASSIGNED' });
    // Ni la cuadrilla dueña ni su líder se filtran en el mensaje.
    const texto = JSON.stringify(res.body);
    for (const dato of [cuadrillaA, cuadrillaB, LIDER_A, INTEGRANTE_A, INTEGRANTE_B]) {
      expect(texto).not.toContain(dato);
    }
  };

  beforeAll(async () => {
    // Storage en memoria: así una subida del dueño es un 201 exacto, sin bucket real.
    app = await createTestApp((b) =>
      b.overrideProvider(EVIDENCE_STORAGE).useValue({
        upload: async ({ key }: { key: string }) => ({ url: `https://storage.test/${key}` }),
        remove: async () => undefined,
      }),
    );
    prisma = app.get(PrismaService);
    await truncateAll(prisma);
    await seedActores(prisma);
    for (const u of [LIDER_A, INTEGRANTE_B])
      await grantRoles(prisma, u, [M6Role.M6_CAMPO_CUADRILLA]);
    await grantRoles(prisma, '9007', [M6Role.M6_CAMPO_INSPECTOR]);

    oficina = Api.porRol(app);
    zoneId = (await crearZona(oficina)).id;
    serviceTypeId = (await crearTipoServicio(oficina, { mode: 'POINT' })).id;
    disposalSiteId = (
      await prisma.disposalSite.create({
        data: { code: 'SITIO-OWN', name: 'Sitio e2e', siteType: 'LANDFILL' },
      })
    ).id;
    cuadrillaA = (await crearCuadrilla(oficina, [INTEGRANTE_A])).id;
    cuadrillaB = (await crearCuadrilla(oficina, [INTEGRANTE_B])).id;
    await oficina.patch(`/crews/${cuadrillaA}`, { leaderUserId: LIDER_A }).expect(200);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('servicios', () => {
    it('el integrante de otra cuadrilla no puede iniciar el servicio: 403 NOT_ASSIGNED', async () => {
      const id = await servicioDe(cuadrillaA, { iniciado: false });

      prohibido(await campo(INTEGRANTE_B).post(`/services/${id}/start`));

      const s = await prisma.service.findUniqueOrThrow({ where: { id } });
      expect(s.status).toBe('SCHEDULED');
    });

    it('el integrante y el líder de la cuadrilla sí ejecutan el ciclo completo', async () => {
      const id = await servicioDe(cuadrillaA, { iniciado: false });

      await campo(INTEGRANTE_A).post(`/services/${id}/start`).expect(200);
      await campo(LIDER_A).post(`/services/${id}/suspend`, { reason: 'Lluvia' }).expect(200);
      await campo(INTEGRANTE_A).post(`/services/${id}/resume`).expect(200);
      await campo(LIDER_A)
        .post(`/services/${id}/zone-results`, { zoneId, status: 'SERVICED' })
        .expect(201);
      const cerrado = await campo(INTEGRANTE_A).post(`/services/${id}/complete`).expect(200);
      expect(cerrado.body.status).toBe('COMPLETED');
    });

    it('un ajeno no puede suspender, reanudar, informar zona, registrar residuos ni avisar demora', async () => {
      const id = await servicioDe(cuadrillaA);
      const ajeno = campo(INTEGRANTE_B);

      prohibido(await ajeno.post(`/services/${id}/suspend`, { reason: 'x' }));
      prohibido(await ajeno.post(`/services/${id}/resume`));
      prohibido(await ajeno.post(`/services/${id}/zone-results`, { zoneId, status: 'SERVICED' }));
      prohibido(
        await ajeno.post(`/services/${id}/collection-records`, {
          wasteType: 'HOUSEHOLD',
          disposalSiteId: randomUUID(),
          weightKg: 100,
        }),
      );
      prohibido(
        await ajeno.post(`/services/${id}/delay-notices`, {
          delayType: 'DURATION',
          delayMinutes: 30,
          reason: 'Camión averiado',
        }),
      );
      prohibido(await ajeno.post(`/services/${id}/complete`));

      const s = await prisma.service.findUniqueOrThrow({ where: { id } });
      expect(s.status).toBe('IN_PROGRESS');
      expect(await prisma.zoneResult.count({ where: { serviceId: id } })).toBe(0);
    });

    it('un servicio sin cuadrilla da 403 a todo Campo, en cada acción', async () => {
      const id = await servicioDe(null);

      for (const quien of [INTEGRANTE_A, LIDER_A]) {
        const c = campo(quien);
        prohibido(await c.post(`/services/${id}/start`));
        prohibido(await c.post(`/services/${id}/suspend`, { reason: 'x' }));
        prohibido(await c.post(`/services/${id}/resume`));
        prohibido(await c.post(`/services/${id}/complete`));
        prohibido(await c.post(`/services/${id}/zone-results`, { zoneId, status: 'SERVICED' }));
        prohibido(
          await c.post(`/services/${id}/collection-records`, {
            wasteType: 'HOUSEHOLD',
            disposalSiteId,
            weightKg: 100,
          }),
        );
        prohibido(
          await c.post(`/services/${id}/delay-notices`, {
            delayType: 'START',
            delayMinutes: 30,
            reason: 'Camión averiado',
          }),
        );
      }
    });

    it('registrar residuos: el integrante y el líder de la cuadrilla pasan', async () => {
      const id = await servicioDe(cuadrillaA);

      for (const quien of [INTEGRANTE_A, LIDER_A]) {
        const res = await campo(quien)
          .post(`/services/${id}/collection-records`, {
            wasteType: 'HOUSEHOLD',
            disposalSiteId,
            weightKg: 100,
          })
          .expect(201);
        expect(res.body).toMatchObject({ disposalSiteId, wasteType: 'HOUSEHOLD' });
      }
      expect(await prisma.collectionRecord.count({ where: { serviceId: id } })).toBe(2);
    });

    it('avisar demora: el integrante y el líder de la cuadrilla pasan', async () => {
      const id = await servicioDe(cuadrillaA);

      for (const quien of [INTEGRANTE_A, LIDER_A]) {
        const res = await campo(quien)
          .post(`/services/${id}/delay-notices`, {
            delayType: 'DURATION',
            delayMinutes: 30,
            reason: 'Camión averiado',
          })
          .expect(201);
        expect(res.body).toMatchObject({ serviceId: id, delayType: 'DURATION' });
      }
      expect(await prisma.serviceDelayNotice.count({ where: { serviceId: id } })).toBe(2);
    });

    it('un servicio inexistente sigue siendo 404 (no se confunde con 403)', async () => {
      await campo(INTEGRANTE_B).post(`/services/${randomUUID()}/start`).expect(404);
    });

    it('los GET no se restringen: el ajeno lee el servicio', async () => {
      const id = await servicioDe(cuadrillaA);
      await campo(INTEGRANTE_B).get(`/services/${id}`).expect(200);
      await campo(INTEGRANTE_B).get(`/services/${id}/zone-results`).expect(200);
    });

    it('Oficina no cambia: asigna y cancela sin ser de ninguna cuadrilla', async () => {
      const id = await servicioDe(null);
      await oficina.post(`/services/${id}/assign-crew`, { crewId: cuadrillaB }).expect(200);
      await oficina.post(`/services/${id}/cancel`, { reason: 'Prueba' }).expect(200);
    });
  });

  describe('inspecciones', () => {
    async function inspeccion(inspectorId?: string): Promise<string> {
      const exp = await oficina.post('/environmental-reports', { reportType: 'NOISE' }).expect(201);
      await oficina.post(`/environmental-reports/${exp.body.id}/start-review`).expect(200);
      const res = await oficina
        .post(`/environmental-reports/${exp.body.id}/inspections`, {
          ...(inspectorId && { inspectorId }),
        })
        .expect(201);
      return res.body.id;
    }
    const cierre = { inspectedAt: new Date().toISOString(), outcome: 'NO_VIOLATION' };

    it('otro inspector que el asignado: 403 NOT_ASSIGNED y la inspección sigue abierta', async () => {
      const id = await inspeccion('9007');

      prohibido(await campo('9005').post(`/environmental-inspections/${id}/complete`, cierre));

      const i = await prisma.environmentalInspection.findUniqueOrThrow({ where: { id } });
      expect(i.outcome).toBeNull();
    });

    it('el asignado la cierra y queda como completedByUserId', async () => {
      const id = await inspeccion('9007');

      const res = await campo('9007')
        .post(`/environmental-inspections/${id}/complete`, cierre)
        .expect(200);

      expect(res.body).toMatchObject({ inspectorId: '9007', completedByUserId: '9007' });
    });

    it('sin inspector asignado la cierra cualquier inspector, y queda el del token', async () => {
      const id = await inspeccion();

      const res = await campo('9005')
        .post(`/environmental-inspections/${id}/complete`, cierre)
        .expect(200);

      expect(res.body).toMatchObject({ inspectorId: null, completedByUserId: '9005' });
    });

    it('una inspección ya cerrada: el ajeno ve 403 (no el 409), el asignado ve 409', async () => {
      const id = await inspeccion('9007');
      await campo('9007').post(`/environmental-inspections/${id}/complete`, cierre).expect(200);

      prohibido(await campo('9005').post(`/environmental-inspections/${id}/complete`, cierre));
      await campo('9007').post(`/environmental-inspections/${id}/complete`, cierre).expect(409);
    });
  });

  describe('evidencia', () => {
    const subir = (userId: string, ownerType: string, ownerId: string) =>
      request(app.getHttpServer())
        .post('/evidence')
        .set(bearer(tokenFor('ADMINISTRATIVO', userId)))
        .set('Idempotency-Key', randomUUID())
        .field('ownerType', ownerType)
        .field('ownerId', ownerId)
        .attach('file', JPEG, { filename: 'foto.jpg', contentType: 'image/jpeg' });

    it('SERVICE: el ajeno recibe 403 NOT_ASSIGNED; el integrante y el líder suben (201)', async () => {
      const id = await servicioDe(cuadrillaA);

      prohibido(await subir(INTEGRANTE_B, 'SERVICE', id));
      expect((await subir(INTEGRANTE_A, 'SERVICE', id)).status).toBe(201);
      expect((await subir(LIDER_A, 'SERVICE', id)).status).toBe(201);
    });

    it('SERVICE sin cuadrilla: 403 NOT_ASSIGNED para todo Campo', async () => {
      const id = await servicioDe(null);

      prohibido(await subir(INTEGRANTE_A, 'SERVICE', id));
      prohibido(await subir(LIDER_A, 'SERVICE', id));
    });

    it('ZONE_RESULT: sigue a la cuadrilla del servicio dueño', async () => {
      const id = await servicioDe(cuadrillaA);
      const zr = await campo(INTEGRANTE_A)
        .post(`/services/${id}/zone-results`, { zoneId, status: 'SERVICED' })
        .expect(201);

      prohibido(await subir(INTEGRANTE_B, 'ZONE_RESULT', zr.body.id));
      expect((await subir(INTEGRANTE_A, 'ZONE_RESULT', zr.body.id)).status).toBe(201);
    });

    it('INSPECTION: el asignado o cualquiera si no hay; otro inspector, 403', async () => {
      const exp = await oficina.post('/environmental-reports', { reportType: 'NOISE' }).expect(201);
      await oficina.post(`/environmental-reports/${exp.body.id}/start-review`).expect(200);
      const asignada = (
        await oficina
          .post(`/environmental-reports/${exp.body.id}/inspections`, { inspectorId: '9007' })
          .expect(201)
      ).body.id;

      prohibido(await subir('9005', 'INSPECTION', asignada));
      expect((await subir('9007', 'INSPECTION', asignada)).status).toBe(201);

      const exp2 = await oficina
        .post('/environmental-reports', { reportType: 'NOISE' })
        .expect(201);
      await oficina.post(`/environmental-reports/${exp2.body.id}/start-review`).expect(200);
      const libre = (
        await oficina.post(`/environmental-reports/${exp2.body.id}/inspections`, {}).expect(201)
      ).body.id;
      expect((await subir('9005', 'INSPECTION', libre)).status).toBe(201);
    });

    it('un dueño inexistente es 404, no 403', async () => {
      expect((await subir(INTEGRANTE_B, 'SERVICE', randomUUID())).status).toBe(404);
    });
  });

  describe('ids de cuadrilla', () => {
    it('rechaza ids de integrante y líder que no son numéricos de M1', async () => {
      await oficina.post(`/crews/${cuadrillaA}/members`, { userIds: ['usr-1'] }).expect(400);
      await oficina.patch(`/crews/${cuadrillaA}`, { leaderUserId: 'jefe' }).expect(400);
    });

    it('normaliza los ceros a la izquierda: el integrante "09012" es el 9012', async () => {
      const res = await oficina
        .post(`/crews/${cuadrillaB}/members`, { userIds: ['09012'] })
        .expect(201);
      expect(res.body.members).toEqual(
        expect.arrayContaining([expect.objectContaining({ userId: '9012' })]),
      );
    });
  });
});
