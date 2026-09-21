import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DECORATORS } from '@nestjs/swagger/dist/constants';
import { SwaggerModule } from '@nestjs/swagger';
import { getMetadataStorage } from 'class-validator';
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
    const excepciones = new Set(['IngestEventDto.data']);
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

  it('todo campo con @Min/@Max/@IsLatitude/@IsLongitude declara minimum/maximum en el swagger', () => {
    // El repo no usa el plugin de Swagger: el rango validado no se refleja solo
    // y un cliente generado no lo ve (#196). Se leen los DTO reales.
    const archivos: string[] = [];
    const recorrer = (dir: string): void => {
      for (const nombre of readdirSync(dir)) {
        const ruta = join(dir, nombre);
        if (statSync(ruta).isDirectory()) recorrer(ruta);
        else if (/\.dto\.ts$/.test(nombre)) archivos.push(ruta);
      }
    };
    recorrer(__dirname);

    // Valor esperado por validacion: min/max lo llevan en constraints[0]; las
    // coordenadas de class-validator tienen rango fijo. Se compara igualdad y no
    // solo presencia: `@Max(50)` con `maximum: 100` tambien es un contrato roto.
    type Esperado = { clave: 'minimum' | 'maximum'; valor: (c: unknown[]) => number };
    const rango: Record<string, Esperado[]> = {
      min: [{ clave: 'minimum', valor: (c) => Number(c[0]) }],
      max: [{ clave: 'maximum', valor: (c) => Number(c[0]) }],
      isLatitude: [
        { clave: 'minimum', valor: () => -90 },
        { clave: 'maximum', valor: () => 90 },
      ],
      isLongitude: [
        { clave: 'minimum', valor: () => -180 },
        { clave: 'maximum', valor: () => 180 },
      ],
    };
    const faltan = new Set<string>();
    for (const archivo of archivos) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const modulo = require(archivo) as Record<string, unknown>;
      for (const clase of Object.values(modulo)) {
        if (typeof clase !== 'function') continue;
        const metas = getMetadataStorage().getTargetValidationMetadatas(clase, '', false, false);
        for (const m of metas) {
          const esperados = rango[m.name ?? ''];
          if (!esperados) continue;
          // En arrays (`each`) Swagger vuelca el rango dentro de `items`.
          const swagger = Reflect.getMetadata(
            DECORATORS.API_MODEL_PROPERTIES,
            clase.prototype,
            m.propertyName,
          ) as Record<string, unknown> | undefined;
          for (const { clave, valor } of esperados) {
            const esperado = valor(m.constraints ?? []);
            if (swagger?.[clave] !== esperado) {
              faltan.add(
                `${clase.name}.${m.propertyName}: ${clave} es ${String(swagger?.[clave])}, la validacion exige ${esperado}`,
              );
            }
          }
        }
      }
    }
    expect([...faltan].sort()).toEqual([]);
  });
});
