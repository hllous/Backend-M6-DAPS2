// Compara las operaciones de docs/api/openapi.json con las que cubre la colección Postman
// (test/api/m6.postman_collection.json) y falla si alguna queda sin caso de éxito o sin caso de error
// (#697). Criterio del Eje B: "todos los endpoints con al menos un caso de éxito y uno de error".
//   éxito: request "METHOD /ruta - exito 2xx ..." con un test de status 2xx y al menos una aserción más.
//   error: cualquier otro request de la operación, con un test de status 4xx.
//   excepción: test/api/excepciones.json { sinExito: {...}, sinError: {...} } con "METHOD /ruta": "motivo".
// Uso: node scripts/check-api-coverage.mjs   (npm run api:coverage)
import { readFileSync } from 'node:fs';

const spec = JSON.parse(readFileSync('docs/api/openapi.json', 'utf8'));
const coleccion = JSON.parse(readFileSync('test/api/m6.postman_collection.json', 'utf8'));
const { sinExito: excepciones, sinError: excepcionesError } = JSON.parse(readFileSync('test/api/excepciones.json', 'utf8'));

const operaciones = Object.entries(spec.paths).flatMap(([ruta, ops]) =>
  Object.keys(ops).map((m) => `${m.toUpperCase()} ${ruta}`),
);

const items = [];
(function recorrer(lista) {
  for (const i of lista) {
    if (i.item) recorrer(i.item);
    else items.push(i);
  }
})(coleccion.item);

const script = (i) =>
  (i.event ?? [])
    .filter((e) => e.listen === 'test')
    .flatMap((e) => e.script.exec)
    .join('\n');

const porOp = new Map(operaciones.map((o) => [o, { exito: 0, error: 0 }]));
const problemas = [];

for (const i of items) {
  const op = operaciones.find((o) => i.name.startsWith(`${o} - `));
  if (!op) {
    problemas.push(`request sin operación en el OpenAPI: ${i.name}`);
    continue;
  }
  const resto = i.name.slice(op.length + 3);
  const codigo = script(i);
  const tests = (codigo.match(/pm\.test\(/g) ?? []).length;
  if (resto.startsWith('exito')) {
    if (!/status 2\d\d/.test(codigo)) problemas.push(`éxito sin aserción de status 2xx: ${i.name}`);
    else if (tests < 2) problemas.push(`éxito sin aserciones sobre el cuerpo (solo el status): ${i.name}`);
    else porOp.get(op).exito++;
  } else if (/status [^']*4\d\d/.test(codigo)) {
    porOp.get(op).error++;
  } else {
    problemas.push(`error sin aserción de status 4xx: ${i.name}`);
  }
}

let conExito = 0;
let conError = 0;
for (const [op, n] of porOp) {
  if (n.exito > 0) {
    conExito++;
    if (op in excepciones) problemas.push(`excepción sobrante, ${op} ya tiene caso de éxito: borrarla de excepciones.json`);
  } else if (!(op in excepciones)) {
    problemas.push(`sin caso de éxito ni excepción justificada: ${op}`);
  } else if (!String(excepciones[op]).trim()) {
    problemas.push(`excepción sin motivo: ${op}`);
  }
  if (n.error > 0) {
    conError++;
    if (op in excepcionesError) problemas.push(`excepción de error sobrante, ${op} ya tiene caso de error`);
  } else if (!String(excepcionesError[op] ?? '').trim()) {
    problemas.push(`sin caso de error ni excepción justificada: ${op}`);
  }
}
for (const op of [...Object.keys(excepciones), ...Object.keys(excepcionesError)]) {
  if (!porOp.has(op)) problemas.push(`excepción de una operación que no existe: ${op}`);
}

const total = operaciones.length;
const exentas = Object.keys(excepciones).length;
const exentasError = Object.keys(excepcionesError).length;
console.log(
  `API: ${total} operaciones; éxito ${conExito}/${total} (+${exentas} con excepción justificada), error ${conError}/${total} (+${exentasError} con excepción justificada); ${items.length} requests`,
);
if (problemas.length) {
  console.error(problemas.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
