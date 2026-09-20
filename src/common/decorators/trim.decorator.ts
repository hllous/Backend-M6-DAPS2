import { Transform } from 'class-transformer';

// Recorta los bordes de los strings. Lo que no sea string se deja pasar tal
// cual para que IsString lo rechace con 400; "   " queda como "" y lo frena
// IsNotEmpty. Se lee el valor crudo (`obj[key]`) como en ToBoolean para no
// depender de la conversion implicita de class-transformer.
export function Trim(): PropertyDecorator {
  return Transform(({ obj, key }: { obj: Record<string, unknown>; key: string }) => {
    const raw = obj[key];
    return typeof raw === 'string' ? raw.trim() : raw;
  });
}
