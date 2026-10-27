// Firma un access token con el contrato de M1 (HS256, clave en base64, iss, typ, rol).
// Uso: node scripts/generate-demo-jwt.mjs <JWT_SECRET en base64> [ROL] [SUB] [HASTA AAAA-MM-DD]
// Para el token de demo del administrador inicial: ROL = RESPONSABLE_AREA y SUB = el
// user_id de M1 cargado en M6_BOOTSTRAP_ADMIN_USER_IDS.
import { createHmac } from "node:crypto";

const secret = process.argv[2] ?? process.env.JWT_SECRET;
if (!secret) {
  console.error("Uso: node scripts/generate-demo-jwt.mjs <JWT_SECRET base64> [ROL] [SUB numérico]");
  process.exit(1);
}
const rol = process.argv[3] ?? "ADMINISTRATIVO";
const sub = process.argv[4] ?? "1";
if (!/^\d{1,19}$/.test(sub)) {
  console.error("El SUB tiene que ser un id numérico de M1 (solo dígitos)");
  process.exit(1);
}

// Como M1: 15 min, salvo que se pase una fecha límite (AAAA-MM-DD, fin de ese día UTC).
const now = Math.floor(Date.now() / 1000);
const hasta = process.argv[5];
const exp = hasta ? Math.floor(Date.parse(`${hasta}T23:59:59Z`) / 1000) : now + 900;
if (!Number.isFinite(exp) || exp <= now) {
  console.error("La fecha límite tiene que ser AAAA-MM-DD y estar en el futuro");
  process.exit(1);
}

const base64url = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const header = { alg: "HS256", typ: "JWT" };
const payload = {
  iss: process.env.JWT_ISSUER ?? "modulo1-ciudadanos",
  sub,
  sub_type: rol === "CIUDADANO" ? "CIUDADANO" : "EMPLEADO",
  rol,
  typ: "access",
  iat: now,
  exp,
};

const unsigned = `${base64url(header)}.${base64url(payload)}`;
// La clave de M1 se usa decodificada de base64.
const signature = createHmac("sha256", Buffer.from(secret, "base64"))
  .update(unsigned)
  .digest("base64url");

console.log(`${unsigned}.${signature}`);
