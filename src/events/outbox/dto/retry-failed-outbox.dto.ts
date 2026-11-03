import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Equals, IsInt, Max, Min, ValidateIf } from 'class-validator';
import { ToBoolean } from '../../../common/decorators';

/** Tope por pedido: reencolar de a tandas acotadas, no vaciar el outbox de un golpe. */
export const MAX_RETRY_BATCH = 100;

export class RetryFailedOutboxDto {
  @ApiProperty({
    description:
      'Confirmación explícita: tiene que ser `true`. Reencola eventos que el receptor ya rechazó, así que no se hace por omisión',
    example: true,
  })
  // ToBoolean lee el valor crudo: con enableImplicitConversion Boolean("false") es true y
  // un string cualquiera confirmaría. Solo `true` o "true" pasan.
  @ToBoolean()
  @Equals(true, { message: 'confirm debe ser true para reencolar los eventos fallidos' })
  confirm: boolean;

  @ApiPropertyOptional({
    description: `Cuántos FAILED reencolar como máximo, los más viejos primero (tope ${MAX_RETRY_BATCH})`,
    default: MAX_RETRY_BATCH,
    minimum: 1,
    maximum: MAX_RETRY_BATCH,
    example: 20,
  })
  // Ausente usa el default; `null` no: IsOptional lo dejaría pasar y llegaría a `take`.
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(MAX_RETRY_BATCH)
  limit: number = MAX_RETRY_BATCH;
}
