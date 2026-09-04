import { Prisma, ServiceStatus, ZoneResultStatus as Z } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { IndicatorsService } from './indicators.service';

const CENTRO = { code: 'Z-CENTRO', name: 'Centro' };
const SUR = { code: 'Z-SUR', name: 'Sur' };
const TIPO = { code: 'REC-DOM', name: 'Recolección domiciliaria' };

/** Un servicio de recorrido con sus pares zona/resultado ya resueltos. */
function servicio(over: Record<string, unknown> = {}) {
  return {
    status: ServiceStatus.COMPLETED,
    scheduledDate: new Date('2026-08-10T00:00:00.000Z'),
    serviceTypeId: 'st-1',
    serviceType: TIPO,
    zones: [
      { zoneId: 'z-centro', zone: CENTRO },
      { zoneId: 'z-sur', zone: SUR },
    ],
    zoneResults: [
      {
        zoneId: 'z-centro',
        status: Z.SERVICED,
        reason: null,
        recordedAt: new Date('2026-08-10T12:00:00.000Z'),
      },
      {
        zoneId: 'z-sur',
        status: Z.NOT_SERVICED,
        reason: 'VEHICLE_BREAKDOWN',
        recordedAt: new Date('2026-08-10T13:00:00.000Z'),
      },
    ],
    ...over,
  };
}

describe('IndicatorsService', () => {
  let prisma: any;
  let indicators: IndicatorsService;

  beforeEach(() => {
    prisma = {
      service: { findMany: jest.fn().mockResolvedValue([]) },
      container: { groupBy: jest.fn().mockResolvedValue([]) },
      zone: { findMany: jest.fn().mockResolvedValue([]) },
      environmentalReport: {
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      collectionRecord: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    indicators = new IndicatorsService(prisma as unknown as PrismaService);
  });

  describe('cobertura', () => {
    it('cuenta pares servicio/zona, no servicios', async () => {
      prisma.service.findMany.mockResolvedValue([servicio()]);

      const result = await indicators.coverage({});

      // Un recorrido por dos zonas son dos objetivos, uno cumplido.
      expect(result.totals).toMatchObject({
        scheduled: 2,
        served: 1,
        notServiced: 1,
        coveragePct: 50,
      });
    });

    it('un par sin resultado cargado queda pendiente, no incumplido', async () => {
      prisma.service.findMany.mockResolvedValue([
        servicio({ status: ServiceStatus.IN_PROGRESS, zoneResults: [] }),
      ]);

      const result = await indicators.coverage({});

      expect(result.totals).toMatchObject({ scheduled: 2, pending: 2, notServiced: 0 });
    });

    it('desglosa por zona y por tipo de servicio', async () => {
      prisma.service.findMany.mockResolvedValue([servicio()]);

      const result = await indicators.coverage({});

      expect(result.byZone).toEqual([
        expect.objectContaining({ code: 'Z-CENTRO', served: 1, coveragePct: 100 }),
        expect.objectContaining({ code: 'Z-SUR', notServiced: 1, coveragePct: 0 }),
      ]);
      expect(result.byServiceType).toEqual([
        expect.objectContaining({ code: 'REC-DOM', scheduled: 2, coveragePct: 50 }),
      ]);
    });

    it('con filtro de zona solo cuenta esa zona del recorrido', async () => {
      prisma.service.findMany.mockResolvedValue([servicio()]);

      const result = await indicators.coverage({ zoneId: 'z-sur' });

      expect(result.totals).toMatchObject({ scheduled: 1, served: 0, notServiced: 1 });
    });

    it('el servicio cancelado no entra: dejó de ser un objetivo', async () => {
      await indicators.coverage({});

      const [[args]] = prisma.service.findMany.mock.calls;
      expect(args.where.status).toEqual({ not: ServiceStatus.CANCELLED });
    });

    it('sobre base vacía devuelve cero, sin dividir por cero', async () => {
      const result = await indicators.coverage({});

      expect(result.totals).toMatchObject({ scheduled: 0, coveragePct: 0 });
      expect(result.byZone).toEqual([]);
    });

    it('sin fechas toma los últimos 30 días', async () => {
      const result = await indicators.coverage({});

      const dias = Math.round(
        (Date.parse(result.period.to) - Date.parse(result.period.from)) / 86_400_000,
      );
      expect(dias).toBe(30);
    });
  });

  describe('cumplimiento', () => {
    it('mide la puntualidad con el último resultado de campo, no con updatedAt', async () => {
      prisma.service.findMany.mockResolvedValue([
        servicio({
          zoneResults: [
            {
              zoneId: 'z-centro',
              status: Z.SERVICED,
              reason: null,
              recordedAt: new Date('2026-08-10T23:00:00.000Z'),
            },
          ],
        }),
      ]);

      const result = await indicators.compliance({});

      expect(result.finished).toEqual({ total: 1, onTime: 1, late: 0, onTimePct: 100 });
    });

    it('cerrar al día siguiente de lo programado cuenta como demorado', async () => {
      prisma.service.findMany.mockResolvedValue([
        servicio({
          zoneResults: [
            {
              zoneId: 'z-centro',
              status: Z.SERVICED,
              reason: null,
              recordedAt: new Date('2026-08-11T01:00:00.000Z'),
            },
          ],
        }),
      ]);

      const result = await indicators.compliance({});

      expect(result.finished).toMatchObject({ onTime: 0, late: 1, onTimePct: 0 });
    });

    it('un servicio que todavía no cerró no cuenta ni a favor ni en contra', async () => {
      prisma.service.findMany.mockResolvedValue([servicio({ status: ServiceStatus.IN_PROGRESS })]);

      const result = await indicators.compliance({});

      expect(result.finished.total).toBe(0);
    });

    it('rankea las zonas no atendidas con su motivo', async () => {
      prisma.service.findMany.mockResolvedValue([servicio(), servicio()]);

      const result = await indicators.compliance({});

      expect(result.notServicedRanking).toEqual([
        expect.objectContaining({
          zoneId: 'z-sur',
          name: 'Sur',
          count: 2,
          reasons: [{ reason: 'VEHICLE_BREAKDOWN', count: 2 }],
        }),
      ]);
    });

    it('un no atendido sin motivo cargado se reporta igual, con reason nulo', async () => {
      prisma.service.findMany.mockResolvedValue([
        servicio({
          zoneResults: [
            {
              zoneId: 'z-sur',
              status: Z.NOT_SERVICED,
              reason: null,
              recordedAt: new Date('2026-08-10T13:00:00.000Z'),
            },
          ],
        }),
      ]);

      const result = await indicators.compliance({});

      expect(result.notServicedRanking[0].reasons).toEqual([{ reason: null, count: 1 }]);
    });

    it('sobre base vacía devuelve cero, sin dividir por cero', async () => {
      const result = await indicators.compliance({});

      expect(result.finished).toEqual({ total: 0, onTime: 0, late: 0, onTimePct: 0 });
    });
  });

  describe('incidencias', () => {
    beforeEach(() => {
      prisma.zone.findMany.mockResolvedValue([
        { id: 'z-centro', ...CENTRO },
        { id: 'z-sur', ...SUR },
      ]);
      prisma.container.groupBy.mockImplementation(({ by }: { by: string[] }) =>
        by.includes('zoneId')
          ? [
              { zoneId: 'z-centro', status: 'ACTIVE', _count: { _all: 40 } },
              { zoneId: 'z-centro', status: 'OVERFLOWED', _count: { _all: 3 } },
              { zoneId: 'z-sur', status: 'DAMAGED', _count: { _all: 5 } },
            ]
          : [{ status: 'ACTIVE', _count: { _all: 40 } }],
      );
      prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray) =>
        String(strings[0]).includes('tree_survey')
          ? [{ riskLevel: 'HIGH', count: 12n }]
          : [{ days: 4.28 }],
      );
    });

    it('ordena las zonas por incidencias, no alfabéticamente', async () => {
      const result = await indicators.incidents({});

      expect(result.containers.byZone.map((z) => z.code)).toEqual(['Z-SUR', 'Z-CENTRO']);
      expect(result.containers.byZone[1]).toMatchObject({ overflowed: 3, damaged: 0, total: 43 });
    });

    it('cuenta cada árbol una sola vez, por su último relevamiento', async () => {
      const result = await indicators.incidents({});

      expect(result.trees.byRiskLevel).toEqual([{ riskLevel: 'HIGH', count: 12 }]);
      const sql = String(prisma.$queryRaw.mock.calls[0][0].join(''));
      expect(sql).toContain('DISTINCT ON (tree_id)');
    });

    it('redondea el tiempo medio de resolución', async () => {
      const result = await indicators.incidents({});

      expect(result.reports.avgResolutionDays).toBe(4.3);
    });

    it('sin denuncias cerradas el tiempo medio es nulo, no cero', async () => {
      prisma.$queryRaw.mockImplementation((strings: TemplateStringsArray) =>
        String(strings[0]).includes('tree_survey') ? [] : [{ days: null }],
      );

      const result = await indicators.incidents({});

      expect(result.reports.avgResolutionDays).toBeNull();
    });
  });

  describe('residuos', () => {
    const registro = (kg: string, m3: string, siteType: string, id = 's-1') => ({
      wasteType: 'HOUSEHOLD',
      weightKg: new Prisma.Decimal(kg),
      volumeM3: new Prisma.Decimal(m3),
      disposalSite: { id, code: id.toUpperCase(), name: id, siteType },
    });

    it('suma kilos y metros cúbicos por tipo y por destino', async () => {
      prisma.collectionRecord.findMany.mockResolvedValue([
        registro('1000', '5', 'LANDFILL', 'relleno'),
        registro('500', '2.5', 'RECYCLING_PLANT', 'planta'),
      ]);

      const result = await indicators.waste({});

      expect(result.totals).toMatchObject({ weightKg: 1500, volumeM3: 7.5, divertedKg: 500 });
      expect(result.byWasteType).toEqual([
        { wasteType: 'HOUSEHOLD', weightKg: 1500, volumeM3: 7.5 },
      ]);
      expect(result.byDisposalSite.map((s) => s.disposalSiteId)).toEqual(['relleno', 'planta']);
    });

    it('el compostaje también cuenta como desvío del relleno', async () => {
      prisma.collectionRecord.findMany.mockResolvedValue([
        registro('750', '3', 'LANDFILL', 'relleno'),
        registro('250', '1', 'COMPOSTING_PLANT', 'compost'),
      ]);

      const result = await indicators.waste({});

      expect(result.totals.divertedPct).toBe(25);
    });

    it('un registro sin peso cargado no rompe la suma', async () => {
      prisma.collectionRecord.findMany.mockResolvedValue([
        { ...registro('100', '1', 'LANDFILL'), weightKg: null },
      ]);

      const result = await indicators.waste({});

      expect(result.totals.weightKg).toBe(0);
      expect(result.totals.volumeM3).toBe(1);
    });

    it('la fecha del residuo es la del servicio que lo recolectó', async () => {
      await indicators.waste({});

      const [[args]] = prisma.collectionRecord.findMany.mock.calls;
      expect(args.where.service.scheduledDate).toBeDefined();
    });

    it('sobre base vacía devuelve cero, sin dividir por cero', async () => {
      const result = await indicators.waste({});

      expect(result.totals).toEqual({
        weightKg: 0,
        volumeM3: 0,
        divertedKg: 0,
        divertedPct: 0,
      });
      expect(result.records).toBe(0);
    });
  });
});
