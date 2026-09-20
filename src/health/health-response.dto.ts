import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok', description: 'Siempre "ok" si el servicio responde' })
  status: string;

  @ApiProperty({ example: '2026-09-19T15:30:00.000Z', description: 'Hora del servidor (ISO 8601)' })
  timestamp: string;

  @ApiProperty({ example: 'm6-ambiente-backend', description: 'Identificador del servicio' })
  service: string;
}

export class ReadinessResponseDto extends HealthResponseDto {
  @ApiProperty({ example: 'up', description: 'Estado de la conexión a la base' })
  database: string;
}
