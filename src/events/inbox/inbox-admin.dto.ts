import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsDateOnly, MAX_EXTERNAL_ID_LENGTH } from '../../common/decorators';
import { PaginationQueryDto } from '../../common/dto';

/** Estado derivado de la fila del inbox; no es una columna. */
export const INBOX_STATUSES = ['processed', 'failed', 'pending'] as const;
export type InboxStatus = (typeof INBOX_STATUSES)[number];

export class QueryInboxDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description:
      'Estado derivado: `processed` (efecto aplicado), `failed` (el handler falló y quedó con error, reintentable) o `pending` (guardado, sin procesar ni error: en curso)',
    enum: INBOX_STATUSES,
    example: 'failed',
  })
  @IsOptional()
  @IsEnum(INBOX_STATUSES)
  status?: InboxStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de evento (exacto, camelCase)',
    example: 'ticketUpdated',
    maxLength: MAX_EXTERNAL_ID_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  eventType?: string;

  @ApiPropertyOptional({
    description: 'Filtrar por módulo emisor del sobre (exacto)',
    example: 'tickets',
    maxLength: MAX_EXTERNAL_ID_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  sourceModule?: string;

  @ApiPropertyOptional({
    description:
      'Recibidos desde este día, inclusive (YYYY-MM-DD, día argentino UTC-3). Filtra por `receivedAt`',
    example: '2026-10-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Recibidos hasta este día, inclusive: hasta las 23:59:59 ART (YYYY-MM-DD). No puede ser anterior a `from`',
    example: '2026-10-31',
    format: 'date',
  })
  @IsOptional()
  @IsDateOnly()
  to?: string;
}

/** Un evento entrante, sin su payload: es de terceros y puede traer datos personales. */
export class InboxEventResponseDto {
  @ApiProperty({
    example: 'a1b2c3d4-e5f6-4a78-9b01-234567890abc',
    description: 'eventId del sobre',
  })
  messageId: string;

  @ApiProperty({ example: 'ticketUpdated', description: 'Tipo de evento (camelCase)' })
  eventType: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'tickets',
    description: 'Módulo emisor según el sobre del Core; null si no lo mandó',
  })
  sourceModule: string | null;

  @ApiProperty({ enum: INBOX_STATUSES, example: 'processed' })
  status: InboxStatus;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-28T14:30:00.000Z' })
  receivedAt: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Cuándo se aplicó el efecto; null si no se procesó',
  })
  processedAt: Date | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'occurredAt del sobre; null si no lo trajo',
  })
  occurredAt: Date | null;

  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  correlationId: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'ticketId inexistente',
    description: 'Error del último intento del handler, acotado a 500 caracteres',
  })
  error: string | null;
}

/** El detalle sí lleva el payload, y solo lo ve el admin. */
export class InboxEventDetailResponseDto extends InboxEventResponseDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { ticketId: 'b2c3d4e5-f6a7-4b89-8c12-34567890abcd', status: 'RESOLVED' },
    description: 'Payload tal como llegó. Puede incluir datos personales',
  })
  payload: Record<string, unknown>;
}
