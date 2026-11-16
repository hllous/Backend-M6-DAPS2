# ──────────────────────────────────────────────────────────────
# Frontend M6 para la demo local (docker-compose.yml, criterio G1, #698).
#
# El código no está acá: llega por el contexto con nombre `frontend`, que el
# compose apunta al repo hllous/Frontend-M6-DAPS2 en FRONTEND_REF. La misma imagen
# sirve al M1 falso (`node scripts/fake-m1.mjs`).
#
# Corre `next dev` y no el build standalone del Dockerfile del frontend: un build de
# producción fija NODE_ENV=production, y con eso el BFF rechaza (a propósito) un
# M1_BASE_URL de loopback y el M1 falso. Solo para la demo local, nunca para desplegar.
# ──────────────────────────────────────────────────────────────

# Node 22: la versión que fija el frontend (engines y su propio Dockerfile).
FROM node:22-alpine

ENV NEXT_TELEMETRY_DISABLED=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    CI=true

# pnpm sale de corepack, en la versión de packageManager del frontend.
RUN corepack enable

WORKDIR /app
# Usuario no root (Trivy DS-0002): next dev escribe .next/ dentro de /app.
RUN chown node:node /app
USER node

# Primero los manifiestos, para reutilizar la capa de dependencias entre builds.
COPY --from=frontend --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY --from=frontend --chown=node:node . .

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=10s --start-period=60s --retries=30 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "node_modules/next/dist/bin/next", "dev", "--hostname", "0.0.0.0", "--port", "3001"]
