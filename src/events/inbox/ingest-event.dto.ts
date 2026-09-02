import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

/** El sobre de la cohorte, tal como lo recibiría del bus. */
export class IngestEventDto {
  @ApiProperty({
    description:
      'Identificador único del mensaje. **Es la clave de idempotencia**: repetirlo descarta el evento sin volver a aplicarlo.',
    example: '646d19f5-5670-4a7b-9442-30e13b02ba11',
  })
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @ApiProperty({
    description: 'Nombre del evento en camelCase',
    example: 'streetClosureApproved',
  })
  @IsString()
  @IsNotEmpty()
  eventType: string;

  @ApiProperty({
    description: 'El payload propio del evento, tal como lo define el módulo que lo publica',
    type: Object,
    example: { closureRequestId: 'a1b2c3d4-...', closureId: 'CL-2026-0342' },
  })
  @IsObject()
  data: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Versión del sobre', example: '1.5' })
  @IsOptional()
  @IsString()
  specVersion?: string;

  @ApiPropertyOptional({ description: 'Versión del payload', example: '1.0' })
  @IsOptional()
  @IsString()
  eventVersion?: string;

  @ApiPropertyOptional({ description: 'Cuándo ocurrió el hecho', format: 'date-time' })
  @IsOptional()
  @IsString()
  occurredAt?: string;

  @ApiPropertyOptional({ description: 'Módulo que lo publica', example: 'M7' })
  @IsOptional()
  @IsString()
  producer?: string;

  @ApiPropertyOptional({ description: 'Agregado sobre el que ocurrió' })
  @IsOptional()
  @IsString()
  subject?: string;
}
