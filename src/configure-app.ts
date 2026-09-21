import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { NoNullCharsPipe } from './common/pipes/no-null-chars.pipe';
import { HttpExceptionFilter } from './common/filters';
import { LoggingInterceptor } from './common/interceptors';
import { securityHeaders } from './common/middleware/security-headers.middleware';

/**
 * Todo lo que transforma la app, en un solo lugar: pipes, filtro de errores,
 * interceptor y cabeceras.
 *
 * Vive fuera de `main.ts` para que los e2e levanten **la misma** configuración
 * que corre en producción. Mientras estuvo inline, un test podía pasar con un
 * body que el `ValidationPipe` real rechaza.
 *
 * Queda afuera a propósito lo que es del arranque del proceso y no del
 * comportamiento de la API: CORS, Swagger y `listen`.
 */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  // Render termina el TLS en un proxy: sin esto req.ip es la IP del proxy y el
  // ThrottlerGuard mete a todos los clientes en el mismo balde. Un solo salto.
  app.set('trust proxy', 1);

  // No anunciar el framework y agregar las cabeceras de seguridad básicas.
  app.disable('x-powered-by');
  app.use(securityHeaders);

  app.useGlobalPipes(
    new NoNullCharsPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  return app;
}
