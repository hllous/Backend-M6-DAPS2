// Genera test/api/m6.postman_collection.json desde docs/api/openapi.json (#572).
//   1. openapi-to-postmanv2 (vía npx) convierte el OpenAPI: nombres, descripciones y cuerpos de ejemplo.
//   2. Este script arma, por endpoint, los casos con tests de Postman:
//        - éxito (GET sin parámetros requeridos, o con ids tomados del listado del padre);
//        - 401 sin token (salvo los públicos);
//        - 403 con token de AUDITOR en las escrituras (el RolesGuard corre antes que la validación);
//        - 400/404 con admin: cuerpo con propiedad no declarada, o id inexistente.
//   3. Escribe test/api/PENDIENTES.md con lo que no tiene caso de éxito (escrituras: necesitan
//      datos de estado que la colección no arma; GET con query requerido).
// Uso: npm run api:collection   (si cambia el OpenAPI, regenerar y commitear).
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Valor JS para interpolar en el código de los tests de Postman. JSON.stringify solo no
// alcanza (CodeQL js/bad-code-sanitization): no escapa <, > ni los separadores de línea.
const ESCAPES = { '<': '\\u003C', '>': '\\u003E', '\u{2028}': '\\u2028', '\u{2029}': '\\u2029' };
const lit = (valor) => JSON.stringify(valor).replace(/[<>\u{2028}\u{2029}]/gu, (c) => ESCAPES[c]);

const spec = JSON.parse(readFileSync('docs/api/openapi.json', 'utf8'));
const tmp = join(mkdtempSync(join(tmpdir(), 'm6-pm-')), 'base.json');
execFileSync(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['--yes', 'openapi-to-postmanv2', '-s', 'docs/api/openapi.json', '-o', tmp, '-p',
    '-O', 'folderStrategy=Tags,requestParametersResolution=Example,exampleParametersResolution=Example'],
  { stdio: 'inherit', shell: process.platform === 'win32' },
);
const base = JSON.parse(readFileSync(tmp, 'utf8'));

// "METHOD /path/{id}" -> request convertido
const convertidos = new Map();
(function walk(items) {
  for (const i of items) {
    if (i.item) walk(i.item);
    else {
      const p = '/' + i.request.url.path.map((s) => s.replace(/^:(.+)$/, '{$1}')).join('/');
      convertidos.set(`${i.request.method} ${p}`, i.request);
    }
  }
})(base.item);

// Roles por endpoint (tabla generada de docs/api/endpoints.md): el token de prueba es M6_ADMIN, que no
// tiene los roles de Campo; en esas rutas el RolesGuard responde 403 antes que la validación.
const sinAdmin = new Set();
for (const m of readFileSync('docs/api/endpoints.md', 'utf8').matchAll(/^\| (GET|POST|PUT|PATCH|DELETE) \| `([^`]+)` \| ([^|]+) \|$/gm)) {
  if (m[3].includes('M6_') && !m[3].includes('M6_ADMIN')) sinAdmin.add(`${m[1]} ${m[2].replace(/:(\w+)/g, '{$1}')}`);
}
const FAKE = '00000000-0000-4000-8000-000000000000';
const ref = (s) => (s?.$ref ? spec.components.schemas[s.$ref.split('/').pop()] : s);
const getOps = (p) => spec.paths[p]?.get;

/** Claves que tiene que traer el 2xx (schema básico): las `required` del objeto de primer nivel. */
function clavesRequeridas(op) {
  const ok = Object.entries(op.responses).find(([c]) => c.startsWith('2'));
  const s = ref(ok?.[1].content?.['application/json']?.schema);
  return s?.type === 'array' ? 'array' : (s?.required ?? []);
}

const auth = (v) => (v === null ? { type: 'noauth' } : { type: 'bearer', bearer: [{ key: 'token', value: `{{${v}}}`, type: 'string' }] });

const test = (lineas) => [{ listen: 'test', script: { type: 'text/javascript', exec: lineas } }];

/** Prerequest que resuelve cada `{{pN}}` pidiendo el listado del padre (una vez por ejecución). */
function prerequest(prefijos) {
  const exec = [
    `const base = pm.variables.get('baseUrl'), tok = pm.variables.get('token');`,
    `const cache = (n, k) => pm.collectionVariables.get('cache:' + n + k);`,
    `const pedir = (url) => new Promise((ok, ko) => pm.sendRequest({ url, header: { Authorization: 'Bearer ' + tok } }, (e, r) => e ? ko(e) : ok(r.json())));`,
    `const prefijos = ${lit(prefijos)};`,
    `(async () => {`,
    `  const previos = [];`,
    `  for (let i = 0; i < prefijos.length; i++) {`,
    `    let ruta = prefijos[i].ruta; previos.forEach((v, j) => { ruta = ruta.replace('{p' + j + '}', v); });`,
    `    let id = cache(ruta, '');`,
    `    if (!id) {`,
    `      const j = await pedir(base + ruta + '?pageSize=1');`,
    `      const fila = (Array.isArray(j) ? j : j.data)[0];`,
    `      id = fila && (fila[prefijos[i].param] ?? fila.id);`,
    `      pm.collectionVariables.set('cache:' + ruta, id);`,
    `    }`,
    `    previos.push(id); pm.variables.set('p' + i, id);`,
    `  }`,
    `})();`,
  ];
  return [{ listen: 'prerequest', script: { type: 'text/javascript', exec } }];
}

const carpetas = new Map();
const pendientes = [];
let casos = 0;
const conExito = new Set();

for (const [path, ops] of Object.entries(spec.paths)) {
  for (const [metodo, op] of Object.entries(ops)) {
    const M = metodo.toUpperCase();
    const clave = `${M} ${path}`;
    const orig = convertidos.get(clave);
    if (!orig) throw new Error(`Sin request convertido para ${clave}`);
    const publico = op.security === undefined;
    const params = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    const queryReq = (op.parameters ?? []).filter((p) => p.in === 'query' && p.required);
    const escritura = M !== 'GET';
    const tag = op.tags?.[0] ?? 'otros';
    if (!carpetas.has(tag)) carpetas.set(tag, []);
    const carpeta = carpetas.get(tag);

    const urlCon = (valor) => {
      const segs = path.split('/').slice(1).map((s) => (s.startsWith('{') ? valor(s.slice(1, -1)) : s));
      return { raw: `{{baseUrl}}/${segs.join('/')}`, host: ['{{baseUrl}}'], path: segs };
    };
    const mk = (nombre, { url, bearer, tests, pre = [], body }) => {
      casos++;
      carpeta.push({
        name: `${clave} - ${nombre}`,
        event: [...pre, ...tests],
        request: {
          method: M,
          header: orig.header ?? [],
          url,
          auth: auth(bearer),
          ...(body ?? (orig.body ? { body: orig.body } : {})),
          description: op.summary,
        },
      });
    };

    // --- éxito (solo GET: las escrituras necesitan estado de dominio, ver PENDIENTES.md)
    if (!escritura) {
      const prefijos = [];
      let resoluble = true;
      params.forEach((p, i) => {
        const ruta = path.slice(0, path.indexOf(`{${p}}`)).replace(/\/$/, '');
        const rutaLista = ruta.replace(/\{(\w+)\}/g, (_, n) => `{p${params.indexOf(n)}}`);
        // el listado del padre tiene que existir como GET (con el path original) para sacar un id real
        if (!getOps(ruta) || (getOps(ruta).parameters ?? []).some((q) => q.in === 'query' && q.required)) resoluble = false;
        prefijos.push({ ruta: rutaLista, param: p });
      });
      if (queryReq.length) resoluble = false;
      if (resoluble) {
        const claves = clavesRequeridas(op);
        mk('exito 200', {
          url: urlCon((p) => `{{p${params.indexOf(p)}}}`),
          bearer: publico ? null : 'token',
          pre: params.length ? prerequest(prefijos) : [],
          tests: test([
            `pm.test('status 200', () => pm.response.to.have.status(200));`,
            `pm.test('es JSON', () => pm.response.to.be.json);`,
            claves === 'array'
              ? `pm.test('es un arreglo', () => pm.expect(pm.response.json()).to.be.an('array'));`
              : `pm.test('trae ${lit(claves)}', () => pm.expect(pm.response.json()).to.include.all.keys(...${lit(claves)}));`,
          ]),
        });
        conExito.add(clave);
      } else {
        pendientes.push([clave, queryReq.length ? 'query requerido sin valor de demo' : 'el listado del padre no existe para resolver el id']);
      }
    } else {
      pendientes.push([clave, 'escritura: necesita datos y estado de dominio']);
    }

    // --- 401 sin token
    if (!publico) {
      mk('401 sin token', {
        url: urlCon(() => FAKE),
        bearer: null,
        tests: test([`pm.test('status 401', () => pm.response.to.have.status(401));`]),
      });
    }

    // --- 403 por rol: auditor en cualquier escritura
    if (escritura && !publico) {
      mk('403 rol AUDITOR', {
        url: urlCon(() => FAKE),
        bearer: 'auditorToken',
        tests: test([
          `pm.test('status 403', () => pm.response.to.have.status(403));`,
          `pm.test('code ROLE_REQUIRED', () => pm.expect(pm.response.json().code).to.eql('ROLE_REQUIRED'));`,
        ]),
      });
    }

    // --- 400/404 con admin
    if (!publico || M === 'GET') {
      const conId = params.length > 0;
      const conBody = ['POST', 'PUT', 'PATCH'].includes(M) && op.requestBody;
      const multipart = Object.keys(op.requestBody?.content ?? {}).some((c) => c.startsWith('multipart'));
      let esperado = conBody && !conId ? [400] : conId ? [400, 404] : [400, 404, 409, 415];
      if (sinAdmin.has(clave)) esperado = [403]; // solo Campo: con admin el error verificable es el 403
      // ValidationPipe (forbidNonWhitelisted) => 400 aunque el id no exista
      const body = conBody && !multipart
        ? { body: { mode: 'raw', raw: '{"propiedadNoDeclarada": true}', options: { raw: { language: 'json' } } } }
        : { body: undefined };
      const q = (op.parameters ?? []).filter((p) => p.in === 'query' && p.required);
      // un GET sin id ni query requerido no tiene error propio: se fuerza con un query inválido
      let url = urlCon(() => FAKE);
      let pre = [];
      if (M === 'GET' && !conId && !q.length) {
        const pag = (op.parameters ?? []).some((p) => p.name === 'pageSize' || p.$ref?.includes('pageSize'));
        if (!pag) continue; // sin id, sin query y sin paginación: no hay forma natural de errar
        url = { ...url, raw: `${url.raw}?page=0`, query: [{ key: 'page', value: '0' }] };
        mk('400 query invalida', {
          url, bearer: publico ? null : 'token', body,
          tests: test([`pm.test('status 400', () => pm.response.to.have.status(400));`]),
        });
        continue;
      }
      mk(`${esperado.join('/')} id inexistente o cuerpo invalido`, {
        url, pre, body, bearer: publico ? null : 'token',
        tests: test([
          `pm.test('status ${esperado.join(' o ')}', () => pm.expect(pm.response.code).to.be.oneOf(${lit(esperado)}));`,
          `pm.test('error con statusCode y message', () => { const j = pm.response.json(); pm.expect(j).to.have.property('statusCode'); pm.expect(j).to.have.property('message'); });`,
        ]),
      });
    }
  }
}

const coleccion = {
  info: {
    name: 'M6 Ambiente, Higiene y Servicios Urbanos',
    description: 'Generada por scripts/build-postman-collection.mjs desde docs/api/openapi.json. No editar a mano.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [{ key: 'baseUrl', value: 'http://localhost:3000' }],
  auth: auth('token'),
  item: [...carpetas.entries()].map(([name, item]) => ({ name, item })),
};
writeFileSync('test/api/m6.postman_collection.json', JSON.stringify(coleccion, null, 2) + '\n');

const total = Object.values(spec.paths).reduce((n, o) => n + Object.keys(o).length, 0);
writeFileSync(
  'test/api/PENDIENTES.md',
  `# Endpoints sin caso de éxito en la colección Postman

Generado por \`npm run api:collection\`. Todos tienen caso de error (401/403/400/404 según corresponda);
${conExito.size} de ${total} tienen además caso de éxito. Los ${pendientes.length} de abajo no, y por qué:

| Endpoint | Motivo |
|---|---|
${pendientes.map(([e, m]) => `| \`${e}\` | ${m} |`).join('\n')}

## Hallazgos de Schemathesis

Defectos reales del backend frente a \`docs/api/openapi.json\` (corrida local, solo GET, #572). No se arreglan en esta rama.

- **H-1, 400 no declarado:** más de 40 GET devuelven un 400 del \`ValidationPipe\` (query o parámetro inválido, propiedad no declarada) que el OpenAPI no lista (ST103). Ejemplo: \`GET /containers\` documenta 200/401/403/500. Por eso \`status_code_conformance\` corre como step informativo en \`api-tests.yml\`.
- **H-2, 503 en \`GET /neighborhoods\` (resuelto, #594):** el CI y el compose cargan el catálogo local \`prisma/data/m9-barrios.json\` con \`NEIGHBORHOODS_CATALOG_FILE\`; en producción sigue siendo 503 sin el catálogo real de M9.
`,
);
console.log(`${casos} casos; éxito en ${conExito.size}/${total}; pendientes ${pendientes.length}`);
