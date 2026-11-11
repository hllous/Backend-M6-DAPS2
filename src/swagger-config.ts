import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { ResponseObject } from '@nestjs/swagger';

/**
 * La configuración del documento OpenAPI, en un solo lugar.
 *
 * La usan `main.ts` —que sirve el Swagger UI en `/api/docs`— y el script que
 * genera `docs/api/openapi.json`. Estaba escrita inline en `main.ts`, y
 * duplicarla en el generador habría garantizado que los dos se separaran:
 * exactamente la clase de deriva que el frontend viene encontrando a mano.
 *
 * Convenciones en docs/api/estandar-swagger.md. El orden de los tags es el
 * orden en que Swagger UI muestra los grupos: primero sobre qué se programa,
 * después la operación, después el inventario.
 */
export function buildSwaggerConfig() {
  return (
    new DocumentBuilder()
      .setTitle('M6 - Ambiente e Higiene API')
      .setDescription(
        'API del módulo 6 de la Municipalidad UADE. Gestiona servicios urbanos, contenedores, arbolado, espacios verdes y control ambiental. Solo para personal municipal: un token válido de ciudadano (sub_type CIUDADANO) recibe 403 en todo endpoint no público.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT emitido por M1, que gestiona los usuarios de la plataforma',
        },
        'JWT-auth',
      )
      // El orden de declaración es el orden en que Swagger UI muestra los grupos:
      // primero sobre qué se programa, después la operación, después el inventario.
      // ─── Configuración y planificación ────────────
      .addTag('zones', 'Zonas operativas y los barrios que agrupan')
      .addTag('neighborhoods', 'Catálogo de barrios de M9 (caché de solo lectura)')
      .addTag('communes', 'Comunas: agrupación de barrios y zonas (solo lectura)')
      .addTag('routes', 'Recorridos y su secuencia de paradas')
      .addTag('service-frequencies', 'Reglas que generan los servicios planificados')
      .addTag('service-types', 'Catálogo de tipos de servicio')
      .addTag('disposal-sites', 'Sitios de disposición final de residuos')
      // ─── Recursos ─────────────────────────────────
      .addTag('crews', 'Cuadrillas')
      .addTag('vehicles', 'Vehículos')
      // ─── Operación ────────────────────────────────
      .addTag('services', 'Programación y ejecución de servicios urbanos')
      // ─── Inventario urbano ────────────────────────
      .addTag('containers', 'Gestión de contenedores')
      .addTag('green-points', 'Puntos verdes de entrega voluntaria')
      .addTag('trees', 'Censo de arbolado urbano')
      .addTag('tree-surveys', 'Relevamientos de arbolado')
      .addTag('tree-interventions', 'Podas, extracciones, plantaciones y tratamientos')
      .addTag('green-spaces', 'Espacios verdes')
      // ─── Derivaciones salientes ───────────────────
      .addTag('repair-requests', 'Reparaciones de infraestructura derivadas a Obras Públicas')
      .addTag('street-closure-requests', 'Cortes de calle solicitados a Tránsito')
      // ─── Control ambiental ────────────────────────
      .addTag('environmental-reports', 'Denuncias y expedientes ambientales')
      .addTag('environmental-inspections', 'Inspecciones ambientales')
      // ─── Evidencia ────────────────────────────────
      .addTag(
        'evidence',
        'Adjuntos de evidencia (foto/PDF) para Container, Service, ZoneResult e Inspection',
      )
      // ─── Integración ──────────────────────────────
      .addTag('events', 'Ingesta de eventos entrantes y estado de los handlers')
      .addTag('outbox', 'Eventos salientes: consulta y reintento de los fallidos')
      .addTag('audit', 'Auditoría de dominio: quién hizo qué y cuándo (solo lectura)')
      // ─── Tablero ──────────────────────────────────
      .addTag('indicators', 'Indicadores de cobertura, cumplimiento, incidencias y residuos')
      // ─── Identidad y roles ────────────────────────
      .addTag('auth', 'Identidad del token y roles de M6 efectivos')
      .addTag('role-assignments', 'Asignación de roles de M6 (solo M6_ADMIN)')
      // ─── Otros ────────────────────────────────────
      .addTag('citizen-portal', 'Endpoints públicos del portal del ciudadano')
      .addTag('health', 'Health check y estado del servicio')
      .build()
  );
}

/**
 * Crea el documento OpenAPI de la app. Lo usan main.ts, el generador de
 * docs/api/openapi.json y openapi-contract.spec.ts: el post-proceso vive acá
 * para que los tres vean exactamente el mismo documento.
 */
export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());
  declareProblemJson(document);
  return document;
}

/**
 * ADR-011: toda respuesta de error (4xx/5xx) se sirve como
 * `application/problem+json`. Declararlo en cada @ApiResponse serían ~1000
 * decoradores; se reescribe el media type acá, una sola vez.
 */
function declareProblemJson(document: OpenAPIObject): void {
  for (const operaciones of Object.values(document.paths)) {
    for (const op of Object.values(operaciones as Record<string, unknown>)) {
      const responses = (op as { responses?: Record<string, ResponseObject> }).responses ?? {};
      for (const [codigo, respuesta] of Object.entries(responses)) {
        if (!/^[45]/.test(codigo) || !respuesta.content?.['application/json']) continue;
        const { 'application/json': json, ...resto } = respuesta.content;
        respuesta.content = { 'application/problem+json': json, ...resto };
      }
    }
  }
}
