import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OutboxEventStatus } from '@prisma/client';

/** Un evento saliente, sin su payload: el listado no expone datos del vecino. */
export class OutboxEventResponseDto {
  @ApiProperty({
    format: 'uuid',
    example: 'a1b2c3d4-e5f6-4a78-9b01-234567890abc',
    description: 'Id de la fila; es también el `eventId` del sobre que ve el receptor',
  })
  id: string;

  @ApiProperty({ example: 'containerDamaged', description: 'Tipo de evento (camelCase)' })
  eventType: string;

  @ApiProperty({ example: 'CONTAINER', description: 'Agregado de dominio que lo originó' })
  aggregateType: string;

  @ApiProperty({ format: 'uuid', example: 'b2c3d4e5-f6a7-4b89-8c12-34567890abcd' })
  aggregateId: string;

  @ApiProperty({ enum: OutboxEventStatus, example: 'FAILED' })
  status: OutboxEventStatus;

  @ApiProperty({ example: 5, description: 'Intentos de envío hechos (se reinicia al reintentar)' })
  attempts: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'connect ECONNREFUSED 127.0.0.1:5672',
    description: 'Error del último intento fallido',
  })
  lastError: string | null;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-28T14:30:00.000Z' })
  occurredAt: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Cuándo se publicó al bus; null si no salió',
  })
  publishedAt: Date | null;

  @ApiProperty({ format: 'uuid', example: 'c3d4e5f6-a7b8-4c90-9d23-4567890abcde' })
  correlationId: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'eventId del evento consumido que lo causó; null si nació de una acción directa',
  })
  causationId: string | null;
}

export class OutboxRetryAuditResponseDto {
  @ApiProperty({ format: 'uuid', example: 'd4e5f6a7-b8c9-4d01-8e34-567890abcdef' })
  id: string;

  @ApiProperty({ example: 'usr-001', description: 'Usuario de M1 que reintentó (sale del token)' })
  actorUserId: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-10-28T15:00:00.000Z' })
  at: Date;

  @ApiProperty({ example: 5, description: 'Intentos que tenía antes del reintento' })
  previousAttempts: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'connect ECONNREFUSED 127.0.0.1:5672',
    description: 'Error que tenía antes del reintento',
  })
  previousError: string | null;
}

/** El detalle sí lleva el payload, y solo lo ve el admin. */
export class OutboxEventDetailResponseDto extends OutboxEventResponseDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { containerId: 'b2c3d4e5-f6a7-4b89-8c12-34567890abcd', severity: 'HIGH' },
    description: 'Payload tal como se publica. Puede incluir datos personales',
  })
  payload: Record<string, unknown>;

  @ApiProperty({
    type: [OutboxRetryAuditResponseDto],
    description: 'Reintentos manuales que se le hicieron, del más viejo al más nuevo',
  })
  retries: OutboxRetryAuditResponseDto[];
}

export class RetryFailedOutboxResponseDto {
  @ApiProperty({ example: 12, description: 'Eventos FAILED que se pasaron a PENDING' })
  requeued: number;

  @ApiProperty({ example: 3, description: 'FAILED que siguen sin reencolar (por el tope)' })
  remainingFailed: number;
}
