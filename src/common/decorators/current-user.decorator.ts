import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extrae el usuario autenticado del request (puesto por JwtStrategy).
 * Es un `AuthenticatedUser` (`userId`, `subType`, `m1Role` y `roles` de M6
 * efectivos), armado por JwtStrategy a partir del access token de M1.
 *
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 * @example con campo específico
 * @Get('profile')
 * getProfile(@CurrentUser('userId') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (field: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return field ? user?.[field] : user;
  },
);
