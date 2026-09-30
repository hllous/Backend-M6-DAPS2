# Resumen DevOps — M6 (Ambiente, Higiene y Servicios Urbanos)

> Explicado en palabras simples para que cualquiera del equipo entienda qué hizo DevOps y por qué.

---

## ¿Qué es lo que hace DevOps en este proyecto?

DevOps se encarga de que el código que escriben back y front **llegue a producción solo**, sin pasos manuales, y de que todo corra de forma estable. La idea es una sola frase:

> **"Pusheás a `develop` y todo se actualiza automáticamente."**

Para eso se armó: contenedores, pipeline de CI/CD, despliegue en la nube, almacenamiento de archivos y seguridad.

---

## 1. Contenedores (Docker)

Backend y frontend se empaquetan en **imágenes Docker** para que corran igual en cualquier lado (la compu de cada uno, o la nube).

- **Build multi-stage**: una etapa compila y otra queda "liviana" con solo lo necesario. Resultado: imágenes más chicas y seguras.
- El backend (NestJS + Prisma) y el frontend (Next.js) tienen su propio `Dockerfile`.
- Se resolvió un clásico "gotcha" de Prisma: agregar **OpenSSL** en Alpine, sin eso no conecta a la base.

## 2. docker-compose (desarrollo local)

Un solo comando (`docker-compose up --build`) levanta todo el entorno local:
- **Postgres** (base de datos)
- **Backend** (NestJS) en el puerto 3001
- **Frontend** (Next.js) en el puerto 3002
- (RabbitMQ queda comentado, listo para cuando M9 lo exponga)

Con esto cualquier dev corre el proyecto completo sin instalar nada a mano.

## 3. CI — Integración continua (GitHub Actions)

Cada vez que alguien hace un PR o pushea a `develop`/`test`/`main`, GitHub Actions corre automáticamente:
- **`build`**: compila y verifica que no haya errores de tipos/lint.
- **`test`**: corre los tests (backend con Jest; frontend con Vitest + Playwright + chequeos de accesibilidad + `npm audit` de seguridad).

Si falla, el merge no pasa. Así no entra código roto.

## 4. CD — Deploy continuo (Render + Vercel)

Cuando el código llega a `develop`, se despliega solo:

```
git push develop
    ↓
build + test (si pasan)
    ↓
deploy del backend en Render (vía Deploy Hook)
    ↓
deploy del frontend en Vercel (nativo)
```

- **Backend** → Render (Web Service + Postgres).
- **Frontend** → Vercel.
- **Costo: $0** (todo en free tier).
- Las **migraciones de la base se aplican solas** en cada deploy, antes de arrancar la API.

## 5. Almacenamiento de archivos — Cloudflare R2

El backend permite subir **evidencia/adjuntos** (fotos de inspecciones, actas). Esos archivos se guardan en **Cloudflare R2** (un almacenamiento tipo S3).

- Se cargaron las 5 variables de R2 en Render.
- Verificado: credenciales válidas, el bucket `m6-evidence` existe y el dominio público sirve los archivos.

## 6. Keepalive (que Render no se duerma)

Render free tier **duerme** el backend tras 15 min sin requests, y eso rompe un proceso de fondo que cierra expedientes vencidos. Se creó un workflow `keepalive` que le hace ping cada 10 minutos para mantenerlo despierto.

## 7. Seguridad

- **Secretos nunca en git**: `.env` ignorado; las claves viven en Render/Vercel o en GitHub Secrets.
- **JWT**: todos los endpoints exigen token (salvo los públicos del portal ciudadano y el health).
- **Imágenes livianas**: `.dockerignore` + build multi-stage → en producción solo van dependencias necesarias.
- **CORS acotado** y **límite de tasa** en los endpoints públicos.

## 8. Git Flow

- Ramas: `main ← test ← develop ← feature/*`.
- Conventional Commits, PRs siempre hacia `develop`.
- `CODEOWNERS` definido.
- **Branch protection** preparada (1 aprobación + checks `build`/`test`), pendiente de que un admin la active.

---

## Estado final

| Tema | Estado |
|---|---|
| Docker (backend + frontend) | ✅ Listo |
| docker-compose local | ✅ Listo |
| CI (build + test) | ✅ Listo |
| CD (deploy automático) | ✅ Listo |
| Cloudflare R2 | ✅ Configurado y verificado |
| Keepalive | ✅ Creado |
| Git Flow + branch protection | 🟡 Script listo, falta activar |
| RabbitMQ | ⏳ Depende de M9 |

**En una frase:** toda la infraestructura DevOps quedó completa y funcionando; lo único que faltaba (las variables de R2) ya está cargado y verificado.
