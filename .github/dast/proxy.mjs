// Proxy de registro para el escaneo activo (dast.yml, #659): reenvía todo al backend y deja
// una línea por pedido con el código de respuesta y si llegó un Authorization. Es la
// evidencia de que ZAP llega autenticado (y de qué responde el negocio), que ZAP no entrega.
// Uso: node proxy.mjs <puerto-escucha> <puerto-backend> <archivo-log>
import { createServer, request } from 'node:http';
import { appendFileSync } from 'node:fs';

const [listen, target, logFile] = process.argv.slice(2);

createServer((req, res) => {
  const up = request(
    { host: 'localhost', port: Number(target), method: req.method, path: req.url, headers: req.headers },
    (r) => {
      const auth = req.headers.authorization ?? '';
      // Solo el esquema y el largo: nunca el token.
      const a = auth ? `${auth.split(' ')[0]}(${auth.length})` : '-';
      const path = (req.url ?? '').split('?')[0];
      appendFileSync(logFile, `${req.method} ${path} ${r.statusCode} auth=${a}\n`);
      res.writeHead(r.statusCode ?? 502, r.headers);
      r.pipe(res);
    },
  );
  up.on('error', () => {
    appendFileSync(logFile, `${req.method} ${req.url} 502 auth=-\n`);
    res.writeHead(502).end();
  });
  req.pipe(up);
}).listen(Number(listen)); // sin host: escucha en IPv4 e IPv6 (localhost puede resolver a ::1)
