# ADR-XXX: [Título de la decisión]

## Metadata

- **Status:** Proposed
- **Date:** YYYY-MM-DD
- **Deciders:** [Personas o roles que participan]
- **Owner:** [Responsable del ADR]
- **Related Issues:** [#123]
- **Related ADRs:** [ADR-0XX]

---

## 1. Context and Problem Statement

### Context

Describir la situación actual del sistema y el problema que motiva la necesidad de tomar una decisión arquitectónica.

### Problem

¿Cuál es el problema concreto que necesitamos resolver?

---

## 2. Decision Drivers

Factores que condicionan la elección (los motivos, no los efectos: esos van en *Consequences*).

- Requerimientos funcionales.
- Performance y escalabilidad.
- Seguridad.
- Mantenibilidad.
- Complejidad de implementación.
- Costos operativos.
- Compatibilidad con la arquitectura existente.

---

## 3. Considered Options

### Option A: [Nombre de la alternativa]

Descripción breve.

**Pros:**
- Ventaja 1.

**Cons:**
- Desventaja 1.

### Option B: [Nombre de la alternativa]

Descripción breve.

**Pros:**
- Ventaja 1.

**Cons:**
- Desventaja 1.

---

## 4. Decision Outcome

**Chosen Option:** [Alternativa seleccionada]

### Rationale

Por qué se eligió y cómo responde a los *Decision Drivers*.

---

## 5. Consequences

### Positive Consequences

- Beneficio 1.

### Negative Consequences

- Limitación, costo o riesgo asumido.

### Technical Implications

- Componentes afectados, cambios necesarios, dependencias o integraciones, impacto en infraestructura.

---

## 6. Implementation and Validation

Cómo se implementa y cómo se verifica que el código respeta la decisión.

- [ ] Tarea de implementación.
- [ ] Tests o validaciones necesarias.
- [ ] Documentación actualizada.

---

## 7. References

- Documentación técnica, issues, PR y ADRs relacionados.

---

## Cómo usar esta plantilla

Formato [MADR](https://adr.github.io/madr/) (Markdown Architectural Decision Records).

1. Copiá este archivo como `adr-NNN-titulo-corto.md` (numeración correlativa de tres dígitos) y reemplazá `XXX`.
2. Completá cada sección. Si alguna no aplica, dejala en blanco pero no la borres, para mantener el formato entre ADRs.
3. **Status** (valores en inglés, como el resto de la plantilla):

   | Status | Significado |
   |---|---|
   | Proposed | Propuesta, pendiente de revisión |
   | Accepted | Aprobada |
   | Rejected | Evaluada y no adoptada |
   | Deprecated | Ya no se recomienda |
   | Superseded | La reemplazó una decisión posterior (indicar `by ADR-YYY`) |

4. Un ADR aceptado es un registro histórico inmutable: si la decisión cambia, se escribe un ADR nuevo y el viejo pasa a *Superseded*. Lo único que se agrega a uno aceptado es una nota fechada (`> Nota del AAAA-MM-DD: …`).
5. Los ADR 001 a 013 usan la plantilla anterior (Estado, Contexto, Decisión, Alternativas, Consecuencias, Referencias) y no se reescriben, justamente por ser registros históricos. Desde el 014 se usa esta.
