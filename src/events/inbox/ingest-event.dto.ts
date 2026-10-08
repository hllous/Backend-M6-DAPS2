import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateBy,
} from 'class-validator';
import { MAX_EXTERNAL_ID_LENGTH } from '../../common/decorators';
import { EventProducer, InboundEnvelope } from '../envelope';

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

/** Lo que el Core admite para `eventType`. */
const MAX_EVENT_TYPE_LENGTH = 120;

/** Los ids de módulo del Core: `obras`, `atencion-ciudadana`, `desarrollo-social`. */
const SOURCE_MODULE = /^[A-Za-z0-9_-]+$/;

/**
 * El sobre de la cohorte, tal como lo recibiría del bus.
 *
 * El vigente es el del Core (M9). El de M2 (`specVersion`, `producer`,
 * `subject`) se sigue aceptando porque los módulos no migran todos el mismo
 * día; sacarlo cuando la cohorte haya migrado.
 */
export class IngestEventDto {
  @ApiProperty({
    maxLength: MAX_EXTERNAL_ID_LENGTH,
    description:
      'Identificador único del mensaje (UUID en el sobre del Core; no se exige, para no rechazar a quien todavía no migró). **Es la clave de idempotencia**: repetir uno ya procesado lo descarta sin volver a aplicarlo; repetir uno cuyo handler falló lo reintenta.',
    example: '3f6c1b7e-9d24-4a1f-9f2a-2b0f0c7d5e11',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_EXTERNAL_ID_LENGTH)
  eventId: string;

  @ApiProperty({
    maxLength: MAX_EVENT_TYPE_LENGTH,
    description: 'Nombre del evento en camelCase',
    example: 'workOrderCompleted',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_EVENT_TYPE_LENGTH)
  eventType: string;

  @ApiProperty({
    description: 'El payload propio del evento, tal como lo define el módulo que lo publica',
    type: Object,
    example: {
      sourceRequestId: '0d9c8b7a-6f5e-4d3c-8b2a-1f0e9d8c7b6a',
      workOrderId: 'f1e2d3c4-b5a6-4789-9abc-def012345678',
      completedAt: '2026-09-29T17:45:00Z',
    },
  })
  @IsObject()
  data: Record<string, unknown>;

  @ApiPropertyOptional({
    maxLength: 20,
    description: 'Versión del contrato del evento (el Core asume "1.0" si falta)',
    example: '1.0',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  eventVersion?: string;

  @ApiPropertyOptional({
    description: 'Cuándo ocurrió el hecho, ISO 8601 con zona horaria',
    format: 'date-time',
    example: '2026-09-29T18:00:00Z',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'occurredAt debe ser una fecha ISO 8601' })
  occurredAt?: string;

  @ApiPropertyOptional({
    maxLength: 60,
    pattern: SOURCE_MODULE.source,
    description:
      'Módulo que publicó el evento (sobre del Core): letras, números, guion y guion bajo',
    example: 'obras',
  })
  @IsOptional()
  @IsString()
  // Se guarda en inbox_event: un id de módulo del Core (`atencion-ciudadana`)
  // no necesita más, y un carácter de control haría fallar el insert.
  @MaxLength(60)
  @Matches(SOURCE_MODULE, {
    message: 'sourceModule solo admite letras, números, guion y guion bajo',
  })
  sourceModule?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Agrupa los eventos de un mismo flujo entre módulos (sobre del Core)',
    example: '8a1f0c22-5d3e-4b77-9c10-6e2b4a90f3d5',
  })
  @IsOptional()
  @IsUUID()
  correlationId?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'eventId del evento que causó este, o null si no lo causó otro evento (sobre del Core)',
    example: null,
  })
  // `@IsOptional` también deja pasar null, que es lo que manda el ejemplo de M9.
  @IsOptional()
  @IsUUID()
  causationId?: string | null;

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Sobre de M2, reemplazado por el del Core. Versión del sobre',
    example: '1.0',
  })
  @IsOptional()
  @IsString()
  specVersion?: string;

  @ApiPropertyOptional({
    deprecated: true,
    description:
      'Sobre de M2, reemplazado por el del Core (`sourceModule`). Quién lo publica: objeto `{ moduleId, service }` (v1.6/v1.70) o string suelto (v1.5)',
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

  @ApiPropertyOptional({
    deprecated: true,
    description: 'Sobre de M2, reemplazado por el del Core. Agregado sobre el que ocurrió',
  })
  @IsOptional()
  @IsString()
  subject?: string;
}

/**
 * Lo que llegó, sin rellenar. Los campos del sobre que no usamos no se
 * inventan: un `producer: 'desconocido'` es peor que su ausencia cuando hay que
 * auditar de dónde salió un evento. Lo comparten el endpoint y el consumidor
 * del bus.
 */
export function toInboundEnvelope(dto: IngestEventDto): InboundEnvelope {
  return {
    specVersion: dto.specVersion,
    eventId: dto.eventId,
    eventType: dto.eventType,
    eventVersion: dto.eventVersion,
    occurredAt: dto.occurredAt,
    sourceModule: dto.sourceModule,
    correlationId: dto.correlationId,
    causationId: dto.causationId,
    producer: dto.producer,
    subject: dto.subject,
    data: dto.data,
  };
}
