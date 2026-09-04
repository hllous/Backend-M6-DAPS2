import { NotFoundException } from '@nestjs/common';
import { EnvironmentalReportStatus as S, Prisma, ServiceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CitizenPortalService } from './citizen-portal.service';
import { PublicReportStage } from './dto';

describe('CitizenPortalService', () => {
  let prisma: any;
  let portal: CitizenPortalService;

  const expediente = (over: Record<string, unknown> = {}) => ({
    ticketId: 'TCK-2026-004512',
    reportType: 'NOISE',
    status: S.INSPECTED,
    address: 'Av. Rivadavia 4500',
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    updatedAt: new Date('2026-08-20T09:00:00.000Z'),
    inspections: [{ inspectedAt: new Date('2026-08-15T14:00:00.000Z') }],
    ...over,
  });

  beforeEach(() => {
    prisma = {
      environmentalReport: { findFirst: jest.fn().mockResolvedValue(expediente()) },
      service: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      greenPoint: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      zone: { findMany: jest.fn().mockResolvedValue([]) },
    };
    portal = new CitizenPortalService(prisma as unknown as PrismaService);
  });

  describe('seguimiento de la denuncia', () => {
    // El criterio central de la fase: la vista pública no puede filtrar nada
    // interno, ni siquiera por descuido de un select nuevo.
    it('devuelve exactamente los campos públicos, ni uno más', async () => {
      const result = await portal.findReportByTicket('TCK-2026-004512');

      expect(Object.keys(result).sort()).toEqual([
        'address',
        'closed',
        'inspectedAt',
        'lastUpdateAt',
        'openedAt',
        'reportType',
        'stage',
        'stageLabel',
        'ticketId',
      ]);
    });

    it('no consulta hallazgos, inspector, checklist ni denunciante', async () => {
      await portal.findReportByTicket('TCK-2026-004512');

      const [[args]] = prisma.environmentalReport.findFirst.mock.calls;
      const pedido = JSON.stringify(args.select);
      for (const interno of ['findings', 'inspectorId', 'checklistItems', 'reporterSnapshot']) {
        expect(pedido).not.toContain(interno);
      }
    });

    it('colapsa el estado interno a una etapa que el vecino puede leer', async () => {
      prisma.environmentalReport.findFirst.mockResolvedValue(
        expediente({ status: S.NOTICE_ISSUED }),
      );

      const result = await portal.findReportByTicket('TCK-1');

      // NOTICE_ISSUED es vocabulario de inspector: para el vecino es "el
      // trámite sancionatorio sigue su curso".
      expect(result.stage).toBe(PublicReportStage.EN_TRAMITE_SANCIONATORIO);
      expect(result.stageLabel).toContain('Habilitaciones');
      expect(result.closed).toBe(false);
    });

    it.each([S.CLOSED, S.DISMISSED, S.NO_VIOLATION])(
      '%s se muestra como cerrada',
      async (status) => {
        prisma.environmentalReport.findFirst.mockResolvedValue(expediente({ status }));

        const result = await portal.findReportByTicket('TCK-1');

        expect(result.stage).toBe(PublicReportStage.CERRADA);
        expect(result.closed).toBe(true);
      },
    );

    it('publica la fecha de inspección pero nunca quién inspeccionó', async () => {
      const result = await portal.findReportByTicket('TCK-1');

      expect(result.inspectedAt).toEqual(new Date('2026-08-15T14:00:00.000Z'));
      expect(result).not.toHaveProperty('inspectorId');
    });

    it('sin inspección hecha, la fecha viaja nula', async () => {
      prisma.environmentalReport.findFirst.mockResolvedValue(expediente({ inspections: [] }));

      const result = await portal.findReportByTicket('TCK-1');

      expect(result.inspectedAt).toBeNull();
    });

    it('un reclamo sin expediente da 404 sin decir si el ticket existe en M2', async () => {
      prisma.environmentalReport.findFirst.mockResolvedValue(null);

      await expect(portal.findReportByTicket('TCK-AJENO')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('cuándo pasa el servicio', () => {
    it('sin fechas mira los próximos 30 días y saltea los cancelados', async () => {
      await portal.findServices({ page: 1, pageSize: 20 } as any);

      const [[args]] = prisma.service.findMany.mock.calls;
      const dias = Math.round(
        (args.where.scheduledDate.lte - args.where.scheduledDate.gte) / 86_400_000,
      );
      expect(dias).toBe(30);
      expect(args.where.status).toEqual({ not: ServiceStatus.CANCELLED });
    });

    it('no expone cuadrilla, vehículo, notas ni el motivo interno del estado', async () => {
      await portal.findServices({ page: 1, pageSize: 20 } as any);

      const [[args]] = prisma.service.findMany.mock.calls;
      const pedido = JSON.stringify(args.select);
      for (const interno of ['crewId', 'vehicleId', 'notes', 'statusReason', 'createdBy']) {
        expect(pedido).not.toContain(interno);
      }
    });

    it('traduce el estado operativo y arma la ventana horaria', async () => {
      prisma.service.findMany.mockResolvedValue([
        {
          id: 'srv-1',
          scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
          windowFrom: new Date('1970-01-01T06:00:00.000Z'),
          windowTo: new Date('1970-01-01T10:30:00.000Z'),
          status: ServiceStatus.PARTIALLY_COMPLETED,
          serviceType: { name: 'Recolección domiciliaria', category: 'WASTE_COLLECTION' },
          zones: [{ zone: { name: 'Centro' } }],
        },
      ]);
      prisma.service.count.mockResolvedValue(1);

      const { data } = await portal.findServices({ page: 1, pageSize: 20 } as any);

      expect(data[0]).toMatchObject({
        serviceTypeName: 'Recolección domiciliaria',
        windowFrom: '06:00',
        windowTo: '10:30',
        stage: 'REALIZADO',
        zones: ['Centro'],
      });
    });
  });

  describe('puntos verdes', () => {
    it('solo los activos, con los residuos que recibe cada uno', async () => {
      prisma.greenPoint.findMany.mockResolvedValue([
        {
          id: 'gp-1',
          code: 'PV-014',
          name: 'Punto Verde Plaza Mitre',
          address: 'Av. Mitre 1200',
          lat: new Prisma.Decimal('-34.6037'),
          lng: null,
          zone: { name: 'Centro' },
          wasteTypes: [{ wasteType: 'RECYCLABLE' }, { wasteType: 'GREEN' }],
        },
      ]);
      prisma.greenPoint.count.mockResolvedValue(1);

      const { data } = await portal.findGreenPoints({ page: 1, pageSize: 20 } as any);

      expect(prisma.greenPoint.findMany.mock.calls[0][0].where.active).toBe(true);
      expect(data[0]).toEqual({
        id: 'gp-1',
        code: 'PV-014',
        name: 'Punto Verde Plaza Mitre',
        address: 'Av. Mitre 1200',
        lat: -34.6037,
        lng: null,
        zoneName: 'Centro',
        wasteTypes: ['RECYCLABLE', 'GREEN'],
      });
    });
  });

  it('las zonas públicas son solo las activas, con código y nombre', async () => {
    await portal.findZones();

    const [[args]] = prisma.zone.findMany.mock.calls;
    expect(args.where).toEqual({ active: true });
    expect(args.select).toEqual({ id: true, code: true, name: true });
  });
});
