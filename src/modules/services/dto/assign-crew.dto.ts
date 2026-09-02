import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

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
}
