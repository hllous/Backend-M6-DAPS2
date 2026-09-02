import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un endpoint como accesible sin JWT.
 * El JwtAuthGuard global lo saltea.
 *
 * Se usa en health check y en los endpoints del portal del ciudadano.
 *
 * @example
 * @Public()
 * @Get('health')
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
