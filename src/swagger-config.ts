import { DocumentBuilder } from '@nestjs/swagger';

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
        'API del módulo 6 de la Municipalidad UADE. Gestiona servicios urbanos, contenedores, arbolado, espacios verdes y control ambiental.',
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
      // ─── Tablero ──────────────────────────────────
      .addTag('indicators', 'Indicadores de cobertura, cumplimiento, incidencias y residuos')
      // ─── Otros ────────────────────────────────────
      .addTag('citizen-portal', 'Endpoints públicos del portal del ciudadano')
      .addTag('health', 'Health check y estado del servicio')
      .build()
  );
}
