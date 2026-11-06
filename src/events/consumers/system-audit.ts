import { Prisma } from '@prisma/client';
import { AuditActor, AuditEntry, AuditService } from '../../common/audit/audit.service';

/** Quién actuó cuando el cambio lo dispara un evento entrante: el módulo emisor, no una persona. */
export const sistema = (modulo: string): AuditActor => ({
  userId: `system:${modulo}`,
  roles: [],
});

/**
 * Una fila de auditoría por entidad afectada por un `updateMany`, que no devuelve
 * ids: el llamador los lee con un `findMany` en el mismo `tx` y llama solo si
 * `count > 0`, para que un evento repetido o tardío no deje rastro.
 *
 * Si las filas leídas no coinciden con `count`, otro proceso tocó el conjunto
 * entre la lectura y el update: se lanza para revertir la transacción y que el
 * inbox reintente, en vez de auditar entidades que quizá no cambiaron.
 */
export async function recordEach(
  audit: AuditService,
  tx: Prisma.TransactionClient,
  rows: { id: string; fromStatus?: string | null }[],
  count: number,
  entry: Omit<AuditEntry, 'entityId' | 'fromStatus'>,
): Promise<void> {
  if (rows.length !== count) {
    throw new Error(
      `Auditoría: se leyeron ${rows.length} filas y el update tocó ${count}; se reintenta`,
    );
  }
  for (const row of rows) {
    await audit.record(tx, { ...entry, entityId: row.id, fromStatus: row.fromStatus });
  }
}
