/**
 * Sincroniza las comunas y las zonas de M6 con el catálogo de M9 (#421): una
 * `Zone` por barrio activo, con su `ZoneNeighborhood` (UUID de M9).
 *
 * `npm run zones:sync-from-core -- [--dry-run] [--from-snapshot] [--clean-legacy]`
 *
 * - `--dry-run`: solo lee; imprime el plan y no escribe en la base.
 * - `--from-snapshot`: usa `prisma/data/m9-*.json` en vez del Core (no pide token).
 * - `--clean-legacy`: DESTRUCTIVO. Borra las filas `zone_neighborhood` cuyo
 *   `neighborhoodId` no está en el catálogo (ids viejos tipo `caba-…`), salvo las
 *   de zonas con servicios, recorridos u otros datos. Nunca borra zonas. Sin la
 *   bandera, esas filas solo se listan.
 *
 * Exige `DATABASE_URL`. Sin `--from-snapshot` usa CORE_API_URL y CORE_MODULE_SECRET.
 * Lee `.env` si existe. Solo imprime el reporte: nunca token, secret ni config.
 */
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import configuration from '../src/config/configuration';
import { CoreClient } from '../src/core/core.client';
import { cargarDesdeCore, cargarSnapshot, syncZones } from '../src/core/zones-sync';

try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env, vale lo que ya esté en el entorno.
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('Falta DATABASE_URL: apuntá a la base que querés sincronizar.');
    process.exit(1);
  }
  const arg = (f: string): boolean => process.argv.includes(f);

  let catalogo;
  if (arg('--from-snapshot')) {
    catalogo = cargarSnapshot();
  } else {
    const core = new CoreClient(new ConfigService(configuration()));
    if (!core.enabled) {
      console.error('Falta CORE_API_URL: usá --from-snapshot para trabajar sin Core.');
      process.exit(1);
    }
    catalogo = await cargarDesdeCore(core);
  }

  const prisma = new PrismaClient();
  try {
    const res = await syncZones(prisma, catalogo, {
      dryRun: arg('--dry-run'),
      cleanLegacy: arg('--clean-legacy'),
    });
    console.log(JSON.stringify(res, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
