import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AssignCrewDto {
  @ApiProperty({
    description: 'Cuadrilla que va a ejecutar el servicio',
    example: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    format: 'uuid',
  })
  @IsUUID()
  crewId: string;

  @ApiPropertyOptional({
    description: 'Vehículo asignado en la misma operación, si el tipo de servicio lo exige',
    example: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({
    description:
      'Por qué se asigna igual un recurso que ya está tomado ese día. **Obligatorio si hay solapamiento**: la asignación avisa y deja pasar, pero no en silencio. Consultar antes con `GET /services/:id/assignment-conflicts`.',
    minLength: 10,
    maxLength: 500,
    example: 'La otra parada termina antes en la práctica; lo coordiné con el jefe de cuadrilla.',
  })
  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  overrideNote?: string;
}
