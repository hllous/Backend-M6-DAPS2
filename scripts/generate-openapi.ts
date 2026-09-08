/**
 * Genera `docs/api/openapi.json` desde el código.
 *
 * Existe porque el contrato autoritativo estaba solo en el Swagger UI del
 * entorno desplegado, y quien lo consume —el frontend, que valida con Zod—
 * terminaba leyendo `docs/api/endpoints.md`, que es una tabla resumen y nunca
 * tuvo la forma de los DTO. De ahí salieron los Issues #124 y #125.
 *
 * Con el JSON versionado, el contrato se lee sin levantar nada, se difea en un
 * PR y no depende de que la instancia de Render esté despierta.
 *
 * Se corre con `npm run openapi:generate`.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { buildSwaggerConfig } from '../src/swagger-config';

// El esquema de entorno exige estas dos. Son de mentira a propósito: generar el
// contrato no toca la base ni firma ningún token.
process.env.DATABASE_URL ??= 'postgresql://openapi:openapi@localhost:5432/openapi?schema=public';
process.env.JWT_SECRET ??= 'solo-para-generar-el-contrato';

const SALIDA = join(__dirname, '..', 'docs', 'api', 'openapi.json');

async function main() {
  // Se reemplaza PrismaService porque su `onModuleInit` abre la conexión, y
  // acá no hay base ni hace falta: el documento sale de los decoradores.
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PrismaService)
    .useValue({})
    .compile();

  const app = moduleRef.createNestApplication();
  const document = SwaggerModule.createDocument(app, buildSwaggerConfig());

  writeFileSync(SALIDA, `${JSON.stringify(document, null, 2)}\n`, 'utf-8');
  await app.close();

  const rutas = Object.keys(document.paths).length;
  const esquemas = Object.keys(document.components?.schemas ?? {}).length;
  console.log(`docs/api/openapi.json: ${rutas} rutas, ${esquemas} esquemas`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
