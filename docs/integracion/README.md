# Integración con los demás módulos

> Índice de la documentación de integración inter-módulo de M6. **Fuente única** del estado: reemplaza lo que estaba duplicado en [`LEEME.md`](../../LEEME.md) y, en el repositorio de documentación, en `Eventos.txt` y `fuentes/alcance-entregable.md` §7. Si algo de eso dice otra cosa, vale lo que dice acá.

## ¿Dónde está lo que busco?

| Pregunta | Documento |
|---|---|
| ¿Qué falta hoy y con quién? | [`../bloqueantes.md`](../bloqueantes.md#tablero) |
| ¿Qué pasó y cuándo? | [`historial.md`](historial.md) |
| ¿Qué acordamos con M1? M2? M3? M4? M7? M9? | [`m1.md`](m1.md) · [`m2.md`](m2.md) · [`m3.md`](m3.md) · [`m4.md`](m4.md) · [`m7.md`](m7.md) · [`m9.md`](m9.md) · [`m5-m8.md`](m5-m8.md) |
| ¿Qué ya se cerró y no hay que repreguntar? | [`resueltos.md`](resueltos.md) |
| ¿Qué riesgos de la cohorte nos salpican? ¿Hay plan B? | [`riesgos.md`](riesgos.md) |
| ¿Qué le mandamos a cada módulo? | [`mensajes.md`](mensajes.md) |
| ¿Por qué se decidió X? | [`../decisiones/`](../decisiones/) (ADR) |
| ¿Cuál es el payload de un evento? | [`../eventos/publicados/`](../eventos/publicados/) · [`../eventos/consumidos/`](../eventos/consumidos/) |

## Cómo se mantiene

1. **Una novedad entra primero en [`historial.md`](historial.md)** (arriba, con fecha).
2. **Solo si deja algo abierto**, se agrega o actualiza una fila en el tablero de [`bloqueantes.md`](../bloqueantes.md#tablero). Cada fila tiene 4 columnas y fecha de última actualización.
3. **Lo cerrado sale del tablero** y se mueve a [`resueltos.md`](resueltos.md).
4. **Lo acordado con una contraparte** se anota en su ficha (`m2.md`, etc.), no en el tablero ni en el historial.
5. **Las decisiones técnicas** van en un ADR, no acá.
6. **Un dato vive en un solo lugar**; los demás documentos enlazan.
7. Antes de abrir el PR: `npm run docs:check`.

### Antes de recircular el Acuerdo y los Sobres

Los dos documentos que circulan a la cohorte ([`Acuerdo-Eventos-M6.md`](../Acuerdo-Eventos-M6.md) y [`Sobres-M6.md`](../Sobres-M6.md)) llevan **número de versión y fecha de edición** en el encabezado, con el mismo número en los dos. Cada vez que se regeneran los PDF para mandarlos:

1. Subir la versión: **mayor** si cambia el contrato y los demás módulos tienen que hacer algo; **menor** si son aclaraciones o confirmaciones.
2. Poner en el encabezado de los dos la **fecha en que se genera** esa edición.
3. Agregar una fila al «Historial de versiones» del final del Acuerdo.
4. Al exportar, nombrar los PDF con la versión (`Acuerdo-Eventos-M6-v2.1.pdf`, `Sobres-M6-v2.1.pdf`), como hace M2 con su paquete.

