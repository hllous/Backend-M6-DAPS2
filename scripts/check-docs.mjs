// Chequeos de la documentación que no dependen de la integración (#539):
//  1. Enlaces relativos de todos los .md versionados (sin anclas ni URLs externas).
//  2. Conteos que la documentación repite a mano (rutas, operaciones, tags, modelos,
//     módulos) contra docs/api/openapi.json, prisma/schema.prisma y src/modules/.
//  3. Cada variable de entorno que valida src/config/env.validation.ts figura en
//     docs/operacion/referencia.md.
// Sin dependencias. Los .md se toman de `git ls-files`, así que lo ignorado por git
// (por ejemplo docs/documentacion/) no se revisa. Uso: npm run docs:check
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (ruta) => readFileSync(join(raiz, ruta), 'utf8');
const errores = [];

const archivos = execFileSync('git', ['ls-files', '*.md'], { cwd: raiz, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);

// Quita los bloques ``` conservando los saltos de línea, para que los números de línea sigan valiendo.
const sinCodigo = (texto) => texto.replace(/```[\s\S]*?```/g, (b) => b.replace(/[^\n]/g, ''));

// --- 1. enlaces ---
let enlaces = 0;
for (const archivo of archivos) {
  const lineas = sinCodigo(leer(archivo)).split('\n');
  lineas.forEach((linea, i) => {
    for (const m of linea.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const destino = m[1];
      if (/^(https?:|mailto:|#)/.test(destino)) continue;
      const ruta = destino.split('#')[0];
      if (!ruta) continue;
      enlaces++;
      let decodificada = ruta;
      try {
        decodificada = decodeURIComponent(ruta);
      } catch {
        // se usa tal cual
      }
      if (!existsSync(join(raiz, dirname(archivo), decodificada))) {
        errores.push(
          `${archivo}:${i + 1}: el enlace "${destino}" no apunta a un archivo que exista`,
        );
      }
    }
  });
}

// --- 2. conteos ---
const openapi = JSON.parse(leer('docs/api/openapi.json'));
const rutas = Object.keys(openapi.paths).length;
let operaciones = 0;
const tags = new Set();
for (const metodos of Object.values(openapi.paths)) {
  for (const op of Object.values(metodos)) {
    operaciones++;
    (op.tags ?? []).forEach((t) => tags.add(t));
  }
}
const modelos = (leer('prisma/schema.prisma').match(/^model\s/gm) ?? []).length;
const modulos = readdirSync(join(raiz, 'src/modules'), { withFileTypes: true }).filter((d) =>
  d.isDirectory(),
).length;

// Solo estos archivos: el resto de la documentación (historial, ADRs, QA) cita conteos
// de una fecha dada y no tiene por qué coincidir con el código de hoy.
const CONTEOS = [
  { re: /(\d+) rutas\b/g, real: rutas, nombre: 'rutas', fuente: 'docs/api/openapi.json' },
  {
    re: /(\d+) (?:operaciones|endpoints REST)\b/g,
    real: operaciones,
    nombre: 'operaciones',
    fuente: 'docs/api/openapi.json',
  },
  { re: /(\d+) tags\b/g, real: tags.size, nombre: 'tags', fuente: 'docs/api/openapi.json' },
  { re: /(\d+) modelos\b/g, real: modelos, nombre: 'modelos', fuente: 'prisma/schema.prisma' },
  { re: /\ben (\d+) módulos\b/g, real: modulos, nombre: 'módulos', fuente: 'src/modules/' },
];
for (const archivo of ['README.md', 'docs/README.md', 'docs/api/endpoints.md']) {
  // Con los bloques de código incluidos: el árbol de carpetas del README repite estos números.
  leer(archivo)
    .split('\n')
    .forEach((linea, i) => {
      for (const { re, real, nombre, fuente } of CONTEOS) {
        for (const m of linea.matchAll(re)) {
          if (Number(m[1]) !== real) {
            errores.push(`${archivo}:${i + 1}: dice ${m[1]} ${nombre} y ${fuente} tiene ${real}`);
          }
        }
      }
    });
}

// --- 3. variables de entorno ---
const claves = [
  ...leer('src/config/env.validation.ts').matchAll(/^ {4}([A-Z][A-Z0-9_]+): z\b/gm),
].map((m) => m[1]);
if (claves.length === 0)
  errores.push('src/config/env.validation.ts: no se encontró ninguna variable');
const referencia = leer('docs/operacion/referencia.md');
for (const clave of new Set(claves)) {
  if (!referencia.includes('`' + clave + '`')) {
    errores.push(
      `docs/operacion/referencia.md: falta la variable ${clave} (la valida env.validation.ts)`,
    );
  }
}

if (errores.length) {
  console.error(`docs:check (docs generales): ${errores.length} problema(s)`);
  for (const e of errores) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `docs:check (docs generales): ok (${archivos.length} archivos, ${enlaces} enlaces, ` +
    `${rutas} rutas / ${operaciones} operaciones / ${tags.size} tags / ${modelos} modelos / ${modulos} módulos, ` +
    `${new Set(claves).size} variables)`,
);
