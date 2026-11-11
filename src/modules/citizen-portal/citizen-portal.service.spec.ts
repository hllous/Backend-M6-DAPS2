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
      environmentalReport: { findFirst: vi.fn().mockResolvedValue(expediente()) },
      service: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
      greenPoint: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      },
      zone: { findMany: vi.fn().mockResolvedValue([]) },
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
        // #145: referencia humana de M2, se muestra; no es credencial.
        'publicId',
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
      for (const interno of [
        'findings',
        'conclusion',
        'inspectorId',
        'checklistItems',
        'reporterSnapshot',
      ]) {
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

      const pedido = portal.findReportByTicket('TCK-AJENO');

      await expect(pedido).rejects.toBeInstanceOf(NotFoundException);
      await expect(pedido).rejects.toThrow(
        "No hay una denuncia ambiental para el reclamo 'TCK-AJENO'",
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

    it('sin from arranca hoy en Argentina aunque en UTC ya sea mañana', async () => {
      vi.useFakeTimers({ now: new Date('2026-09-20T01:00:00.000Z') }); // 22:00 ART del 19
      try {
        await portal.findServices({ page: 1, pageSize: 20 } as any);
      } finally {
        vi.useRealTimers();
      }

      const { scheduledDate } = prisma.service.findMany.mock.calls[0][0].where;
      expect(scheduledDate.gte).toEqual(new Date('2026-09-19T00:00:00.000Z'));
      expect(scheduledDate.lte).toEqual(new Date('2026-10-19T00:00:00.000Z'));
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
          zones: [{ zone: { name: 'Centro' } }, { zone: { name: 'Norte' } }],
        },
      ]);
      prisma.service.count.mockResolvedValue(1);

      const { data } = await portal.findServices({ page: 1, pageSize: 20 } as any);

      expect(data[0]).toEqual({
        id: 'srv-1',
        serviceTypeName: 'Recolección domiciliaria',
        category: 'WASTE_COLLECTION',
        scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
        windowFrom: '06:00',
        windowTo: '10:30',
        stage: 'REALIZADO',
        zones: ['Centro', 'Norte'],
      });
    });
  });

  // ─── #152: las ramas de los filtros, que no tocaba ningún caso ──

  describe('filtros del calendario público', () => {
    it('con from y to explícitos respeta esas fechas', async () => {
      await portal.findServices({
        page: 1,
        pageSize: 20,
        from: '2026-10-01',
        to: '2026-10-05',
      } as any);

      const { scheduledDate } = prisma.service.findMany.mock.calls[0][0].where;
      expect(scheduledDate.gte).toEqual(new Date('2026-10-01'));
      expect(scheduledDate.lte).toEqual(new Date('2026-10-05'));
    });

    it('from y to con hora se truncan al día: scheduledDate es @db.Date', async () => {
      await portal.findServices({
        page: 1,
        pageSize: 20,
        from: '2026-10-01T15:00:00.000Z',
        to: '2026-10-05T15:00:00.000Z',
      } as any);

      const { scheduledDate } = prisma.service.findMany.mock.calls[0][0].where;
      expect(scheduledDate.gte).toEqual(new Date('2026-10-01T00:00:00.000Z'));
      // Sin truncar, el lte a las 15:00 dejaría afuera el servicio del día 5.
      expect(scheduledDate.lte).toEqual(new Date('2026-10-05T00:00:00.000Z'));
    });

    it('filtra por tipo de servicio y por zona', async () => {
      await portal.findServices({
        page: 1,
        pageSize: 20,
        serviceTypeId: 'st-1',
        zoneId: 'z-1',
      } as any);
      await portal.findServices({ page: 1, pageSize: 20 } as any);

      const [[{ where }], [sinFiltros]] = prisma.service.findMany.mock.calls;
      expect(where.serviceTypeId).toBe('st-1');
      expect(where.zones).toEqual({ some: { zoneId: 'z-1' } });
      expect(sinFiltros.where).not.toHaveProperty('serviceTypeId');
      expect(sinFiltros.where).not.toHaveProperty('zones');
    });

    it('un servicio sin ventana horaria la publica nula, no rompe', async () => {
      prisma.service.findMany.mockResolvedValue([
        {
          id: 'srv-2',
          scheduledDate: new Date('2026-09-15T00:00:00.000Z'),
          windowFrom: null,
          windowTo: null,
          status: ServiceStatus.SCHEDULED,
          serviceType: { name: 'Barrido', category: 'STREET_CLEANING' },
          zones: [],
        },
      ]);
      prisma.service.count.mockResolvedValue(1);

      const { data } = await portal.findServices({ page: 1, pageSize: 20 } as any);

      expect(data[0]).toMatchObject({ windowFrom: null, windowTo: null, stage: 'PROGRAMADO' });
    });
  });

  describe('puntos verdes', () => {
    it('filtra por zona cuando se la pide, ordena por nombre y proyecta solo lo público', async () => {
      await portal.findGreenPoints({ page: 1, pageSize: 20, zoneId: 'z-1' } as any);
      await portal.findGreenPoints({ page: 1, pageSize: 20 } as any);

      const [[con], [sin]] = prisma.greenPoint.findMany.mock.calls;
      expect(con.where).toEqual({ active: true, zoneId: 'z-1' });
      expect(sin.where).toStrictEqual({ active: true });
      expect(con.orderBy).toEqual({ name: 'asc' });
      expect(con.select).toEqual({
        id: true,
        code: true,
        name: true,
        address: true,
        lat: true,
        lng: true,
        zone: { select: { name: true } },
        wasteTypes: { select: { wasteType: true } },
      });
      expect(prisma.greenPoint.count).toHaveBeenCalledWith({ where: con.where });
    });

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
        {
          id: 'gp-2',
          code: 'PV-015',
          name: 'Punto Verde Norte',
          address: 'Calle 1',
          lat: null,
          lng: new Prisma.Decimal('-58.3816'),
          zone: { name: 'Norte' },
          wasteTypes: [],
        },
      ]);
      prisma.greenPoint.count.mockResolvedValue(2);

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
      expect(data[1]).toMatchObject({ lat: null, lng: -58.3816 });
    });
  });

  it('las zonas públicas son solo las activas, con código y nombre', async () => {
    await portal.findZones();

    const [[args]] = prisma.zone.findMany.mock.calls;
    expect(args.where).toEqual({ active: true });
    expect(args.orderBy).toEqual({ name: 'asc' });
    expect(args.select).toEqual({ id: true, code: true, name: true });
  });

  // Regla: los once estados internos se colapsan a siete etapas públicas.
  it.each([
    [S.RECEIVED, PublicReportStage.RECIBIDA],
    [S.UNDER_REVIEW, PublicReportStage.EN_ANALISIS],
    [S.INSPECTION_SCHEDULED, PublicReportStage.INSPECCION_PROGRAMADA],
    [S.INSPECTED, PublicReportStage.INSPECCIONADA],
    [S.VIOLATION_FOUND, PublicReportStage.EN_TRAMITE_SANCIONATORIO],
    [S.NOTICE_ISSUED, PublicReportStage.EN_TRAMITE_SANCIONATORIO],
    [S.SANCTIONED, PublicReportStage.EN_TRAMITE_SANCIONATORIO],
    [S.FORWARDED, PublicReportStage.DERIVADA],
    [S.DISMISSED, PublicReportStage.CERRADA],
    [S.NO_VIOLATION, PublicReportStage.CERRADA],
    [S.CLOSED, PublicReportStage.CERRADA],
  ])('el estado %s se publica como la etapa %s', async (status, etapa) => {
    prisma.environmentalReport.findFirst.mockResolvedValue(expediente({ status }));

    const result = await portal.findReportByTicket('TCK-1');

    expect(result.stage).toBe(etapa);
    expect(result.closed).toBe(etapa === PublicReportStage.CERRADA);
  });

  // El vecino lee este texto tal cual: ninguna etapa puede salir vacía ni
  // repetir la frase de otra.
  it('cada etapa pública tiene su propia frase para el vecino', async () => {
    const estados = [
      S.RECEIVED,
      S.UNDER_REVIEW,
      S.INSPECTION_SCHEDULED,
      S.INSPECTED,
      S.VIOLATION_FOUND,
      S.FORWARDED,
      S.CLOSED,
    ];
    const frases = new Set<string>();
    for (const status of estados) {
      prisma.environmentalReport.findFirst.mockResolvedValue(expediente({ status }));
      const { stageLabel } = await portal.findReportByTicket('TCK-1');
      expect(stageLabel.trim()).not.toBe('');
      frases.add(stageLabel);
    }
    expect(frases.size).toBe(estados.length);
  });

  it('busca el expediente más reciente del reclamo y pide solo la última inspección hecha', async () => {
    await portal.findReportByTicket('TCK-1');

    const [[args]] = prisma.environmentalReport.findFirst.mock.calls;
    expect(args.where).toEqual({ ticketId: 'TCK-1' });
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.select.inspections).toEqual({
      where: { inspectedAt: { not: null } },
      orderBy: { inspectedAt: 'desc' },
      take: 1,
      select: { inspectedAt: true },
    });
  });

  // Los siete estados operativos se ven en cuatro etapas.
  it.each([
    [ServiceStatus.SCHEDULED, 'PROGRAMADO'],
    [ServiceStatus.RESCHEDULED, 'REPROGRAMADO'],
    [ServiceStatus.IN_PROGRESS, 'EN_CURSO'],
    [ServiceStatus.SUSPENDED, 'EN_CURSO'],
    [ServiceStatus.COMPLETED, 'REALIZADO'],
    [ServiceStatus.PARTIALLY_COMPLETED, 'REALIZADO'],
    [ServiceStatus.CANCELLED, 'CANCELADO'],
  ])('el servicio %s se publica como %s', async (status, etapa) => {
    prisma.service.findMany.mockResolvedValue([
      {
        id: 'sv-1',
        scheduledDate: new Date('2026-09-20T00:00:00.000Z'),
        windowFrom: null,
        windowTo: null,
        status,
        serviceType: { name: 'X', category: 'COLLECTION' },
        zones: [],
      },
    ]);

    const { data } = await portal.findServices({ page: 1, pageSize: 20 } as any);

    expect(data[0].stage).toBe(etapa);
  });

  it('el listado de servicios ordena por fecha y ventana, pagina y proyecta solo lo público', async () => {
    await portal.findServices({
      page: 2,
      pageSize: 5,
      skip: 5,
      take: 5,
      from: '2026-09-01',
      to: '2026-09-10',
    } as any);

    const [[args]] = prisma.service.findMany.mock.calls;
    expect(args.skip).toBe(5);
    expect(args.take).toBe(5);
    expect(args.orderBy).toEqual([{ scheduledDate: 'asc' }, { windowFrom: 'asc' }]);
    expect(args.select).toEqual({
      id: true,
      scheduledDate: true,
      windowFrom: true,
      windowTo: true,
      status: true,
      serviceType: { select: { name: true, category: true } },
      zones: { orderBy: { sequence: 'asc' }, select: { zone: { select: { name: true } } } },
    });
    expect(prisma.service.count).toHaveBeenCalledWith({ where: args.where });
  });

  it('con solo from, el tope es 30 días después de ese from', async () => {
    await portal.findServices({ page: 1, pageSize: 20, from: '2026-09-01' } as any);

    const { scheduledDate } = prisma.service.findMany.mock.calls[0][0].where;
    expect(scheduledDate.lte).toEqual(new Date('2026-10-01T00:00:00.000Z'));
  });
});
