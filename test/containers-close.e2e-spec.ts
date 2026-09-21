import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '../src/prisma/prisma.service';
import {
  Api,
  crearContenedor,
  crearCuadrilla,
  crearTipoServicio,
  crearZona,
  createTestApp,
  hoy,
  tokenFor,
  truncateAll,
} from './helpers';

/**
 * Cerrar el servicio **es** la transición del contenedor: vaciado y reubicación
 * se ejecutan como un `Service` de modo POINT apuntando al contenedor, y las dos
 * escrituras van en la misma transacción.
 *
 * Con Prisma mockeado se puede verificar que se llamó a `container.update`; acá
 * se verifica lo que importa, que es que no quede una mitad escrita: el caso del
 * CHECK hace fallar la escritura del contenedor **dentro** de la transacción,
 * después de que el servicio ya se actualizó, y exige el rollback.
 */
describe('Cierre de servicio que transiciona el contenedor (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let api: Api;

  let zoneId: string;
  let serviceTypeId: string;
  let crewId: string;

  /** Un servicio POINT sobre el contenedor, llevado hasta IN_PROGRESS con la zona informada. */
  async function servicioListoParaCerrar(containerId: string): Promise<string> {
    const creado = await api
      .post('/services', {
        serviceTypeId,
        targetType: 'CONTAINER',
        targetId: containerId,
        scheduledDate: hoy(),
        origin: 'PLANNED',
        crewId,
      })
      .expect(201);

    const serviceId: string = creado.body.id;
    await api.post(`/services/${serviceId}/start`).expect(200);
    await api
      .post(`/services/${serviceId}/zone-results`, { zoneId, status: 'SERVICED' })
      .expect(201);
    return serviceId;
  }

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    api = new Api(app, tokenFor(['SUPERVISOR']));
    await truncateAll(prisma);

    zoneId = (await crearZona(api)).id;
    serviceTypeId = (await crearTipoServicio(api, { mode: 'POINT' })).id;
    crewId = (await crearCuadrilla(api)).id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('devuelve a ACTIVE el contenedor desbordado al cerrar el servicio', async () => {
    const contenedor = await crearContenedor(api, zoneId);
    await api.post(`/containers/${contenedor.id}/report-overflow`).expect(200);

    const serviceId = await servicioListoParaCerrar(contenedor.id);
    const cerrado = await api.post(`/services/${serviceId}/complete`).expect(200);
    expect(cerrado.body.status).toBe('COMPLETED');

    const fila = await prisma.container.findUniqueOrThrow({ where: { id: contenedor.id } });
    expect(fila.status).toBe('ACTIVE');
  });

  it('no cierra el servicio si falta la ubicación nueva del contenedor en RELOCATING', async () => {
    const contenedor = await crearContenedor(api, zoneId);
    await api.post(`/containers/${contenedor.id}/relocate`).expect(200);

    const serviceId = await servicioListoParaCerrar(contenedor.id);
    const res = await api.post(`/services/${serviceId}/complete`);
    expect(res.status).toBe(400);

    // Ninguna de las dos escrituras ocurrió: el servicio sigue abierto y el
    // contenedor sigue esperando la ubicación.
    const servicio = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
    expect(servicio.status).toBe('IN_PROGRESS');
    const fila = await prisma.container.findUniqueOrThrow({ where: { id: contenedor.id } });
    expect(fila.status).toBe('RELOCATING');

    // Con la ubicación, cierra y reubica de una sola vez.
    const cerrado = await api
      .post(`/services/${serviceId}/complete`, {
        containerLocation: { address: 'Av. Santa Fe 2800', lat: -34.5955, lng: -58.4016 },
      })
      .expect(200);
    expect(cerrado.body.status).toBe('COMPLETED');

    const reubicado = await prisma.container.findUniqueOrThrow({ where: { id: contenedor.id } });
    expect(reubicado.status).toBe('ACTIVE');
    expect(reubicado.address).toBe('Av. Santa Fe 2800');
  });

  it('revierte el cierre del servicio si falla la escritura del contenedor dentro de la transacción', async () => {
    const contenedor = await crearContenedor(api, zoneId);
    await api.post(`/containers/${contenedor.id}/report-overflow`).expect(200);
    const serviceId = await servicioListoParaCerrar(contenedor.id);
    const outboxAntes = await prisma.outboxEvent.count({ where: { aggregateId: serviceId } });

    // El 400 de RELOCATING sale en la validación previa, antes de abrir la
    // transacción, así que no prueba el rollback. Acá la validación pasa y lo que
    // falla es el UPDATE del contenedor, segunda escritura de la transacción.
    // NOT VALID: no revisa las filas ACTIVE que dejaron los otros casos.
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "container" ADD CONSTRAINT e2e_no_active CHECK (status <> 'ACTIVE') NOT VALID`,
    );
    try {
      const res = await api.post(`/services/${serviceId}/complete`);
      expect(res.status).toBe(500);
    } finally {
      await prisma.$executeRawUnsafe(`ALTER TABLE "container" DROP CONSTRAINT e2e_no_active`);
    }

    const servicio = await prisma.service.findUniqueOrThrow({ where: { id: serviceId } });
    expect(servicio.status).toBe('IN_PROGRESS');
    const fila = await prisma.container.findUniqueOrThrow({ where: { id: contenedor.id } });
    expect(fila.status).toBe('OVERFLOWED');
    expect(await prisma.outboxEvent.count({ where: { aggregateId: serviceId } })).toBe(outboxAntes);

    // Sin la restricción, el mismo cierre entra. Además libera la cuadrilla, que
    // no puede tener dos servicios abiertos el mismo día.
    await api.post(`/services/${serviceId}/complete`).expect(200);
  });

  it('no toca el contenedor si el cierre es parcial', async () => {
    const contenedor = await crearContenedor(api, zoneId);
    await api.post(`/containers/${contenedor.id}/report-overflow`).expect(200);

    const creado = await api
      .post('/services', {
        serviceTypeId,
        targetType: 'CONTAINER',
        targetId: contenedor.id,
        scheduledDate: hoy(),
        origin: 'PLANNED',
        crewId,
      })
      .expect(201);
    const serviceId: string = creado.body.id;

    await api.post(`/services/${serviceId}/start`).expect(200);
    await api
      .post(`/services/${serviceId}/zone-results`, {
        zoneId,
        status: 'NOT_SERVICED',
        reason: 'BLOCKED_ACCESS',
      })
      .expect(201);

    const cerrado = await api.post(`/services/${serviceId}/complete`).expect(200);
    expect(cerrado.body.status).toBe('PARTIALLY_COMPLETED');

    const fila = await prisma.container.findUniqueOrThrow({ where: { id: contenedor.id } });
    expect(fila.status).toBe('OVERFLOWED');
  });
});
