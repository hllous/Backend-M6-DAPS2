/**
 * Da de baja a mano suscripciones sobrantes de M6 en el Core (DELETE con el
 * token de módulo). Solo las que se piden por nombre; nunca "todas las sobrantes".
 *
 * `npm run core:unregister -- --type zoneNotServiced` es un simulacro: solo GET.
 * Con `--apply` borra de verdad. `--type` se repite. Lee `.env` si existe.
 */
import { ConfigService } from '@nestjs/config';
import configuration from '../src/config/configuration';
import { CoreClient } from '../src/core/core.client';
import { CoreRegistryService } from '../src/core/core-registry.service';
import { parsearArgs } from '../src/core/unregister-args';

try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env, vale lo que ya esté en el entorno.
}
process.env.DATABASE_URL ??= 'postgresql://registro:registro@localhost:5432/registro';
process.env.JWT_SECRET ??= 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

async function main(): Promise<void> {
  const { tipos, apply } = parsearArgs(process.argv.slice(2));
  const config = new ConfigService(configuration());
  const core = new CoreClient(config);
  if (!core.enabled) {
    console.error('Falta CORE_API_URL: no hay Core al que darle de baja nada.');
    process.exit(1);
  }
  // Solo se imprime el resultado: nunca token, secret ni config.
  const res = await new CoreRegistryService(core, config).darDeBaja(tipos, apply);
  console.log(JSON.stringify({ apply, resultado: res }, null, 2));
  if (res.some((r) => r.estado === 'error')) process.exit(1);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
