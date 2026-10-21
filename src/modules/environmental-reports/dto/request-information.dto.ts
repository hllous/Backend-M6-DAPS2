import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Trim } from '../../../common/decorators';

/** Pedido de información al vecino durante la revisión (#169). */
export class RequestInformationDto {
  @ApiProperty({
    description:
      'Lo que ve el vecino en M2 (va como messageForCitizen y como publicMessage). No incluir datos internos.',
    example: 'Necesitamos una foto más del frente del local, tomada de noche.',
    maxLength: 500,
  })
  @Trim()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  message: string;

  @ApiPropertyOptional({
    description:
      'Fecha límite para responder. YYYY-MM-DD (vence a las 23:59:59 de ese día argentino) o ISO 8601 completo con zona horaria. Tiene que ser futura.',
    example: '2026-11-03',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/, {
    message: 'requiredBy debe ser YYYY-MM-DD o un ISO 8601 con zona horaria',
  })
  @IsISO8601({ strict: true })
  requiredBy?: string;

  @ApiPropertyOptional({
    description: 'Nota para el equipo (internalMessage hacia M2). El vecino no la ve.',
    example: 'La foto anterior salió movida.',
    maxLength: 500,
  })
  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(500)
  internalNote?: string;
}
