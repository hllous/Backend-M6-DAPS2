import { execFileSync } from 'child_process';
import { assertBaseLocal } from './guard-database-url';

/**
 * Aplica las migraciones antes de las suites, con la URL ya validada.
 *
 * Estaba documentado como un `npx prisma migrate deploy` a mano antes de correr
 * los e2e, y ese paso quedaba fuera del guard: el CLI de Prisma lee el `.env` del
 * repo por su cuenta, así que olvidarse del `export` aplicaba migraciones contra
 * la base desplegada. Acá corre dentro de jest y con la misma validación.
 */
export default function globalSetup(): void {
  const databaseUrl = assertBaseLocal(process.env.DATABASE_URL);
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}
