import { BadRequestException, PipeTransform } from '@nestjs/common';

/**
 * Id de M1: numérico y SIEMPRE texto (un bigint pierde precisión en JSON).
 * Normaliza ceros a la izquierda para que '007' y '7' sean el mismo usuario.
 */
export class ParseNumericIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!/^\d{1,20}$/.test(value)) {
      throw new BadRequestException('El id de usuario debe ser numérico (id de M1)');
    }
    return BigInt(value).toString();
  }
}
