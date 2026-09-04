import { Injectable } from '@nestjs/common';
import {
  ContainerStatus,
  DisposalSiteType,
  NotServicedReason,
  Prisma,
  RiskLevel,
  ServiceStatus,
  ZoneResultStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ComplianceIndicatorDto,
  CoverageBreakdownDto,
  CoverageIndicatorDto,
  CoverageTotalsDto,
  IncidentsIndicatorDto,
  PeriodDto,
  PeriodQueryDto,
  ServicePeriodQueryDto,
  WasteIndicatorDto,
} from './dto';

const DIA_MS = 86_400_000;

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

function dia(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function num(value: Prisma.Decimal | null): number {
  return value === null ? 0 : Number(value);
}

interface Periodo {
  from: Date;
  to: Date;
  /** Límite superior exclusivo, para filtrar timestamps con un `to` que es día. */
  toExclusive: Date;
  dto: PeriodDto;
}

function periodo(query: PeriodQueryDto): Periodo {
  const to = query.to ? new Date(query.to) : new Date(dia(new Date()));
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - 30 * DIA_MS);
  return {
    from,
    to,
    toExclusive: new Date(to.getTime() + DIA_MS),
    dto: { from: dia(from), to: dia(to) },
  };
}

/** Acumulador de cobertura, para no repetir la misma suma tres veces. */
class Acumulador {
  scheduled = 0;
  served = 0;
  partial = 0;
  notServiced = 0;
  pending = 0;

  suma(resultado: ZoneResultStatus | undefined): void {
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
  constructor(private readonly prisma: PrismaService) {}

  /** Objetivos atendidos sobre programados, por zona y por tipo de servicio. */
  async coverage(query: ServicePeriodQueryDto): Promise<CoverageIndicatorDto> {
    const p = periodo(query);
    const services = await this.serviciosDelPeriodo(p, query);

    const totales = new Acumulador();
    const porZona = new Map<string, { code: string; name: string; acc: Acumulador }>();
    const porTipo = new Map<string, { code: string; name: string; acc: Acumulador }>();

    for (const s of services) {
      const resultados = new Map(s.zoneResults.map((r) => [r.zoneId, r.status]));
      // Con filtro de zona solo cuenta esa: el resto del recorrido no se pidió.
      const pares = query.zoneId ? s.zones.filter((z) => z.zoneId === query.zoneId) : s.zones;

      const tipo = obtener(porTipo, s.serviceTypeId, s.serviceType);
      for (const par of pares) {
        const resultado = resultados.get(par.zoneId);
        totales.suma(resultado);
        obtener(porZona, par.zoneId, par.zone).acc.suma(resultado);
        tipo.acc.suma(resultado);
      }
    }

    return {
      period: p.dto,
      totals: totales.totales(),
      byZone: desglose(porZona),
      byServiceType: desglose(porTipo),
    };
  }

  /** Finalizados en término vs. demorados, y ranking de zonas no atendidas. */
  async compliance(query: ServicePeriodQueryDto): Promise<ComplianceIndicatorDto> {
    const p = periodo(query);
    const services = await this.serviciosDelPeriodo(p, query);

    let onTime = 0;
    let late = 0;
    const zonas = new Map<
      string,
      { code: string; name: string; count: number; reasons: Map<string, number> }
    >();

    for (const s of services) {
      if (CERRADOS.includes(s.status) && s.zoneResults.length > 0) {
        // No hay columna de cierre en Service, y updatedAt se mueve con
        // cualquier edición posterior: el último resultado de campo cargado es
        // la única marca honesta de cuándo se terminó el trabajo.
        const cierre = s.zoneResults.reduce(
          (max, r) => (r.recordedAt > max ? r.recordedAt : max),
          s.zoneResults[0].recordedAt,
        );
        if (dia(cierre) <= dia(s.scheduledDate)) onTime += 1;
        else late += 1;
      }

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

    const total = onTime + late;
    return {
      period: p.dto,
      finished: { total, onTime, late, onTimePct: pct(onTime, total) },
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
    };
  }

  /** Contenedores, arbolado y denuncias. */
  async incidents(query: PeriodQueryDto): Promise<IncidentsIndicatorDto> {
    const p = periodo(query);
    const rango = { gte: p.from, lt: p.toExclusive };

    const [porEstado, porZona, zonas, riesgos, porTipo, porStatus, total, resolucion] =
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
        this.prisma.environmentalReport.count({ where: { createdAt: rango } }),
        // Solo CLOSED: es el único estado del que no se sale. updatedAt como
        // marca de cierre alcanza porque después de cerrar no se toca más.
        // ponytail: si hace falta precisión, una columna closedAt.
        this.prisma.$queryRaw<{ days: number | null }[]>`
          SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at)) / 86400)::float8 AS days
          FROM environmental_report
          WHERE status = 'CLOSED' AND created_at >= ${p.from} AND created_at < ${p.toExclusive}
        `,
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

    const dias = resolucion[0]?.days ?? null;

    return {
      period: p.dto,
      containers: {
        byStatus: porEstado.map((f) => ({ status: f.status, count: f._count._all })),
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
        total,
        byType: porTipo.map((f) => ({ reportType: f.reportType, count: f._count._all })),
        byStatus: porStatus.map((f) => ({ status: f.status, count: f._count._all })),
        avgResolutionDays: dias === null ? null : Math.round(dias * 10) / 10,
      },
    };
  }

  /** Kg y m³ por tipo y destino, y porcentaje desviado del relleno. */
  async waste(query: PeriodQueryDto): Promise<WasteIndicatorDto> {
    const p = periodo(query);

    // CollectionRecord no tiene fecha propia: la del servicio que lo generó es
    // la fecha del residuo.
    const records = await this.prisma.collectionRecord.findMany({
      where: { service: { scheduledDate: { gte: p.from, lte: p.to } } },
      select: {
        wasteType: true,
        weightKg: true,
        volumeM3: true,
        disposalSite: { select: { id: true, code: true, name: true, siteType: true } },
      },
    });

    let weightKg = 0;
    let volumeM3 = 0;
    let divertedKg = 0;
    const porTipo = new Map<string, { weightKg: number; volumeM3: number }>();
    const porSitio = new Map<
      string,
      { code: string; name: string; siteType: DisposalSiteType; weightKg: number; volumeM3: number }
    >();

    for (const r of records) {
      const kg = num(r.weightKg);
      const m3 = num(r.volumeM3);
      weightKg += kg;
      volumeM3 += m3;
      if (DESVIADOS.includes(r.disposalSite.siteType)) divertedKg += kg;

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

    return {
      period: p.dto,
      totals: {
        weightKg: redondear(weightKg),
        volumeM3: redondear(volumeM3),
        divertedKg: redondear(divertedKg),
        divertedPct: pct(divertedKg, weightKg),
      },
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
    };
  }

  // ─── Helpers ──────────────────────────────────────

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
        zoneResults: { select: { zoneId: true, status: true, reason: true, recordedAt: true } },
      },
    });
  }
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
): CoverageBreakdownDto[] {
  return [...mapa.entries()]
    .map(([id, v]) => ({ id, code: v.code, name: v.name, ...v.acc.totales() }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function redondear(value: number): number {
  return Math.round(value * 100) / 100;
}
