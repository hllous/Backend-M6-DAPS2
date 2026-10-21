// Chequea la documentación de integración (#312):
//  1. El tablero de docs/bloqueantes.md: filas de 4 columnas, con fecha de
//     última actualización y solo lo abierto (lo cerrado va a integracion/resueltos.md).
//  2. Los enlaces relativos de bloqueantes.md y docs/integracion/*.md apuntan a archivos que existen.
// Uso: npm run docs:check
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docs = join(raiz, 'docs');
const errores = [];

const MESES = 'ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic';
const FECHA = new RegExp(`^\\d{1,2} (${MESES}) 20\\d{2}$`, 'i');
// Un estado con ✅ sigue abierto si todavía queda algo por hacer.
const PENDIENTE = ['⚠️', '🟡', '🔴', 'falta', 'implementación en', 'docs en #', 'pendiente'];

// --- 1. tablero ---
const bloqueantes = join(docs, 'bloqueantes.md');
const lineas = readFileSync(bloqueantes, 'utf8').split('\n');
const desde = lineas.findIndex((l) => l.startsWith('## Tablero'));
if (desde < 0) errores.push('bloqueantes.md: falta la sección "## Tablero"');

// Divide por | sin cortar los \| escapados dentro de una celda.
const celdas = (fila) => fila.split(/(?<!\\)\|/).slice(1, -1).map((c) => c.trim());

let filas = 0;
for (let i = desde + 1; i < lineas.length; i++) {
  const l = lineas[i];
  if (l.startsWith('## ')) break;
  if (!l.startsWith('| ') || l.startsWith('| ---') || l.startsWith('| Con quién')) continue;
  filas++;
  const c = celdas(l);
  const donde = `bloqueantes.md:${i + 1}`;
  if (c.length !== 4) {
    errores.push(`${donde}: la fila tiene ${c.length} columnas, deberían ser 4`);
    continue;
  }
  if (!FECHA.test(c[3])) errores.push(`${donde}: "Última act." no es una fecha (ej. "20 oct 2026"): "${c[3]}"`);
  if (c[2].startsWith('✅') && !PENDIENTE.some((k) => c[2].includes(k))) {
    errores.push(`${donde}: fila cerrada (${c[2].slice(0, 40)}): mover a integracion/resueltos.md`);
  }
}
if (filas === 0) errores.push('bloqueantes.md: el tablero no tiene filas');

// --- 2. enlaces ---
const archivos = [bloqueantes];
const dirIntegracion = join(docs, 'integracion');
if (existsSync(dirIntegracion)) {
  for (const f of readdirSync(dirIntegracion)) if (f.endsWith('.md')) archivos.push(join(dirIntegracion, f));
}
const ENLACE = /\]\(([^)\s]+)\)/g;
for (const archivo of archivos) {
  const texto = readFileSync(archivo, 'utf8');
  for (const m of texto.matchAll(ENLACE)) {
    const destino = m[1];
    if (/^(https?:|mailto:|#)/.test(destino)) continue;
    const ruta = decodeURIComponent(destino.split('#')[0]);
    if (!ruta) continue;
    if (!existsSync(resolve(dirname(archivo), ruta))) {
      errores.push(`${archivo.slice(raiz.length + 1).replaceAll('\\', '/')}: enlace roto → ${destino}`);
    }
  }
}

if (errores.length) {
  console.error(`docs:check: ${errores.length} problema(s)`);
  for (const e of errores) console.error(' - ' + e);
  process.exit(1);
}
console.log(`docs:check: ok (${filas} filas abiertas, ${archivos.length} archivos revisados)`);
