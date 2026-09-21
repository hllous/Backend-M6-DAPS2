import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IngestResult } from './inbox.service';

export class IngestResultDto implements IngestResult {
  @ApiProperty({
    enum: ['processed', 'duplicate', 'ignored', 'failed'],
    example: 'processed',
    description: 'Qué hizo M6 con el evento',
  })
  status: IngestResult['status'];

  @ApiPropertyOptional({
    example: 'sin handler registrado',
    description: 'Motivo o error, cuando hay algo que aclarar',
  })
  detail?: string;
}

export class RegisteredHandlersDto {
  @ApiProperty({
    type: [String],
    example: ['ticketUpdated', 'weatherAlertIssued'],
    description: 'Tipos de evento con handler registrado',
  })
  eventTypes: string[];
}
