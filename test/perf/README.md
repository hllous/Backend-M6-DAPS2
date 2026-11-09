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

## Rate limit (#568)

El backend aplica un límite global de 600 req/min por IP y por endpoint (`THROTTLE_LIMIT`, `THROTTLE_TTL_MS`). Esta prueba hace ~50 req/s por endpoint desde una sola IP, así que recibiría 429 y rompería el umbral de error `< 1%`.

- Backend local o de pruebas: arrancarlo con `THROTTLE_LIMIT=100000` (solo para la prueba).
- Despliegue real: coordinarlo con el equipo antes; el límite protege producción y no se sube sin acordarlo.

## Resultados (09/11/2026)

Corrida de 5 min, 50 usuarios concurrentes, sobre la rama de integración (commit `6bd08f6`, el contenido que entra a `develop`). Salida completa en `resultados/2026-11-09/k6-completa.txt` y métricas en `resultados/2026-11-09/k6-summary-completa.json`.

| Métrica | Resultado | Umbral |
|---|---|---|
| `http_req_duration` p(95) | **32,84 ms** | < 500 ms: cumple |
| `http_req_failed` | **0,00 %** (0 de 14 850) | < 1 %: cumple |
| Requests | 14 850 (49,1 por segundo) | — |
| Promedio / mediana / p(90) / máximo | 14,97 / 11,11 / 23,95 / 441,21 ms | — |
| Checks (`GET /services`, `/containers`, `/zones` con 200) | 100 % | — |

**Cómo se midió (límites).** Todo en una sola máquina local (6 CPUs): backend, Postgres y RabbitMQ con `docker compose up`, y k6 con `docker run grafana/k6` en el mismo equipo. Base del seed de demo (673 servicios, 500 contenedores, 48 zonas). `THROTTLE_LIMIT=100000` en el backend (ver "Rate limit"); un token firmado con el `JWT_SECRET` del `.env` (`test/api/make-token.mjs admin`). Cada usuario hace una pausa de 1 s entre pedidos, con `pageSize=20`. **No mide el despliegue** (Render y Supabase, con red de por medio): la latencia allí va a ser mayor. Solo lectura: no se midieron escrituras.
