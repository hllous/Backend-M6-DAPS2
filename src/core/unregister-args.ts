import { parseArgs } from 'node:util';

/**
 * Argumentos de `core:unregister`. Estricto: un flag desconocido, con `=` o mal
 * escrito (`--dry-run`, `--apply=true`, `--aply`) falla en vez de ignorarse,
 * porque ignorarlo podría borrar cuando se pidió lo contrario.
 */
export function parsearArgs(argv: string[]): { tipos: string[]; apply: boolean } {
  const { values } = parseArgs({
    args: argv,
    strict: true,
    allowPositionals: false,
    options: {
      type: { type: 'string', multiple: true },
      apply: { type: 'boolean' },
    },
  });
  if (argv.some((a) => a.startsWith('--apply=') || a.startsWith('--type='))) {
    throw new Error('Usar --type <eventType> y --apply sin "="');
  }
  const tipos = values.type ?? [];
  if (!tipos.length) throw new Error('Falta al menos un --type <eventType>');
  return { tipos, apply: values.apply === true };
}
