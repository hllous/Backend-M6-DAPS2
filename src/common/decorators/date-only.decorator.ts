import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Matches, ValidateBy } from 'class-validator';

// IsDateString deja pasar "20260901" (toDateOnly revienta con RangeError -> 500),
// "2026-02-30" (JS lo corre a marzo) y datetimes con hora (toDateOnly los lee en UTC,
// no en Argentina). Solo YYYY-MM-DD y de un dia que exista en el calendario.
const existe = (v: unknown): boolean => {
  if (typeof v !== 'string') return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
};

export const IsDateOnly = (): PropertyDecorator =>
  applyDecorators(
    ApiPropertyOptional({ format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: '$property debe tener formato YYYY-MM-DD' }),
    ValidateBy({
      name: 'isDateOnly',
      validator: {
        validate: existe,
        defaultMessage: (args) => `${args?.property} no es un día real del calendario`,
      },
    }),
  );
