import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Solo lo que se puede corregir sin cambiar de qué trabajo se trata.
 *
 * El tipo, el modo, el recorrido, el objetivo y las zonas quedan fijos al
 * programar: cambiarlos convierte el servicio en otro. La fecha se mueve con
 * `reschedule` + `confirm-reschedule`, que dejan rastro del motivo.
 */
export class UpdateServiceDto {
  @ApiPropertyOptional({
    description: 'Vehículo asignado',
    example: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ description: 'Inicio de la ventana horaria (HH:mm)', example: '09:00' })
  @IsOptional()
  @Matches(TIME_HHMM, { message: 'windowFrom debe tener formato HH:mm' })
  windowFrom?: string;

  @ApiPropertyOptional({ description: 'Fin de la ventana horaria (HH:mm)', example: '13:00' })
  @IsOptional()
  @Matches(TIME_HHMM, { message: 'windowTo debe tener formato HH:mm' })
  windowTo?: string;

  @ApiPropertyOptional({
    description: 'Notas internas',
    example: 'La cuadrilla entra por Rivadavia, la otra calle está cortada.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}
