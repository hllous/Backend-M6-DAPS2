# Prueba de carga (k6)

`k6-criticos.js`: 50 VUs durante 5 min contra `GET /services`, `/containers` y `/zones` (autenticados, solo lectura).
Thresholds: `p(95) < 500 ms` y errores `< 1%`. No corre en el CI; la ejecuta el equipo contra el despliegue o el compose.

## Token de prueba

Hace falta un JWT válido de M1 cuyo usuario tenga rol de M6 (cualquiera sirve para estos GET). Opciones:

- Despliegue: loguearse en M1 con una cuenta que tenga rol asignado y copiar el access token (dura poco: para 5 min usar uno recién emitido).
- Local/compose: firmarlo con el `JWT_SECRET` de tu `.env` (HS256, `iss` = `JWT_ISSUER`) con claims `{ sub: "9001", sub_type: "EMPLEADO", rol: "RESPONSABLE_AREA", typ: "access" }` y `expiresIn: 15m`, y asignarle rol en `user_role_assignment` (como en `test/helpers.ts`). Con `npm run prisma:seed` hay usuarios de demo (ver `docs/seed.md`).

## Correr

```bash
# k6 instalado
k6 run -e BASE_URL=http://localhost:3000 -e TOKEN=$TOKEN --summary-export=reports/k6-summary.json test/perf/k6-criticos.js

# o con Docker (en Windows/Mac usar host.docker.internal en lugar de localhost)
docker run --rm -i -v "$PWD:/w" -w /w -e BASE_URL=http://host.docker.internal:3000 -e TOKEN=$TOKEN \
  grafana/k6 run --summary-export=reports/k6-summary.json test/perf/k6-criticos.js
```

Humo de 30 s: agregar `-e DURATION=30s`. `VUS` también es variable. `reports/` está en `.gitignore`.
