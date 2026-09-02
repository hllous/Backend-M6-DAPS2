import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** El código no es mutable. Las paradas se editan con PUT /routes/:id/stops. */
export class UpdateRouteDto {
  @ApiPropertyOptional({
    description: 'Nombre descriptivo del recorrido',
    example: 'Recorrido troncal Norte-Centro (ampliado)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Si el recorrido está disponible para programar servicios',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
