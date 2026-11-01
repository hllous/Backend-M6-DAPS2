import { BadRequestException } from '@nestjs/common';
import { Prisma, ServiceStatus, ZoneResultStatus as Z } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { IndicatorsService } from './indicators.service';

/** Lo que `configuration.ts` arma con las metas por defecto del equipo. */
const CONFIG_BASE = {
  minSample: 5,
  reportDeadlineBusinessDays: 5,
  targets: {
    coveragePct: 95,
    compliancePct: 90,
    resolutionBusinessDays: 5,
    schedulingDeviationPct: 10,
    landfillDiversionPct: null as number | null,
    reportsWithinDeadlinePct: 85,
    reportsOverduePct: 10,
  },
};

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
    delayNotices: [] as { id: string }[],
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

/**
 * Una fila del historial de estados de un contenedor. `desde` null es el alta (o la
 * fila base de la migración): sirve para reconstruir el estado, no es un incidente.
 */
function fila(contenedor: string, desde: string | null, hacia: string, cuando: string) {
  return {
    containerId: contenedor,
    fromStatus: desde,
    toStatus: hacia,
    changedAt: new Date(cuando),
  };
}

/** Una denuncia: alta y última modificación (que es el cierre cuando está CLOSED). */
function denuncia(creada: string, actualizada: string, status = 'CLOSED') {
  return { createdAt: new Date(creada), updatedAt: new Date(actualizada), status };
}

describe('IndicatorsService', () => {
  let prisma: any;
  let indicators: IndicatorsService;
  let cfg: typeof CONFIG_BASE;

  beforeEach(() => {
    cfg = structuredClone(CONFIG_BASE);
    prisma = {
      service: { findMany: jest.fn().mockResolvedValue([]) },
      container: { groupBy: jest.fn().mockResolvedValue([]) },
      containerStatusHistory: {
        findMany: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _min: { changedAt: null } }),
      },
      zone: { findMany: jest.fn().mockResolvedValue([]) },
      environmentalReport: {
        groupBy: jest.fn().mockResolvedValue([]),
        findMany: jest.fn().mockResolvedValue([]),
      },
      collectionRecord: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const config = { get: (key: string) => (key === 'indicators' ? cfg : undefined) };
    indicators = new IndicatorsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );
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

    it('sin to, el período termina hoy en Argentina aunque en UTC ya sea mañana', async () => {
      jest.useFakeTimers({ now: new Date('2026-09-20T01:00:00.000Z') }); // 22:00 ART del 19
      try {
        const result = await indicators.coverage({});

        expect(result.period.to).toBe('2026-09-19');
      } finally {
        jest.useRealTimers();
      }
    });

    it('from y to con hora se truncan al día, en el filtro y en el período', async () => {
      const result = await indicators.coverage({
        from: '2026-08-01T15:00:00.000Z',
        to: '2026-08-31T15:00:00.000Z',
      });

      const [[args]] = prisma.service.findMany.mock.calls;
      expect(args.where.scheduledDate).toEqual({
        gte: new Date('2026-08-01T00:00:00.000Z'),
        lte: new Date('2026-08-31T00:00:00.000Z'),
      });
      expect(result.period).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    });

    it('sin fechas toma los últimos 30 días', async () => {
      const result = await indicators.coverage({});

      const dias = Math.round(
        (Date.parse(result.period.to) - Date.parse(result.period.from)) / 86_400_000,
      );
      expect(dias).toBe(30);
    });

    describe('serie temporal y período anterior (#473)', () => {
      /** Un servicio en una fecha dada: 1 par atendido, 1 no atendido. */
      const en = (fecha: string, over: Record<string, unknown> = {}) =>
        servicio({ scheduledDate: new Date(`${fecha}T00:00:00.000Z`), ...over });

      /** Prisma devuelve solo los servicios que caen en el rango que se le pide. */
      function conServicios(todos: ReturnType<typeof servicio>[]) {
        prisma.service.findMany.mockImplementation(({ where }: any) =>
          todos.filter(
            (s) =>
              s.scheduledDate >= where.scheduledDate.gte &&
              s.scheduledDate <= where.scheduledDate.lte,
          ),
        );
      }

      const atendidos = (...zonas: string[]) =>
        zonas.map((zoneId) => ({
          zoneId,
          status: Z.SERVICED,
          reason: null,
          recordedAt: new Date('2026-08-10T12:00:00.000Z'),
        }));

      it('sin bucket ni compare no hay serie, previous ni delta', async () => {
        const result = await indicators.coverage({});

        expect(result.series).toBeUndefined();
        expect(result.previous).toBeUndefined();
        expect(result.delta).toBeUndefined();
      });

      it('bucket=week da un punto por semana (lunes a domingo) y la suma coincide con totals', async () => {
        conServicios([en('2026-08-03'), en('2026-08-05'), en('2026-08-12'), en('2026-08-16')]);

        const result = await indicators.coverage({
          from: '2026-08-03',
          to: '2026-08-16',
          bucket: 'week',
        });

        expect(result.series!.map((p) => [p.from, p.to, p.scheduled])).toEqual([
          ['2026-08-03', '2026-08-09', 4],
          ['2026-08-10', '2026-08-16', 4],
        ]);
        const suma = (k: 'scheduled' | 'served' | 'notServiced') =>
          result.series!.reduce((acc, p) => acc + p[k], 0);
        expect(suma('scheduled')).toBe(result.totals.scheduled);
        expect(suma('served')).toBe(result.totals.served);
        expect(suma('notServiced')).toBe(result.totals.notServiced);
        expect(result.series![0].coveragePct).toBe(50);
      });

      it('la primera y la última semana se recortan al período pedido', async () => {
        const result = await indicators.coverage({
          from: '2026-08-05', // miércoles
          to: '2026-08-18', // martes
          bucket: 'week',
        });

        expect(result.series!.map((p) => [p.from, p.to])).toEqual([
          ['2026-08-05', '2026-08-09'],
          ['2026-08-10', '2026-08-16'],
          ['2026-08-17', '2026-08-18'],
        ]);
      });

      it('bucket=month corta en el último día de cada mes y recorta los bordes', async () => {
        const result = await indicators.coverage({
          from: '2026-07-20',
          to: '2026-09-10',
          bucket: 'month',
        });

        expect(result.series!.map((p) => [p.from, p.to])).toEqual([
          ['2026-07-20', '2026-07-31'],
          ['2026-08-01', '2026-08-31'],
          ['2026-09-01', '2026-09-10'],
        ]);
      });

      it('bucket=day devuelve los días sin servicios en cero, sin huecos', async () => {
        conServicios([en('2026-08-03'), en('2026-08-05')]);

        const result = await indicators.coverage({
          from: '2026-08-03',
          to: '2026-08-05',
          bucket: 'day',
        });

        expect(result.series!.map((p) => [p.from, p.scheduled, p.coveragePct])).toEqual([
          ['2026-08-03', 2, 50],
          ['2026-08-04', 0, 0],
          ['2026-08-05', 2, 50],
        ]);
      });

      it('un servicio a futuro cae en su día como upcoming, no como programado', async () => {
        jest.useFakeTimers({ now: new Date('2026-08-10T15:00:00.000Z') });
        try {
          conServicios([en('2026-08-10'), en('2026-08-12', { zoneResults: [] })]);

          const result = await indicators.coverage({
            from: '2026-08-10',
            to: '2026-08-12',
            bucket: 'day',
          });

          expect(result.series!.map((p) => [p.scheduled, p.upcoming])).toEqual([
            [2, 0],
            [0, 0],
            [0, 2],
          ]);
        } finally {
          jest.useRealTimers();
        }
      });

      it('con filtro de zona la serie cuenta solo esa zona', async () => {
        conServicios([en('2026-08-03')]);

        const result = await indicators.coverage({
          from: '2026-08-03',
          to: '2026-08-03',
          bucket: 'day',
          zoneId: 'z-sur',
        });

        expect(result.series![0]).toMatchObject({ scheduled: 1, notServiced: 1 });
      });

      it('90 puntos entran; 91 responden 400 con el motivo y las dos salidas', async () => {
        await expect(
          indicators.coverage({ from: '2026-06-01', to: '2026-08-29', bucket: 'day' }), // 90 días
        ).resolves.toBeDefined();

        const error = await indicators
          .coverage({ from: '2026-06-01', to: '2026-08-30', bucket: 'day' }) // 91 días
          .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).message).toMatch(/91 puntos.*90/);
        expect((error as BadRequestException).message).toMatch(/rango.*bucket/i);
      });

      it('el tope se valida antes de consultar la base', async () => {
        await indicators
          .coverage({ from: '2020-01-01', to: '2026-01-01', bucket: 'day' })
          .catch(() => undefined);

        expect(prisma.service.findMany).not.toHaveBeenCalled();
      });

      it('compare=previous trae el período anterior de igual duración y la diferencia', async () => {
        conServicios([
          en('2026-08-05'), // anterior: 1 atendido de 2 → 50 %
          en('2026-08-15'), // actual: 1 de 2
          en('2026-08-16', {
            zones: [{ zoneId: 'z-centro', zone: CENTRO }],
            zoneResults: atendidos('z-centro'),
          }), // actual: 1 de 1
        ]);

        const result = await indicators.coverage({
          from: '2026-08-11',
          to: '2026-08-20',
          compare: 'previous',
        });

        expect(result.previous!.period).toEqual({ from: '2026-08-01', to: '2026-08-10' });
        expect(result.previous!.totals).toMatchObject({ scheduled: 2, served: 1, coveragePct: 50 });
        expect(result.totals).toMatchObject({ scheduled: 3, served: 2, coveragePct: 66.7 });
        expect(result.delta).toEqual({ coveragePct: 16.7 });
        expect(prisma.service.findMany.mock.calls[1][0].where.scheduledDate).toEqual({
          gte: new Date('2026-08-01T00:00:00.000Z'),
          lte: new Date('2026-08-10T00:00:00.000Z'),
        });
      });

      it('la diferencia puede ser negativa', async () => {
        conServicios([
          en('2026-08-05', { zoneResults: atendidos('z-centro', 'z-sur') }), // anterior: 100 %
          en('2026-08-15'), // actual: 50 %
        ]);

        const result = await indicators.coverage({
          from: '2026-08-11',
          to: '2026-08-20',
          compare: 'previous',
        });

        expect(result.delta).toEqual({ coveragePct: -50 });
      });

      it('sin base en alguno de los dos períodos, la diferencia es nula', async () => {
        conServicios([en('2026-08-15')]); // nada en el período anterior

        const result = await indicators.coverage({
          from: '2026-08-11',
          to: '2026-08-20',
          compare: 'previous',
        });

        expect(result.previous!.totals.scheduled).toBe(0);
        expect(result.delta).toEqual({ coveragePct: null });
      });

      it('compare y bucket se combinan', async () => {
        conServicios([en('2026-08-05'), en('2026-08-15')]);

        const result = await indicators.coverage({
          from: '2026-08-11',
          to: '2026-08-20',
          bucket: 'week',
          compare: 'previous',
        });

        expect(result.series).toHaveLength(2);
        expect(result.previous!.totals.scheduled).toBe(2);
      });

      it('from posterior a to sigue dando 400 con los parámetros nuevos', async () => {
        await expect(
          indicators.coverage({
            from: '2026-12-01',
            to: '2026-01-01',
            bucket: 'week',
            compare: 'previous',
          }),
        ).rejects.toThrow(/no puede ser posterior/);
      });
    });

    describe('metas, muestra mínima y servicios a futuro (#473)', () => {
      it('trae la meta de cobertura con su sentido', async () => {
        const result = await indicators.coverage({});

        expect(result.targets).toEqual({ coveragePct: { value: 95, direction: 'min' } });
      });

      it('la meta sale de la configuración', async () => {
        cfg.targets.coveragePct = 97.5;

        const result = await indicators.coverage({});

        expect(result.targets.coveragePct.value).toBe(97.5);
      });

      it('marca lowSample en zonas y tipos con menos programados que el umbral', async () => {
        const cinco = Array.from({ length: 5 }, () =>
          servicio({ zones: [{ zoneId: 'z-centro', zone: CENTRO }], zoneResults: [] }),
        );
        const uno = servicio({ zones: [{ zoneId: 'z-sur', zone: SUR }], zoneResults: [] });
        prisma.service.findMany.mockResolvedValue([...cinco, uno]);

        const result = await indicators.coverage({});

        const porCodigo = Object.fromEntries(result.byZone.map((z) => [z.code, z.lowSample]));
        expect(porCodigo).toEqual({ 'Z-CENTRO': false, 'Z-SUR': true });
        expect(result.byServiceType[0].lowSample).toBe(false); // 6 programados
      });

      it('el umbral sale de la configuración', async () => {
        cfg.minSample = 2;
        prisma.service.findMany.mockResolvedValue([servicio()]); // 1 par por zona

        const result = await indicators.coverage({});

        expect(result.byZone.every((z) => z.lowSample)).toBe(true);
        expect(result.byServiceType[0]).toMatchObject({ scheduled: 2, lowSample: false });
      });

      it('lo programado a futuro no cuenta como programado ni como pendiente', async () => {
        jest.useFakeTimers({ now: new Date('2026-08-10T15:00:00.000Z') });
        try {
          prisma.service.findMany.mockResolvedValue([
            servicio(), // hoy: 2 pares, 1 atendido
            servicio({ scheduledDate: new Date('2026-08-11T00:00:00.000Z'), zoneResults: [] }),
          ]);

          const result = await indicators.coverage({ from: '2026-08-01', to: '2026-08-31' });

          expect(result.totals).toEqual({
            scheduled: 2,
            served: 1,
            partial: 0,
            notServiced: 1,
            pending: 0,
            upcoming: 2,
            coveragePct: 50,
          });
          expect(result.byZone.find((z) => z.code === 'Z-CENTRO')).toMatchObject({
            scheduled: 1,
            upcoming: 1,
          });
        } finally {
          jest.useRealTimers();
        }
      });

      it('hoy ya venció aunque en UTC sea mañana: el día es el argentino', async () => {
        jest.useFakeTimers({ now: new Date('2026-08-11T01:00:00.000Z') }); // 22:00 ART del 10
        try {
          prisma.service.findMany.mockResolvedValue([servicio({ zoneResults: [] })]);

          const result = await indicators.coverage({ from: '2026-08-01', to: '2026-08-31' });

          expect(result.totals).toMatchObject({ scheduled: 2, pending: 2, upcoming: 0 });
        } finally {
          jest.useRealTimers();
        }
      });
    });
  });

  describe('cumplimiento', () => {
    describe('metas, desvío de programación, serie y período anterior (#473)', () => {
      const en = (fecha: string, over: Record<string, unknown> = {}) =>
        servicio({ scheduledDate: new Date(`${fecha}T00:00:00.000Z`), ...over });

      /** Cerrado el mismo día programado (en término) o dos días después (demorado). */
      const cerrado = (fecha: string, demoraDias = 0) =>
        en(fecha, {
          zoneResults: [
            {
              zoneId: 'z-centro',
              status: Z.SERVICED,
              reason: null,
              recordedAt: new Date(Date.parse(`${fecha}T15:00:00.000Z`) + demoraDias * 86_400_000),
            },
          ],
        });

      function conServicios(todos: ReturnType<typeof servicio>[]) {
        prisma.service.findMany.mockImplementation(({ where }: any) =>
          todos.filter(
            (s) =>
              s.scheduledDate >= where.scheduledDate.gte &&
              s.scheduledDate <= where.scheduledDate.lte,
          ),
        );
      }

      it('trae las metas de cumplimiento y de desvío con su sentido', async () => {
        const result = await indicators.compliance({});

        expect(result.targets).toEqual({
          compliancePct: { value: 90, direction: 'min' },
          schedulingDeviationPct: { value: 10, direction: 'max' },
        });
      });

      it('las metas salen de la configuración', async () => {
        cfg.targets.compliancePct = 92;
        cfg.targets.schedulingDeviationPct = 8;

        const result = await indicators.compliance({});

        expect(result.targets.compliancePct.value).toBe(92);
        expect(result.targets.schedulingDeviationPct.value).toBe(8);
      });

      it('el desvío cuenta servicios reprogramados o con aviso de demora', async () => {
        conServicios([
          en('2026-08-10'),
          en('2026-08-11', { status: ServiceStatus.RESCHEDULED }),
          en('2026-08-12', { delayNotices: [{ id: 'd-1' }] }),
          en('2026-08-13'),
        ]);

        const result = await indicators.compliance({ from: '2026-08-01', to: '2026-08-31' });

        expect(result.schedulingDeviation).toEqual({ total: 4, deviated: 2, deviatedPct: 50 });
      });

      it('un servicio cuenta una sola vez aunque esté reprogramado y tenga varios avisos', async () => {
        conServicios([
          en('2026-08-10', {
            status: ServiceStatus.RESCHEDULED,
            delayNotices: [{ id: 'd-1' }, { id: 'd-2' }],
          }),
          en('2026-08-11'),
        ]);

        const result = await indicators.compliance({ from: '2026-08-01', to: '2026-08-31' });

        expect(result.schedulingDeviation).toEqual({ total: 2, deviated: 1, deviatedPct: 50 });
      });

      it('lee los avisos de demora de cada servicio, vigentes o reemplazados', async () => {
        await indicators.compliance({});

        const [[args]] = prisma.service.findMany.mock.calls;
        expect(args.select.delayNotices).toBeDefined();
        expect(args.select.delayNotices.where).toBeUndefined();
      });

      it('sobre base vacía el desvío es cero, sin dividir por cero', async () => {
        const result = await indicators.compliance({});

        expect(result.schedulingDeviation).toEqual({ total: 0, deviated: 0, deviatedPct: 0 });
      });

      it('sin bucket ni compare no hay serie, previous ni delta', async () => {
        const result = await indicators.compliance({});

        expect(result.series).toBeUndefined();
        expect(result.previous).toBeUndefined();
        expect(result.delta).toBeUndefined();
      });

      it('bucket=day: cada servicio cae en su día programado y la suma coincide con el total', async () => {
        conServicios([
          cerrado('2026-08-03'),
          cerrado('2026-08-03', 2), // demorado
          cerrado('2026-08-05', 0),
          en('2026-08-05', { status: ServiceStatus.RESCHEDULED, zoneResults: [] }),
        ]);

        const result = await indicators.compliance({
          from: '2026-08-03',
          to: '2026-08-05',
          bucket: 'day',
        });

        expect(result.series!.map((p) => [p.from, p.finished, p.schedulingDeviation])).toEqual([
          [
            '2026-08-03',
            { total: 2, onTime: 1, late: 1, onTimePct: 50 },
            { total: 2, deviated: 0, deviatedPct: 0 },
          ],
          [
            '2026-08-04',
            { total: 0, onTime: 0, late: 0, onTimePct: 0 },
            { total: 0, deviated: 0, deviatedPct: 0 },
          ],
          [
            '2026-08-05',
            { total: 1, onTime: 1, late: 0, onTimePct: 100 },
            { total: 2, deviated: 1, deviatedPct: 50 },
          ],
        ]);
        expect(result.series!.reduce((n, p) => n + p.finished.total, 0)).toBe(
          result.finished.total,
        );
      });

      it('el tope de puntos también rige en cumplimiento', async () => {
        await expect(
          indicators.compliance({ from: '2026-01-01', to: '2026-12-31', bucket: 'day' }),
        ).rejects.toThrow(/máximo es 90/);
      });

      it('compare=previous trae finished y desvío del período anterior, y las diferencias', async () => {
        conServicios([
          cerrado('2026-08-05'), // anterior: 1 en término de 1 → 100 %
          en('2026-08-06', { status: ServiceStatus.RESCHEDULED, zoneResults: [] }), // desvío 1 de 2
          cerrado('2026-08-15'), // actual: en término
          cerrado('2026-08-16', 2), // actual: demorado
        ]);

        const result = await indicators.compliance({
          from: '2026-08-11',
          to: '2026-08-20',
          compare: 'previous',
        });

        expect(result.previous!.period).toEqual({ from: '2026-08-01', to: '2026-08-10' });
        expect(result.previous!.totals.finished).toEqual({
          total: 1,
          onTime: 1,
          late: 0,
          onTimePct: 100,
        });
        expect(result.previous!.totals.schedulingDeviation).toEqual({
          total: 2,
          deviated: 1,
          deviatedPct: 50,
        });
        expect(result.finished.onTimePct).toBe(50);
        expect(result.delta).toEqual({ onTimePct: -50, deviatedPct: -50 });
      });

      it('sin base en alguno de los dos períodos, las diferencias son nulas', async () => {
        conServicios([cerrado('2026-08-15')]);

        const result = await indicators.compliance({
          from: '2026-08-11',
          to: '2026-08-20',
          compare: 'previous',
        });

        expect(result.delta).toEqual({ onTimePct: null, deviatedPct: null });
      });
    });

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

    describe('el día del cierre es el argentino, no el UTC (#230)', () => {
      const cerradoEn = (iso: string) =>
        servicio({
          zoneResults: [
            { zoneId: 'z-centro', status: Z.SERVICED, reason: null, recordedAt: new Date(iso) },
          ],
        });

      it.each([
        ['22:00 ART del día programado', '2026-08-11T01:00:00.000Z'],
        ['23:30 ART del día programado', '2026-08-11T02:30:00.000Z'],
        ['23:59:59.999 ART, último instante del día', '2026-08-11T02:59:59.999Z'],
      ])('cerrar a las %s cuenta a tiempo', async (_, iso) => {
        prisma.service.findMany.mockResolvedValue([cerradoEn(iso)]);

        const result = await indicators.compliance({});

        expect(result.finished).toEqual({ total: 1, onTime: 1, late: 0, onTimePct: 100 });
      });

      it.each([
        ['00:00 ART del día siguiente, la medianoche exacta', '2026-08-11T03:00:00.000Z'],
        ['al mediodía ART del día siguiente', '2026-08-11T15:00:00.000Z'],
      ])('cerrar a las %s cuenta como demorado', async (_, iso) => {
        prisma.service.findMany.mockResolvedValue([cerradoEn(iso)]);

        const result = await indicators.compliance({});

        expect(result.finished).toMatchObject({ onTime: 0, late: 1, onTimePct: 0 });
      });
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
      prisma.$queryRaw.mockResolvedValue([{ riskLevel: 'HIGH', count: 12n }]);
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
      // 4,25 días corridos de alta a cierre.
      prisma.environmentalReport.findMany.mockResolvedValue([
        denuncia('2026-08-03T12:00:00.000Z', '2026-08-07T18:00:00.000Z'),
      ]);

      const result = await indicators.incidents({});

      expect(result.reports.avgResolutionDays).toBe(4.3);
    });

    it('filtra las denuncias por días argentinos, no por medianoche UTC', async () => {
      await indicators.incidents({ from: '2026-08-01', to: '2026-08-31' });

      // 00:00 ART del 1 al 00:00 ART del 1 de septiembre, exclusivo.
      const rango = {
        gte: new Date('2026-08-01T03:00:00.000Z'),
        lt: new Date('2026-09-01T03:00:00.000Z'),
      };
      expect(prisma.environmentalReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { createdAt: rango } }),
      );
      expect(prisma.environmentalReport.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { createdAt: rango } }),
      );
    });

    it('sin denuncias cerradas el tiempo medio es nulo, no cero', async () => {
      const result = await indicators.incidents({});

      expect(result.reports.avgResolutionDays).toBeNull();
      expect(result.reports.avgResolutionBusinessDays).toBeNull();
    });

    it('los campos que ya tenía incidencias no cambian con la etapa 2 (#475)', async () => {
      prisma.environmentalReport.findMany.mockResolvedValue([
        denuncia('2026-08-07T15:00:00.000Z', '2026-08-10T15:00:00.000Z'),
      ]);

      const result = await indicators.incidents({});

      expect(result.containers.byStatus).toEqual([{ status: 'ACTIVE', count: 40 }]);
      expect(result.containers.byZone.map((z) => z.code)).toEqual(['Z-SUR', 'Z-CENTRO']);
      expect(result.trees).toEqual({ byRiskLevel: [{ riskLevel: 'HIGH', count: 12 }] });
      expect(result.reports).toMatchObject({
        total: 1,
        avgResolutionDays: 3,
        avgResolutionBusinessDays: 1,
        byType: [],
        byStatus: [],
      });
      expect(result.targets.resolutionBusinessDays).toEqual({ value: 5, direction: 'max' });
    });

    describe('historial de contenedores (#475)', () => {
      /** Prisma devuelve las filas anteriores al corte que se le pide, en orden. */
      function conHistorial(todas: ReturnType<typeof fila>[]) {
        prisma.containerStatusHistory.findMany.mockImplementation(({ where }: any) =>
          todas
            .filter((f) => f.changedAt < where.changedAt.lt)
            .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime()),
        );
        const primera = todas.map((f) => f.changedAt).sort((a, b) => a.getTime() - b.getTime())[0];
        prisma.containerStatusHistory.aggregate.mockResolvedValue({
          _min: { changedAt: primera ?? null },
        });
      }

      const AGOSTO = { from: '2026-08-01', to: '2026-08-31' };

      it('cuenta un incidente de desborde por transición, no por contenedor', async () => {
        conHistorial([
          fila('c1', null, 'ACTIVE', '2026-07-01T12:00:00.000Z'),
          fila('c1', 'ACTIVE', 'OVERFLOWED', '2026-08-05T12:00:00.000Z'),
          fila('c1', 'OVERFLOWED', 'ACTIVE', '2026-08-06T12:00:00.000Z'),
          fila('c1', 'ACTIVE', 'OVERFLOWED', '2026-08-20T12:00:00.000Z'),
          fila('c2', null, 'ACTIVE', '2026-07-01T12:00:00.000Z'),
          fila('c2', 'ACTIVE', 'OVERFLOWED', '2026-08-10T12:00:00.000Z'),
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.containers.history.overflowIncidents).toBe(3);
      });

      it('las filas de alta y la fila base (origen nulo) nunca son incidentes', async () => {
        conHistorial([
          fila('c1', null, 'OVERFLOWED', '2026-08-05T12:00:00.000Z'),
          fila('c2', null, 'DAMAGED', '2026-08-05T12:00:00.000Z'),
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.containers.history).toMatchObject({
          overflowIncidents: 0,
          damageIncidents: 0,
        });
      });

      it('lo de fuera del período no cuenta, y los días son los argentinos', async () => {
        conHistorial([
          fila('c1', 'ACTIVE', 'OVERFLOWED', '2026-08-01T02:59:59.000Z'), // 23:59 ART del 31/7
          fila('c2', 'ACTIVE', 'OVERFLOWED', '2026-08-01T03:00:00.000Z'), // 00:00 ART del 1/8
          fila('c3', 'ACTIVE', 'OVERFLOWED', '2026-09-01T02:59:59.000Z'), // 23:59 ART del 31/8
          fila('c4', 'ACTIVE', 'OVERFLOWED', '2026-09-01T03:00:00.000Z'), // 00:00 ART del 1/9
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.containers.history.overflowIncidents).toBe(2);
      });

      it('cuenta los incidentes de daño por transición a DAMAGED', async () => {
        conHistorial([
          fila('c1', 'ACTIVE', 'DAMAGED', '2026-08-05T12:00:00.000Z'),
          fila('c1', 'DAMAGED', 'UNDER_REPAIR', '2026-08-06T12:00:00.000Z'),
          fila('c1', 'UNDER_REPAIR', 'ACTIVE', '2026-08-07T12:00:00.000Z'),
          fila('c1', 'ACTIVE', 'DAMAGED', '2026-08-20T12:00:00.000Z'),
          fila('c2', 'ACTIVE', 'OVERFLOWED', '2026-08-10T12:00:00.000Z'),
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.containers.history).toMatchObject({
          damageIncidents: 2,
          overflowIncidents: 1,
        });
      });
    });

    describe('daños pendientes y desde cuándo hay historial (#475)', () => {
      function conHistorial(todas: ReturnType<typeof fila>[]) {
        prisma.containerStatusHistory.findMany.mockImplementation(({ where }: any) =>
          todas
            .filter((f) => f.changedAt < where.changedAt.lt)
            .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime()),
        );
        const primera = todas.map((f) => f.changedAt).sort((a, b) => a.getTime() - b.getTime())[0];
        prisma.containerStatusHistory.aggregate.mockResolvedValue({
          _min: { changedAt: primera ?? null },
        });
      }

      const AGOSTO = { from: '2026-08-01', to: '2026-08-31' };

      it('dañado y en reparación son pendientes; el resto de los estados no', async () => {
        conHistorial([
          fila('c1', null, 'ACTIVE', '2026-07-01T12:00:00.000Z'),
          fila('c1', 'ACTIVE', 'DAMAGED', '2026-08-05T12:00:00.000Z'), // pendiente
          fila('c2', null, 'ACTIVE', '2026-07-01T12:00:00.000Z'),
          fila('c2', 'ACTIVE', 'DAMAGED', '2026-08-05T12:00:00.000Z'),
          fila('c2', 'DAMAGED', 'UNDER_REPAIR', '2026-08-06T12:00:00.000Z'), // pendiente
          fila('c3', null, 'ACTIVE', '2026-07-01T12:00:00.000Z'),
          fila('c3', 'ACTIVE', 'DAMAGED', '2026-08-05T12:00:00.000Z'),
          fila('c3', 'DAMAGED', 'UNDER_REPAIR', '2026-08-06T12:00:00.000Z'),
          fila('c3', 'UNDER_REPAIR', 'ACTIVE', '2026-08-07T12:00:00.000Z'), // reparado
          fila('c4', null, 'ACTIVE', '2026-07-01T12:00:00.000Z'),
          fila('c4', 'ACTIVE', 'DAMAGED', '2026-08-05T12:00:00.000Z'),
          fila('c4', 'DAMAGED', 'REMOVED', '2026-08-06T12:00:00.000Z'), // dado de baja
          fila('c5', null, 'ACTIVE', '2026-07-01T12:00:00.000Z'),
          fila('c5', 'ACTIVE', 'RELOCATING', '2026-08-05T12:00:00.000Z'), // reubicado
          fila('c6', null, 'ACTIVE', '2026-07-01T12:00:00.000Z'),
          fila('c6', 'ACTIVE', 'OVERFLOWED', '2026-08-05T12:00:00.000Z'), // desbordado
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.containers.history.pendingDamage).toBe(2);
      });

      it('lo que pasa después del fin del período no cambia los pendientes', async () => {
        conHistorial([
          fila('c1', null, 'ACTIVE', '2026-07-01T12:00:00.000Z'),
          fila('c1', 'ACTIVE', 'DAMAGED', '2026-08-31T20:00:00.000Z'), // 17:00 ART del 31
          fila('c1', 'DAMAGED', 'UNDER_REPAIR', '2026-09-01T02:59:59.000Z'), // sigue pendiente
          fila('c1', 'UNDER_REPAIR', 'ACTIVE', '2026-09-01T03:00:00.000Z'), // 1/9: ya es de septiembre
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.containers.history.pendingDamage).toBe(1);
      });

      it('un contenedor sin filas hasta el fin del período no cuenta', async () => {
        conHistorial([
          fila('c1', null, 'ACTIVE', '2026-07-01T12:00:00.000Z'),
          fila('c1', 'ACTIVE', 'DAMAGED', '2026-08-05T12:00:00.000Z'),
          fila('c2', null, 'DAMAGED', '2026-09-10T12:00:00.000Z'), // nace después
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.containers.history.pendingDamage).toBe(1);
      });

      it('sin ninguna fila hasta el fin del período los pendientes son null, no cero', async () => {
        conHistorial([fila('c1', null, 'DAMAGED', '2026-09-10T12:00:00.000Z')]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.containers.history.pendingDamage).toBeNull();
      });

      it('con historial pero sin daños, los pendientes son cero (hay dato)', async () => {
        conHistorial([fila('c1', null, 'ACTIVE', '2026-07-01T12:00:00.000Z')]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.containers.history.pendingDamage).toBe(0);
      });

      it('trackingSince es el instante de la fila más antigua, aunque sea posterior al período', async () => {
        conHistorial([
          fila('c1', null, 'ACTIVE', '2026-10-30T15:00:00.000Z'),
          fila('c1', 'ACTIVE', 'OVERFLOWED', '2026-10-31T15:00:00.000Z'),
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.containers.history.trackingSince).toBe('2026-10-30T15:00:00.000Z');
      });

      it('sin historial trackingSince es null', async () => {
        const result = await indicators.incidents(AGOSTO);

        expect(result.containers.history).toEqual({
          overflowIncidents: 0,
          damageIncidents: 0,
          pendingDamage: null,
          trackingSince: null,
        });
      });
    });

    describe('serie y comparación de los contenedores (#475)', () => {
      function conHistorial(todas: ReturnType<typeof fila>[]) {
        prisma.containerStatusHistory.findMany.mockImplementation(({ where }: any) =>
          todas
            .filter((f) => f.changedAt < where.changedAt.lt)
            .sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime()),
        );
        const primera = todas.map((f) => f.changedAt).sort((a, b) => a.getTime() - b.getTime())[0];
        prisma.containerStatusHistory.aggregate.mockResolvedValue({
          _min: { changedAt: primera ?? null },
        });
      }

      /** Historial que empieza el 20/7: julio tiene pendientes, junio no tiene dato. */
      const HISTORIAL = [
        fila('c1', null, 'ACTIVE', '2026-07-20T12:00:00.000Z'),
        fila('c1', 'ACTIVE', 'DAMAGED', '2026-07-25T12:00:00.000Z'), // julio: pendiente
        fila('c1', 'DAMAGED', 'UNDER_REPAIR', '2026-08-04T12:00:00.000Z'),
        fila('c1', 'UNDER_REPAIR', 'ACTIVE', '2026-08-20T12:00:00.000Z'), // agosto: resuelto
        fila('c2', null, 'ACTIVE', '2026-07-20T12:00:00.000Z'),
        fila('c2', 'ACTIVE', 'OVERFLOWED', '2026-07-28T12:00:00.000Z'),
        fila('c2', 'OVERFLOWED', 'ACTIVE', '2026-07-29T12:00:00.000Z'),
        fila('c2', 'ACTIVE', 'OVERFLOWED', '2026-08-10T12:00:00.000Z'),
        fila('c2', 'OVERFLOWED', 'ACTIVE', '2026-08-11T12:00:00.000Z'),
        fila('c2', 'ACTIVE', 'OVERFLOWED', '2026-08-25T12:00:00.000Z'),
        fila('c2', 'OVERFLOWED', 'ACTIVE', '2026-08-26T12:00:00.000Z'),
        fila('c3', 'ACTIVE', 'DAMAGED', '2026-08-28T12:00:00.000Z'), // agosto: pendiente
      ];

      it('bucket=month: incidentes por mes, pendientes a fin de mes y null antes del historial', async () => {
        conHistorial(HISTORIAL);

        const result = await indicators.incidents({
          from: '2026-06-15',
          to: '2026-08-31',
          bucket: 'month',
        });

        expect(result.series!.map((pt) => [pt.from, pt.to, pt.containers])).toEqual([
          [
            '2026-06-15',
            '2026-06-30',
            { overflowIncidents: 0, damageIncidents: 0, pendingDamage: null },
          ],
          [
            '2026-07-01',
            '2026-07-31',
            { overflowIncidents: 1, damageIncidents: 1, pendingDamage: 1 },
          ],
          [
            '2026-08-01',
            '2026-08-31',
            { overflowIncidents: 2, damageIncidents: 1, pendingDamage: 1 },
          ],
        ]);
      });

      it('la suma de los incidentes de la serie coincide con el total del período', async () => {
        conHistorial(HISTORIAL);

        const result = await indicators.incidents({
          from: '2026-06-15',
          to: '2026-08-31',
          bucket: 'week',
        });

        const suma = (k: 'overflowIncidents' | 'damageIncidents') =>
          result.series!.reduce((n, pt) => n + pt.containers[k], 0);
        expect(suma('overflowIncidents')).toBe(result.containers.history.overflowIncidents);
        expect(suma('damageIncidents')).toBe(result.containers.history.damageIncidents);
      });

      it('el último punto de la serie tiene los mismos pendientes que el total', async () => {
        conHistorial(HISTORIAL);

        const result = await indicators.incidents({
          from: '2026-08-01',
          to: '2026-08-31',
          bucket: 'day',
        });

        expect(result.series!.at(-1)!.containers.pendingDamage).toBe(
          result.containers.history.pendingDamage,
        );
      });

      it('un incidente cerca de la medianoche cae en su día argentino', async () => {
        conHistorial([
          fila('c1', null, 'ACTIVE', '2026-08-01T12:00:00.000Z'),
          fila('c1', 'ACTIVE', 'OVERFLOWED', '2026-08-05T02:30:00.000Z'), // 23:30 ART del 4
        ]);

        const result = await indicators.incidents({
          from: '2026-08-04',
          to: '2026-08-05',
          bucket: 'day',
        });

        expect(result.series!.map((pt) => pt.containers.overflowIncidents)).toEqual([1, 0]);
      });

      it('el tope de 90 puntos rige también con el historial', async () => {
        await expect(
          indicators.incidents({ from: '2026-01-01', to: '2026-12-31', bucket: 'day' }),
        ).rejects.toThrow(/máximo es 90/);
      });

      it('compare=previous trae los totales del período anterior y la diferencia en cantidades', async () => {
        conHistorial(HISTORIAL);

        const result = await indicators.incidents({
          from: '2026-08-01',
          to: '2026-08-31',
          compare: 'previous',
        });

        expect(result.previous!.period).toEqual({ from: '2026-07-01', to: '2026-07-31' });
        expect(result.previous!.totals.containers).toEqual({
          overflowIncidents: 1,
          damageIncidents: 1,
          pendingDamage: 1,
        });
        expect(result.delta).toMatchObject({ overflowIncidents: 1, pendingDamage: 0 });
      });

      it('la diferencia puede ser negativa', async () => {
        conHistorial([
          fila('c1', null, 'ACTIVE', '2026-06-20T12:00:00.000Z'),
          fila('c1', 'ACTIVE', 'DAMAGED', '2026-07-05T12:00:00.000Z'),
          fila('c1', 'DAMAGED', 'UNDER_REPAIR', '2026-07-06T12:00:00.000Z'),
          fila('c1', 'UNDER_REPAIR', 'ACTIVE', '2026-08-02T12:00:00.000Z'),
        ]);

        const result = await indicators.incidents({
          from: '2026-08-01',
          to: '2026-08-31',
          compare: 'previous',
        });

        expect(result.delta).toMatchObject({ pendingDamage: -1, overflowIncidents: 0 });
      });

      it('sin historial en el período anterior la diferencia es null, no una mejora inventada', async () => {
        conHistorial([
          fila('c1', null, 'ACTIVE', '2026-08-01T12:00:00.000Z'),
          fila('c1', 'ACTIVE', 'OVERFLOWED', '2026-08-05T12:00:00.000Z'),
        ]);

        const result = await indicators.incidents({
          from: '2026-08-01',
          to: '2026-08-31',
          compare: 'previous',
        });

        expect(result.previous!.totals.containers.pendingDamage).toBeNull();
        expect(result.delta).toMatchObject({ pendingDamage: null, overflowIncidents: null });
      });
    });

    describe('reclamos dentro del plazo y vencidos (#475)', () => {
      /** Jueves 20/8/2026, mediodía argentino: el plazo por defecto es de 5 días hábiles. */
      const AHORA = new Date('2026-08-20T15:00:00.000Z');

      beforeEach(() => jest.useFakeTimers({ now: AHORA }));
      afterEach(() => jest.useRealTimers());

      function conDenuncias(todas: ReturnType<typeof denuncia>[]) {
        prisma.environmentalReport.findMany.mockImplementation(({ where }: any) =>
          todas.filter(
            (d) => d.createdAt >= where.createdAt.gte && d.createdAt < where.createdAt.lt,
          ),
        );
      }

      const AGOSTO = { from: '2026-08-01', to: '2026-08-31' };

      it('el plazo es de 5 días hábiles por defecto y la respuesta lo informa', async () => {
        const result = await indicators.incidents(AGOSTO);

        expect(result.reports.deadlineBusinessDays).toBe(5);
      });

      it('justo en el plazo cuenta como dentro; un día hábil más, no', async () => {
        conDenuncias([
          denuncia('2026-08-07T15:00:00.000Z', '2026-08-14T15:00:00.000Z'), // viernes → viernes: 5
          denuncia('2026-08-07T15:00:00.000Z', '2026-08-17T15:00:00.000Z'), // viernes → lunes 17: 6
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.reports.withinDeadline).toEqual({ resolved: 2, withinDeadline: 1, pct: 50 });
      });

      it('el plazo sale de la configuración', async () => {
        cfg.reportDeadlineBusinessDays = 3;
        conDenuncias([
          denuncia('2026-08-10T15:00:00.000Z', '2026-08-13T15:00:00.000Z'), // lun → jue: 3
          denuncia('2026-08-10T15:00:00.000Z', '2026-08-14T15:00:00.000Z'), // lun → vie: 4
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.reports.deadlineBusinessDays).toBe(3);
        expect(result.reports.withinDeadline).toMatchObject({ resolved: 2, withinDeadline: 1 });
      });

      it('sin reclamos resueltos el porcentaje es null, no 0 %', async () => {
        conDenuncias([
          denuncia('2026-08-18T15:00:00.000Z', '2026-08-18T16:00:00.000Z', 'UNDER_REVIEW'),
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.reports.withinDeadline).toEqual({
          resolved: 0,
          withinDeadline: 0,
          pct: null,
        });
      });

      it('el porcentaje lleva un decimal', async () => {
        conDenuncias([
          denuncia('2026-08-10T15:00:00.000Z', '2026-08-11T15:00:00.000Z'),
          denuncia('2026-08-10T15:00:00.000Z', '2026-08-11T15:00:00.000Z'),
          denuncia('2026-08-03T15:00:00.000Z', '2026-08-17T15:00:00.000Z'), // 10 hábiles: fuera
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.reports.withinDeadline.pct).toBe(66.7);
      });

      it('vencido: abierto cuyos días hábiles desde el alta hasta hoy superan el plazo', async () => {
        conDenuncias([
          denuncia('2026-08-12T15:00:00.000Z', '2026-08-12T15:00:00.000Z', 'UNDER_REVIEW'), // mié → jue 20: 6, vencido
          denuncia('2026-08-13T15:00:00.000Z', '2026-08-13T15:00:00.000Z', 'UNDER_REVIEW'), // jue → jue: 5, justo
          denuncia('2026-08-17T15:00:00.000Z', '2026-08-17T15:00:00.000Z', 'RECEIVED'), // lun: 3
          denuncia('2026-08-03T15:00:00.000Z', '2026-08-03T15:00:00.000Z', 'INSPECTED'), // vencido
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.reports.overdue).toEqual({ open: 4, overdue: 2, pct: 50 });
      });

      it('un reclamo cerrado nunca cuenta como abierto ni como vencido', async () => {
        conDenuncias([
          denuncia('2026-08-03T15:00:00.000Z', '2026-08-04T15:00:00.000Z', 'CLOSED'),
          denuncia('2026-08-03T15:00:00.000Z', '2026-08-18T15:00:00.000Z', 'CLOSED'),
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.reports.overdue).toEqual({ open: 0, overdue: 0, pct: null });
      });

      /**
       * Solo CLOSED es final: desestimado, sin infracción y derivado todavía pasan a
       * CLOSED (docs/entidades/environmental-report.md) y se pueden reabrir, así que
       * siguen abiertos hasta cerrarse. Es la lectura conservadora.
       */
      it.each(['DISMISSED', 'NO_VIOLATION', 'FORWARDED', 'SANCTIONED'])(
        '%s todavía no es final: cuenta como abierto',
        async (estado) => {
          conDenuncias([denuncia('2026-08-03T15:00:00.000Z', '2026-08-04T15:00:00.000Z', estado)]);

          const result = await indicators.incidents(AGOSTO);

          expect(result.reports.overdue).toEqual({ open: 1, overdue: 1, pct: 100 });
        },
      );

      it('sin reclamos abiertos el porcentaje de vencidos es null, no 0 %', async () => {
        const result = await indicators.incidents(AGOSTO);

        expect(result.reports.overdue).toEqual({ open: 0, overdue: 0, pct: null });
      });

      it('hoy es el día argentino: a las 22:00 ART del jueves todavía es jueves', async () => {
        jest.setSystemTime(new Date('2026-08-21T01:00:00.000Z')); // viernes en UTC, jueves en ART
        conDenuncias([
          denuncia('2026-08-13T15:00:00.000Z', '2026-08-13T15:00:00.000Z', 'UNDER_REVIEW'), // jue 13 → jue 20: 5
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.reports.overdue).toEqual({ open: 1, overdue: 0, pct: 0 });
      });

      it('el universo son los reclamos creados en el período', async () => {
        conDenuncias([
          denuncia('2026-07-03T15:00:00.000Z', '2026-07-03T15:00:00.000Z', 'UNDER_REVIEW'),
          denuncia('2026-08-03T15:00:00.000Z', '2026-08-03T15:00:00.000Z', 'UNDER_REVIEW'),
        ]);

        const result = await indicators.incidents(AGOSTO);

        expect(result.reports.overdue.open).toBe(1);
      });

      it('la serie trae resueltos y dentro del plazo por día argentino de creación', async () => {
        conDenuncias([
          denuncia('2026-08-04T02:00:00.000Z', '2026-08-05T15:00:00.000Z'), // lunes 3 ART, dentro
          denuncia('2026-08-03T15:00:00.000Z', '2026-08-17T15:00:00.000Z'), // lunes 3, fuera
          denuncia('2026-08-05T15:00:00.000Z', '2026-08-06T15:00:00.000Z'), // miércoles 5, dentro
        ]);

        const result = await indicators.incidents({
          from: '2026-08-03',
          to: '2026-08-05',
          bucket: 'day',
        });

        expect(result.series!.map((pt) => pt.withinDeadline)).toEqual([
          { resolved: 2, withinDeadline: 1, pct: 50 },
          { resolved: 0, withinDeadline: 0, pct: null },
          { resolved: 1, withinDeadline: 1, pct: 100 },
        ]);
        const dentro = result.series!.reduce((n, pt) => n + pt.withinDeadline.withinDeadline, 0);
        expect(dentro).toBe(result.reports.withinDeadline.withinDeadline);
      });

      it('los vencidos no tienen serie, ni previous, ni delta: son una foto de hoy', async () => {
        const result = await indicators.incidents({
          ...AGOSTO,
          bucket: 'week',
          compare: 'previous',
        });

        expect(result.series![0]).not.toHaveProperty('overdue');
        expect(result.previous!.totals).not.toHaveProperty('overdue');
        expect(result.delta).not.toHaveProperty('overdue');
      });

      it('compare=previous trae el período anterior y la diferencia en puntos porcentuales', async () => {
        conDenuncias([
          denuncia('2026-08-03T15:00:00.000Z', '2026-08-04T15:00:00.000Z'), // anterior: dentro
          denuncia('2026-08-03T15:00:00.000Z', '2026-08-10T15:00:00.000Z'), // anterior: 5, dentro
          denuncia('2026-08-04T15:00:00.000Z', '2026-08-17T15:00:00.000Z'), // anterior: 9, fuera
          denuncia('2026-08-12T15:00:00.000Z', '2026-08-13T15:00:00.000Z'), // actual: dentro
          denuncia('2026-08-13T15:00:00.000Z', '2026-08-14T15:00:00.000Z'), // actual: dentro
        ]);

        const result = await indicators.incidents({
          from: '2026-08-11',
          to: '2026-08-20',
          compare: 'previous',
        });

        expect(result.previous!.totals.withinDeadline).toEqual({
          resolved: 3,
          withinDeadline: 2,
          pct: 66.7,
        });
        expect(result.reports.withinDeadline.pct).toBe(100);
        expect(result.delta!.withinDeadlinePct).toBe(33.3);
      });

      it('sin resueltos en alguno de los dos períodos, la diferencia es null', async () => {
        conDenuncias([denuncia('2026-08-12T15:00:00.000Z', '2026-08-13T15:00:00.000Z')]);

        const result = await indicators.incidents({
          from: '2026-08-11',
          to: '2026-08-20',
          compare: 'previous',
        });

        expect(result.previous!.totals.withinDeadline.pct).toBeNull();
        expect(result.delta!.withinDeadlinePct).toBeNull();
      });
    });

    describe('días hábiles, serie, período anterior y meta (#473)', () => {
      /** Prisma devuelve las denuncias creadas en el rango que se le pide. */
      function conDenuncias(todas: ReturnType<typeof denuncia>[]) {
        prisma.environmentalReport.findMany.mockImplementation(({ where }: any) =>
          todas.filter(
            (d) => d.createdAt >= where.createdAt.gte && d.createdAt < where.createdAt.lt,
          ),
        );
      }

      it('trae las metas de resolución, de plazo y de vencidos, con su sentido', async () => {
        const result = await indicators.incidents({});

        expect(result.targets).toMatchObject({
          resolutionBusinessDays: { value: 5, direction: 'max' },
          reportsWithinDeadlinePct: { value: 85, direction: 'min' },
          reportsOverduePct: { value: 10, direction: 'max' },
        });
      });

      it('las metas de plazo y de vencidos salen de la configuración', async () => {
        cfg.targets.reportsWithinDeadlinePct = 90;
        cfg.targets.reportsOverduePct = 5;

        const result = await indicators.incidents({});

        expect(result.targets.reportsWithinDeadlinePct.value).toBe(90);
        expect(result.targets.reportsOverduePct.value).toBe(5);
      });

      /** Nadie definió un número: se informa el sentido y el valor queda nulo. */
      it('desbordados y daños pendientes son de tendencia descendente, sin valor numérico', async () => {
        const result = await indicators.incidents({});

        expect(result.targets.overflowTrend).toEqual({ value: null, direction: 'down' });
        expect(result.targets.pendingDamageTrend).toEqual({ value: null, direction: 'down' });
      });

      it('la meta sale de la configuración', async () => {
        cfg.targets.resolutionBusinessDays = 4;

        const result = await indicators.incidents({});

        expect(result.targets.resolutionBusinessDays.value).toBe(4);
      });

      it('el fin de semana no cuenta: viernes a lunes son 3 corridos y 1 hábil', async () => {
        // viernes 7 → lunes 10
        prisma.environmentalReport.findMany.mockResolvedValue([
          denuncia('2026-08-07T15:00:00.000Z', '2026-08-10T15:00:00.000Z'),
        ]);

        const result = await indicators.incidents({});

        expect(result.reports.avgResolutionDays).toBe(3);
        expect(result.reports.avgResolutionBusinessDays).toBe(1);
      });

      it('de un viernes al viernes siguiente son 5 hábiles', async () => {
        prisma.environmentalReport.findMany.mockResolvedValue([
          denuncia('2026-08-07T15:00:00.000Z', '2026-08-14T15:00:00.000Z'),
        ]);

        const result = await indicators.incidents({});

        expect(result.reports.avgResolutionBusinessDays).toBe(5);
      });

      it('creada un sábado y cerrada el lunes es 1 hábil; el mismo día es 0', async () => {
        prisma.environmentalReport.findMany.mockResolvedValue([
          denuncia('2026-08-08T15:00:00.000Z', '2026-08-10T15:00:00.000Z'), // sáb → lun
          denuncia('2026-08-05T13:00:00.000Z', '2026-08-05T19:00:00.000Z'), // mismo día
          denuncia('2026-08-08T13:00:00.000Z', '2026-08-09T19:00:00.000Z'), // sáb → dom
        ]);

        const result = await indicators.incidents({});

        // (1 + 0 + 0) / 3
        expect(result.reports.avgResolutionBusinessDays).toBe(0.3);
      });

      it('promedia los hábiles de todas las cerradas con un decimal', async () => {
        prisma.environmentalReport.findMany.mockResolvedValue([
          denuncia('2026-08-07T15:00:00.000Z', '2026-08-14T15:00:00.000Z'), // 5
          denuncia('2026-08-07T15:00:00.000Z', '2026-08-10T15:00:00.000Z'), // 1
        ]);

        const result = await indicators.incidents({});

        expect(result.reports.avgResolutionBusinessDays).toBe(3);
      });

      it('los días son los argentinos: lo creado el lunes a la noche cuenta como lunes', async () => {
        // 02:00Z del martes 4 = 23:00 ART del lunes 3; cerrada el martes a mediodía ART.
        prisma.environmentalReport.findMany.mockResolvedValue([
          denuncia('2026-08-04T02:00:00.000Z', '2026-08-04T15:00:00.000Z'),
        ]);

        const result = await indicators.incidents({});

        expect(result.reports.avgResolutionBusinessDays).toBe(1);
      });

      it('las denuncias abiertas cuentan en el total pero no en el tiempo de resolución', async () => {
        prisma.environmentalReport.findMany.mockResolvedValue([
          denuncia('2026-08-07T15:00:00.000Z', '2026-08-10T15:00:00.000Z'),
          denuncia('2026-08-07T15:00:00.000Z', '2026-08-30T15:00:00.000Z', 'OPEN'),
        ]);

        const result = await indicators.incidents({});

        expect(result.reports.total).toBe(2);
        expect(result.reports.avgResolutionDays).toBe(3);
      });

      it('sin bucket ni compare no hay serie, previous ni delta', async () => {
        const result = await indicators.incidents({});

        expect(result.series).toBeUndefined();
        expect(result.previous).toBeUndefined();
        expect(result.delta).toBeUndefined();
      });

      it('bucket=day: denuncias por día argentino de creación, ceros y null sin base', async () => {
        conDenuncias([
          denuncia('2026-08-04T02:00:00.000Z', '2026-08-07T15:00:00.000Z'), // lunes 3 (ART)
          denuncia('2026-08-03T15:00:00.000Z', '2026-08-04T15:00:00.000Z', 'OPEN'), // lunes 3
          denuncia('2026-08-05T15:00:00.000Z', '2026-08-05T18:00:00.000Z'), // miércoles 5
        ]);

        const result = await indicators.incidents({
          from: '2026-08-03',
          to: '2026-08-05',
          bucket: 'day',
        });

        expect(result.series).toMatchObject([
          {
            from: '2026-08-03',
            to: '2026-08-03',
            total: 2,
            avgResolutionDays: 3.5,
            avgResolutionBusinessDays: 4,
          },
          {
            from: '2026-08-04',
            to: '2026-08-04',
            total: 0,
            avgResolutionDays: null,
            avgResolutionBusinessDays: null,
          },
          {
            from: '2026-08-05',
            to: '2026-08-05',
            total: 1,
            avgResolutionDays: 0.1,
            avgResolutionBusinessDays: 0,
          },
        ]);
        expect(result.series!.reduce((n, p) => n + p.total, 0)).toBe(result.reports.total);
      });

      it('la serie no incluye la foto actual de contenedores ni el arbolado', async () => {
        const result = await indicators.incidents({
          from: '2026-08-03',
          to: '2026-08-03',
          bucket: 'day',
        });

        // Sí lleva el historial de contenedores (#475); no el byStatus/byZone ni los árboles.
        expect(Object.keys(result.series![0]).sort()).toEqual([
          'avgResolutionBusinessDays',
          'avgResolutionDays',
          'containers',
          'from',
          'to',
          'total',
          'withinDeadline',
        ]);
      });

      it('el tope de puntos también rige en incidencias', async () => {
        await expect(
          indicators.incidents({ from: '2026-01-01', to: '2026-12-31', bucket: 'day' }),
        ).rejects.toThrow(/máximo es 90/);
      });

      it('compare=previous trae total y resolución del período anterior, y la diferencia', async () => {
        conDenuncias([
          denuncia('2026-08-03T15:00:00.000Z', '2026-08-13T15:00:00.000Z'), // anterior: 10 corridos, 8 hábiles
          denuncia('2026-08-12T15:00:00.000Z', '2026-08-14T15:00:00.000Z'), // actual: 2 corridos, 2 hábiles
          denuncia('2026-08-13T15:00:00.000Z', '2026-08-13T18:00:00.000Z', 'OPEN'),
        ]);

        const result = await indicators.incidents({
          from: '2026-08-11',
          to: '2026-08-20',
          compare: 'previous',
        });

        expect(result.previous).toMatchObject({
          period: { from: '2026-08-01', to: '2026-08-10' },
          totals: { total: 1, avgResolutionDays: 10, avgResolutionBusinessDays: 8 },
        });
        expect(result.reports.total).toBe(2);
        expect(result.delta).toMatchObject({
          avgResolutionDays: -8,
          avgResolutionBusinessDays: -6,
        });
      });

      it('sin cerradas en alguno de los dos períodos, la diferencia es nula', async () => {
        conDenuncias([denuncia('2026-08-12T15:00:00.000Z', '2026-08-14T15:00:00.000Z')]);

        const result = await indicators.incidents({
          from: '2026-08-11',
          to: '2026-08-20',
          compare: 'previous',
        });

        expect(result.previous!.totals.avgResolutionDays).toBeNull();
        expect(result.delta).toMatchObject({
          avgResolutionDays: null,
          avgResolutionBusinessDays: null,
        });
      });
    });
  });

  describe('residuos', () => {
    const registro = (
      kg: string,
      m3: string,
      siteType: string,
      id = 's-1',
      fecha = '2026-08-10',
    ) => ({
      wasteType: 'HOUSEHOLD',
      weightKg: new Prisma.Decimal(kg),
      volumeM3: new Prisma.Decimal(m3),
      disposalSite: { id, code: id.toUpperCase(), name: id, siteType },
      service: { scheduledDate: new Date(`${fecha}T00:00:00.000Z`) },
    });

    /** Prisma devuelve los registros cuyo servicio cae en el rango que se le pide. */
    function conRegistros(todos: ReturnType<typeof registro>[]) {
      prisma.collectionRecord.findMany.mockImplementation(({ where }: any) =>
        todos.filter(
          (r) =>
            r.service.scheduledDate >= where.service.scheduledDate.gte &&
            r.service.scheduledDate <= where.service.scheduledDate.lte,
        ),
      );
    }

    describe('serie, período anterior y meta (#473)', () => {
      it('la meta del relleno no está definida: es nula hasta que el equipo la acuerde', async () => {
        const result = await indicators.waste({});

        expect(result.targets).toEqual({ landfillDiversionPct: null });
      });

      it('con meta configurada, más desvío es mejor', async () => {
        cfg.targets.landfillDiversionPct = 30;

        const result = await indicators.waste({});

        expect(result.targets).toEqual({ landfillDiversionPct: { value: 30, direction: 'min' } });
      });

      it('sin bucket ni compare no hay serie, previous ni delta', async () => {
        const result = await indicators.waste({});

        expect(result.series).toBeUndefined();
        expect(result.previous).toBeUndefined();
        expect(result.delta).toBeUndefined();
      });

      it('bucket=week: kilos, metros cúbicos y desvío por intervalo; la suma coincide con totals', async () => {
        conRegistros([
          registro('1000', '5', 'LANDFILL', 'relleno', '2026-08-04'),
          registro('500', '2', 'RECYCLING_PLANT', 'planta', '2026-08-05'),
          registro('300', '1', 'COMPOSTING_PLANT', 'compost', '2026-08-18'),
        ]);

        const result = await indicators.waste({
          from: '2026-08-03',
          to: '2026-08-23',
          bucket: 'week',
        });

        expect(result.series).toEqual([
          {
            from: '2026-08-03',
            to: '2026-08-09',
            weightKg: 1500,
            volumeM3: 7,
            divertedKg: 500,
            divertedPct: 33.3,
          },
          {
            from: '2026-08-10',
            to: '2026-08-16',
            weightKg: 0,
            volumeM3: 0,
            divertedKg: 0,
            divertedPct: 0,
          },
          {
            from: '2026-08-17',
            to: '2026-08-23',
            weightKg: 300,
            volumeM3: 1,
            divertedKg: 300,
            divertedPct: 100,
          },
        ]);
        const suma = (k: 'weightKg' | 'volumeM3' | 'divertedKg') =>
          result.series!.reduce((acc, pt) => acc + pt[k], 0);
        expect(suma('weightKg')).toBe(result.totals.weightKg);
        expect(suma('volumeM3')).toBe(result.totals.volumeM3);
        expect(suma('divertedKg')).toBe(result.totals.divertedKg);
      });

      it('el tope de puntos también rige en residuos', async () => {
        await expect(
          indicators.waste({ from: '2026-01-01', to: '2026-12-31', bucket: 'day' }),
        ).rejects.toThrow(/máximo es 90/);
      });

      it('compare=previous trae los totales del período anterior y la diferencia en puntos', async () => {
        conRegistros([
          registro('1000', '5', 'LANDFILL', 'relleno', '2026-08-05'), // anterior: 0 %
          registro('750', '3', 'LANDFILL', 'relleno', '2026-08-15'), // actual: 25 %
          registro('250', '1', 'COMPOSTING_PLANT', 'compost', '2026-08-16'),
        ]);

        const result = await indicators.waste({
          from: '2026-08-11',
          to: '2026-08-20',
          compare: 'previous',
        });

        expect(result.previous).toEqual({
          period: { from: '2026-08-01', to: '2026-08-10' },
          totals: { weightKg: 1000, volumeM3: 5, divertedKg: 0, divertedPct: 0 },
        });
        expect(result.totals.divertedPct).toBe(25);
        expect(result.delta).toEqual({ divertedPct: 25 });
      });

      it('sin kilos en alguno de los dos períodos, la diferencia es nula', async () => {
        conRegistros([registro('750', '3', 'LANDFILL', 'relleno', '2026-08-15')]);

        const result = await indicators.waste({
          from: '2026-08-11',
          to: '2026-08-20',
          compare: 'previous',
        });

        expect(result.delta).toEqual({ divertedPct: null });
      });
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

  describe('período invertido', () => {
    it('los cuatro indicadores rechazan from posterior a to', async () => {
      const q = { from: '2026-12-01', to: '2026-01-01' };

      await expect(indicators.coverage(q)).rejects.toThrow(BadRequestException);
      await expect(indicators.compliance(q)).rejects.toThrow(BadRequestException);
      await expect(indicators.incidents(q)).rejects.toThrow(BadRequestException);
      await expect(indicators.waste(q)).rejects.toThrow(BadRequestException);
    });
  });
});
