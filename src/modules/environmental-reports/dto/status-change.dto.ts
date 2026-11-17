import { MAX_REASON_LENGTH, Trim } from '../../../common/decorators';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

const REASON_MAX = MAX_REASON_LENGTH;

/** Derivar, desestimar y cerrar tienen que dejar constancia del motivo. */
export class ReportStatusChangeDto {
  @ApiProperty({
    description: 'Motivo del cambio de estado',
    example: 'El hecho denunciado corresponde a Obras Públicas, no a Ambiente.',
    maxLength: REASON_MAX,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(REASON_MAX)
  reason: string;
}

/** Cerrar acepta el motivo pero no lo exige: el cierre manual existía sin body. */
export class CloseReportDto {
  @ApiPropertyOptional({
    description:
      'Motivo del cierre. Queda en el historial del expediente y viaja a M2 como nota interna (el vecino no la ve).',
    example: 'Se verificó que el vecino regularizó la situación.',
    maxLength: REASON_MAX,
  })
  @Trim()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(REASON_MAX)
  reason?: string;
}
