/**
 * Registra a mano las suscripciones y publicaciones de M6 en el Core, con el
 * mismo servicio que corre al arrancar. Es idempotente: crea solo lo que falta.
 *
 * Se corre con `npm run core:register` (lee `.env` si existe).
 */
import { ConfigService } from '@nestjs/config';
import configuration from '../src/config/configuration';
import { CoreClient } from '../src/core/core.client';
import { CoreRegistryService } from '../src/core/core-registry.service';

try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env, vale lo que ya esté en el entorno.
}
// El esquema de entorno las exige; el registro no toca la base ni firma JWT.
process.env.DATABASE_URL ??= 'postgresql://registro:registro@localhost:5432/registro';
process.env.JWT_SECRET ??= 'solo-para-registrar-en-el-core';

async function main(): Promise<void> {
  const config = new ConfigService(configuration());
  const core = new CoreClient(config);
  if (!core.enabled) {
    console.error('Falta CORE_API_URL: no hay Core al que registrar.');
    process.exit(1);
  }
  const res = await new CoreRegistryService(core, config).sync();
  console.log(JSON.stringify(res, null, 2));
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
