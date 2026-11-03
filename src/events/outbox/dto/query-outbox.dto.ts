import { ApiPropertyOptional } from '@nestjs/swagger';
import { OutboxEventStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsDateOnly, MAX_EXTERNAL_ID_LENGTH } from '../../../common/decorators';
import { PaginationQueryDto } from '../../../common/dto';

export class QueryOutboxDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrar por estado del envío',
    enum: OutboxEventStatus,
    example: 'FAILED',
  })
  @IsOptional()
  @IsEnum(OutboxEventStatus)
  status?: OutboxEventStatus;

  @ApiPropertyOptional({
    description: 'Filtrar por tipo de evento (exacto, camelCase)',
    example: 'containerDamaged',
    maxLength: MAX_EXTERNAL_ID_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  eventType?: string;

  @ApiPropertyOptional({
    description:
      'Ocurridos desde este día, inclusive (YYYY-MM-DD, día argentino UTC-3). Filtra por `occurredAt`',
    example: '2026-10-01',
    format: 'date',
  })
  @IsOptional()
  @IsDateOnly()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Ocurridos hasta este día, inclusive: hasta las 23:59:59 ART (YYYY-MM-DD). No puede ser anterior a `from`',
    example: '2026-10-31',
    format: 'date',
  })
  @IsOptional()
  @IsDateOnly()
  to?: string;
}
