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
});
