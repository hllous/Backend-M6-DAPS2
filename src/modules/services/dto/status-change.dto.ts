import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const TIME_HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Motivo obligatorio: suspender, cancelar y reprogramar tienen que dejar rastro. */
export class StatusChangeDto {
  @ApiProperty({
    description: 'Motivo del cambio de estado. Queda en statusReason.',
    example: 'Alerta meteorológica: tormenta fuerte en la zona',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason: string;
}

export class ConfirmRescheduleDto {
  @ApiProperty({
    description: 'Nueva fecha agendada (YYYY-MM-DD)',
    example: '2026-09-22',
    format: 'date',
  })
  @IsDateString()
  scheduledDate: string;

  @ApiPropertyOptional({
    description: 'Nuevo inicio de la ventana horaria (HH:mm)',
    example: '07:00',
  })
  @IsOptional()
  @Matches(TIME_HHMM, { message: 'windowFrom debe tener formato HH:mm' })
  windowFrom?: string;

  @ApiPropertyOptional({ description: 'Nuevo fin de la ventana horaria (HH:mm)', example: '11:00' })
  @IsOptional()
  @Matches(TIME_HHMM, { message: 'windowTo debe tener formato HH:mm' })
  windowTo?: string;
}
