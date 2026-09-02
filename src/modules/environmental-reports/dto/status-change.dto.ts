import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Derivar, desestimar y cerrar tienen que dejar constancia del motivo. */
export class ReportStatusChangeDto {
  @ApiProperty({
    description: 'Motivo del cambio de estado',
    example: 'El hecho denunciado corresponde a Obras Públicas, no a Ambiente.',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}
