import { BadRequestException } from '@nestjs/common';
import { todayArgentina } from '../../common/utils/date-only';
import type { Bucket } from './dto';

const DIA_MS = 86_400_000;

/** Tope de puntos de una serie: más que eso no se lee en un gráfico. */
export const MAX_SERIES_POINTS = 90;

/** Un tramo del período, con días argentinos sin hora y ambos extremos incluidos. */
export interface Intervalo {
  from: Date;
  to: Date;
}

/** Último día del tramo que arranca en `desde` (sin recortar al período). */
function finDelTramo(desde: Date, bucket: Bucket): Date {
  if (bucket === 'day') return desde;
  if (bucket === 'week') {
    // getUTCDay: 0 es domingo. Una semana va de lunes a domingo.
    const hastaDomingo = (7 - desde.getUTCDay()) % 7;
    return new Date(desde.getTime() + hastaDomingo * DIA_MS);
  }
  // Día 0 del mes siguiente = último día de este mes.
  return new Date(Date.UTC(desde.getUTCFullYear(), desde.getUTCMonth() + 1, 0));
}

/**
 * Parte `[from, to]` en tramos contiguos que cubren el período exacto: el
 * primero y el último se recortan, así que la suma de los tramos es el total.
 * Tira 400 si salen más de `MAX_SERIES_POINTS`, antes de tocar la base.
 */
export function intervalos(from: Date, to: Date, bucket: Bucket): Intervalo[] {
  const tramos: Intervalo[] = [];
  let cantidad = 0;
  for (let desde = from; desde <= to;) {
    const fin = finDelTramo(desde, bucket);
    const hasta = fin < to ? fin : to;
    cantidad += 1;
    // Pasado el tope solo se cuenta: un rango de siglos no arma el arreglo.
    if (cantidad <= MAX_SERIES_POINTS) tramos.push({ from: desde, to: hasta });
    desde = new Date(hasta.getTime() + DIA_MS);
  }
  if (cantidad > MAX_SERIES_POINTS) {
    throw new BadRequestException(
      `El período con bucket=${bucket} da ${cantidad} puntos y el máximo es ${MAX_SERIES_POINTS}: acotá el rango o usá un bucket más grueso (week o month)`,
    );
  }
  return tramos;
}

/** Los mismos días, terminando la víspera de `from`. */
export function rangoAnterior(from: Date, to: Date): Intervalo {
  const dias = Math.round((to.getTime() - from.getTime()) / DIA_MS) + 1;
  const hasta = new Date(from.getTime() - DIA_MS);
  return { from: new Date(hasta.getTime() - (dias - 1) * DIA_MS), to: hasta };
}

/** Cuántos de los `tramos` contiene el día `dia`. */
export function tramoDe(tramos: Intervalo[], dia: Date): number {
  return tramos.findIndex((t) => t.from <= dia && dia <= t.to);
}

/** El día argentino de un instante, para ubicarlo en un tramo. */
export const diaArgentino = (instante: Date): Date => todayArgentina(instante);

/**
 * Días hábiles (lunes a viernes) transcurridos entre el día argentino del alta
 * y el del cierre: cuenta cada día hábil en `(alta, cierre]`. El mismo día es 0,
 * de viernes a lunes es 1. Los feriados no se consideran.
 */
export function diasHabiles(alta: Date, cierre: Date): number {
  const desde = diaArgentino(alta).getTime();
  const hasta = diaArgentino(cierre).getTime();
  let habiles = 0;
  for (let t = desde + DIA_MS; t <= hasta; t += DIA_MS) {
    const diaSemana = new Date(t).getUTCDay();
    if (diaSemana !== 0 && diaSemana !== 6) habiles += 1;
  }
  return habiles;
}
