import { applyDecorators } from '@nestjs/common';
import { Matches } from 'class-validator';

/**
 * Id de usuario de M1 en un body: solo dígitos (hasta 19, como el `sub` de M1).
 * Los ceros a la izquierda se aceptan acá y el service los normaliza
 * (`BigInt(x).toString()`), igual que en role-assignments: '007' y '7' son la
 * misma persona, y la pertenencia de Campo (#365) compara el id exacto del token.
 */
export const M1_USER_ID_REGEX = /^\d{1,19}$/;

export const IsM1UserId = (each = false) =>
  applyDecorators(
    Matches(M1_USER_ID_REGEX, {
      each,
      message: 'El id de usuario debe ser el id numérico de M1 (solo dígitos)',
    }),
  );

/** Forma canónica del id de M1 (sin ceros a la izquierda). Solo para ids ya validados. */
export const normalizeM1UserId = (raw: string): string => BigInt(raw).toString();
