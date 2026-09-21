import { NestExpressApplication } from '@nestjs/platform-express';
import { OutboxEventStatus } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Api,
  crearTipoServicio,
  crearZona,
  createTestApp,
  hoy,
  tokenFor,
  truncateAll,
} from './helpers';

/**
 * El expediente ambiental de punta a punta: denuncia → análisis → inspección →
 * acta de constatación.
 *
 * Cada paso lo mueve un módulo distinto (`EnvironmentalReportsService` aplica
 * la transición dentro de la transacción de `EnvironmentalInspectionsService`),
 * así que es justo el caso que los unitarios con Prisma mockeado no pueden
 * probar: que las dos escrituras queden persistidas. Solo el camino feliz: el
 * rollback ante una falla a mitad de camino no se prueba acá.
 */
describe('Flujo del expediente ambiental (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let api: Api;

  let reportId: string;
  let inspectionId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    api = new Api(app, tokenFor(['INSPECTOR']));
    await truncateAll(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('recibe la denuncia y la toma para análisis', async () => {
    const creado = await api
      .post('/environmental-reports', {
        reportType: 'WATER_DISCHARGE',
        address: 'Camino de Cintura 4500',
        description: '  Vuelco de efluentes al pluvial.  ',
        priority: 'HIGH',
      })
      .expect(201);

    reportId = creado.body.id;
    expect(creado.body.status).toBe('RECEIVED');
    expect(creado.body.description).toBe('Vuelco de efluentes al pluvial.');
    const detalle = await api.get(`/environmental-reports/${reportId}`).expect(200);
    expect(detalle.body.description).toBe('Vuelco de efluentes al pluvial.');

    const enAnalisis = await api
      .post(`/environmental-reports/${reportId}/start-review`)
      .expect(200);
    expect(enAnalisis.body.status).toBe('UNDER_REVIEW');
  });

  it('programa la inspección y deja el expediente en INSPECTION_SCHEDULED', async () => {
    const res = await api
      .post(`/environmental-reports/${reportId}/inspections`, { inspectorId: 'user-e2e' })
      .expect(201);

    inspectionId = res.body.id;

    const expediente = await prisma.environmentalReport.findUniqueOrThrow({
      where: { id: reportId },
    });
    expect(expediente.status).toBe('INSPECTION_SCHEDULED');
  });

  it('programa el servicio de la inspección y el vínculo queda en la inspección (#218)', async () => {
    const zona = await crearZona(api);
    const tipo = await crearTipoServicio(api, { category: 'ENVIRONMENTAL_CONTROL', mode: 'POINT' });

    const res = await api
      .post('/services', {
        serviceTypeId: tipo.id,
        scheduledDate: hoy(),
        origin: 'INSPECTION',
        zoneId: zona.id,
        inspectionId,
      })
      .expect(201);

    expect(res.body.inspectionId).toBe(inspectionId);
    const inspeccion = await prisma.environmentalInspection.findUniqueOrThrow({
      where: { id: inspectionId },
    });
    expect(inspeccion.serviceId).toBe(res.body.id);

    // Una segunda alta sobre la misma inspección no le pisa el servicio.
    await api
      .post('/services', {
        serviceTypeId: tipo.id,
        scheduledDate: hoy(),
        origin: 'INSPECTION',
        zoneId: zona.id,
        inspectionId,
      })
      .expect(409);
  });

  it('cierra la inspección con infracción y lleva el expediente a VIOLATION_FOUND', async () => {
    // #217: lo que el frontend manda al cerrar con infracción.
    const cierre = {
      conclusion: 'Vertido confirmado en el fondo del predio.',
      violationType: 'UNTREATED_DISCHARGE',
      severity: 'HIGH',
      suggestedAction: 'FINE',
    };
    const res = await api
      .post(`/environmental-inspections/${inspectionId}/complete`, {
        inspectedAt: new Date().toISOString(),
        outcome: 'VIOLATION_FOUND',
        nextStep: 'NOTICE_TO_BE_ISSUED',
        findings: 'Vertido de efluentes sin tratar al pluvial.',
        checklist: [
          { itemCode: 'RES-01', label: 'Plan de gestión de residuos vigente', result: false },
        ],
        ...cierre,
      })
      .expect(200);

    expect(res.body.outcome).toBe('VIOLATION_FOUND');
    expect(res.body).toMatchObject(cierre);

    const detalle = await api.get(`/environmental-inspections/${inspectionId}`).expect(200);
    expect(detalle.body).toMatchObject(cierre);

    const expediente = await prisma.environmentalReport.findUniqueOrThrow({
      where: { id: reportId },
    });
    // INSPECTED es de paso: sale enseguida al resultado, en la misma transacción.
    expect(expediente.status).toBe('VIOLATION_FOUND');
  });

  it('emite el acta, la deriva a M4 y cierra el expediente en NOTICE_ISSUED', async () => {
    const res = await api
      .post(`/environmental-inspections/${inspectionId}/violation-notice`, {
        violationType: 'UNTREATED_DISCHARGE',
        severity: 'HIGH',
        suggestedAction: 'FINE',
        establishmentId: 'EST-E2E-01',
      })
      .expect(201);

    expect(res.body.noticeNumber).toMatch(/^ACTA-/);

    const expediente = await prisma.environmentalReport.findUniqueOrThrow({
      where: { id: reportId },
    });
    expect(expediente.status).toBe('NOTICE_ISSUED');
    expect(expediente.deadlineAt).not.toBeNull();

    const encolados = await prisma.outboxEvent.findMany({
      where: { eventType: 'environmentalViolationDetected' },
    });
    expect(encolados).toHaveLength(1);
    expect(encolados[0].status).toBe(OutboxEventStatus.PENDING);
    expect((encolados[0].payload as { establishmentId: string }).establishmentId).toBe(
      'EST-E2E-01',
    );
  });

  it('no deja emitir una segunda acta sobre la misma inspección', async () => {
    const res = await api.post(`/environmental-inspections/${inspectionId}/violation-notice`, {
      violationType: 'UNTREATED_DISCHARGE',
      severity: 'HIGH',
      suggestedAction: 'FINE',
    });

    expect(res.status).toBe(409);
  });
});
