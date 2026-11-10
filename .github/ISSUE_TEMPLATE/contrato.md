---
name: Cambio de contrato
about: Cambio o consulta sobre eventos, endpoints REST, DTOs u OpenAPI que afecta a otros módulos o al Frontend
labels: event-driven, api
---

## Objetivo

## Contexto

<!-- Qué dispara el cambio: pedido de otro módulo, deriva detectada, decisión del Core. -->

## Contrato afectado

<!-- Evento o endpoint, versión, campos que cambian. Antes y después. -->

## Consumidores a avisar

- [ ] Módulo o repo (M2, M3, M4, M7, Core, Frontend):

## Criterios de aceptación

- [ ] Código, `payloads.ts` / `.schema.json` / `openapi.json` actualizados
- [ ] Docs actualizados (`docs/eventos/`, `docs/api/`) y `npm run docs:check` en verde
- [ ] Novedad registrada en `docs/integracion/historial.md`
- [ ] Retrocompatibilidad mantenida o migración acordada

## Evidencia / Referencias
