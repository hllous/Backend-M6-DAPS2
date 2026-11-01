import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ContainerStatus,
  DisposalSiteType,
  EnvironmentalReportStatus,
  NotServicedReason,
  Prisma,
  RiskLevel,
  ServiceStatus,
  ZoneResultStatus,
} from '@prisma/client';
import { startOfDayArgentina, toDateOnly, todayArgentina } from '../../common/utils/date-only';
import { PrismaService } from '../../prisma/prisma.service';
import {
  diaArgentino,
  diasHabiles,
  intervalos,
  rangoAnterior,
  tramoDe,
} from './indicators.intervals';
import {
  ComplianceIndicatorDto,
  ComplianceTotalsDto,
  ContainerHistoryTotalsDto,
  CoverageBreakdownDto,
  CoverageIndicatorDto,
  CoverageTotalsDto,
  IncidentsIndicatorDto,
  PeriodDto,
  OverdueDto,
  PeriodQueryDto,
  ReportsTotalsDto,
  ServicePeriodQueryDto,
  WasteIndicatorDto,
  WasteTotalsDto,
} from './dto';

const DIA_MS = 86_400_000;

/** Lo que arma `configuration.ts` con las variables INDICATORS_*. */
export interface IndicatorsConfig {
  minSample: number;
  /** Plazo objetivo de resolución de una denuncia, en días hábiles. */
  reportDeadlineBusinessDays: number;
  targets: {
    coveragePct: number;
    compliancePct: number;
    resolutionBusinessDays: number;
    schedulingDeviationPct: number;
    landfillDiversionPct: number | null;
    reportsWithinDeadlinePct: number;
    reportsOverduePct: number;
  };
}

/** Los estados que cuentan como servicio cerrado. */
const CERRADOS: ServiceStatus[] = [ServiceStatus.COMPLETED, ServiceStatus.PARTIALLY_COMPLETED];

/** Lo que no termina en relleno cuenta como desvío. */
const DESVIADOS: DisposalSiteType[] = [
  DisposalSiteType.RECYCLING_PLANT,
  DisposalSiteType.COMPOSTING_PLANT,
];

/** Un porcentaje con un decimal, y sin dividir por cero sobre base vacía. */
function pct(parte: number, total: number): number {
  return total === 0 ? 0 : Math.round((parte / total) * 1000) / 10;
}

/** Solo para fechas sin hora (@db.Date o `from`/`to`); un timestamp va por `todayArgentina`. */
function dia(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function num(value: Prisma.Decimal | null): number {
  return value === null ? 0 : Number(value);
}

interface Periodo {
  from: Date;
  to: Date;
  /**
   * Límites para filtrar timestamps. `from` y `to` son días argentinos: cortar
   * en la medianoche UTC dejaría afuera lo cargado después de las 21:00 del
   * último día y metería lo de la noche anterior al primero.
   */
  desde: Date;
  /** Exclusivo. */
  hasta: Date;
  dto: PeriodDto;
}

function periodo(query: PeriodQueryDto): Periodo {
  // El DTO acepta ISO con hora: se trunca para que el filtro @db.Date y los
  // límites argentinos de los timestamps hablen del mismo día.
  const to = query.to ? toDateOnly(query.to) : todayArgentina();
  const from = query.from ? toDateOnly(query.from) : new Date(to.getTime() - 30 * DIA_MS);
  if (from > to) {
    throw new BadRequestException(
      `'from' (${dia(from)}) no puede ser posterior a 'to' (${dia(to)})`,
    );
  }
  return armarPeriodo(from, to);
}

function armarPeriodo(from: Date, to: Date): Periodo {
  return {
    from,
    to,
    desde: startOfDayArgentina(from),
    hasta: startOfDayArgentina(new Date(to.getTime() + DIA_MS)),
    dto: { from: dia(from), to: dia(to) },
  };
}

/** El período inmediatamente anterior, de igual duración (`compare=previous`). */
function periodoAnterior(p: Periodo): Periodo {
  const anterior = rangoAnterior(p.from, p.to);
  return armarPeriodo(anterior.from, anterior.to);
}

/** Diferencia con un decimal; null si alguno de los dos lados no tiene base. */
function diferencia(actual: number | null, previo: number | null): number | null {
  return actual === null || previo === null ? null : Math.round((actual - previo) * 10) / 10;
}

/** Diferencia de un conteo de contenedores; null si alguno de los dos lados no tiene historial. */
function diferenciaConHistorial(
  actual: ContainerHistoryTotalsDto,
  previo: ContainerHistoryTotalsDto,
  campo: 'overflowIncidents' | 'pendingDamage',
): number | null {
  if (actual.pendingDamage === null || previo.pendingDamage === null) return null;
  return diferencia(actual[campo], previo[campo]);
}

/** Acumulador de cobertura, para no repetir la misma suma tres veces. */
class Acumulador {
  scheduled = 0;
  served = 0;
  partial = 0;
  notServiced = 0;
  pending = 0;

  upcoming = 0;

  /** Un par con fecha futura no es un incumplimiento: se cuenta aparte. */
  suma(resultado: ZoneResultStatus | undefined, vencido: boolean): void {
    if (!vencido) {
      this.upcoming += 1;
      return;
    }
    this.scheduled += 1;
    if (resultado === ZoneResultStatus.SERVICED) this.served += 1;
    else if (resultado === ZoneResultStatus.PARTIAL) this.partial += 1;
    else if (resultado === ZoneResultStatus.NOT_SERVICED) this.notServiced += 1;
    else this.pending += 1;
  }

  totales(): CoverageTotalsDto {
    return {
      scheduled: this.scheduled,
      served: this.served,
      partial: this.partial,
      notServiced: this.notServiced,
      pending: this.pending,
      upcoming: this.upcoming,
      coveragePct: pct(this.served, this.scheduled),
    };
  }
}

/**
 * Las cuatro familias de indicadores del tablero (docs/README.md).
 *
 * **La unidad de cobertura es el par (servicio, zona)**, no el servicio: un
 * recorrido que pasa por cuatro zonas y atiende tres no es "un servicio a
 * medias", son tres objetivos cumplidos y uno no. `ServiceZone` ya es ese par
 * —lo escribe el servicio al programarse, incluso en modo `POINT`— y
 * `ZoneResult` es su resultado.
 *
 * ponytail: la cobertura y el cumplimiento traen los servicios del período y
 * agregan en memoria. Para un mes municipal son cientos de filas; si el tablero
 * empieza a pedir años, esto pasa a `GROUP BY` en SQL.
 */
@Injectable()
export class IndicatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get cfg(): IndicatorsConfig {
    const cfg = this.config.get<IndicatorsConfig>('indicators');
    if (!cfg) throw new Error('Falta la configuración de indicadores');
    return cfg;
  }

  /** Objetivos atendidos sobre programados, por zona y por tipo de servicio. */
  async coverage(query: ServicePeriodQueryDto): Promise<CoverageIndicatorDto> {
    const p = periodo(query);
    // El tope se valida antes de leer la base.
    const tramos = query.bucket ? intervalos(p.from, p.to, query.bucket) : undefined;
    const hoy = todayArgentina();
    const services = await this.serviciosDelPeriodo(p, query);

    const totales = new Acumulador();
    const porZona = new Map<string, { code: string; name: string; acc: Acumulador }>();
    const porTipo = new Map<string, { code: string; name: string; acc: Acumulador }>();
    const porTramo = (tramos ?? []).map(() => new Acumulador());

    for (const s of services) {
      const resultados = new Map(s.zoneResults.map((r) => [r.zoneId, r.status]));
      // Con filtro de zona solo cuenta esa: el resto del recorrido no se pidió.
      const pares = query.zoneId ? s.zones.filter((z) => z.zoneId === query.zoneId) : s.zones;

      const tipo = obtener(porTipo, s.serviceTypeId, s.serviceType);
      const vencido = s.scheduledDate.getTime() <= hoy.getTime();
      const tramo = tramos ? porTramo[tramoDe(tramos, s.scheduledDate)] : undefined;
      for (const par of pares) {
        const resultado = resultados.get(par.zoneId);
        totales.suma(resultado, vencido);
        obtener(porZona, par.zoneId, par.zone).acc.suma(resultado, vencido);
        tipo.acc.suma(resultado, vencido);
        tramo?.suma(resultado, vencido);
      }
    }

    const result: CoverageIndicatorDto = {
      period: p.dto,
      totals: totales.totales(),
      byZone: desglose(porZona, this.cfg.minSample),
      byServiceType: desglose(porTipo, this.cfg.minSample),
      targets: { coveragePct: { value: this.cfg.targets.coveragePct, direction: 'min' } },
    };
    if (tramos) {
      result.series = tramos.map((t, i) => ({
        from: dia(t.from),
        to: dia(t.to),
        ...porTramo[i].totales(),
      }));
    }
    if (query.compare) {
      const anterior = periodoAnterior(p);
      const previo = await this.coberturaTotal(anterior, query, hoy);
      result.previous = { period: anterior.dto, totals: previo };
      result.delta = {
        coveragePct: diferencia(
          result.totals.scheduled === 0 ? null : result.totals.coveragePct,
          previo.scheduled === 0 ? null : previo.coveragePct,
        ),
      };
    }
    return result;
  }

  /** Finalizados en término vs. demorados, y ranking de zonas no atendidas. */
  async compliance(query: ServicePeriodQueryDto): Promise<ComplianceIndicatorDto> {
    const p = periodo(query);
    const tramos = query.bucket ? intervalos(p.from, p.to, query.bucket) : undefined;
    const services = await this.serviciosDelPeriodo(p, query);
    const totales = resumenCumplimiento(services);

    const zonas = new Map<
      string,
      { code: string; name: string; count: number; reasons: Map<string, number> }
    >();

    for (const s of services) {
      const nombres = new Map(s.zones.map((z) => [z.zoneId, z.zone]));
      for (const r of s.zoneResults) {
        if (r.status !== ZoneResultStatus.NOT_SERVICED) continue;
        if (query.zoneId && r.zoneId !== query.zoneId) continue;

        const zona = zonas.get(r.zoneId) ?? {
          ...(nombres.get(r.zoneId) ?? { code: '?', name: '?' }),
          count: 0,
          reasons: new Map<string, number>(),
        };
        zona.count += 1;
        const motivo = r.reason ?? 'SIN_MOTIVO';
        zona.reasons.set(motivo, (zona.reasons.get(motivo) ?? 0) + 1);
        zonas.set(r.zoneId, zona);
      }
    }

    const result: ComplianceIndicatorDto = {
      period: p.dto,
      finished: totales.finished,
      schedulingDeviation: totales.schedulingDeviation,
      notServicedRanking: [...zonas.entries()]
        .map(([zoneId, z]) => ({
          zoneId,
          code: z.code,
          name: z.name,
          count: z.count,
          reasons: [...z.reasons.entries()]
            .map(([reason, count]) => ({
              reason: reason === 'SIN_MOTIVO' ? null : (reason as NotServicedReason),
              count,
            }))
            .sort((a, b) => b.count - a.count),
        }))
        .sort((a, b) => b.count - a.count),
      targets: {
        compliancePct: { value: this.cfg.targets.compliancePct, direction: 'min' },
        schedulingDeviationPct: {
          value: this.cfg.targets.schedulingDeviationPct,
          direction: 'max',
        },
      },
    };
    if (tramos) {
      result.series = tramos.map((t) => ({
        from: dia(t.from),
        to: dia(t.to),
        ...resumenCumplimiento(
          services.filter((s) => s.scheduledDate >= t.from && s.scheduledDate <= t.to),
        ),
      }));
    }
    if (query.compare) {
      const anterior = periodoAnterior(p);
      const previo = resumenCumplimiento(await this.serviciosDelPeriodo(anterior, query));
      result.previous = { period: anterior.dto, totals: previo };
      result.delta = {
        onTimePct: diferencia(
          totales.finished.total === 0 ? null : totales.finished.onTimePct,
          previo.finished.total === 0 ? null : previo.finished.onTimePct,
        ),
        deviatedPct: diferencia(
          totales.schedulingDeviation.total === 0 ? null : totales.schedulingDeviation.deviatedPct,
          previo.schedulingDeviation.total === 0 ? null : previo.schedulingDeviation.deviatedPct,
        ),
      };
    }
    return result;
  }

  /** Contenedores, arbolado y denuncias. */
  async incidents(query: PeriodQueryDto): Promise<IncidentsIndicatorDto> {
    const p = periodo(query);
    const tramos = query.bucket ? intervalos(p.from, p.to, query.bucket) : undefined;
    const rango = { gte: p.desde, lt: p.hasta };

    const [porEstado, porZona, zonas, riesgos, porTipo, porStatus, denuncias, historial] =
      await Promise.all([
        this.prisma.container.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.container.groupBy({ by: ['zoneId', 'status'], _count: { _all: true } }),
        this.prisma.zone.findMany({ select: { id: true, code: true, name: true } }),
        // El último relevamiento de cada árbol: DISTINCT ON es exactamente eso
        // en una pasada, y Prisma no lo expresa con su API de agregación.
        this.prisma.$queryRaw<{ riskLevel: RiskLevel; count: bigint }[]>`
          SELECT ultimo.risk_level AS "riskLevel", COUNT(*) AS count
          FROM (
            SELECT DISTINCT ON (tree_id) tree_id, risk_level
            FROM tree_survey
            ORDER BY tree_id, surveyed_at DESC
          ) ultimo
          JOIN tree t ON t.id = ultimo.tree_id AND t.active = true
          GROUP BY ultimo.risk_level
        `,
        this.prisma.environmentalReport.groupBy({
          by: ['reportType'],
          where: { createdAt: rango },
          _count: { _all: true },
        }),
        this.prisma.environmentalReport.groupBy({
          by: ['status'],
          where: { createdAt: rango },
          _count: { _all: true },
        }),
        this.denunciasDelPeriodo(p),
        this.historialDeContenedores(p),
      ]);

    const nombres = new Map(zonas.map((z) => [z.id, z]));
    const contadores = new Map<string, { overflowed: number; damaged: number; total: number }>();
    for (const fila of porZona) {
      const c = contadores.get(fila.zoneId) ?? { overflowed: 0, damaged: 0, total: 0 };
      c.total += fila._count._all;
      if (fila.status === ContainerStatus.OVERFLOWED) c.overflowed += fila._count._all;
      if (fila.status === ContainerStatus.DAMAGED) c.damaged += fila._count._all;
      contadores.set(fila.zoneId, c);
    }

    const plazo = this.cfg.reportDeadlineBusinessDays;
    const totales = resumenDenuncias(denuncias, plazo);

    const result: IncidentsIndicatorDto = {
      period: p.dto,
      containers: {
        byStatus: porEstado.map((f) => ({ status: f.status, count: f._count._all })),
        history: {
          ...resumenContenedores(historial.filas, p),
          trackingSince: historial.trackingSince?.toISOString() ?? null,
        },
        byZone: [...contadores.entries()]
          .map(([zoneId, c]) => ({
            zoneId,
            code: nombres.get(zoneId)?.code ?? '?',
            name: nombres.get(zoneId)?.name ?? '?',
            ...c,
          }))
          .sort((a, b) => b.overflowed + b.damaged - (a.overflowed + a.damaged)),
      },
      trees: {
        byRiskLevel: riesgos.map((r) => ({ riskLevel: r.riskLevel, count: Number(r.count) })),
      },
      reports: {
        ...totales,
        deadlineBusinessDays: plazo,
        overdue: resumenVencidas(denuncias, plazo, new Date()),
        byType: porTipo.map((f) => ({ reportType: f.reportType, count: f._count._all })),
        byStatus: porStatus.map((f) => ({ status: f.status, count: f._count._all })),
      },
      targets: {
        resolutionBusinessDays: {
          value: this.cfg.targets.resolutionBusinessDays,
          direction: 'max',
        },
        reportsWithinDeadlinePct: {
          value: this.cfg.targets.reportsWithinDeadlinePct,
          direction: 'min',
        },
        reportsOverduePct: { value: this.cfg.targets.reportsOverduePct, direction: 'max' },
        // De tendencia: el equipo pidió que bajen, no fijó un número.
        overflowTrend: { value: null, direction: 'down' },
        pendingDamageTrend: { value: null, direction: 'down' },
      },
    };
    if (tramos) {
      result.series = tramos.map((t) => ({
        from: dia(t.from),
        to: dia(t.to),
        ...resumenDenuncias(
          denuncias.filter((d) => {
            const creada = diaArgentino(d.createdAt);
            return creada >= t.from && creada <= t.to;
          }),
          plazo,
        ),
        containers: resumenContenedores(historial.filas, armarPeriodo(t.from, t.to)),
      }));
    }
    if (query.compare) {
      const anterior = periodoAnterior(p);
      const previo = resumenDenuncias(await this.denunciasDelPeriodo(anterior), plazo);
      const contenedoresPrevio = resumenContenedores(historial.filas, anterior);
      const contenedores = result.containers.history;
      result.previous = {
        period: anterior.dto,
        totals: { ...previo, containers: contenedoresPrevio },
      };
      result.delta = {
        avgResolutionDays: diferencia(totales.avgResolutionDays, previo.avgResolutionDays),
        avgResolutionBusinessDays: diferencia(
          totales.avgResolutionBusinessDays,
          previo.avgResolutionBusinessDays,
        ),
        withinDeadlinePct: diferencia(totales.withinDeadline.pct, previo.withinDeadline.pct),
        // Sin historial en alguno de los dos lados no hay base: ni los pendientes ni
        // los desbordes (un 0 sin historial no es "ningún desborde") se comparan.
        overflowIncidents: diferenciaConHistorial(
          contenedores,
          contenedoresPrevio,
          'overflowIncidents',
        ),
        pendingDamage: diferenciaConHistorial(contenedores, contenedoresPrevio, 'pendingDamage'),
      };
    }
    return result;
  }

  /** Kg y m³ por tipo y destino, y porcentaje desviado del relleno. */
  async waste(query: PeriodQueryDto): Promise<WasteIndicatorDto> {
    const p = periodo(query);
    const tramos = query.bucket ? intervalos(p.from, p.to, query.bucket) : undefined;
    const records = await this.registrosDelPeriodo(p);

    const porTipo = new Map<string, { weightKg: number; volumeM3: number }>();
    const porSitio = new Map<
      string,
      { code: string; name: string; siteType: DisposalSiteType; weightKg: number; volumeM3: number }
    >();

    for (const r of records) {
      const kg = num(r.weightKg);
      const m3 = num(r.volumeM3);

      const tipo = porTipo.get(r.wasteType) ?? { weightKg: 0, volumeM3: 0 };
      tipo.weightKg += kg;
      tipo.volumeM3 += m3;
      porTipo.set(r.wasteType, tipo);

      const sitio = porSitio.get(r.disposalSite.id) ?? {
        code: r.disposalSite.code,
        name: r.disposalSite.name,
        siteType: r.disposalSite.siteType,
        weightKg: 0,
        volumeM3: 0,
      };
      sitio.weightKg += kg;
      sitio.volumeM3 += m3;
      porSitio.set(r.disposalSite.id, sitio);
    }

    const totals = totalesResiduos(records);
    const result: WasteIndicatorDto = {
      period: p.dto,
      totals,
      byWasteType: [...porTipo.entries()]
        .map(([wasteType, v]) => ({
          wasteType: wasteType as WasteIndicatorDto['byWasteType'][number]['wasteType'],
          weightKg: redondear(v.weightKg),
          volumeM3: redondear(v.volumeM3),
        }))
        .sort((a, b) => b.weightKg - a.weightKg),
      byDisposalSite: [...porSitio.entries()]
        .map(([disposalSiteId, v]) => ({
          disposalSiteId,
          ...v,
          weightKg: redondear(v.weightKg),
          volumeM3: redondear(v.volumeM3),
        }))
        .sort((a, b) => b.weightKg - a.weightKg),
      records: records.length,
      targets: {
        landfillDiversionPct:
          this.cfg.targets.landfillDiversionPct === null
            ? null
            : { value: this.cfg.targets.landfillDiversionPct, direction: 'min' },
      },
    };
    if (tramos) {
      result.series = tramos.map((t) => ({
        from: dia(t.from),
        to: dia(t.to),
        ...totalesResiduos(
          records.filter(
            (r) => r.service.scheduledDate >= t.from && r.service.scheduledDate <= t.to,
          ),
        ),
      }));
    }
    if (query.compare) {
      const anterior = periodoAnterior(p);
      const previo = totalesResiduos(await this.registrosDelPeriodo(anterior));
      result.previous = { period: anterior.dto, totals: previo };
      result.delta = {
        divertedPct: diferencia(
          totals.weightKg === 0 ? null : totals.divertedPct,
          previo.weightKg === 0 ? null : previo.divertedPct,
        ),
      };
    }
    return result;
  }

  // ─── Helpers ──────────────────────────────────────

  /**
   * Los registros de recolección del período. CollectionRecord no tiene fecha
   * propia: la del servicio que lo generó es la fecha del residuo.
   */
  private registrosDelPeriodo(p: Periodo) {
    return this.prisma.collectionRecord.findMany({
      where: { service: { scheduledDate: { gte: p.from, lte: p.to } } },
      select: {
        wasteType: true,
        weightKg: true,
        volumeM3: true,
        service: { select: { scheduledDate: true } },
        disposalSite: { select: { id: true, code: true, name: true, siteType: true } },
      },
    });
  }

  /**
   * Las denuncias creadas en el período, con lo mínimo para contarlas y medir su
   * resolución.
   *
   * Solo CLOSED es un estado del que no se sale, así que `updatedAt` como marca
   * de cierre alcanza porque después de cerrar no se toca más.
   * ponytail: si hace falta precisión, una columna closedAt.
   */
  private denunciasDelPeriodo(p: Periodo) {
    return this.prisma.environmentalReport.findMany({
      where: { createdAt: { gte: p.desde, lt: p.hasta } },
      select: { createdAt: true, updatedAt: true, status: true },
    });
  }

  /**
   * Todas las filas del historial de contenedores anteriores al fin del período,
   * en orden, más el instante de la más antigua de todas. Alcanza una sola
   * lectura: el período anterior de `compare` termina antes y sale del mismo
   * arreglo, y los pendientes al fin de cada tramo también.
   * ponytail: se agrega en memoria (un parque municipal son cientos de
   * contenedores con pocas transiciones por mes); si el historial crece a años,
   * esto pasa a DISTINCT ON / GROUP BY en SQL como el arbolado.
   */
  private async historialDeContenedores(p: Periodo) {
    const [filas, primera] = await Promise.all([
      this.prisma.containerStatusHistory.findMany({
        where: { changedAt: { lt: p.hasta } },
        select: { containerId: true, fromStatus: true, toStatus: true, changedAt: true },
        orderBy: { changedAt: 'asc' },
      }),
      this.prisma.containerStatusHistory.aggregate({ _min: { changedAt: true } }),
    ]);
    return { filas, trackingSince: primera._min.changedAt };
  }

  /** Solo los totales de cobertura de un período (el anterior de `compare`). */
  private async coberturaTotal(
    p: Periodo,
    query: ServicePeriodQueryDto,
    hoy: Date,
  ): Promise<CoverageTotalsDto> {
    const acc = new Acumulador();
    for (const s of await this.serviciosDelPeriodo(p, query)) {
      const resultados = new Map(s.zoneResults.map((r) => [r.zoneId, r.status]));
      const pares = query.zoneId ? s.zones.filter((z) => z.zoneId === query.zoneId) : s.zones;
      const vencido = s.scheduledDate.getTime() <= hoy.getTime();
      for (const par of pares) acc.suma(resultados.get(par.zoneId), vencido);
    }
    return acc.totales();
  }

  /**
   * Los servicios del período con sus pares zona/resultado. Cobertura y
   * cumplimiento leen lo mismo, así que hay una sola consulta.
   *
   * El `CANCELLED` queda afuera: un servicio cancelado no es un objetivo
   * incumplido, es un objetivo que dejó de existir.
   */
  private serviciosDelPeriodo(p: Periodo, query: ServicePeriodQueryDto) {
    return this.prisma.service.findMany({
      where: {
        scheduledDate: { gte: p.from, lte: p.to },
        status: { not: ServiceStatus.CANCELLED },
        ...(query.serviceTypeId && { serviceTypeId: query.serviceTypeId }),
        ...(query.zoneId && { zones: { some: { zoneId: query.zoneId } } }),
      },
      select: {
        status: true,
        scheduledDate: true,
        serviceTypeId: true,
        serviceType: { select: { code: true, name: true } },
        zones: { select: { zoneId: true, zone: { select: { code: true, name: true } } } },
        // Solo importa si hay alguno, vigente o reemplazado: un servicio cuenta una vez.
        delayNotices: { select: { id: true }, take: 1 },
        zoneResults: { select: { zoneId: true, status: true, reason: true, recordedAt: true } },
      },
    });
  }
}

/** Finalizados (en término / demorados) y desvío de programación de un grupo de servicios. */
function resumenCumplimiento(
  services: {
    status: ServiceStatus;
    scheduledDate: Date;
    delayNotices: unknown[];
    zoneResults: { recordedAt: Date }[];
  }[],
): ComplianceTotalsDto {
  let onTime = 0;
  let late = 0;
  let deviated = 0;

  for (const s of services) {
    if (s.status === ServiceStatus.RESCHEDULED || s.delayNotices.length > 0) deviated += 1;

    if (CERRADOS.includes(s.status) && s.zoneResults.length > 0) {
      // No hay columna de cierre en Service, y updatedAt se mueve con
      // cualquier edición posterior: el último resultado de campo cargado es
      // la única marca honesta de cuándo se terminó el trabajo.
      const cierre = s.zoneResults.reduce(
        (max, r) => (r.recordedAt > max ? r.recordedAt : max),
        s.zoneResults[0].recordedAt,
      );
      // El día del cierre es el argentino: un nocturno cerrado a las 23:30
      // ya cae en el día UTC siguiente y contaría como demorado.
      if (todayArgentina(cierre).getTime() <= s.scheduledDate.getTime()) onTime += 1;
      else late += 1;
    }
  }

  const total = onTime + late;
  return {
    finished: { total, onTime, late, onTimePct: pct(onTime, total) },
    schedulingDeviation: {
      total: services.length,
      deviated,
      deviatedPct: pct(deviated, services.length),
    },
  };
}

interface FilaHistorial {
  containerId: string;
  fromStatus: ContainerStatus | null;
  toStatus: ContainerStatus;
  changedAt: Date;
}

/** Un daño sin resolver: el contenedor está dañado o esperando/en reparación. */
const PENDIENTES: ContainerStatus[] = [ContainerStatus.DAMAGED, ContainerStatus.UNDER_REPAIR];

/**
 * Contenedores con un daño sin resolver en el instante `corte` (exclusivo): los
 * que tienen `DAMAGED` o `UNDER_REPAIR` como último estado conocido hasta ahí.
 * Un contenedor sin filas antes del corte no existía en el historial y no se
 * cuenta. **Null si ningún contenedor tiene historial hasta el corte**: sin dato
 * no es lo mismo que cero daños. `filas` va ordenado por `changedAt`.
 */
function pendientesAl(filas: FilaHistorial[], corte: Date): number | null {
  const ultimo = new Map<string, ContainerStatus>();
  for (const f of filas) {
    if (f.changedAt < corte) ultimo.set(f.containerId, f.toStatus);
  }
  if (ultimo.size === 0) return null;
  return [...ultimo.values()].filter((estado) => PENDIENTES.includes(estado)).length;
}

/**
 * Incidentes del período: una transición a OVERFLOWED o a DAMAGED con origen no
 * nulo. El alta y la fila base de la migración (origen nulo) solo sirven para
 * reconstruir el estado.
 */
function resumenContenedores(filas: FilaHistorial[], p: Periodo): ContainerHistoryTotalsDto {
  let overflowIncidents = 0;
  let damageIncidents = 0;
  for (const f of filas) {
    if (f.fromStatus === null || f.changedAt < p.desde || f.changedAt >= p.hasta) continue;
    if (f.toStatus === ContainerStatus.OVERFLOWED) overflowIncidents += 1;
    if (f.toStatus === ContainerStatus.DAMAGED) damageIncidents += 1;
  }
  return { overflowIncidents, damageIncidents, pendingDamage: pendientesAl(filas, p.hasta) };
}

/** Un porcentaje con un decimal; null sobre base vacía (sin dato no es 0 %). */
function pctONull(parte: number, total: number): number | null {
  return total === 0 ? null : pct(parte, total);
}

/** Los reclamos "resueltos" son los CLOSED, como en el promedio de resolución. */
function cerrada(d: { status: EnvironmentalReportStatus }): boolean {
  return d.status === EnvironmentalReportStatus.CLOSED;
}

/**
 * Cantidad de denuncias, tiempo medio de resolución (corrido y hábil) de las
 * cerradas y cuántas se cerraron dentro del plazo objetivo (`plazo`, en días
 * hábiles; justo el plazo cuenta como dentro).
 */
function resumenDenuncias(
  denuncias: { createdAt: Date; updatedAt: Date; status: EnvironmentalReportStatus }[],
  plazo: number,
): ReportsTotalsDto {
  const cerradas = denuncias.filter(cerrada);
  const dentro = cerradas.filter((d) => diasHabiles(d.createdAt, d.updatedAt) <= plazo).length;
  const withinDeadline = {
    resolved: cerradas.length,
    withinDeadline: dentro,
    pct: pctONull(dentro, cerradas.length),
  };
  if (cerradas.length === 0) {
    return {
      total: denuncias.length,
      avgResolutionDays: null,
      avgResolutionBusinessDays: null,
      withinDeadline,
    };
  }
  const corridos = cerradas.reduce(
    (suma, d) => suma + (d.updatedAt.getTime() - d.createdAt.getTime()) / DIA_MS,
    0,
  );
  const habiles = cerradas.reduce((suma, d) => suma + diasHabiles(d.createdAt, d.updatedAt), 0);
  return {
    total: denuncias.length,
    avgResolutionDays: Math.round((corridos / cerradas.length) * 10) / 10,
    avgResolutionBusinessDays: Math.round((habiles / cerradas.length) * 10) / 10,
    withinDeadline,
  };
}

/**
 * Foto de hoy: de las denuncias creadas en el período, las abiertas y cuántas
 * superaron el plazo. **Solo CLOSED es final.** Desestimado (DISMISSED), sin
 * infracción (NO_VIOLATION) y derivado (FORWARDED) todavía pasan a CLOSED y se
 * pueden reabrir (docs/entidades/environmental-report.md), así que cuentan como
 * abiertos: es la lectura conservadora, que no da por resuelto lo que el modelo
 * de estados no cerró. Los días hábiles corren hasta hoy (día argentino).
 */
function resumenVencidas(
  denuncias: { createdAt: Date; status: EnvironmentalReportStatus }[],
  plazo: number,
  ahora: Date,
): OverdueDto {
  const abiertas = denuncias.filter((d) => !cerrada(d));
  const vencidas = abiertas.filter((d) => diasHabiles(d.createdAt, ahora) > plazo).length;
  return { open: abiertas.length, overdue: vencidas, pct: pctONull(vencidas, abiertas.length) };
}

/** Kilos, metros cúbicos y desvío del relleno de un grupo de registros. */
function totalesResiduos(
  records: {
    weightKg: Prisma.Decimal | null;
    volumeM3: Prisma.Decimal | null;
    disposalSite: { siteType: DisposalSiteType };
  }[],
): WasteTotalsDto {
  let weightKg = 0;
  let volumeM3 = 0;
  let divertedKg = 0;
  for (const r of records) {
    const kg = num(r.weightKg);
    weightKg += kg;
    volumeM3 += num(r.volumeM3);
    if (DESVIADOS.includes(r.disposalSite.siteType)) divertedKg += kg;
  }
  return {
    weightKg: redondear(weightKg),
    volumeM3: redondear(volumeM3),
    divertedKg: redondear(divertedKg),
    divertedPct: pct(divertedKg, weightKg),
  };
}

function obtener<T extends { code: string; name: string }>(
  mapa: Map<string, { code: string; name: string; acc: Acumulador }>,
  key: string,
  etiqueta: T,
) {
  const actual = mapa.get(key) ?? {
    code: etiqueta.code,
    name: etiqueta.name,
    acc: new Acumulador(),
  };
  mapa.set(key, actual);
  return actual;
}

function desglose(
  mapa: Map<string, { code: string; name: string; acc: Acumulador }>,
  minSample: number,
): CoverageBreakdownDto[] {
  return [...mapa.entries()]
    .map(([id, v]) => {
      const totales = v.acc.totales();
      return {
        id,
        code: v.code,
        name: v.name,
        ...totales,
        lowSample: totales.scheduled < minSample,
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

function redondear(value: number): number {
  return Math.round(value * 100) / 100;
}
