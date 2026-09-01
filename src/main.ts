import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';
import { LoggingInterceptor } from './common/interceptors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ─── Global pipes ───────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ─── Global filters ────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Global interceptors ───────────────────────
  app.useGlobalInterceptors(new LoggingInterceptor());

  // ─── CORS ──────────────────────────────────────
  app.enableCors();

  // ─── Swagger ───────────────────────────────────
  // Configuración según docs/api/estandar-swagger.md
  const config = new DocumentBuilder()
    .setTitle('M6 - Ambiente e Higiene API')
    .setDescription(
      'API del módulo 6 de la Municipalidad UADE. Gestiona servicios urbanos, contenedores, arbolado, espacios verdes y control ambiental.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT emitido por el módulo Core (M9)',
      },
      'JWT-auth',
    )
    .addTag('services', 'Programación y ejecución de servicios urbanos')
    .addTag('containers', 'Gestión de contenedores')
    .addTag('trees', 'Gestión de arbolado urbano')
    .addTag('green-spaces', 'Espacios verdes')
    .addTag('zones', 'Zonas, recorridos y frecuencias')
    .addTag('environmental-reports', 'Denuncias y expedientes ambientales')
    .addTag('environmental-inspections', 'Inspecciones ambientales')
    .addTag('crews', 'Cuadrillas')
    .addTag('vehicles', 'Vehículos')
    .addTag('citizen-portal', 'Endpoints públicos del portal del ciudadano')
    .addTag('health', 'Health check y estado del servicio')
    .build();

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
