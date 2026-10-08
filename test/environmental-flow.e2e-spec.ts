import { NestExpressApplication } from '@nestjs/platform-express';
import { OutboxEventStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
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
        // Con reclamo de M2: cada paso proyecta también un updateTicketStatus.
        ticketId: 'TCK-E2E-ACTA',
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

    // Un solo hilo para la acción (#267): el acta hacia M4 y la novedad hacia M2
    // salen de enqueue distintos pero del mismo request.
    const hilo = await prisma.outboxEvent.findMany({
      where: { correlationId: encolados[0].correlationId },
    });
    expect(hilo.map((e) => e.eventType).sort()).toEqual([
      'environmentalViolationDetected',
      'updateTicketStatus',
    ]);
    expect(hilo.every((e) => e.causationId === null)).toBe(true);
  });

  it('no deja emitir una segunda acta sobre la misma inspección', async () => {
    const res = await api.post(`/environmental-inspections/${inspectionId}/violation-notice`, {
      violationType: 'UNTREATED_DISCHARGE',
      severity: 'HIGH',
      suggestedAction: 'FINE',
    });

    expect(res.status).toBe(409);
  });

  it('recibe la multa de M4 por el inbox, registra la resolución y cierra el expediente', async () => {
    const acta = await prisma.violationNotice.findFirstOrThrow({ where: { inspectionId } });
    const evento = {
      specVersion: '1.70',
      eventId: randomUUID(),
      eventType: 'commercialFineGenerated',
      eventVersion: '1.0',
      occurredAt: new Date().toISOString(),
      producer: { moduleId: 'M4', service: 'habilitaciones' },
      subject: `violations/${acta.id}`,
      data: {
        sourceViolationId: acta.id,
        actId: 'MULTA-E2E-01',
        decision: 'FINE_ISSUED',
        decidedAt: '2026-09-01T12:00:00.000Z',
        externalRef: 'EXT-E2E-01',
      },
    };

    const primera = await api.post('/events/inbox', evento).expect(200);
    expect(primera.body.status).toBe('processed');

    // El consumidor pasa por SANCTIONED y cierra en la misma transacción.
    const expediente = await prisma.environmentalReport.findUniqueOrThrow({
      where: { id: reportId },
    });
    expect(expediente.status).toBe('CLOSED');
    const resolucion = await prisma.sanctionOutcome.findMany({
      where: { violationNoticeId: acta.id },
    });
    expect(resolucion).toHaveLength(1);
    expect(resolucion[0]).toMatchObject({ decision: 'FINE_ISSUED', externalRef: 'EXT-E2E-01' });
    expect(resolucion[0].decidedAt?.toISOString()).toBe('2026-09-01T12:00:00.000Z');

    // Mismo eventId: el inbox lo descarta y no se duplica nada.
    const segunda = await api.post('/events/inbox', evento).expect(200);
    expect(segunda.body.status).toBe('duplicate');
    expect(await prisma.sanctionOutcome.count({ where: { violationNoticeId: acta.id } })).toBe(1);
    expect(await prisma.inboxEvent.count({ where: { messageId: evento.eventId } })).toBe(1);

    // Otro eventId sobre la misma acta: el handler lo descarta, sigue habiendo una sola resolución.
    // 'processed' y no 'failed': lo descarta el guard, no el @unique de violationNoticeId.
    const tercera = await api
      .post('/events/inbox', { ...evento, eventId: randomUUID() })
      .expect(200);
    expect(tercera.body.status).toBe('processed');
    expect(await prisma.sanctionOutcome.count({ where: { violationNoticeId: acta.id } })).toBe(1);
  });

  it('rechaza con 400 una multa sin sourceViolationId válido y no guarda la fila', async () => {
    const eventId = randomUUID();
    const res = await api
      .post('/events/inbox', {
        specVersion: '1.70',
        eventId,
        eventType: 'commercialFineGenerated',
        eventVersion: '1.0',
        occurredAt: new Date().toISOString(),
        producer: { moduleId: 'M4', service: 'habilitaciones' },
        subject: 'violations/n-a',
        data: { sourceViolationId: 'no-es-uuid' },
      })
      .expect(400);

    expect(res.body.message).toContain('sourceViolationId');
    expect(await prisma.inboxEvent.findUnique({ where: { messageId: eventId } })).toBeNull();
  });

  describe('vínculo servicio → inspección (#218)', () => {
    /** Expediente nuevo con una inspección abierta y sin servicio. */
    const inspeccionAbierta = async (): Promise<string> => {
      const r = await api.post('/environmental-reports', { reportType: 'NOISE' }).expect(201);
      await api.post(`/environmental-reports/${r.body.id}/start-review`).expect(200);
      const insp = await api.post(`/environmental-reports/${r.body.id}/inspections`).expect(201);
      return insp.body.id;
    };

    const altaInspeccion = async (id: string) => {
      const zona = await crearZona(api);
      const tipo = await crearTipoServicio(api, {
        category: 'ENVIRONMENTAL_CONTROL',
        mode: 'POINT',
      });
      return {
        serviceTypeId: tipo.id,
        scheduledDate: hoy(),
        origin: 'INSPECTION',
        zoneId: zona.id,
        inspectionId: id,
      };
    };

    it('no programa un servicio para una inspección ya cerrada', async () => {
      const id = await inspeccionAbierta();
      await api
        .post(`/environmental-inspections/${id}/complete`, {
          inspectedAt: new Date().toISOString(),
          outcome: 'NO_VIOLATION',
        })
        .expect(200);

      const res = await api.post('/services', await altaInspeccion(id)).expect(409);

      expect(res.body.message).toMatch(/cerrada/);
      const inspeccion = await prisma.environmentalInspection.findUniqueOrThrow({ where: { id } });
      expect(inspeccion.serviceId).toBeNull();
    });

    it('con altas concurrentes sobre la misma inspección gana una sola', async () => {
      const id = await inspeccionAbierta();
      const body = await altaInspeccion(id);
      const servicios0 = await prisma.service.count();
      const eventos = () =>
        prisma.outboxEvent.count({ where: { eventType: 'urbanServiceScheduled' } });
      const eventos0 = await eventos();

      // Todas pasan el chequeo previo a la vez: lo que decide es el updateMany
      // condicionado dentro de la transacción de cada alta.
      const res = await Promise.all(Array.from({ length: 12 }, () => api.post('/services', body)));
      const codigos = res.map((r) => r.status);

      expect(codigos.filter((c) => c === 201)).toHaveLength(1);
      expect(codigos.filter((c) => c === 409)).toHaveLength(11);
      expect(await prisma.service.count()).toBe(servicios0 + 1);
      expect(await eventos()).toBe(eventos0 + 1);
      const ganador = res.find((r) => r.status === 201)!;
      const inspeccion = await prisma.environmentalInspection.findUniqueOrThrow({ where: { id } });
      expect(inspeccion.serviceId).toBe(ganador.body.id);
    });
  });
});
