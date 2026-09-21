/**
 * Los e2e **truncan todas las tablas**, así que nada de esta carpeta puede
 * arrancar sin confirmar que la base es local y descartable. Sin este guard, un
 * `npm run test:e2e` sin variables tomaría el `DATABASE_URL` del `.env` del repo
 * —que apunta a la base desplegada— y la vaciaría.
 */
const HOSTS_LOCALES = ['localhost', '127.0.0.1', '::1'];

export function assertBaseLocal(databaseUrl: string | undefined): string {
  if (!databaseUrl) {
    throw new Error(
      'Los e2e necesitan DATABASE_URL en el entorno del proceso, apuntando a una base descartable ' +
        '(ej. postgresql://m6:m6local@localhost:5433/m6_e2e?schema=public). Ver docs/testing.md.',
    );
  }

  // Se parsea el host en vez de buscar la subcadena: una URL como
  // postgresql://u:p@localhost:5432@host.remoto/x pasa cualquier regex de
  // substring, y Prisma conecta al host que va después del último '@'.
  let hostname: string;
  try {
    hostname = new URL(databaseUrl).hostname.replace(/^\[|\]$/g, '');
  } catch {
    throw new Error('DATABASE_URL no es una URL válida. Ver docs/testing.md.');
  }

  if (!HOSTS_LOCALES.includes(hostname)) {
    throw new Error(
      `DATABASE_URL apunta a '${hostname}'. Los e2e truncan todas las tablas: se niegan a correr ` +
        'contra una base que no sea local. Ver docs/testing.md.',
    );
  }

  return databaseUrl;
}
