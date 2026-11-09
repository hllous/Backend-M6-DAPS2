# Fase 0 — Inventario de documentación

Generado desde `git ls-files` + `git log -1` (fecha = último commit que tocó el archivo). Audiencias: Equipo, Cátedra, Otros módulos, DevOps, IA.

## Archivos individuales

| Ruta | Bytes | Últ. commit | Hash | Diátaxis | Audiencia | Fuente/derivado |
|---|---:|---|---|---|---|---|
| `.github/CODEOWNERS` | 920 | 2026-10-21 | f1e1ff6 | Referencia | Equipo | Fuente |
| `.github/branch-protection-rules.json` | 1806 | 2026-08-26 | 1039cdd | Referencia | Equipo/DevOps | Fuente |
| `.github/scripts/apply-branch-protection.ps1` | 2946 | 2026-08-26 | 1039cdd | How-to (script) | Equipo/DevOps | Fuente |
| `.github/workflows/ci.yml` | 6999 | 2026-11-03 | dcb46b4 | Referencia (CI) | Equipo | Fuente |
| `.github/workflows/keepalive.yml` | 4147 | 2026-10-27 | 0892810 | Referencia (CI) | DevOps | Fuente |
| `.gitleaks.toml` | 764 | 2026-11-03 | dcb46b4 | Referencia | Equipo | Fuente |
| `AGENTS.md` | 7745 | 2026-11-06 | 759220d | Referencia + explicación (índice) | IA/Equipo | Fuente |
| `CLAUDE.md` | 11 | 2026-10-04 | 8eb8b4b | Puntero (importa AGENTS.md) | IA | Fuente |
| `CONTRIBUTING.md` | 6986 | 2026-10-20 | 1641298 | How-to + referencia (mezcla) | Equipo | Fuente |
| `LEEME.md` | 8145 | 2026-11-06 | 759220d | Explicación (obsoleta) | Equipo/Cátedra | Fuente (desfasada) |
| `README.md` | 4807 | 2026-11-06 | 759220d | Tutorial/quickstart + referencia | Equipo/Cátedra | Fuente (con conteos copiados) |
| `devops/DEVOPS-SEGUIMIENTO.md` | 20815 | 2026-10-21 | b9511a7 | Mixto: how-to + historial | DevOps | Fuente |
| `devops/MENSAJE-M9-RABBITMQ.md` | 3231 | 2026-10-21 | 97809ec | Mensaje (historial) | Otros módulos (M9) | Fuente |
| `devops/PRESENTACION-DEVOPS.md` | 5233 | 2026-10-02 | c24908a | Explicación | Cátedra/DevOps | Fuente |
| `devops/docker-compose.yml` | 3384 | 2026-10-21 | b9511a7 | Referencia (config) | DevOps | Fuente |
| `devops/resumen-devops.md` | 4187 | 2026-10-02 | c24908a | Explicación | DevOps | Fuente |
| `docs/Acuerdo-Eventos-M6.md` | 51720 | 2026-11-02 | 47b24e9 | Referencia (CONTRATO) | Otros módulos | Fuente de PDF — contrato, requiere aviso |
| `docs/Cruce-Eventos-M6.md` | 38450 | 2026-10-21 | 2cb55d4 | Referencia (CONTRATO) | Otros módulos | Derivado/cruce — contrato, requiere aviso |
| `docs/DER.md` | 20320 | 2026-11-06 | 759220d | Referencia | Equipo/Cátedra | Fuente (Mermaid) |
| `docs/DER.puml` | 18866 | 2026-11-02 | 9482e01 | Referencia | Equipo | Fuente (duplica DER.md en otra notación) |
| `docs/Diagrama de Eventos - Grupo 04 (Modulo 6).pdf` | 56402 | 2026-08-20 | f7539d8 | Referencia | Cátedra | Derivado (PDF compilado; no se lee) |
| `docs/Documento de Alcance - Grupo 04 (Modulo 6).pdf` | 835392 | 2026-08-25 | d073b8c | Explicación | Cátedra | Derivado (PDF compilado; no se lee) |
| `docs/README.md` | 6872 | 2026-11-06 | 759220d | Explicación + glosario | Equipo/IA | Fuente (con conteos copiados) |
| `docs/Sobres-M6.md` | 33939 | 2026-11-02 | 47b24e9 | Referencia (CONTRATO) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/agents/domain.md` | 3732 | 2026-10-04 | 8eb8b4b | Andamiaje de agente | IA | Fuente |
| `docs/agents/issue-tracker.md` | 3731 | 2026-08-25 | b45ece7 | Andamiaje de agente | IA | Fuente |
| `docs/agents/triage-labels.md` | 1059 | 2026-08-25 | b45ece7 | Andamiaje de agente | IA | Fuente |
| `docs/api/README.md` | 1664 | 2026-10-20 | 1641298 | Referencia (índice) | Equipo | Fuente |
| `docs/api/endpoints.md` | 114167 | 2026-11-06 | 759220d | Referencia | Equipo/Frontend | Fuente manual con partes derivables de openapi.json |
| `docs/api/estandar-swagger.md` | 14271 | 2026-10-28 | 3bf5b46 | Referencia (estándar) | Equipo | Fuente |
| `docs/api/openapi.json` | 725093 | 2026-11-06 | 759220d | Referencia | Frontend/Cátedra | Derivado (generado, validado en CI) |
| `docs/bloqueantes.md` | 4848 | 2026-11-06 | 759220d | Referencia (tablero) | Equipo/otros módulos | Fuente |
| `docs/decisiones/README.md` | 2330 | 2026-11-06 | 759220d | Referencia (índice ADR) | Equipo | Fuente |
| `docs/decisiones/_template-adr.md` | 1993 | 2026-08-20 | f7539d8 | Plantilla | Equipo | Fuente |
| `docs/decisiones/adr-001-stack-tecnologico.md` | 7774 | 2026-10-08 | 5c3cbc2 | Explicación (ADR) | Equipo | Fuente |
| `docs/decisiones/adr-002-auth-provisoria.md` | 6439 | 2026-11-06 | 759220d | Explicación (ADR) | Equipo | Fuente |
| `docs/decisiones/adr-003-divergencias-enums.md` | 9213 | 2026-10-21 | 2cb55d4 | Explicación (ADR) | Equipo | Fuente |
| `docs/decisiones/adr-004-jwt-m1-y-puerto-identidad.md` | 4398 | 2026-11-03 | 14b3d0d | Explicación (ADR) | Equipo | Fuente |
| `docs/decisiones/adr-005-alineacion-frontend-sesion-y-seguridad.md` | 7118 | 2026-10-21 | e6153f9 | Explicación (ADR) | Equipo | Fuente |
| `docs/decisiones/adr-006-rabbitmq-como-bus.md` | 11918 | 2026-10-22 | 6a3758d | Explicación (ADR) | Equipo | Fuente |
| `docs/decisiones/adr-007-contrato-de-integracion-del-core.md` | 14045 | 2026-10-27 | 9278dfa | Explicación (ADR) | Equipo | Fuente |
| `docs/decisiones/adr-008-roles-m6-adaptados-desde-m1.md` | 12831 | 2026-10-22 | 2c76ed7 | Explicación (ADR) | Equipo | Fuente |
| `docs/decisiones/adr-009-rest-m6-a-m1-consultas-de-identidad.md` | 4209 | 2026-11-05 | aa540be | Explicación (ADR) | Equipo | Fuente |
| `docs/deploy.md` | 32143 | 2026-11-06 | 759220d | MEZCLA: referencia + how-to + runbook + historial | DevOps/Equipo | Fuente |
| `docs/entidades/auditoria.md` | 7467 | 2026-11-05 | c07dcc9 | Referencia (modelo de datos) | Equipo | Fuente (duplica schema.prisma a mano) |
| `docs/entidades/configuracion-y-recursos.md` | 7180 | 2026-11-05 | aa540be | Referencia (modelo de datos) | Equipo | Fuente (duplica schema.prisma a mano) |
| `docs/entidades/container.md` | 7256 | 2026-11-02 | 9aa2f14 | Referencia (modelo de datos) | Equipo | Fuente (duplica schema.prisma a mano) |
| `docs/entidades/control-ambiental.md` | 4501 | 2026-11-05 | d0f8e91 | Referencia (modelo de datos) | Equipo | Fuente (duplica schema.prisma a mano) |
| `docs/entidades/derivaciones.md` | 6184 | 2026-11-02 | 9482e01 | Referencia (modelo de datos) | Equipo | Fuente (duplica schema.prisma a mano) |
| `docs/entidades/environmental-report.md` | 12303 | 2026-11-05 | d0f8e91 | Referencia (modelo de datos) | Equipo | Fuente (duplica schema.prisma a mano) |
| `docs/entidades/inventario-urbano.md` | 2695 | 2026-11-05 | 96c50bc | Referencia (modelo de datos) | Equipo | Fuente (duplica schema.prisma a mano) |
| `docs/entidades/service.md` | 11001 | 2026-10-28 | 305386b | Referencia (modelo de datos) | Equipo | Fuente (duplica schema.prisma a mano) |
| `docs/entidades/tree-intervention.md` | 3314 | 2026-10-28 | bfdf200 | Referencia (modelo de datos) | Equipo | Fuente (duplica schema.prisma a mano) |
| `docs/enumeraciones.md` | 7489 | 2026-11-06 | 759220d | Referencia | Equipo/otros módulos | Fuente (parcialmente derivable de Prisma) |
| `docs/eventos/consumidos/README.md` | 9931 | 2026-11-06 | 759220d | Referencia (índice) | Equipo/otros módulos | Fuente |
| `docs/eventos/consumidos/closureUpdate.md` | 3750 | 2026-11-05 | d0f8e91 | Referencia (evento ajeno) | Equipo/otros módulos | Fuente |
| `docs/eventos/consumidos/commercialFineGenerated.md` | 2356 | 2026-11-05 | d0f8e91 | Referencia (evento ajeno) | Equipo/otros módulos | Fuente |
| `docs/eventos/consumidos/notificationSent.md` | 1493 | 2026-10-20 | 1641298 | Referencia (evento ajeno) | Equipo/otros módulos | Fuente |
| `docs/eventos/consumidos/streetClosureApproved.md` | 4289 | 2026-10-20 | a05bc2e | Referencia (evento ajeno) | Equipo/otros módulos | Fuente |
| `docs/eventos/consumidos/streetClosureEnded.md` | 4532 | 2026-10-20 | a05bc2e | Referencia (evento ajeno) | Equipo/otros módulos | Fuente |
| `docs/eventos/consumidos/streetClosureRejected.md` | 2458 | 2026-11-02 | 9482e01 | Referencia (evento ajeno) | Equipo/otros módulos | Fuente |
| `docs/eventos/consumidos/ticketUpdated.md` | 20604 | 2026-10-22 | f75cf5f | Referencia (evento ajeno) | Equipo/otros módulos | Fuente |
| `docs/eventos/consumidos/weatherAlertIssued.md` | 2635 | 2026-09-20 | 6048655 | Referencia (evento ajeno) | Equipo/otros módulos | Fuente |
| `docs/eventos/consumidos/workOrderCompleted.md` | 3307 | 2026-10-20 | 1641298 | Referencia (evento ajeno) | Equipo/otros módulos | Fuente |
| `docs/eventos/consumidos/workOrderScheduled.md` | 2787 | 2026-11-05 | c07dcc9 | Referencia (evento ajeno) | Equipo/otros módulos | Fuente |
| `docs/eventos/publicados/README.md` | 7231 | 2026-10-28 | 3bf5b46 | Referencia (índice) | Equipo/otros módulos | Fuente |
| `docs/eventos/publicados/_shared.schema.json` | 4290 | 2026-10-27 | 94aeff3 | Referencia (schema) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/eventos/publicados/containerDamaged.md` | 1920 | 2026-10-27 | 94aeff3 | Referencia (evento propio) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/eventos/publicados/containerDamaged.schema.json` | 1321 | 2026-08-20 | f7539d8 | Referencia (schema) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/eventos/publicados/descartados.md` | 6516 | 2026-10-21 | 97809ec | Explicación | Equipo | Fuente |
| `docs/eventos/publicados/environmentalViolationDetected.md` | 3213 | 2026-10-21 | 2cb55d4 | Referencia (evento propio) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/eventos/publicados/environmentalViolationDetected.schema.json` | 2213 | 2026-09-02 | 068e9e2 | Referencia (schema) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/eventos/publicados/infrastructureRepairRequested.md` | 1876 | 2026-10-28 | 605085f | Referencia (evento propio) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/eventos/publicados/infrastructureRepairRequested.schema.json` | 1426 | 2026-10-28 | 605085f | Referencia (schema) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/eventos/publicados/streetClosureRequested.md` | 2563 | 2026-11-02 | 47b24e9 | Referencia (evento propio) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/eventos/publicados/streetClosureRequested.schema.json` | 2094 | 2026-11-02 | 47b24e9 | Referencia (schema) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/eventos/publicados/treeRiskDetected.md` | 2649 | 2026-10-27 | 94aeff3 | Referencia (evento propio) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/eventos/publicados/treeRiskDetected.schema.json` | 2732 | 2026-10-21 | 97809ec | Referencia (schema) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/eventos/publicados/updateTicketStatus.md` | 24259 | 2026-11-02 | a108b56 | Referencia (evento propio) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/eventos/publicados/updateTicketStatus.schema.json` | 5276 | 2026-10-20 | 11dfb5c | Referencia (schema) | Otros módulos | Fuente — contrato, requiere aviso |
| `docs/gestion/README.md` | 876 | 2026-08-20 | f7539d8 | Referencia (índice) | Equipo | Fuente |
| `docs/gestion/definition-of-done.md` | 5640 | 2026-10-08 | 5c3cbc2 | Referencia (checklist) | Equipo | Fuente |
| `docs/integracion/README.md` | 2667 | 2026-10-22 | 7e077a1 | Referencia (índice) | Equipo | Fuente |
| `docs/integracion/cuentas-empleado-m1.csv` | 119996 | 2026-11-03 | bea62a5 | Datos (¡PII!) | Equipo | Derivado de M1 (export) |
| `docs/integracion/historial.md` | 123489 | 2026-11-06 | 759220d | Registro cronológico | Equipo | Fuente (123 KB) |
| `docs/integracion/m1.md` | 32382 | 2026-11-06 | 759220d | Referencia (ficha de módulo) | Equipo/otro módulo | Fuente |
| `docs/integracion/m2.md` | 18251 | 2026-10-28 | 4e48880 | Referencia (ficha de módulo) | Equipo/otro módulo | Fuente |
| `docs/integracion/m3.md` | 8216 | 2026-11-05 | c07dcc9 | Referencia (ficha de módulo) | Equipo/otro módulo | Fuente |
| `docs/integracion/m4.md` | 6338 | 2026-11-06 | 759220d | Referencia (ficha de módulo) | Equipo/otro módulo | Fuente |
| `docs/integracion/m5-m8.md` | 594 | 2026-10-20 | 1641298 | Referencia (ficha) | Equipo | Fuente |
| `docs/integracion/m7.md` | 14271 | 2026-11-05 | d0f8e91 | Referencia (ficha de módulo) | Equipo/otro módulo | Fuente |
| `docs/integracion/m9.md` | 29464 | 2026-10-28 | 4e48880 | Referencia (ficha de módulo) | Equipo/otro módulo | Fuente |
| `docs/integracion/mensajes.md` | 39271 | 2026-11-05 | d0f8e91 | Registro de mensajes | Otros módulos | Fuente |
| `docs/integracion/resueltos.md` | 50615 | 2026-11-06 | 759220d | Registro | Equipo | Fuente (50 KB) |
| `docs/integracion/riesgos.md` | 4503 | 2026-11-05 | c07dcc9 | Explicación | Equipo | Fuente |
| `docs/seed.md` | 33747 | 2026-11-06 | 759220d | Referencia + how-to | Equipo | Fuente |
| `docs/superpowers/plans/2026-10-28-preparar-prueba-backend.md` | 9742 | 2026-10-28 | bd61e3a | Andamiaje de agente (plan) | IA | Fuente (histórico) |
| `docs/testing.md` | 7329 | 2026-11-06 | 759220d | How-to | Equipo | Fuente |
| `prisma/data/README.md` | 10294 | 2026-10-27 | 95e34d7 | Referencia + how-to | Equipo | Fuente |

## docs/QA/ (entregable de cátedra; fuente de los PDF)

| Ruta | Bytes | Últ. commit | Diátaxis |
|---|---:|---|---|
| `docs/QA/01-plan-y-estrategia.md` | 14980 | 2026-11-06 | Explicación |
| `docs/QA/02-historias-y-criterios.md` | 85661 | 2026-11-06 | Referencia |
| `docs/QA/03-matriz-trazabilidad.md` | 150002 | 2026-11-06 | Referencia (matriz; derivable) |
| `docs/QA/04-especificacion-casos.md` | 203228 | 2026-11-06 | Referencia |
| `docs/QA/05-informe-ejecucion.md` | 15551 | 2026-11-06 | Registro |
| `docs/QA/06-registro-defectos.md` | 26167 | 2026-11-06 | Registro |
| `docs/QA/07-informe-seguridad.md` | 25188 | 2026-11-06 | Explicación/Referencia |
| `docs/QA/09-lecciones-aprendidas.md` | 10088 | 2026-11-03 | Explicación |
| `docs/QA/README.md` | 3838 | 2026-11-03 | Referencia (índice) |
| `docs/QA/manual-de-usuario.md` | 42575 | 2026-11-04 | How-to/Tutorial (usuarios finales) |
| `docs/QA/pdf.css` | 1318 | 2026-11-03 | Estilo (PDF) |

## Agrupados

- `docs/manual-de-usuario/img/` — 19 capturas PNG, 2622161 bytes, último commit 2026-11-04. Soporte de `docs/QA/manual-de-usuario.md` (el manual original; el frontend guarda una copia), que vive en otra carpeta.
- `docs/geojson/` — 4 archivos, 20207180 bytes (~20 MB). Datos fuente de GCBA, no documentación; los consumen `scripts/build-*.ts`.

## Observaciones del inventario

1. **134 archivos versionados** relevantes, ~25 MB, de los cuales ~20 MB son GeoJSON (datos, no docs).
2. **Ausentes** (verificado con `ls`): `LICENSE`, `SECURITY.md`, `CHANGELOG*`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`. `.github/` solo tiene CODEOWNERS, branch-protection, scripts y 2 workflows.
3. **Mezclan tipos Diátaxis:** `docs/deploy.md` (32 KB), `CONTRIBUTING.md`, `README.md`, `devops/DEVOPS-SEGUIMIENTO.md` (20 KB).
4. **Archivos muy grandes** (candidatos a partir/archivar): `docs/QA/04-especificacion-casos.md` 203 KB, `docs/QA/03-matriz-trazabilidad.md` 150 KB, `docs/integracion/historial.md` 123 KB, `docs/api/endpoints.md` 114 KB, `docs/integracion/resueltos.md` 50 KB.
5. **Dos copias del DER:** `docs/DER.md` (Mermaid, 2026-11-06) y `docs/DER.puml` (PlantUML, 18 KB, 2026-11-02). Fechas distintas: riesgo de deriva.
6. **PII:** `docs/integracion/cuentas-empleado-m1.csv` tiene 1.510 filas con columnas `mail`, `nombre_empleado`, `apellido_empleado`, `uuid`, versionado. Se evalúa en Fase 1 (no se reproducen valores).
7. **Andamiaje de agente dentro de `docs/`:** `docs/agents/` (3 archivos) y `docs/superpowers/` (1 plan fechado 2026-10-28). Destino a definir en Fase 2/3.
8. **Contratos que circulan a otros grupos** (no tocar sin aviso): `Acuerdo-Eventos-M6.md`, `Sobres-M6.md`, `Cruce-Eventos-M6.md`, los `.schema.json` y los `.md` de eventos publicados.
9. **Fechas engañosas:** muchos archivos muestran 2026-11-06 / `759220d` por un commit de sincronización masiva (#525). La fecha de git no indica contenido fresco (p. ej. `LEEME.md` figura 2026-11-06 y su contenido está desfasado).
10. **PDFs** (`Diagrama de Eventos…`, `Documento de Alcance…`): entregables compilados, no se leyeron (AGENTS.md). No se pueden contrastar con el código desde este repo.
