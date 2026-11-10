// Arma los PDF de docs/QA a partir de los .md (el Markdown es la fuente; el PDF se regenera).
//   npm run qa:pdf              -> falla si falta alguno de los .md del informe
//   npm run qa:pdf -- --partial -> salta los que no existan (solo para pruebas locales)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, extname, join, posix, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Versión fija: npx sin versión bajaría la última y el PDF cambiaría sin tocar el repo.
const MD_TO_PDF = 'md-to-pdf@5.2.5';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const qaDir = join(root, 'docs', 'QA');
const buildDir = join(qaDir, 'build');
const partial = process.argv.includes('--partial');

const INFORME = [
  '01-plan-y-estrategia.md',
  '02-historias-y-criterios.md',
  '03-matriz-trazabilidad.md',
  '04-especificacion-casos.md',
  '05-informe-ejecucion.md',
  '06-registro-defectos.md',
  '07-informe-seguridad.md',
  '08-lecciones-aprendidas.md',
];

const DOCS = [
  {
    out: 'Clase15_Grupo04_Ambiente-e-Higiene_Testing',
    title: 'Criterios de Testing y Aseguramiento de Calidad',
    subtitle: 'Prueba del sistema — Clase 15',
    files: INFORME,
    toc: true,
  },
  {
    out: 'Manual-de-usuario-M6',
    title: 'Manual de usuario',
    subtitle: 'Aplicación web de Ambiente y Servicios',
    files: ['manual-de-usuario.md'],
  },
];

// Además del integrado, un PDF por cada documento 01..08 (build/individuales/).
for (const f of INFORME) {
  const p = join(qaDir, f);
  if (!existsSync(p)) continue; // el integrado ya avisa o falla si falta
  const h1 = readFileSync(p, 'utf8').match(/^#\s+(.+)$/m);
  DOCS.push({
    out: join('individuales', f.replace(/\.md$/, '')),
    title: h1 ? h1[1] : f,
    subtitle: 'Prueba del sistema — Clase 15',
    files: [f],
  });
}

const docsDir = join(root, 'docs');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

// Cada imagen local se incrusta como data URI (no depende del servidor de md-to-pdf).
// Si el archivo no existe, queda un placeholder visible para insertar la captura a mano:
// el PDF se genera igual.
function inlineImages(md, fileDir) {
  return md.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, src) => {
    if (/^(https?:|data:|#)/.test(src)) return m;
    const abs = resolve(fileDir, src);
    const mime = MIME[extname(abs).toLowerCase()];
    if (!mime || !existsSync(abs)) {
      const ruta = relative(root, abs).split('\\').join(posix.sep);
      console.warn(`  (captura pendiente: ${ruta})`);
      return `> **[CAPTURA PENDIENTE: ${alt || 'sin descripción'}, ruta ${ruta}]**`;
    }
    return `![${alt}](data:${mime};base64,${readFileSync(abs).toString('base64')})`;
  });
}

function cover({ title, subtitle }) {
  const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  return `<div class="cover">
<p class="cover-kicker">Desarrollo de Aplicaciones II · 2.º C 2026 · UADE</p>
<p class="cover-title">${title}</p>
<p class="cover-sub">${subtitle}</p>
<p class="cover-meta"><strong>Grupo 04</strong> · Módulo 6 — Ambiente e Higiene<br>${fecha}</p>
</div>

`;
}

// Páginas de un PDF de Chrome: el /Count mayor es el del nodo raíz /Pages.
const pageCount = (pdf) =>
  Math.max(0, ...[...readFileSync(pdf).toString('latin1').matchAll(/\/Count (\d+)/g)].map((m) => Number(m[1])));

// Índice del integrado: cada parte arranca en página nueva; portada = 1, índice = 1.
function tocHtml(files) {
  let page = 3;
  const rows = files.map((f) => {
    const h1 = readFileSync(join(qaDir, f), 'utf8').match(/^#\s+(.+)$/m);
    const n = existsSync(join(buildDir, 'individuales', f.replace(/\.md$/, '.pdf')))
      ? pageCount(join(buildDir, 'individuales', f.replace(/\.md$/, '.pdf'))) - 1 // el h1 inicial deja una página en blanco
      : 0;
    const row = `<tr><td>${h1 ? h1[1] : f}</td><td class="pg">${page}</td></tr>`;
    page += n;
    return row;
  });
  return `<div class="toc">
<p class="toc-title">Índice</p>
<table><thead><tr><th>Documento</th><th>Pág.</th></tr></thead><tbody>
${rows.join('')}
</tbody></table>
</div>

`;
}

function build({ out, title, subtitle, files, toc }) {
  const parts = [];
  for (const f of files) {
    const p = join(qaDir, f);
    if (!existsSync(p)) {
      if (partial) {
        console.warn(`  (se salta, no existe: ${f})`);
        continue;
      }
      throw new Error(`Falta docs/QA/${f}. Usá --partial solo para pruebas locales.`);
    }
    parts.push(inlineImages(readFileSync(p, 'utf8'), qaDir));
  }
  mkdirSync(dirname(join(buildDir, out)), { recursive: true });
  const mdPath = join(buildDir, `${out}.md`);
  const pdfPath = join(buildDir, `${out}.pdf`);
  writeFileSync(mdPath, cover({ title, subtitle }) + (toc ? tocHtml(files) : '') + parts.join('\n\n'), 'utf8');

  const configPath = join(buildDir, 'md-to-pdf.config.json');
  writeFileSync(
    configPath,
    JSON.stringify({
      basedir: docsDir,
      dest: pdfPath,
      stylesheet: [join(qaDir, 'pdf.css')],
      document_title: title,
      pdf_options: {
        format: 'A4',
        margin: { top: '20mm', bottom: '22mm', left: '16mm', right: '16mm' },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate:
          '<div style="width:100%;font-size:8px;color:#666;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      },
    }),
    'utf8',
  );

  // shell:true: en Windows npx es un .cmd y Node 22 no lo ejecuta sin shell.
  execFileSync('npx', ['--yes', MD_TO_PDF, `"${mdPath}"`, '--config-file', `"${configPath}"`], {
    stdio: 'inherit',
    shell: true,
    cwd: root,
  });
  rmSync(mdPath);
  rmSync(configPath);
  console.log(`  -> ${relative(root, pdfPath)}`);
}

// Orden: individuales -> integrado (necesita sus páginas) -> manual.
const rank = (d) => (d.toc ? 1 : d.out.startsWith('individuales') ? 0 : 2);
DOCS.sort((a, b) => rank(a) - rank(b));
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
for (const d of DOCS) {
  if (only && !d.out.includes(only)) continue;
  console.log(d.out);
  build(d);
}
