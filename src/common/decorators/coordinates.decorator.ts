import { applyDecorators } from '@nestjs/common';
import { IsNumber, Max, Min } from 'class-validator';

// Decimal(10,7) acepta hasta 999.9999999: sin tope, una latitud de 500 se
// guardaba y una de 1e12 reventaba en Prisma con 500. Mismo criterio que
// IsLatitude/IsLongitude de las denuncias, pero para inputs numericos.
export const Latitude = (): PropertyDecorator =>
  applyDecorators(IsNumber({ maxDecimalPlaces: 7 }), Min(-90), Max(90));

export const Longitude = (): PropertyDecorator =>
  applyDecorators(IsNumber({ maxDecimalPlaces: 7 }), Min(-180), Max(180));
