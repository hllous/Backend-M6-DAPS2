import { createHmac } from "node:crypto";

const secret = process.argv[2] ?? process.env.JWT_SECRET;
if (!secret) {
  console.error("Uso: node scripts/generate-demo-jwt.mjs <JWT_SECRET>");
  process.exit(1);
}

const base64url = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

const header = { alg: "HS256", typ: "JWT" };
const payload = {
  sub: "user-demo",
  roles: ["ADMIN"],
  exp: Math.floor(Date.now() / 1000) + 31536000,
};

const unsigned = `${base64url(header)}.${base64url(payload)}`;
const signature = createHmac("sha256", secret)
  .update(unsigned)
  .digest("base64url");

console.log(`${unsigned}.${signature}`);
