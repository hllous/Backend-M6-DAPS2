import { ApiProperty } from '@nestjs/swagger';

/**
 * Un paso del historial de una entidad, para quien no puede leer `GET /audit`.
 * A propósito sin `id`, `actorUserId` ni `actorRoles`: la vista no expone quién actuó
 * ni ids internos.
 */
export class AuditHistoryItemDto {
  @ApiProperty({ example: '2026-11-02T14:30:00.000Z', description: 'Cuándo ocurrió' })
  occurredAt: Date;

  @ApiProperty({ example: 'CLOSE', description: 'Acción realizada' })
  action: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'FORWARDED',
    description: 'Estado anterior',
  })
  fromStatus: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'CLOSED', description: 'Estado nuevo' })
  toStatus: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Se verificó que el vecino regularizó la situación.',
    description:
      'Motivo que escribió quien decidió (hasta 500 caracteres, no debería contener datos personales); null si no lo hubo',
  })
  note: string | null;
}
