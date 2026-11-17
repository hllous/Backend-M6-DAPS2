#!/usr/bin/env node
// Guion de la demo de seguridad en vivo (#696): los mismos casos que
// test/security-live.e2e-spec.ts, contra una URL base cualquiera (local o Render).
//
//   node scripts/security-live.mjs [--base-url URL] [--writes]
//
// Variables:
//   BASE_URL     URL base (default http://localhost:3000). --base-url la pisa.
//   JWT_SECRET   Secreto de M1 en base64. Sin él solo corren los casos sin token
//                válido (JWT trucho, cabeceras, CORS, errores); el resto sale SALTEADO.
//   JWT_ISSUER   Emisor esperado (default modulo1-ciudadanos).
//
// Usuarios: los del seed de demo (docs/seed.md): 10000 admin, 10002 operaciones,
// 10007 auditor, 10010 integrante de la cuadrilla de Belgrano.
//
// Nunca deja cambios si la API se comporta bien: todo caso que escribe espera un
// 400/401/403. La excepción es el XSS guardado, que crea un expediente: solo
// corre con --writes. Sale con código 1 si algún caso falla.
//
// Ningún token ni secreto se imprime.
import { createHmac, randomBytes, randomUUID } from 'node:crypto';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
if (flag('--help') || flag('-h')) {
  console.log(
    'Uso: node scripts/security-live.mjs [--base-url URL] [--writes]  (ver docs/testing.md)',
  );
  process.exit(0);
}

const BASE = (opt('--base-url') ?? process.env.BASE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);
const SECRET = process.env.JWT_SECRET ? Buffer.from(process.env.JWT_SECRET, 'base64') : undefined;
const ISSUER = process.env.JWT_ISSUER ?? 'modulo1-ciudadanos';
const WRITES = flag('--writes');
const EVIL = 'https://evil.example';

const USERS = {
  admin: { sub: '10000', rol: 'RESPONSABLE_AREA' },
  operaciones: { sub: '10002', rol: 'ADMINISTRATIVO' },
  auditor: { sub: '10007', rol: 'AUDITOR' },
  cuadrilla: { sub: '10010', rol: 'ADMINISTRATIVO' },
  ciudadano: { sub: '777', rol: 'CIUDADANO', sub_type: 'CIUDADANO' },
};

// ─── JWT ──────────────────────────────────────────────
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
function claims(user = USERS.admin, extra = {}) {
  return {
    sub_type: 'EMPLEADO',
    typ: 'access',
    iss: ISSUER,
    iat: now(),
    exp: now() + 900,
    ...user,
    ...extra,
  };
}
function sign(payload, { alg = 'HS256', key = SECRET } = {}) {
  const body = `${b64({ alg, typ: 'JWT' })}.${b64(payload)}`;
  if (alg === 'none') return `${body}.`;
  return `${body}.${createHmac('sha256', key).update(body).digest('base64url')}`;
}
const tokenOf = (name, extra) => sign(claims(USERS[name], extra));
const otherKey = randomBytes(32);

// ─── HTTP ─────────────────────────────────────────────
async function call(method, path, { token, body, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  if (body !== undefined || raw !== undefined) h['Content-Type'] = 'application/json';
  // Render duerme: el primer pedido puede tardar ~1 min.
  const res = await fetch(BASE + path, {
    method,
    headers: h,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    redirect: 'manual',
    signal: AbortSignal.timeout(90_000),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, headers: res.headers, text, json };
}

const STACK = /\bat [\w.<>]+ \(|node_modules|[A-Z]:\\|\/src\/|"stack"/i;
/** Un error bien formado: Problem Details y sin stack. El traceId (DEF-19) tiene su propio caso, al final. */
function errorLimpio(r) {
  const tipo = r.headers.get('content-type') ?? '';
  const problemas = [];
  if (!tipo.startsWith('application/problem+json')) problemas.push(`content-type ${tipo || '—'}`);
  if (STACK.test(r.text)) problemas.push('stack o ruta interna en el cuerpo');
  return problemas;
}

// ─── Casos ────────────────────────────────────────────
const results = [];
const cases = [];
function caso(grupo, nombre, esperado, fn, { needsSecret = false, needsWrites = false } = {}) {
  cases.push({ grupo, nombre, esperado, fn, needsSecret, needsWrites });
}
/** Para los casos que esperan un status puntual y un error limpio. */
const espera = (status, extra) => async (r) => {
  const p = r.status === status ? [] : [`status ${r.status}`];
  if (r.status >= 400) p.push(...errorLimpio(r));
  if (extra) p.push(...((await extra(r)) ?? []));
  return { obtenido: `${r.status}${r.json?.code ? ` ${r.json.code}` : ''}`, problemas: p };
};

// 1. JWT inválido → 401
caso('JWT', 'sin token', '401', async () => espera(401)(await call('GET', '/zones')));
caso('JWT', 'alg=none', '401', async () =>
  espera(401)(await call('GET', '/zones', { token: sign(claims(), { alg: 'none' }) })),
);
caso('JWT', 'firmado con otra clave', '401', async () =>
  espera(401)(await call('GET', '/zones', { token: sign(claims(), { key: otherKey }) })),
);
caso('JWT', 'payload editado (firma vieja)', '401', async () => {
  const [h, , s] = sign(claims(USERS.cuadrilla), { key: SECRET ?? otherKey }).split('.');
  return espera(401)(await call('GET', '/zones', { token: `${h}.${b64(claims())}.${s}` }));
});
caso('JWT', 'basura', '401', async () =>
  espera(401)(await call('GET', '/zones', { token: 'no.es.jwt' })),
);
caso(
  'JWT',
  'control: token válido entra',
  '200',
  async () => espera(200)(await call('GET', '/zones', { token: tokenOf('admin') })),
  { needsSecret: true },
);
caso(
  'JWT',
  'vencido',
  '401',
  async () =>
    espera(401)(
      await call('GET', '/zones', {
        token: tokenOf('admin', { iat: now() - 3600, exp: now() - 60 }),
      }),
    ),
  { needsSecret: true },
);
caso(
  'JWT',
  'otro emisor (iss)',
  '401',
  async () =>
    espera(401)(await call('GET', '/zones', { token: tokenOf('admin', { iss: 'emisor-falso' }) })),
  { needsSecret: true },
);
caso(
  'JWT',
  'typ=refresh',
  '401',
  async () =>
    espera(401)(await call('GET', '/zones', { token: tokenOf('admin', { typ: 'refresh' }) })),
  { needsSecret: true },
);
caso(
  'JWT',
  'sin exp',
  '401',
  async () =>
    espera(401)(await call('GET', '/zones', { token: tokenOf('admin', { exp: undefined }) })),
  { needsSecret: true },
);

// 2. BFLA → 403
const sinRol = (r) =>
  /M6_(ADMIN|OFICINA|CAMPO|AUDITOR)/.test(r.text) ? ['el 403 revela el rol'] : [];
caso(
  'BFLA',
  'auditor crea una zona',
  '403',
  async () =>
    espera(403, sinRol)(await call('POST', '/zones', { token: tokenOf('auditor'), body: {} })),
  { needsSecret: true },
);
caso(
  'BFLA',
  'cuadrilla se asigna M6_ADMIN',
  '403',
  async () =>
    espera(
      403,
      sinRol,
    )(
      await call('PUT', `/role-assignments/${USERS.cuadrilla.sub}`, {
        token: tokenOf('cuadrilla'),
        body: { roles: ['M6_ADMIN'] },
      }),
    ),
  { needsSecret: true },
);
caso(
  'BFLA',
  'operaciones lista roles',
  '403',
  async () =>
    espera(403, sinRol)(await call('GET', '/role-assignments', { token: tokenOf('operaciones') })),
  { needsSecret: true },
);
caso(
  'BFLA',
  'ciudadano lee servicios',
  '403',
  async () => espera(403, sinRol)(await call('GET', '/services', { token: tokenOf('ciudadano') })),
  { needsSecret: true },
);

// 3. BOLA → 403 NOT_ASSIGNED, nunca el dato
let ajeno; // un servicio de otra cuadrilla, para BOLA y mass assignment
async function servicioAjeno() {
  if (ajeno !== undefined) return ajeno;
  const me = await call('GET', '/me', { token: tokenOf('cuadrilla') });
  const mias = new Set((me.json?.crews ?? []).map((c) => c.id));
  for (const status of ['SCHEDULED', 'IN_PROGRESS']) {
    const l = await call('GET', `/services?status=${status}&pageSize=100`, {
      token: tokenOf('admin'),
    });
    const s = (l.json?.data ?? []).find((x) => x.crewId && !mias.has(x.crewId));
    if (s) return (ajeno = s);
  }
  return (ajeno = null);
}
const sinServicio = {
  obtenido: '—',
  problemas: ['no hay un servicio de otra cuadrilla en la base'],
};
caso(
  'BOLA',
  'integrante lee evidencia de otra cuadrilla',
  '403 NOT_ASSIGNED',
  async () => {
    const s = await servicioAjeno();
    if (!s) return sinServicio;
    const r = await call('GET', `/evidence?ownerType=SERVICE&ownerId=${s.id}`, {
      token: tokenOf('cuadrilla'),
    });
    return espera(403, (x) => [
      ...(x.json?.code === 'NOT_ASSIGNED' ? [] : ['sin code NOT_ASSIGNED']),
      ...(/https?:\/\/[^"]*\.(jpe?g|png|pdf)/i.test(x.text) ? ['devolvió URLs de evidencia'] : []),
    ])(r);
  },
  { needsSecret: true },
);
caso(
  'BOLA',
  'integrante opera un servicio de otra cuadrilla',
  '403 NOT_ASSIGNED, sin cambio',
  async () => {
    const s = await servicioAjeno();
    if (!s) return sinServicio;
    const accion = s.status === 'SCHEDULED' ? 'start' : 'suspend';
    const r = await call('POST', `/services/${s.id}/${accion}`, {
      token: tokenOf('cuadrilla'),
      body: accion === 'suspend' ? { reason: 'prueba de seguridad' } : undefined,
    });
    const despues = await call('GET', `/services/${s.id}`, { token: tokenOf('admin') });
    return espera(403, () =>
      despues.json?.status === s.status ? [] : [`el servicio pasó a ${despues.json?.status}`],
    )(r);
  },
  { needsSecret: true },
);
caso(
  'BOLA',
  '/me ignora un userId ajeno en la query',
  '200 con el propio',
  async () => {
    const r = await call('GET', `/me?userId=${USERS.admin.sub}`, { token: tokenOf('cuadrilla') });
    return {
      obtenido: `${r.status} userId=${r.json?.userId}`,
      problemas: r.json?.userId === USERS.cuadrilla.sub ? [] : ['devolvió otra identidad'],
    };
  },
  { needsSecret: true },
);

// 4. Mass assignment → 400, nada persistido
caso(
  'Mass assignment',
  'POST /zones con id, createdAt y role',
  '400',
  async () => {
    const code = `SEC-${randomUUID().slice(0, 8)}`;
    const r = await call('POST', '/zones', {
      token: tokenOf('admin'),
      body: { code, name: 'x', id: randomUUID(), createdAt: '2000-01-01', role: 'M6_ADMIN' },
    });
    const busca = await call('GET', `/zones?search=${code}`, { token: tokenOf('admin') });
    return espera(400, () => ((busca.json?.data ?? []).length ? ['la zona quedó creada'] : []))(r);
  },
  { needsSecret: true },
);
caso(
  'Mass assignment',
  'PATCH /services/:id con status e id',
  '400, sin cambio',
  async () => {
    const s = await servicioAjeno();
    if (!s) return sinServicio;
    const r = await call('PATCH', `/services/${s.id}`, {
      token: tokenOf('admin'),
      body: { status: 'CANCELLED', id: randomUUID() },
    });
    const despues = await call('GET', `/services/${s.id}`, { token: tokenOf('admin') });
    return espera(400, () =>
      despues.json?.status === s.status ? [] : [`el servicio pasó a ${despues.json?.status}`],
    )(r);
  },
  { needsSecret: true },
);

// 5. Inyección
caso(
  'Inyección',
  "SQL en el id: /services/' OR '1'='1",
  '400',
  async () =>
    espera(400)(
      await call('GET', `/services/${encodeURIComponent("' OR '1'='1")}`, {
        token: tokenOf('admin'),
      }),
    ),
  { needsSecret: true },
);
caso(
  'Inyección',
  "SQL en el filtro: ?search=' OR 1=1--",
  '200 y 0 filas',
  async () => {
    const r = await call('GET', `/zones?search=${encodeURIComponent("' OR 1=1--")}`, {
      token: tokenOf('admin'),
    });
    const n = r.json?.data?.length;
    return {
      obtenido: `${r.status}, ${n ?? '?'} filas`,
      problemas: r.status === 200 && n === 0 ? [] : ['devolvió filas o falló'],
    };
  },
  { needsSecret: true },
);
caso(
  'Inyección',
  'NoSQL: {"code": {"$gt": ""}}',
  '400',
  async () =>
    espera(400)(
      await call('POST', '/zones', {
        token: tokenOf('admin'),
        body: { code: { $gt: '' }, name: { $ne: null } },
      }),
    ),
  { needsSecret: true },
);
caso(
  'Inyección',
  'XSS guardado literal, servido como JSON',
  '201 y mismo texto',
  async () => {
    const xss = '<script>alert(1)</script>';
    const r = await call('POST', '/environmental-reports', {
      token: tokenOf('admin'),
      body: { reportType: 'NOISE', description: xss },
    });
    if (r.status !== 201) return { obtenido: String(r.status), problemas: ['no se creó'] };
    const leido = await call('GET', `/environmental-reports/${r.json.id}`, {
      token: tokenOf('admin'),
    });
    const p = [];
    if (leido.json?.description !== xss) p.push('el texto cambió');
    if (!(leido.headers.get('content-type') ?? '').startsWith('application/json'))
      p.push('no es JSON');
    if (!(leido.headers.get('content-security-policy') ?? '').includes("default-src 'none'"))
      p.push('sin CSP');
    return { obtenido: `201, expediente ${r.json.id}`, problemas: p };
  },
  { needsSecret: true, needsWrites: true },
);

// 6. Cabeceras y CORS
caso(
  'Cabeceras',
  'API: CSP, nosniff, DENY, HSTS (https), sin X-Powered-By',
  'presentes',
  async () => {
    const r = await call('GET', '/zones');
    const h = (n) => r.headers.get(n);
    const p = [];
    if (h('content-security-policy') !== "default-src 'none'; frame-ancestors 'none'")
      p.push(`CSP ${h('content-security-policy')}`);
    if (h('x-content-type-options') !== 'nosniff') p.push('sin nosniff');
    if (h('x-frame-options') !== 'DENY') p.push('sin X-Frame-Options');
    if (BASE.startsWith('https://') && !/max-age=\d+/.test(h('strict-transport-security') ?? ''))
      p.push('sin HSTS');
    if (h('x-powered-by')) p.push(`X-Powered-By ${h('x-powered-by')}`);
    return { obtenido: p.length ? 'faltan' : 'todas', problemas: p };
  },
);
caso('Cabeceras', '/api/docs con CSP propia (Swagger UI)', "200, script-src 'self'", async () => {
  const r = await call('GET', '/api/docs');
  const csp = r.headers.get('content-security-policy') ?? '';
  const p = [];
  if (r.status !== 200) p.push(`status ${r.status}`);
  if (!csp.includes("script-src 'self'")) p.push(`CSP ${csp || 'ausente'}`);
  if (csp.includes('unsafe-eval')) p.push('permite eval');
  return { obtenido: `${r.status}, ${csp ? 'con CSP' : 'sin CSP'}`, problemas: p };
});
caso(
  'CORS',
  'preflight desde un origen ajeno',
  'sin ACAO del ajeno, sin credenciales',
  async () => {
    const r = await call('OPTIONS', '/zones', {
      headers: { Origin: EVIL, 'Access-Control-Request-Method': 'GET' },
    });
    const acao = r.headers.get('access-control-allow-origin');
    const acac = r.headers.get('access-control-allow-credentials');
    const p = [];
    if (acac === 'true') p.push('Allow-Credentials: true');
    if (acao === EVIL) p.push('refleja el origen ajeno');
    return { obtenido: `ACAO=${acao ?? '—'} ACAC=${acac ?? '—'}`, problemas: p };
  },
);

// 7. Errores
caso('Errores', 'ruta inexistente', '404 Problem Details sin stack', async () =>
  espera(404)(await call('GET', '/no-existe-sec')),
);
caso('Errores', 'JSON mal formado', '400 sin stack', async () =>
  espera(400)(await call('POST', '/zones', { raw: '{"code": "x",' })),
);
caso('Errores', 'path sin query sensible', 'path=/zones', async () => {
  const r = await call('GET', '/zones?access_token=TOKEN-DE-PRUEBA');
  const p = errorLimpio(r);
  if (r.json?.path !== '/zones') p.push(`path ${r.json?.path}`);
  if (r.text.includes('TOKEN-DE-PRUEBA')) p.push('el token vuelve en la respuesta');
  return { obtenido: `${r.status} path=${r.json?.path}`, problemas: p };
});
caso('Errores', 'traceId del cuerpo = header X-Request-Id', 'iguales', async () => {
  const r = await call('GET', '/zones');
  const h = r.headers.get('x-request-id');
  return {
    obtenido: `${r.json?.traceId ?? '—'}`,
    problemas: h && h === r.json?.traceId ? [] : [`header ${h ?? '—'}`],
  };
});

// ─── Corrida ──────────────────────────────────────────
console.log(
  `Seguridad en vivo contra ${BASE}${SECRET ? '' : ' (sin JWT_SECRET: casos con token válido salteados)'}${WRITES ? ' [--writes]' : ''}\n`,
);
for (const c of cases) {
  if (c.needsSecret && !SECRET) {
    results.push({ ...c, obtenido: '—', estado: 'SALTEADO' });
    continue;
  }
  if (c.needsWrites && !WRITES) {
    results.push({ ...c, obtenido: '—', estado: 'SALTEADO (--writes)' });
    continue;
  }
  try {
    const { obtenido, problemas } = await c.fn();
    results.push({
      ...c,
      obtenido: problemas.length ? `${obtenido} (${problemas.join('; ')})` : obtenido,
      estado: problemas.length ? 'FALLA' : 'OK',
    });
  } catch (e) {
    results.push({ ...c, obtenido: `error: ${e.message}`, estado: 'FALLA' });
  }
}

const cols = ['grupo', 'nombre', 'esperado', 'obtenido', 'estado'];
const titulos = {
  grupo: 'Grupo',
  nombre: 'Caso',
  esperado: 'Esperado',
  obtenido: 'Obtenido',
  estado: 'Resultado',
};
const ancho = Object.fromEntries(
  cols.map((k) => [
    k,
    Math.min(
      k === 'obtenido' ? 90 : 48,
      Math.max(titulos[k].length, ...results.map((r) => String(r[k]).length)),
    ),
  ]),
);
const fila = (r) => cols.map((k) => String(r[k]).slice(0, ancho[k]).padEnd(ancho[k])).join(' | ');
console.log(fila(titulos));
console.log(cols.map((k) => '-'.repeat(ancho[k])).join('-|-'));
for (const r of results) console.log(fila(r));

const n = (e) => results.filter((r) => r.estado.startsWith(e)).length;
console.log(`\nOK ${n('OK')} · FALLA ${n('FALLA')} · SALTEADO ${n('SALTEADO')}`);
process.exit(n('FALLA') ? 1 : 0);
