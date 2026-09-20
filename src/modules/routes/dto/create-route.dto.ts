import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ToBoolean } from '../../../common/decorators';

export class CreateRouteDto {
  @ApiProperty({
    description: 'Código único del recorrido',
    example: 'R-03',
    maxLength: 20,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;

  @ApiProperty({
    description: 'Nombre descriptivo del recorrido',
    example: 'Recorrido troncal Norte-Centro',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({
    description: 'Si el recorrido está disponible para programar servicios',
    example: true,
    default: true,
  })
  @IsOptional()
  @ToBoolean()
  active?: boolean;
}
