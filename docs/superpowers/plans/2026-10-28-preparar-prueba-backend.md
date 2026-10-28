# Preparación de la prueba contra el Core: plan de trabajo (28/10)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar M6 listo para la prueba contra el Core real (#299/#442) y avanzar en paralelo el frontend que no depende de nadie (mapa C, pulido D, tablas TanStack E).

**Architecture:** Backend: casi todo es operativo (Render, suscripción de prueba, docs); el código ya ignora tipos sin handler (`inbox.service.ts:209`), así que `pruebaConexionM6` no necesita handler. Frontend: tres carriles que no se pisan por archivos (mapa / listados y paneles / tablas).

**Tech Stack:** NestJS + Prisma + RabbitMQ (backend); Next.js + React-Leaflet + TanStack Table (frontend, repo `hllous/Frontend-M6-DAPS2`).

**Spec:** [`docs/bloqueantes.md`](../../bloqueantes.md), [`docs/integracion/m9.md`](../../integracion/m9.md#correcciones-del-2810), issues Backend #442/#299 y Frontend #708/#709/#321/#582–#586.

## Global Constraints

- Nada de commits, push, PRs ni mensajes al grupo sin pedido explícito.
- El Core es **único y compartido**: avisar en el grupo general antes de publicar o suscribir; datos ficticios, `eventId` nuevos.
- Clave de barrio: seguimos con el **UUID** (M9 se retractó del slug); no cambiar el contrato por cuenta propia.
- Credenciales fuera de issues, logs y capturas.
- Frontend: screenshots Playwright 1440x900 y 390x844 antes/después en cada pantalla tocada; typecheck, lint, Vitest y e2e verdes.
- Backend: `npm run build`, `lint:check`, `test`, `docs:check` verdes.

## Review Focus

- Mapa con 15 comunas + ~48 barrios dibujados: legibilidad y rendimiento (muchos polígonos en Leaflet).
- Barrio de la API sin polígono en el GeoJSON (o al revés): no debe romper el mapa.
- Capas ocultas + selección de barrio: ocultar el barrio seleccionado no debe dejar un filtro "fantasma".
- `core:unregister` con un tipo que no está en `ConsumedEvent`.
- Suscripción de prueba repetida: un POST repetido reactiva el registro (idempotencia).

---

## Estado de los bloqueantes (resumen)

| Fila | Estado | Qué se puede hacer ya |
|---|---|---|
| M3 (adaptador + schemas) | 🟡 espera a M3 | Nada; cruzar schemas cuando lleguen |
| #266 registro + #299/#442 prueba | ⚠️ nuestro; **5671 ya abierto** | Tareas B1–B3 |
| #328 coordinación M9 | ⚠️ nuestro | Cubierto por #442 (B2) |
| Decisiones del Core (format, user_id, barrio, updateTicketStatus) | 🟡 espera M9/M2 | Nada; nuestro código ya es compatible con (2) y (3) |

Nada 🔴. El único trabajo backend es de prueba y operación, no de código nuevo.

---

## Backend

### Task B1: Pre-chequeo local (sin tocar el Core)

**Files:** `scripts/core-unregister.ts`, `scripts/core-register.ts` (solo lectura salvo hallazgo)

- [ ] **Step 1:** Correr `npm run core:register -- --dry-run` y `npm run core:unregister -- --type pruebaConexionM6` (simulacro, solo GET). Expected: no falla por tipo fuera de `ConsumedEvent`.
- [ ] **Step 2:** Si rechaza el tipo, abrir un fix en `scripts/core-unregister.ts` que acepte `--type` arbitrario en simulacro y `--apply` (con test en spec hermano si hay lógica nueva). Si no, no tocar nada.
- [ ] **Step 3:** `npm run build && npm run lint:check && npm test` en verde.

### Task B2: Prueba pasiva desde Render y suscripción `pruebaConexionM6` (#442)

Requiere deploy en Render y acuerdo de horario; son acciones sobre un ambiente compartido: **confirmar con vos antes de ejecutar**.

- [ ] **Step 1:** Vos avisás en el grupo general el horario (texto sugerido en `docs/integracion/mensajes.md`, registrar hora de envío).
- [ ] **Step 2:** Verificar que la instancia en Render arranca con `RABBITMQ_URL` `amqps://…:5671` y que el log muestra conexión y `checkQueue q.ambiente` OK (prueba pasiva, sin publicar).
- [ ] **Step 3:** `GET /subscriptions` y luego crear la suscripción `pruebaConexionM6` con `maxAttempts: 4` (el POST repetido reactiva, no duplica).
- [ ] **Step 4:** M9 publica `pruebaConexionM6` por HTTP; verificar fila en el inbox como `ignored` (sin handler) y ack. Anotar `eventId`, resultado y hora.
- [ ] **Step 5:** Retirar la suscripción: `npm run core:unregister -- --type pruebaConexionM6 --apply`.

### Task B3: Documentar el resultado

**Files:** `docs/integracion/historial.md` (primero), `docs/bloqueantes.md`, `docs/integracion/m9.md`, `docs/integracion/resueltos.md`

- [ ] **Step 1:** Entrada en `historial.md` con el resultado de B2; mover a `resueltos.md` lo cerrado y actualizar/quitar las filas "Probar contra el Core" y "Coordinación M6↔M9" del tablero.
- [ ] **Step 2:** Comentar hallazgos en #299 y cerrar #442. Dejar #257 listo para cerrar si todo pasó.
- [ ] **Step 3:** `npm run docs:check` pasa.

---

## Frontend (repo `Frontend-M6-DAPS2`)

Tres carriles en paralelo; los archivos no se cruzan.

### Carril C: mapa (#708 + #709 + capas ocultables), un solo agente

**Files:**
- Modify: `src/components/map/operational-map-canvas.tsx` (+ `.module.css`, `.test.tsx`), `src/components/services/services-map-canvas.tsx`, `src/lib/operational-zones.ts`
- Create: `public/geo/comunas.geojson`, `public/geo/barrios.geojson` (BA Data, citar fuente y licencia en el PR), `src/lib/map-boundaries.ts`

**Interfaces:**
- Produces: `loadBoundaries(): { communes: Feature[]; neighborhoods: Feature[] }` y `matchBoundaries(apiCommunes, apiZones)`, emparejando comunas por `commune.code` (`comuna-N`) y barrios por `codigo` del barrio. Los ids de la API son UUID; el `codigo` solo sirve para emparejar con el GeoJSON.
- Consumes: `GET /communes`, `GET /zones` (trae `commune` y `neighborhood`), `GET /neighborhoods`.

- [ ] **Step 1 (test):** `map-boundaries.test.ts`: un barrio de la API sin polígono se omite sin romper; un polígono sin barrio de la API se dibuja sin color ni filtro.
- [ ] **Step 2 (#708):** Capa de comunas: contorno visible a cualquier zoom, sin relleno, etiqueta con número.
- [ ] **Step 3 (#709):** Capa de barrios: relleno por barrio (tono por comuna, variación por barrio), contraste en modo claro/oscuro, hover y selección con tooltip (nombre y comuna), y filtro de servicios/contenedores/espacios verdes por barrio y comuna.
- [ ] **Step 4 (capas ocultables):** Control de capas en el mapa: casillas "Comunas" y "Barrios" (ambas visibles por defecto) y, dentro de cada una, una lista para **ocultar comunas o barrios individuales** más "ocultar todos / mostrar todos". Estado local del mapa (no se persiste). **La visibilidad también filtra los marcadores** (decisión del PO, 28/10): con "ocultar todos" y "mostrar Palermo" solo se ven los contenedores, árboles, espacios verdes y servicios que caen dentro de Palermo; con todo visible no hay filtro. Ocultar una comuna oculta sus barrios; mostrar un barrio de una comuna oculta lo muestra a él solo. Usar `Checkbox`/`DropdownMenu` de shadcn (ya en `ui/`). Test: ocultar comuna 3 deja de renderizar sus polígonos y sus barrios; mostrar todos restaura.
- [ ] **Step 5:** Screenshots, typecheck, lint, Vitest, e2e del mapa.

> La función de ocultar no tiene issue: propongo abrir uno en Frontend (ref. #708/#709); no lo abro hasta que lo confirmes.

### Carril D: pulido de listados y paneles (#321), sin tocar el mapa

**Files:** listados y paneles de Oficina, Campo y tablero (formateo en `src/lib/` ya existente para fechas).

- [ ] **Step 1 (test + fix, ítems 1–7):** fechas con el formateador existente; sacar "Checklist —"; corregir los textos de "solo consulta" (cuadrilla antes de iniciar; Oficina junto a botones activos); unificar etiquetas de enums (inspección/acta); títulos de Intervenciones de arbolado y fila del tablero sin UUID.
- [ ] **Step 2 (ítem 8, 404 de `violation-notice`):** es un cambio de contrato con el backend: **no tocar de entrada**. Decisión para vos: o el backend responde 200 con `null`, o el frontend trata el 404 como "sin acta" y lo silencia. Recomiendo lo segundo: es chico y no cambia el contrato.
- [ ] **Step 3:** Screenshots, typecheck, lint, Vitest, e2e de las pantallas tocadas.

### Carril E: TanStack (#582 → #583 ∥ #584 → #586)

**Files:** `src/components/ui/data-table.tsx` (componente compartido, ya existe), tablas de Catálogo A/B.

- [ ] **Step 1 (#582):** Migrar árboles, espacios verdes, puntos verdes y contenedores. Esto fija la base: si hace falta ajustar la API de `data-table.tsx`, se hace acá y se mergea antes de seguir.
- [ ] **Step 2 (#583 y #584 en paralelo, tras mergear #582):** #583 cuadrillas/vehículos/rutas/zonas; #584 sitios de disposición/tipos de servicio/frecuencias. Sin tocar `data-table.tsx` (si hace falta, volver a #582).
- [ ] **Step 3 (#586, al final):** Buscar estado de tabla escrito a mano, borrar helpers sin uso, registrar excepciones en #520.
- [ ] Cada paso con screenshots antes/después y checks en verde.

> Choque a vigilar: la tabla de zonas (#583) y el mapa (carril C) consumen `/zones`; son componentes distintos, pero si C cambia el tipo `OperationalZone` hay que avisar a E.

---

## Orden y paralelismo

1. Ya: B1 + carril C + carril D + #582 (cuatro frentes sin dependencias cruzadas).
2. Cuando mergea #582: #583 ∥ #584. Cuando ambos mergean: #586.
3. B2 apenas haya horario acordado y deploy en Render; B3 inmediatamente después.

## Decisiones tuyas antes de arrancar

1. ¿Abro el issue de "ocultar comunas/barrios" en Frontend? (Hoy está en el Step 4 del carril C.)
2. #321 ítem 8: ¿el frontend silencia el 404 (recomendado) o el backend devuelve 200 con `null`?
3. B2 toca el Core compartido: ¿vos avisás en el grupo general, o te dejo el texto en `mensajes.md`?
