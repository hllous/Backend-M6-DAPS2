// Firma un access token de prueba (HS256, como el de M1) con el JWT_SECRET del entorno.
// Uso: JWT_SECRET=<base64> node test/api/make-token.mjs [admin|auditor]
// No hay tokens ni secretos en el repo: el secreto lo declara quien corre (CI o local).
import { createHmac } from 'node:crypto';

// Ids y roles del seed de demo (prisma/seed.ts): 10000 = M6_ADMIN, 10007 = M6_AUDITOR.
const PERFILES = {
  admin: { sub: '10000', rol: 'RESPONSABLE_AREA' },
  auditor: { sub: '10007', rol: 'AUDITOR' },
};

const perfil = PERFILES[process.argv[2] ?? 'admin'];
if (!perfil) throw new Error(`Perfil desconocido: ${process.argv[2]} (admin|auditor)`);
const secret = process.env.JWT_SECRET;
if (!secret) throw new Error('Falta JWT_SECRET');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const head = b64({ alg: 'HS256', typ: 'JWT' });
const body = b64({
  ...perfil,
  sub_type: 'EMPLEADO',
  typ: 'access',
  iss: process.env.JWT_ISSUER ?? 'modulo1-ciudadanos',
  iat: now,
  exp: now + 3600,
});
// Como M1: la clave se usa decodificada de base64.
const sig = createHmac('sha256', Buffer.from(secret, 'base64')).update(`${head}.${body}`).digest('base64url');
process.stdout.write(`${head}.${body}.${sig}`);
