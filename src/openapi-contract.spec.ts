import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { buildSwaggerConfig } from './swagger-config';

process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@localhost:5432/openapi?schema=public';
process.env.JWT_SECRET ??= 'solo-para-generar-el-contrato';

describe('contrato OpenAPI', () => {
  let documento: ReturnType<typeof SwaggerModule.createDocument>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    const app = moduleRef.createNestApplication();
    documento = SwaggerModule.createDocument(app, buildSwaggerConfig());
    await app.close();
  });

  it('toda operación 200/201 declara el schema de su respuesta', () => {
    // Sin schema el frontend no puede tipar la respuesta y termina escribiendo
    // el suyo a mano (#186). Los 204 no llevan cuerpo, por eso no se miran.
    const sinSchema: string[] = [];
    for (const [ruta, operaciones] of Object.entries(documento.paths)) {
      for (const [metodo, op] of Object.entries(operaciones)) {
        const responses = (op as { responses?: Record<string, { content?: object }> }).responses;
        for (const codigo of ['200', '201']) {
          if (responses?.[codigo] && !responses[codigo].content) {
            sinSchema.push(`${metodo.toUpperCase()} ${ruta} ${codigo}`);
          }
        }
      }
    }
    expect(sinSchema).toEqual([]);
  });

  it('docs/api/openapi.json está al día con el código', () => {
    const versionado = JSON.parse(
      readFileSync(join(__dirname, '..', 'docs', 'api', 'openapi.json'), 'utf-8'),
    );
    expect(JSON.parse(JSON.stringify(documento))).toEqual(versionado);
  });

  it('ninguna propiedad de un schema queda con type object sin forma (tipo perdido)', () => {
    // Un `string | null` sin `type` explícito se refleja como Object y sale así
    // en el contrato (#190); el frontend no puede tipar esos campos.
    type Prop = {
      type?: string;
      properties?: object;
      additionalProperties?: unknown;
      [k: string]: unknown;
    };
    // IngestEventDto.data es un objeto libre a propósito (payload del bus).
    // EnvironmentalReportResponseDto: pendiente de #181, que reescribe ese DTO. Borrar estas
    // seis excepciones al mergear #181 y darles tipo a esas propiedades.
    const excepciones = new Set([
      'IngestEventDto.data',
      ...['address', 'lat', 'lng', 'ticketId', 'publicId', 'deadlineAt'].map(
        (p) => `EnvironmentalReportResponseDto.${p}`,
      ),
    ]);
    const perdidas: string[] = [];
    const schemas = (documento.components?.schemas ?? {}) as Record<
      string,
      { properties?: Record<string, Prop> }
    >;
    for (const [nombre, schema] of Object.entries(schemas)) {
      for (const [prop, def] of Object.entries(schema.properties ?? {})) {
        const forma =
          def.properties ??
          def.additionalProperties ??
          def.$ref ??
          def.allOf ??
          def.oneOf ??
          def.anyOf;
        if (def.type === 'object' && !forma && !excepciones.has(`${nombre}.${prop}`))
          perdidas.push(`${nombre}.${prop}`);
      }
    }
    expect(perdidas).toEqual([]);
  });
});
