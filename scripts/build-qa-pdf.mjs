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
  '08-declaracion-ia.md',
  '09-lecciones-aprendidas.md',
];

const DOCS = [
  {
    out: 'Clase15_Grupo04_Ambiente-e-Higiene_Testing',
    title: 'Criterios de Testing y Aseguramiento de Calidad',
    subtitle: 'Prueba del sistema — Clase 15',
    files: INFORME,
  },
  {
    out: 'Manual-de-usuario-M6',
    title: 'Manual de usuario',
    subtitle: 'Aplicación web de Ambiente y Servicios',
    files: ['manual-de-usuario.md'],
  },
];

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

function build({ out, title, subtitle, files }) {
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
  mkdirSync(buildDir, { recursive: true });
  const mdPath = join(buildDir, `${out}.md`);
  const pdfPath = join(buildDir, `${out}.pdf`);
  writeFileSync(mdPath, cover({ title, subtitle }) + parts.join('\n\n'), 'utf8');

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

for (const d of DOCS) {
  console.log(d.out);
  build(d);
}
