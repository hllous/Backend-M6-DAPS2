import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { buildCorsOptions } from './common/http/cors-options';
import { setupSwagger } from './swagger-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Pipes, filtros, interceptores y cabeceras. Lo mismo que levantan los e2e.
  configureApp(app);

  // ─── CORS ──────────────────────────────────────
  // Opciones y razones en common/http/cors-options.ts: sin CORS_ORIGINS queda
  // abierto (desarrollo), nunca con credenciales.
  const corsOrigins = configService.get<string[]>('corsOrigins');
  app.enableCors(buildCorsOptions(corsOrigins));
  logger.log(
    corsOrigins?.length
      ? `CORS restringido a: ${corsOrigins.join(', ')}`
      : 'CORS abierto a cualquier origen (sin CORS_ORIGINS)',
  );

  // ─── Swagger ───────────────────────────────────
  // La configuración vive en swagger-config.ts porque el script que
  // genera docs/api/openapi.json usa exactamente la misma.
  setupSwagger(app);

  // ─── Start ─────────────────────────────────────
  const port = configService.get<number>('port', 3000);
  await app.listen(port, '0.0.0.0');
  const host = process.env.HOST || '0.0.0.0';
  logger.log(`🚀 M6 Ambiente API corriendo en http://${host}:${port}`);
  logger.log(`📄 Swagger UI en http://${host}:${port}/api/docs`);
}

bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    'No se pudo iniciar la aplicación',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
