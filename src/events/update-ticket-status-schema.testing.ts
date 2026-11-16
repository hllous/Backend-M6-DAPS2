import * as fs from 'fs';
import * as path from 'path';
import Ajv2020 from 'ajv/dist/2020';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Valida un `data` de `updateTicketStatus` contra NUESTRO schema versionado
 * (`docs/eventos/publicados/`), que adopta el contrato de M2 v1.78. Corre
 * siempre, también en CI; la comparación con el paquete oficial de M2 es manual.
 */
const DIR = path.join(__dirname, '../../docs/eventos/publicados');

let validate: ValidateFunction | undefined;

/** Errores del `data` contra el schema; `[]` si es válido. */
export function erroresUpdateTicketStatus(data: unknown): string[] {
  if (!validate) {
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(
      JSON.parse(fs.readFileSync(path.join(DIR, '_shared.schema.json'), 'utf-8')),
      '_shared.schema.json',
    );
    validate = ajv.compile(
      JSON.parse(fs.readFileSync(path.join(DIR, 'updateTicketStatus.schema.json'), 'utf-8')),
    );
  }
  return validate(data)
    ? []
    : (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`);
}
