import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

// Postgres rechaza \u0000 en text y en jsonb ("invalid byte sequence" /
// "unsupported Unicode escape"), y Prisma lo devuelve como un 500. Se corta
// aca, una sola vez, en vez de anotar cada campo de cada DTO. Corre antes del
// ValidationPipe y mira body, query y parametros de ruta completos, incluido el
// JSON anidado del ingreso de eventos. El error sale por el HttpExceptionFilter
// como cualquier 400.
//
// Tambien pone tope a la profundidad del JSON: class-transformer recorre el body
// de forma recursiva y con unos miles de niveles desborda la pila (un 500 opaco).
// Un payload legitimo no pasa de unos pocos niveles.
export const MAX_PROFUNDIDAD_JSON = 64;

@Injectable()
export class NoNullCharsPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    if (metadata.type === 'body' || metadata.type === 'query' || metadata.type === 'param') {
      const problema = revisar(value);
      if (problema === 'nulo') {
        throw new BadRequestException('El texto no puede contener el carácter nulo (\\u0000)');
      }
      if (problema === 'profundo') {
        throw new BadRequestException(
          `El cuerpo tiene demasiados niveles de anidado (máximo ${MAX_PROFUNDIDAD_JSON})`,
        );
      }
    }
    return value;
  }
}

// Recorrido con pila explicita y no recursivo, para que el propio chequeo no
// desborde la pila con un JSON muy anidado.
function revisar(root: unknown): 'nulo' | 'profundo' | null {
  const pila: Array<[unknown, number]> = [[root, 0]];
  while (pila.length > 0) {
    const [valor, nivel] = pila.pop() as [unknown, number];
    if (typeof valor === 'string') {
      if (valor.includes('\u0000')) return 'nulo';
    } else if (Array.isArray(valor)) {
      if (nivel >= MAX_PROFUNDIDAD_JSON) return 'profundo';
      for (const item of valor) pila.push([item, nivel + 1]);
    } else if (valor !== null && typeof valor === 'object') {
      if (nivel >= MAX_PROFUNDIDAD_JSON) return 'profundo';
      for (const [clave, hijo] of Object.entries(valor)) {
        // Las claves tambien terminan en jsonb.
        if (clave.includes('\u0000')) return 'nulo';
        pila.push([hijo, nivel + 1]);
      }
    }
  }
  return null;
}
