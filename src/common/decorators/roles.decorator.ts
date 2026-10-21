import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { M6Role } from '../../auth/m6-role';
import { ErrorResponseDto } from '../dto/error-response.dto';

export const ROLES_KEY = 'roles';
export const ANY_EMPLOYEE_KEY = 'anyEmployee';

/** Código del cuerpo del 403 por rol: el frontend distingue "falta rol" de otros 403. */
export const ROLE_REQUIRED_CODE = 'ROLE_REQUIRED';

/**
 * Roles de M6 que pueden invocar el endpoint (basta uno). Lo hace cumplir el
 * RolesGuard global y, de paso, documenta el 403 en Swagger: así no se escribe
 * un @ApiResponse por endpoint.
 *
 * Una escritura (POST/PUT/PATCH/DELETE) sin @Roles se rechaza para todos: un
 * endpoint nuevo olvidado no queda abierto. Un GET sin @Roles exige cualquier
 * rol de M6.
 *
 * @example
 * @Roles(M6Role.M6_ADMIN, M6Role.M6_OFICINA_OPERACIONES)
 */
export const Roles = (...roles: M6Role[]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    ApiForbiddenResponse({
      description: `Falta el rol de M6: se requiere alguno de ${roles.join(', ')} (code ${ROLE_REQUIRED_CODE}). También 403 si el token no es de personal municipal`,
      type: ErrorResponseDto,
    }),
  );

/**
 * Pide JWT de empleado pero ningún rol de M6. Solo para `GET /me`: un empleado
 * recién creado, sin asignaciones, tiene que poder preguntar qué puede hacer.
 */
export const AnyEmployee = () => SetMetadata(ANY_EMPLOYEE_KEY, true);
