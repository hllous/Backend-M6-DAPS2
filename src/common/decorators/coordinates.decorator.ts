import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';

// Decimal(10,7) acepta hasta 999.9999999: sin tope, una latitud de 500 se
// guardaba y una de 1e12 reventaba en Prisma con 500. Mismo criterio que
// IsLatitude/IsLongitude de class-validator, pero acotando tambien los decimales.
// El rango se declara tambien en el swagger (no hay plugin) para que el cliente
// lo vea; todas las coordenadas del repo son opcionales, y Swagger fusiona esta
// metadata con el @ApiPropertyOptional del DTO.
export const Latitude = (): PropertyDecorator =>
  applyDecorators(
    ApiPropertyOptional({ minimum: -90, maximum: 90 }),
    IsNumber({ maxDecimalPlaces: 7 }),
    Min(-90),
    Max(90),
  );

export const Longitude = (): PropertyDecorator =>
  applyDecorators(
    ApiPropertyOptional({ minimum: -180, maximum: 180 }),
    IsNumber({ maxDecimalPlaces: 7 }),
    Min(-180),
    Max(180),
  );
