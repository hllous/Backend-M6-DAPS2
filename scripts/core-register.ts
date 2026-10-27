/**
 * Registra a mano las suscripciones y publicaciones de M6 en el Core, con el
 * mismo servicio que corre al arrancar. Es idempotente: crea solo lo que falta.
 *
 * Se corre con `npm run core:register` (lee `.env` si existe).
 * Con `-- --dry-run` solo hace GET e imprime el plan: no crea nada.
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
// base64 de 32 bytes: el esquema rechaza un secret que no lo sea.
process.env.JWT_SECRET ??= 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

async function main(): Promise<void> {
  const config = new ConfigService(configuration());
  const core = new CoreClient(config);
  if (!core.enabled) {
    console.error('Falta CORE_API_URL: no hay Core al que registrar.');
    process.exit(1);
  }
  const registro = new CoreRegistryService(core, config);
  // Solo se imprime el plan o el resultado: nunca token, secret ni config.
  const dryRun = process.argv.includes('--dry-run');
  const res = dryRun ? await registro.simular() : await registro.sync();
  console.log(JSON.stringify(dryRun ? { dryRun: true, ...res } : res, null, 2));
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
