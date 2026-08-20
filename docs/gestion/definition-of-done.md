# Definition of Done — Módulo 6

Este documento define **cuándo una tarjeta del tablero puede pasar a la columna "Hecho"**. No se trata de "el código funciona en mi máquina" — se trata de que el trabajo esté cerrado con toda la calidad y la documentación que el equipo acordó.

Como en este proyecto **no hay reviews obligatorias** (ver [`CONTRIBUTING.md`](../../CONTRIBUTING.md)), el DoD funciona como la principal barrera de calidad. Es responsabilidad de cada integrante chequearse contra esta lista antes de mover una tarjeta.

## Criterios generales (aplican a toda tarjeta)

Toda tarjeta, sea de código, documentación, decisión técnica o coordinación, cumple:

- [ ] La tarjeta tiene descripción clara y criterios de aceptación explícitos.
- [ ] Está asignada a una persona responsable.
- [ ] Los cambios están en `main` (o en la rama que corresponda al flujo del sprint).
- [ ] La tarjeta está movida a "Hecho" en Trello.
- [ ] Los archivos, links o entregables producidos están accesibles al equipo.

## Cuando la tarjeta es de código

Además de lo general:

- [ ] El código compila sin errores.
- [ ] Los tests unitarios pasan localmente.
- [ ] **Cobertura de tests ≥ 85%** en los archivos modificados (requisito del TPO).
- [ ] El linter no arroja errores ni warnings nuevos.
- [ ] No hay código comentado ni `console.log` de debug olvidados.
- [ ] Ninguna variable sensible (secretos, tokens, credenciales, URLs privadas) quedó hardcodeada.
- [ ] Si aplica: la variable de entorno nueva está agregada al `.env.example`.
- [ ] El cambio funciona en el entorno desplegado (Railway para backend, Vercel para frontend), no solo local.

### Extras si el cambio es un endpoint REST

- [ ] Cumple el [estándar Swagger](../api/estandar-swagger.md): tags, códigos HTTP, DTOs con `@ApiProperty`, `@ApiResponse` para cada código posible.
- [ ] Puede probarse desde Swagger UI en el entorno desplegado con un JWT válido.
- [ ] Está listado en [`docs/api/endpoints.md`](../api/endpoints.md).

### Extras si el cambio es un evento publicado o consumido

- [ ] El archivo `.md` del evento en [`docs/eventos/`](../eventos/) está actualizado.
- [ ] Si es publicado: el `.schema.json` hermano está actualizado.
- [ ] Si el cambio impacta a otro grupo de la cohorte: el pedido o aviso está anotado en [`docs/bloqueantes.md`](../bloqueantes.md).

### Extras si el cambio toca el modelo de datos

- [ ] El archivo correspondiente en [`docs/entidades/`](../entidades/) está actualizado.
- [ ] Si aplica: el diagrama en [`docs/DER.puml`](../DER.puml) está actualizado.
- [ ] Si hay enums nuevos: [`docs/enumeraciones.md`](../enumeraciones.md) está actualizada.
- [ ] La migración de Prisma corrió sin errores en el entorno desplegado.

## Cuando la tarjeta es de documentación

Además de lo general:

- [ ] Los links internos funcionan (no llevan a archivos inexistentes).
- [ ] La ortografía y gramática están revisadas.
- [ ] Si el cambio actualiza un tema que aparece en varios lugares (por ejemplo, un evento documentado en su `.md`, en el `bloqueantes.md` y en el `LEEME.md`), **todos los lugares están alineados**.

## Cuando la tarjeta es una decisión técnica

Además de lo general:

- [ ] La decisión está escrita como ADR en [`docs/decisiones/`](../decisiones/) siguiendo la [plantilla](../decisiones/_template-adr.md).
- [ ] El ADR incluye contexto, alternativas consideradas y consecuencias.
- [ ] Fue comunicada al equipo (WhatsApp, Slack o reunión).
- [ ] Si reemplaza a un ADR anterior: el viejo se marcó como *Reemplazado por ADR-XXX*.

## Cuando la tarjeta es de coordinación con otro grupo

Además de lo general:

- [ ] Está registrada la comunicación (link al mensaje, foto de la conversación, o mail archivado).
- [ ] Si hubo un acuerdo: quedó reflejado en [`docs/bloqueantes.md`](../bloqueantes.md) con fecha.
- [ ] Si el otro grupo confirmó algo: la fila del tablero de bloqueantes está actualizada de 🔴 a ⚠️ o ✅ según corresponda.

## Excepciones

Si por alguna razón (tiempo del sprint, dependencia de otro módulo, decisión del equipo) un criterio no se puede cumplir, se **documenta la excepción en la tarjeta** con:

- Por qué no se cumplió.
- Cuándo se planea resolverlo.
- Qué tarjeta nueva quedó abierta para el trabajo pendiente.

Una excepción no es una vía libre — es un compromiso de cerrarlo después.

## Evolución de este DoD

Este DoD puede ajustarse en cualquier retrospectiva del equipo. Los cambios se hacen por PR con descripción clara y quedan versionados. El DoD no es sagrado, pero mientras esté vigente, se cumple.

---

*Última revisión: 2026-08-20 — Sprint 0*
