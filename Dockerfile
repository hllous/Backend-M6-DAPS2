# ──────────────────────────────────────────────────────────────
# M6 Ambiente Backend — Imagen Docker (NestJS + Prisma)
# Build multi-stage: etapa "builder" compila, etapa "runner" queda liviana.
# ──────────────────────────────────────────────────────────────

# ─── Etapa 1: builder (compilación) ───────────────────────────
FROM node:24-alpine AS builder

# Sin telemetría de @scarf/scarf (postinstall de swagger-ui-dist).
ENV SCARF_ANALYTICS=false

WORKDIR /app

# OpenSSL es requerido por el query engine de Prisma en Alpine (musl).
# Sin esto, prisma generate no detecta la versión de OpenSSL y falla en runtime.
RUN apk add --no-cache openssl

# Primero se copian SOLO los manifiestos para aprovechar la caché de Docker
# (si no cambian las dependencias, esta capa se reutiliza entre builds).
COPY package.json package-lock.json ./

# Instala TODAS las dependencias (incluye dev) necesarias para compilar.
# --ignore-scripts: no corre scripts de instalación de terceros (S6505); lo que
# hacían (cliente y motores de Prisma) se hace explícito más abajo.
RUN npm ci --ignore-scripts

# Copia el resto del código fuente (respeta .dockerignore).
COPY . .

# Genera el cliente de Prisma a partir de prisma/schema.prisma.
# (No necesita conexión a la base, solo el schema.)
RUN npm run prisma:generate

# Compila TypeScript -> dist/ (usa tsconfig.build.json).
RUN npm run build

# ─── Etapa 2: runner (imagen final, liviana) ──────────────────
FROM node:24-alpine AS runner

WORKDIR /app

# Entorno de producción
ENV NODE_ENV=production
ENV SCARF_ANALYTICS=false

# OpenSSL requerido por el query engine de Prisma en runtime.
RUN apk add --no-cache openssl

# Copia manifiestos e instala SOLO dependencias de producción.
COPY package.json package-lock.json ./
# Sin scripts de terceros; solo se reconstruyen los motores de Prisma, que
# `prisma migrate deploy` necesita al arrancar (si no, los bajaría en runtime).
RUN npm ci --omit=dev --ignore-scripts \
    && npm rebuild @prisma/engines \
    && npm cache clean --force

# Copia el cliente de Prisma ya generado en la etapa builder
# (necesario para que @prisma/client funcione en runtime).
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Copia el código ya compilado.
COPY --from=builder /app/dist ./dist

# Copia el schema y las migraciones de Prisma.
COPY prisma ./prisma

# Puerto que expone la app (coincide con PORT del .env.example).
EXPOSE 3000

# Aplica las migraciones pendientes y arranca.
# Si la migración falla el contenedor no levanta, que es lo correcto:
# preferimos no servir una API contra un esquema desactualizado.
CMD ["sh", "-c", "npm run prisma:migrate:deploy && node dist/main.js"]
