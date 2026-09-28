import { PipeTransform, ValidationPipe } from '@nestjs/common';
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

  app.useGlobalPipes(...globalPipes());

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  return app;
}

/**
 * Los pipes que ve cualquier body. Exportados para que el consumidor de
 * RabbitMQ valide un mensaje igual que `POST /events/inbox`: si tuviera su
 * propia copia, el día que cambie una opción el bus y el HTTP aceptarían cosas
 * distintas.
 *
 * La única diferencia es `forbidNonWhitelisted`: el bus lo apaga para que un
 * campo de sobre que no conocemos (un `traceId` de M9) se descarte en vez de
 * tirar el mensaje entero. Por HTTP un 400 le avisa al emisor; por el bus el
 * mensaje se perdería en silencio (envelope.ts: "tolerantes al consumir").
 */
export function globalPipes({ forbidNonWhitelisted = true } = {}): PipeTransform[] {
  return [
    new NoNullCharsPipe(),
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  ];
}
