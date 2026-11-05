import { EnvironmentalReportStatus, Prisma, ServiceStatus } from '@prisma/client';
import { diasHabiles } from './indicators.intervals';

/**
 * La denuncia no tiene zona propia: se la deriva del servicio de su inspección
 * más reciente (sin contar los CANCELLED). Un servicio puede cubrir varias
 * zonas; en ese caso la denuncia queda sin zona antes que contarse en todas
 * (duplicaría el total). El conteo del indicador y el filtro del listado usan
 * esta misma regla para que "Ver lista" coincida con el número.
 */
export const ZONA_DE_DENUNCIA = {
  inspections: {
    where: { service: { status: { not: ServiceStatus.CANCELLED } } },
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { service: { select: { zones: { select: { zoneId: true } } } } },
  },
} satisfies Prisma.EnvironmentalReportInclude;

export interface DenunciaConZona {
  createdAt: Date;
  status: EnvironmentalReportStatus;
  inspections: { service: { zones: { zoneId: string }[] } | null }[];
}

export function zonaDeDenuncia(d: Pick<DenunciaConZona, 'inspections'>): string | null {
  const zonas = d.inspections?.[0]?.service?.zones ?? [];
  return zonas.length === 1 ? zonas[0].zoneId : null;
}

/**
 * Vencida = abierta (cualquier estado menos CLOSED) con más días hábiles desde
 * el alta hasta `ahora` que el plazo. Única definición, la usan el indicador y
 * el filtro `overdue` del listado.
 */
export function estaVencida(
  d: { createdAt: Date; status: EnvironmentalReportStatus },
  plazo: number,
  ahora: Date,
): boolean {
  return d.status !== EnvironmentalReportStatus.CLOSED && diasHabiles(d.createdAt, ahora) > plazo;
}
