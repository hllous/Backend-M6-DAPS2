import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsNotEmpty, IsObject, IsOptional, IsString, ValidateBy } from 'class-validator';
import { EventProducer } from '../envelope';

const noVacio = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;

/**
 * La v1.5 mandaba `producer` como string suelto; la v1.6/v1.70 de M2 lo manda
 * como `{ moduleId, service }`. Mientras convivan las dos, aceptamos ambas.
 * No se usa `@ValidateNested` porque la unión no tiene una clase única.
 */
function IsProducer(): PropertyDecorator {
  return ValidateBy({
    name: 'isProducer',
    validator: {
      validate: (v: unknown): boolean => {
        if (noVacio(v)) return true;
        if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
        const o = v as Record<string, unknown>;
        return noVacio(o.moduleId) && noVacio(o.service);
      },
      defaultMessage: () =>
        'producer debe ser un string o un objeto { moduleId: string, service: string }',
    },
  });
}

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

  @ApiPropertyOptional({ description: 'Versión del sobre', example: '1.0' })
  @IsOptional()
  @IsString()
  specVersion?: string;

  @ApiPropertyOptional({ description: 'Versión del payload', example: '1.0' })
  @IsOptional()
  @IsString()
  eventVersion?: string;

  @ApiPropertyOptional({ description: 'Cuándo ocurrió el hecho', format: 'date-time' })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'occurredAt debe ser una fecha ISO 8601' })
  occurredAt?: string;

  @ApiPropertyOptional({
    description:
      'Quién lo publica. Objeto `{ moduleId, service }` (sobre v1.6/v1.70) o string suelto (v1.5)',
    oneOf: [
      { type: 'string', example: 'M7' },
      {
        type: 'object',
        required: ['moduleId', 'service'],
        properties: {
          moduleId: { type: 'string', example: 'M2' },
          service: { type: 'string', example: 'tickets-service' },
        },
      },
    ],
    example: { moduleId: 'M2', service: 'tickets-service' },
  })
  @IsOptional()
  @IsProducer()
  producer?: string | EventProducer;

  @ApiPropertyOptional({ description: 'Agregado sobre el que ocurrió' })
  @IsOptional()
  @IsString()
  subject?: string;
}
