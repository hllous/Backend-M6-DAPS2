import { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { StreetClosureExpirySweeper } from '../src/modules/outbound-requests/street-closure-expiry.sweeper';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Api,
  crearRuta,
  crearTipoServicio,
  crearZona,
  createTestApp,
  hoy,
  tokenFor,
  truncateAll,
} from './helpers';

const DIA_MS = 24 * 60 * 60 * 1000;

function sobre(eventType: string, data: Record<string, unknown>) {
  return {
    specVersion: '1.70',
    eventId: randomUUID(),
    eventType,
    eventVersion: '1.0',
    occurredAt: new Date().toISOString(),
    producer: { moduleId: 'M7', service: 'transito' },
    subject: `street-closures/${data.closureRequestId}`,
    data,
  };
}

/**
 * Un corte aprobado que M7 deja expirar sin avisar (#321): se vence por
 * `approvedTo` + gracia y el servicio que dependía queda para reprogramar.
 */
describe('Vencimiento de cortes aprobados (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let api: Api;
  let sweeper: StreetClosureExpirySweeper;
  let rutaId: string;
  let tipoId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    sweeper = app.get(StreetClosureExpirySweeper);
    api = new Api(app, tokenFor(['SUPERVISOR']));
    await truncateAll(prisma);
    rutaId = (await crearRuta(api, [(await crearZona(api)).id])).id;
    tipoId = (await crearTipoServicio(api, { mode: 'ROUTE' })).id;
  });

  afterAll(async () => {
    await app.close();
  });

  /** Un servicio con un corte pedido, aprobado por M7 con la ventana dada. */
  async function corteAprobado(endDate: Date) {
    const servicio = await api
      .post('/services', {
        serviceTypeId: tipoId,
        routeId: rutaId,
        scheduledDate: hoy(),
        origin: 'PLANNED',
      })
      .expect(201);
    const corte = await api
      .post('/street-closure-requests', {
        sourceType: 'SERVICE',
        sourceId: servicio.body.id,
        reason: 'Trabajo sobre la calzada',
        sections: [{ streetName: 'Belgrano', fromCross: 'Mitre', toCross: 'San Martín' }],
        requestedFrom: new Date(endDate.getTime() - DIA_MS).toISOString(),
        requestedTo: endDate.toISOString(),
      })
      .expect(201);
    const res = await api
      .post(
        '/events/inbox',
        sobre('streetClosureApproved', {
          closureRequestId: corte.body.id,
          streetClosureId: 'CL-1',
          startDate: new Date(endDate.getTime() - DIA_MS).toISOString(),
          endDate: endDate.toISOString(),
        }),
      )
      .expect(200);
    expect(res.body.status).toBe('processed');
    return { corteId: corte.body.id as string, servicioId: servicio.body.id as string };
  }

  it('persiste la ventana, vence por el barrido y reprograma el servicio', async () => {
    const endDate = new Date(Date.now() - 2 * DIA_MS);
    const { corteId, servicioId } = await corteAprobado(endDate);

    const aprobado = await prisma.streetClosureRequest.findUniqueOrThrow({
      where: { id: corteId },
    });
    expect(aprobado.status).toBe('APPROVED');
    expect(aprobado.approvedTo?.toISOString()).toBe(endDate.toISOString());

    await sweeper.expireClosures();

    const vencido = await prisma.streetClosureRequest.findUniqueOrThrow({
      where: { id: corteId },
    });
    expect(vencido.status).toBe('EXPIRED');
    const servicio = await prisma.service.findUniqueOrThrow({ where: { id: servicioId } });
    expect(servicio.status).toBe('RESCHEDULED');
    expect(servicio.statusReason).toBe('venció la ventana autorizada del corte');

    // Nada hacia M7: el corte ya expiró de su lado.
    const aM7 = await prisma.outboxEvent.count({
      where: { aggregateId: corteId, eventType: { not: 'streetClosureRequested' } },
    });
    expect(aM7).toBe(0);

    // Idempotente: una segunda pasada no cambia nada.
    await sweeper.expireClosures();
    expect(
      (await prisma.streetClosureRequest.findUniqueOrThrow({ where: { id: corteId } })).status,
    ).toBe('EXPIRED');
  });

  it('un streetClosureEnded posterior sobre el corte EXPIRED se acepta', async () => {
    const { corteId } = await corteAprobado(new Date(Date.now() - 2 * DIA_MS));
    await sweeper.expireClosures();

    const res = await api
      .post('/events/inbox', sobre('streetClosureEnded', { closureRequestId: corteId }))
      .expect(200);

    expect(res.body.status).toBe('processed');
    expect(
      (await prisma.streetClosureRequest.findUniqueOrThrow({ where: { id: corteId } })).status,
    ).toBe('ENDED');
  });

  it('un corte dentro de la gracia o todavia vigente no se toca', async () => {
    const dentroDeGracia = await corteAprobado(new Date(Date.now() - 60 * 60 * 1000));
    const vigente = await corteAprobado(new Date(Date.now() + DIA_MS));

    await sweeper.expireClosures();

    for (const { corteId, servicioId } of [dentroDeGracia, vigente]) {
      expect(
        (await prisma.streetClosureRequest.findUniqueOrThrow({ where: { id: corteId } })).status,
      ).toBe('APPROVED');
      expect((await prisma.service.findUniqueOrThrow({ where: { id: servicioId } })).status).toBe(
        'SCHEDULED',
      );
    }
  });

  it('un servicio ya iniciado no se reprograma al vencer su corte', async () => {
    const { corteId, servicioId } = await corteAprobado(new Date(Date.now() - 2 * DIA_MS));
    await prisma.service.update({ where: { id: servicioId }, data: { status: 'IN_PROGRESS' } });

    await sweeper.expireClosures();

    expect(
      (await prisma.streetClosureRequest.findUniqueOrThrow({ where: { id: corteId } })).status,
    ).toBe('EXPIRED');
    expect((await prisma.service.findUniqueOrThrow({ where: { id: servicioId } })).status).toBe(
      'IN_PROGRESS',
    );
  });
});
