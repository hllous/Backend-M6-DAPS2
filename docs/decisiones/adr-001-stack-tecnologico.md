# ADR-001: Stack tecnológico del módulo

## Estado

**Aceptado** — 2026-08-20

## Contexto

El TPO exige para cada módulo:

- Arquitectura de **tres capas** explícita en el backend (presentación, negocio, acceso a datos).
- **API REST** documentada con Swagger.
- Integración con otros módulos vía **eventos asincrónicos**.
- Autenticación y autorización por roles.
- Tests con cobertura mínima **85%** en frontend y backend por separado.
- Deploy en un entorno accesible.
- Frontend web o mobile independiente del backend.

El equipo tenía que elegir un stack completo (frontend + backend + base de datos + broker de eventos) que cubra estos requisitos y sea viable de aprender y entregar en un cuatrimestre, con 6 integrantes que en su mayoría no habían usado antes las opciones más modernas del ecosistema JavaScript.

Restricciones adicionales:

- **Tiempo:** dos meses hasta la primera entrega individual (22/9), tres y medio hasta la integrada (17/11).
- **Curva de aprendizaje:** el equipo quería aprovechar el TPO para incorporar tecnologías demandadas en el mercado, no repetir lo aprendido en materias anteriores.
- **Coordinación con otros grupos:** el broker de eventos depende del Core (M9), que aún no lo definió.

## Decisión

Se adopta el siguiente stack:

| Capa | Elección |
|---|---|
| Frontend | **Next.js 15** + React 19 + TypeScript + Tailwind + shadcn/ui |
| Backend | **NestJS** + TypeScript + Node 20 LTS |
| Base de datos | **PostgreSQL** + Prisma como ORM |
| Broker de eventos | **Kafka** (confirmado por M9) |
| Deploy frontend | Vercel |
| Deploy backend | Render |
| Base de datos gestionada | Render PostgreSQL |

## Alternativas consideradas

### Frontend

- **Angular**: bien conocido en UADE, arquitectura estricta e imposicion de patrones. Se descartó por verbosidad y curva relativamente alta en un equipo sin experiencia previa reciente.
- **React puro (Vite)**: opción sólida y simple. Se descartó a favor de Next para aprovechar el routing por carpetas, SSR y deploy trivial en Vercel, y porque el equipo priorizó ganar experiencia con un framework más pedido en el mercado.
- **Vue**: sintaxis más simple, pero con menos demanda laboral en Argentina; el equipo prefirió apostar al ecosistema React.
- **Next.js** (elegida): framework sobre React con routing por carpetas, TypeScript de fábrica, deploy nativo en Vercel, y el skill más pedido hoy en el mercado local. Se usa **solo como frontend** — las API routes no se utilizan, para mantener la separación estricta FE/BE que exige el TPO.

### Backend

- **Java + Spring Boot**: la opción más segura por experiencia previa del equipo en UADE. Impone arquitectura de tres capas, Swagger integrado, ecosistema maduro para eventos. Se descartó a favor de NestJS para trabajar en un solo lenguaje con el frontend y para incorporar una tecnología nueva.
- **Node + Express**: rápido de arrancar, mismo lenguaje que el front. Se descartó porque no impone arquitectura de tres capas, y sostener la disciplina a lo largo de 3 meses sin esa imposición es un riesgo alto en un equipo estudiantil.
- **Python (FastAPI)**: curva baja, buena documentación. Menos maduro para eventos y colas que Java o Node. El equipo prefirió un ecosistema más alineado con TypeScript.
- **Go, PHP/Laravel**: descartados por curvas altas para el tiempo disponible o por menor demanda de mercado.
- **NestJS** (elegida): equivalente a Spring pero en TypeScript. Impone tres capas mediante decoradores (`@Controller`, `@Injectable`, `@Module`), Swagger integrado, soporte oficial para Kafka con `@nestjs/microservices`, y comparte lenguaje con el frontend.

### Base de datos

- **MySQL**: alternativa relacional válida, prácticamente equivalente para este caso.
- **MongoDB**: descartada porque el dominio de M6 es fuertemente relacional (Zone → Route → Container → Service, con múltiples FKs). Usarla obligaría a reimplementar joins en el código o duplicar datos.
- **PostgreSQL** (elegida): SQL estándar, soporte de JSON nativo por si aparece flexibilidad, integración excelente con Prisma. Es el default de la industria para este tipo de dominios.

### ORM

- **TypeORM**: alternativa madura pero con fama de comportamientos sutiles poco predecibles.
- **Prisma** (elegida): schema declarativo en un archivo, migraciones automáticas, tipos TypeScript generados de la base. Es el ORM más moderno del ecosistema Node y encaja bien con dominios relacionales complejos.

### Broker de eventos

- **Kafka** (confirmado por M9): potente, alta throughput, particionado, replay de mensajes. Más complejo de operar que RabbitMQ pero es lo que definió el Core. NestJS lo soporta nativamente con `@nestjs/microservices`.
- **RabbitMQ**: más simple, con documentación abundante en castellano. Descartado porque M9 definió Kafka.

## Consecuencias

### Positivas

- **Un solo lenguaje (TypeScript) en frontend y backend.** Menos context switch, tipos e interfaces reutilizables entre proyectos.
- **NestJS impone la arquitectura de tres capas** que exige el TPO, evitando el riesgo de que el código se degrade sprint a sprint.
- **Swagger integrado** en NestJS mediante decoradores — cubre requisito del TPO sin trabajo extra.
- **Prisma genera los tipos TypeScript** desde el schema, eliminando desincronización entre modelos y base.
- **Deploy trivial**: Vercel para el frontend, Render para el backend y postgres, ambos con tier gratuito suficiente para el TPO.
- El stack elegido es de los **más pedidos en el mercado laboral argentino**, sumando valor formativo al TPO.

### Negativas

- **El equipo aprende Next.js y NestJS por primera vez.** Suma curva de aprendizaje durante el Sprint 1 y parte del 2, en paralelo al desarrollo funcional.
- **M9 confirmó Kafka.** El broker de eventos está definido. NestJS lo soporta nativamente con `@nestjs/microservices` y `KafkaModule`.
- **Prisma es un cambio respecto a JPA/Hibernate**, que era lo conocido del equipo.

### Neutras

- Los repos frontend y backend viven separados; el proyecto NestJS convive con la documentación en `m6-ambiente-backend`.
- Se acordó nomenclatura de eventos y campos en `camelCase`, alineada con la cohorte.
- Los tipos TypeScript de los payloads de eventos se pueden compartir entre front y back copiando manualmente. Si en el futuro se decide monorepo con workspaces, se documentará como ADR nuevo.

## Referencias

- Enunciado del TPO: `enunciado/TPO - Desarrollo de Apps II - Gestión de municipalidad.pdf`, en el repositorio de documentación
- Documentación NestJS: https://docs.nestjs.com
- Documentación Next.js: https://nextjs.org/docs
- Documentación Prisma: https://www.prisma.io/docs
- Discusión previa del equipo sobre alternativas (Slack/WhatsApp, agosto 2026)
