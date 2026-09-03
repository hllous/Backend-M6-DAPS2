# Decisiones técnicas — ADRs

Registro de las decisiones de arquitectura y tecnología del módulo. Cada archivo es un **ADR** (Architecture Decision Record).

## Qué es un ADR

Un documento corto que explica **por qué** se tomó una decisión técnica, en qué contexto, y qué consecuencias trae. Sirve para que un integrante que llega meses después entienda el razonamiento, y para no reabrir discusiones ya cerradas.

Los ADRs no se editan una vez aceptados. Si una decisión cambia, se escribe un ADR nuevo que la reemplaza, y el viejo se marca como *Superseded by ADR-XXX*.

## Formato

Cada ADR sigue la plantilla de [`_template-adr.md`](_template-adr.md). Numeración correlativa: `adr-001-*.md`, `adr-002-*.md`, etc.

## Índice

| Nº | Título | Estado | Fecha |
|---|---|---|---|
| [001](adr-001-stack-tecnologico.md) | Stack tecnológico del módulo | Aceptado | 2026-08-20 |
| [002](adr-002-auth-provisoria.md) | Autenticación provisoria mientras M1 no publica su contrato de JWT | Aceptado | 2026-09-02 |
| [003](adr-003-divergencias-enums.md) | Resolución de las divergencias de enums con el acuerdo publicado | Propuesto | 2026-09-02 |
| [004](adr-004-jwt-m1-y-puerto-identidad.md) | JWT de usuario emitido por M1 y consulta a identidad desacoplada por puerto | Aceptado | 2026-09-01 |
