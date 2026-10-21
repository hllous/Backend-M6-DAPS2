// Firma un access token con el contrato de M1 (HS256, clave en base64, iss, typ, rol).
// Uso: node scripts/generate-demo-jwt.mjs <JWT_SECRET en base64> [ROL]
import { createHmac } from "node:crypto";

const secret = process.argv[2] ?? process.env.JWT_SECRET;
if (!secret) {
  console.error("Uso: node scripts/generate-demo-jwt.mjs <JWT_SECRET base64> [ROL]");
  process.exit(1);
}
const rol = process.argv[3] ?? "ADMINISTRATIVO";

const base64url = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const now = Math.floor(Date.now() / 1000);
const header = { alg: "HS256", typ: "JWT" };
const payload = {
  iss: process.env.JWT_ISSUER ?? "modulo1-ciudadanos",
  sub: "1",
  sub_type: rol === "CIUDADANO" ? "CIUDADANO" : "EMPLEADO",
  rol,
  typ: "access",
  iat: now,
  // Como M1: 15 min. Para una demo larga, regenerar el token.
  exp: now + 900,
};

const unsigned = `${base64url(header)}.${base64url(payload)}`;
// La clave de M1 se usa decodificada de base64.
const signature = createHmac("sha256", Buffer.from(secret, "base64"))
  .update(unsigned)
  .digest("base64url");

console.log(`${unsigned}.${signature}`);
