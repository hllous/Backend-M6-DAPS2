import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

// Con enableImplicitConversion, class-transformer hace Boolean("false") === true
// antes de correr el @Transform, asi que se lee el valor crudo de `obj`. Todo lo
// que no sea boolean ni 'true'/'false' se deja tal cual para que IsBoolean lo
// rechace con 400 (0, 1 y 'maybe' incluidos).
export function ToBoolean(): PropertyDecorator {
  return applyDecorators(
    Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
      const raw = obj[key];
      if (typeof raw === 'string') {
        const lower = raw.toLowerCase();
        if (lower === 'true') return true;
        if (lower === 'false') return false;
      }
      return raw;
    }),
    IsBoolean({ message: '$property debe ser true o false' }),
  );
}
