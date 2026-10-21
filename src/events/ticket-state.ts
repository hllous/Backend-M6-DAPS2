import { Prisma, TicketStateSource } from '@prisma/client';
import { TicketUpdateType } from './payloads';

/**
 * El estado del ticket en M2, tal como lo conocemos de este lado (#303).
 *
 * M2 no avisa el `IN_PROGRESS` (no hay un `ticketUpdated` espejo): nuestro
 * `STARTED` es la única fuente, y `PROGRESS` solo vale con el ticket en
 * `IN_PROGRESS` (con `ROUTED` M2 hace `nack` y el Core reintenta hasta la DLQ).
 * Por eso lo llevamos nosotros, deduciéndolo de lo que publicamos y corrigiéndolo
 * con lo que M2 informa. Los valores son de M2 (§3 de su guía), no un enum
 * nuestro: se guardan y comparan como string.
 */

/**
 * Los estados canónicos de M2 (§3 de su guía v1.78). Es una lista cerrada: lo
 * que viene de afuera solo se guarda si está acá, así que un valor basura no
 * llega a la tabla ni puede silenciar el aviso de programación.
 */
export const ESTADOS_M2: readonly string[] = [
  'REGISTERED',
  'IN_REVIEW',
  'ROUTED',
  'IN_PROGRESS',
  'PENDING_INFORMATION',
  'DUPLICATE',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];

export const esEstadoM2 = (valor: unknown): valor is string =>
  typeof valor === 'string' && ESTADOS_M2.includes(valor);

/** Un UUID mide 36; el tope deja margen a los ids que no lo son y acota lo que persistimos. */
const MAX_TICKET_ID = 64;

const ticketIdValido = (ticketId: string): boolean =>
  ticketId.length > 0 && ticketId.length <= MAX_TICKET_ID;

/** Lo que cada `updateType` publicado deja como estado (§3 y §8.2 de M2). */
const ESTADO_POR_UPDATE: Partial<Record<TicketUpdateType, string>> = {
  STARTED: 'IN_PROGRESS',
  INFORMATION_REQUIRED: 'PENDING_INFORMATION',
  RETURNED: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'CANCELLED',
  // PROGRESS permanece IN_PROGRESS: no cambia nada.
};

/** El estado al que M2 pasa el ticket con este `updateType`, o null si no cambia. */
export function deducirEstado(updateType: TicketUpdateType): string | null {
  return ESTADO_POR_UPDATE[updateType] ?? null;
}

/**
 * Agendar cuenta como tomar la gestión (M2, 20/10). Solo en estos estados M2
 * acepta un `STARTED`; en `IN_PROGRESS` lo que vale es un `PROGRESS`.
 *
 * "Desconocido" es solo `null`/`undefined`: un ticket que nunca vimos ni
 * deducimos (p. ej. uno que ya estaba `IN_PROGRESS` antes del deploy). Se trata
 * como `ROUTED`, que es como M2 entrega un ticket al área. Un valor fuera de
 * la lista de M2 no se persiste (ver `esEstadoM2`), así que tampoco llega acá.
 */
const ACEPTA_STARTED = ['ROUTED', 'IN_REVIEW'];

/**
 * El evento hacia M2 que informa la programación, o `null` si no corresponde
 * publicar nada: con el ticket pendiente de información, terminado o en un
 * estado que no es de gestión, M2 rechazaría o ignoraría el aviso.
 */
export function scheduleUpdate(
  estadoActual: string | null | undefined,
  publicMessage: string,
): { updateType: 'STARTED' | 'PROGRESS'; publicMessage: string } | null {
  if (estadoActual === 'IN_PROGRESS') return { updateType: 'PROGRESS', publicMessage };
  if (!estadoActual || ACEPTA_STARTED.includes(estadoActual)) {
    return { updateType: 'STARTED', publicMessage };
  }
  return null;
}

/**
 * `STARTED` al comenzar la gestión, salvo que el ticket ya esté `IN_PROGRESS`
 * (porque agendar ya lo arrancó): ahí repetir `STARTED` no es válido y se manda
 * `PROGRESS` con el mismo mensaje.
 */
export function startUpdate(estadoActual: string | null | undefined): 'STARTED' | 'PROGRESS' {
  return estadoActual === 'IN_PROGRESS' ? 'PROGRESS' : 'STARTED';
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * La programación como texto para el vecino, en es-AR. Es lo único que M2
 * admite (no hay campo estructurado): solo fecha y franja, nunca la cuadrilla
 * ni las notas.
 *
 * `fecha` (@db.Date) y la franja (@db.Time) son valores de calendario y de reloj
 * guardados como UTC: se leen en UTC, sin pasarlos a hora argentina, que
 * correría la fecha un día para atrás. Una sola punta de la franja no se
 * inventa: sin las dos, solo va la fecha.
 */
export function textoProgramacion(
  fecha: Date,
  desde: Date | null,
  hasta: Date | null,
  reprogramado = false,
): string {
  const dia = `${DIAS[fecha.getUTCDay()]} ${fecha.getUTCDate()} de ${MESES[fecha.getUTCMonth()]} de ${fecha.getUTCFullYear()}`;
  const accion = reprogramado ? 'reprogramado' : 'programado';
  const franja =
    desde && hasta
      ? `, entre las ${desde.toISOString().slice(11, 16)} y las ${hasta.toISOString().slice(11, 16)} hs`
      : '';
  return `Su servicio fue ${accion} para el ${dia}${franja}.`;
}

// ─── Persistencia ─────────────────────────────────

/** Sirve con `PrismaService` y con el cliente de una transacción. */
type Db = Pick<Prisma.TransactionClient, 'ticketM2State'>;

/** El estado conocido del ticket, o null si nunca lo vimos ni lo deducimos. */
export async function leerEstado(db: Db, ticketId: string): Promise<string | null> {
  const fila = await db.ticketM2State.findUnique({ where: { ticketId } });
  return fila?.status ?? null;
}

/**
 * Lo que dejó un `updateTicketStatus` que acabamos de encolar. No toca
 * `receivedAt`: sigue siendo la marca del último estado que M2 informó, para
 * que uno recibido más viejo no pise lo que sabemos.
 */
export async function registrarDeducido(
  db: Db,
  ticketId: string,
  updateType: TicketUpdateType,
): Promise<void> {
  const status = deducirEstado(updateType);
  if (!status || !ticketIdValido(ticketId)) return;
  await db.ticketM2State.upsert({
    where: { ticketId },
    create: { ticketId, status, source: TicketStateSource.DEDUCED },
    update: { status, source: TicketStateSource.DEDUCED },
  });
}

/**
 * El estado que M2 informó en un `ticketUpdated`. Manda sobre una deducción,
 * pero uno más viejo que el último recibido no lo pisa (el Core reintenta fuera
 * de orden). `at` igual a la marca se reaplica: es el reintento del mismo
 * evento. Devuelve si se aplicó.
 */
export async function registrarRecibido(
  db: Db,
  ticketId: string,
  status: string,
  at: Date | null,
): Promise<boolean> {
  if (!esEstadoM2(status) || !ticketIdValido(ticketId)) return false;
  const actual = await db.ticketM2State.findUnique({ where: { ticketId } });
  if (at && actual?.receivedAt && at < actual.receivedAt) return false;

  await db.ticketM2State.upsert({
    where: { ticketId },
    create: { ticketId, status, source: TicketStateSource.RECEIVED, receivedAt: at },
    // Sin marca de orden no se pisa la que había.
    update: { status, source: TicketStateSource.RECEIVED, ...(at && { receivedAt: at }) },
  });
  return true;
}
