import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { buildSwaggerConfig } from './swagger-config';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Pipes, filtros, interceptores y cabeceras. Lo mismo que levantan los e2e.
  configureApp(app);

  // ─── CORS ──────────────────────────────────────
  // Sin CORS_ORIGINS se aceptan todos, que es lo que hace falta en desarrollo
  // y lo que veniamos haciendo. En el entorno desplegado se carga la URL del
  // frontend.
  //
  // Alcance: el JWT viaja en un header y no en una cookie, asi que esto no
  // cierra un CSRF — no habia uno. Evita que un sitio cualquiera use la API
  // desde el navegador de un usuario nuestro.
  const corsOrigins = configService.get<string[]>('corsOrigins');
  app.enableCors(corsOrigins?.length ? { origin: corsOrigins } : undefined);
  logger.log(
    corsOrigins?.length
      ? `CORS restringido a: ${corsOrigins.join(', ')}`
      : 'CORS abierto a cualquier origen (sin CORS_ORIGINS)',
  );

  // ─── Swagger ───────────────────────────────────
  // La configuración vive en swagger-config.ts porque el script que
  // genera docs/api/openapi.json usa exactamente la misma.
  const config = buildSwaggerConfig();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // ─── Start ─────────────────────────────────────
  const port = configService.get<number>('port', 3000);
  await app.listen(port, '0.0.0.0');
  const host = process.env.HOST || '0.0.0.0';
  logger.log(`🚀 M6 Ambiente API corriendo en http://${host}:${port}`);
  logger.log(`📄 Swagger UI en http://${host}:${port}/api/docs`);
}

bootstrap();
