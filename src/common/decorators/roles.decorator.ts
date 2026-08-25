import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Decorador que marca los roles requeridos para acceder a un endpoint.
 * Se usa con RolesGuard.
 *
 * @example
 * @Roles('SERVICE_SUPERVISOR', 'ADMIN')
 * @UseGuards(JwtAuthGuard, RolesGuard)
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
