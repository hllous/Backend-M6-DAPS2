// Proxy de registro para el escaneo activo (dast.yml, #659): reenvía todo al backend efímero y
// deja una línea por pedido con el código de respuesta y si llegó un Authorization. Es la
// evidencia de que ZAP llega autenticado (y de qué responde el negocio), que ZAP no entrega.
//
// Endurecido a propósito (Sonar jssecurity):
//   - destino FIJO: 127.0.0.1 y el puerto del backend, que viene de la línea de comandos del
//     workflow y se valida; nunca sale de la request (sin SSRF);
//   - solo se reenvía un path relativo validado: se rechaza todo lo que no empiece con una
//     sola "/" (URLs absolutas, "//host", esquemas, backslashes);
//   - los headers van por lista blanca y a objetos sin prototipo (sin prototype pollution);
//   - un `Location` de la respuesta solo pasa si es un path relativo del mismo host: nunca se
//     redirige a otro host.
// Uso: node proxy.mjs <puerto-escucha> <puerto-backend> <archivo-log>
import { createServer, request } from 'node:http';
import { appendFileSync } from 'node:fs';

const [listenArg, targetArg, logFile] = process.argv.slice(2);
const listenPort = Number(listenArg);
const targetPort = Number(targetArg);
for (const p of [listenPort, targetPort]) {
  if (!Number.isInteger(p) || p < 1 || p > 65535) throw new Error(`Puerto inválido: ${p}`);
}
if (!logFile) throw new Error('Falta el archivo de log');

const TARGET_HOST = '127.0.0.1';

// Path relativo seguro: empieza con una sola "/", sin "\", sin caracteres de control y sin
// esquema ni authority escondidos.
const SAFE_PATH = /^\/(?![/\\])[^\\\u0000-\u001f\u007f\s]*$/;

// Headers de pedido que se reenvían al backend.
const REQUEST_HEADERS = new Set([
  'accept',
  'accept-language',
  'authorization',
  'content-type',
  'content-length',
  'if-match',
  'if-none-match',
  'idempotency-key',
  'user-agent',
  'x-forwarded-for',
  'x-m6-bff-key',
]);

// Headers de respuesta que se devuelven a ZAP (sin `location`: se trata aparte).
const RESPONSE_HEADERS = new Set([
  'content-type',
  'content-length',
  'content-security-policy',
  'etag',
  'cache-control',
  'retry-after',
  'idempotency-replayed',
  'x-content-type-options',
  'x-frame-options',
  'referrer-policy',
  'cross-origin-resource-policy',
  'strict-transport-security',
  'access-control-allow-origin',
  'access-control-expose-headers',
  'vary',
]);

function pick(source, allowed) {
  const out = Object.create(null);
  for (const [k, v] of Object.entries(source)) {
    if (allowed.has(k.toLowerCase()) && v !== undefined) out[k.toLowerCase()] = v;
  }
  return out;
}

createServer((req, res) => {
  const method = String(req.method ?? 'GET').toUpperCase();
  const target = req.url ?? '';
  if (!/^[A-Z]{3,7}$/.test(method) || !SAFE_PATH.test(target)) {
    appendFileSync(logFile, `${method} - 400 auth=-\n`);
    res.writeHead(400).end();
    return;
  }

  const upstream = request(
    { host: TARGET_HOST, port: targetPort, method, path: target, headers: pick(req.headers, REQUEST_HEADERS) },
    (r) => {
      const auth = typeof req.headers.authorization === 'string' ? req.headers.authorization : '';
      // Solo el esquema y el largo: nunca el token.
      const a = auth ? `${auth.split(' ')[0]}(${auth.length})` : '-';
      const status = r.statusCode ?? 502;
      appendFileSync(logFile, `${method} ${target.split('?')[0]} ${status} auth=${a}\n`);

      const headers = pick(r.headers, RESPONSE_HEADERS);
      const location = r.headers.location;
      // Redirección: solo un path relativo del mismo host; si no, se descarta.
      if (typeof location === 'string' && SAFE_PATH.test(location)) headers.location = location;
      res.writeHead(status, headers);
      r.pipe(res);
    },
  );
  upstream.on('error', () => {
    appendFileSync(logFile, `${method} ${target.split('?')[0]} 502 auth=-\n`);
    res.writeHead(502).end();
  });
  req.pipe(upstream);
}).listen(listenPort); // sin host: IPv4 e IPv6 (localhost puede resolver a ::1 en el contenedor de ZAP)
