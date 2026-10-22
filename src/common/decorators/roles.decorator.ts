import { applyDecorators, ForbiddenException, SetMetadata } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { M6Role } from '../../auth/m6-role';
import { ErrorResponseDto } from '../dto/error-response.dto';

export const ROLES_KEY = 'roles';
export const ANY_EMPLOYEE_KEY = 'anyEmployee';

/** Código del cuerpo del 403 por rol: el frontend distingue "falta rol" de otros 403. */
export const ROLE_REQUIRED_CODE = 'ROLE_REQUIRED';

/** El 403 por rol, igual para el guard y para los chequeos dentro de un service. No dice qué rol falta. */
export const roleRequiredException = () =>
  new ForbiddenException({
    statusCode: 403,
    message: 'No tiene el rol requerido para esta operación',
    code: ROLE_REQUIRED_CODE,
  });

/** Código del 403 por pertenencia: tiene el rol pero el objeto no es de su cuadrilla / no se le asignó. */
export const NOT_ASSIGNED_CODE = 'NOT_ASSIGNED';

/**
 * El 403 por pertenencia (#365). El mensaje no dice de quién es el objeto: el
 * 404 previo ya es lo único que se revela de su existencia.
 */
export const notAssignedException = () =>
  new ForbiddenException({
    statusCode: 403,
    message: 'El recurso no está asignado a su cuadrilla o a usted',
    code: NOT_ASSIGNED_CODE,
  });

/**
 * Documenta el 403 NOT_ASSIGNED de un endpoint de Campo. Va ARRIBA de @Roles:
 * Swagger guarda una respuesta por status y gana el último decorador aplicado
 * (el de más arriba), así que este pisa al de @Roles con un texto que cubre los dos códigos.
 */
export const ApiNotAssigned = (who: string) =>
  ApiForbiddenResponse({
    description: `403 con code ${ROLE_REQUIRED_CODE} si falta el rol de Campo, o con code ${NOT_ASSIGNED_CODE} si el usuario no es ${who} (no se revela de quién es)`,
    type: ErrorResponseDto,
  });

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
