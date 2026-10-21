import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../src/prisma/prisma.service';
import { Api, createTestApp, seedActores, truncateAll } from './helpers';

/**
 * #325: el aviso del acta a M2 depende del estado del ticket. PROGRESS solo
 * vale con el ticket IN_PROGRESS; si el expediente no pasó por `startReview`
 * (p. ej. nació del reclamo ya en análisis) el ticket sigue ROUTED y va STARTED.
 */
describe('Acta ambiental: aviso a M2 según el estado del ticket (e2e)', () => {
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

  /** Lleva el expediente hasta emitir el acta y devuelve los updateType enviados a M2. */
  async function emitirActa(conStartReview: boolean): Promise<string[]> {
    const ticketId = `TCK-${randomUUID()}`;
    let reportId: string;
    if (conStartReview) {
      const res = await api
        .post('/environmental-reports', {
          reportType: 'WATER_DISCHARGE',
          address: 'Camino de Cintura 4500',
          ticketId,
        })
        .expect(201);
      reportId = res.body.id;
      await api.post(`/environmental-reports/${reportId}/start-review`).expect(200);
    } else {
      // Como los que crea el consumidor de M2: ya en análisis, sin nuestro STARTED.
      const r = await prisma.environmentalReport.create({
        data: { ticketId, reportType: 'WATER_DISCHARGE', status: 'UNDER_REVIEW' },
      });
      reportId = r.id;
    }

    const insp = await api
      .post(`/environmental-reports/${reportId}/inspections`, { inspectorId: 'user-e2e' })
      .expect(201);
    await api
      .post(`/environmental-inspections/${insp.body.id}/complete`, {
        inspectedAt: new Date().toISOString(),
        outcome: 'VIOLATION_FOUND',
        nextStep: 'NOTICE_TO_BE_ISSUED',
        findings: 'Vertido sin tratar.',
        conclusion: 'Vertido confirmado.',
        violationType: 'UNTREATED_DISCHARGE',
        severity: 'HIGH',
        suggestedAction: 'FINE',
        checklist: [],
      })
      .expect(200);
    await api
      .post(`/environmental-inspections/${insp.body.id}/violation-notice`, {
        violationType: 'UNTREATED_DISCHARGE',
        severity: 'HIGH',
        suggestedAction: 'FINE',
      })
      .expect(201);

    const avisos = await prisma.outboxEvent.findMany({
      where: { eventType: 'updateTicketStatus', aggregateId: reportId },
      orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
    });
    return avisos.map((a) => (a.payload as { updateType: string }).updateType);
  }

  it('sin startReview previo el acta informa STARTED, no PROGRESS', async () => {
    expect(await emitirActa(false)).toEqual(['STARTED']);
  });

  it('con startReview previo el acta informa PROGRESS', async () => {
    expect(await emitirActa(true)).toEqual(['STARTED', 'PROGRESS']);
  });
});
