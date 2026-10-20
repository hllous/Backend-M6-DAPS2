import * as fs from 'fs';
import * as path from 'path';
import Ajv2020 from 'ajv/dist/2020';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Valida un `data` contra el paquete de schemas de M2 v1.78, si está.
 *
 * El paquete vive en `docs/documentacion/` (ignorada por git), así que en CI
 * y en un clon limpio no existe: ahí los specs que lo usan se saltean con un
 * aviso en vez de fallar. `M2_V178_SCHEMAS` permite apuntarlo a otra carpeta
 * (p. ej. desde un worktree, que no hereda los archivos ignorados).
 */
const PAQUETE =
  process.env.M2_V178_SCHEMAS ??
  path.join(__dirname, '../../docs/documentacion/otros modulos/m2/m2-eventos-v1.78/schemas');

export const PAQUETE_M2_PRESENTE = fs.existsSync(PAQUETE);

/** Los sobres de ejemplo válidos, hermanos de `schemas/` (el `.json` completo, con su sobre). */
export const EJEMPLOS_M2_VALIDOS = path.join(PAQUETE, '..', 'examples', 'valid');

if (!PAQUETE_M2_PRESENTE) {
  console.warn(
    `Paquete de M2 v1.78 ausente (${PAQUETE}): se saltea la validación contra su contrato.`,
  );
}

let validate: ValidateFunction | undefined;

/** Errores del `data` de `updateTicketStatus` contra el paquete de M2; `[]` si es válido. */
export function erroresM2UpdateTicketStatus(data: unknown): string[] {
  if (!validate) {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    for (const f of fs.readdirSync(PAQUETE).filter((n) => n.endsWith('.schema.json'))) {
      ajv.addSchema(JSON.parse(fs.readFileSync(path.join(PAQUETE, f), 'utf-8')));
    }
    validate = ajv.getSchema(
      'https://municipalidad-uade.example/m2/events/v1.78/updateTicketStatus.data.schema.json',
    );
    if (!validate) throw new Error('No se pudo compilar updateTicketStatus.data de M2 v1.78');
  }
  return validate(data)
    ? []
    : (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`);
}
