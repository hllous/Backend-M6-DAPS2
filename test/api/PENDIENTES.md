# Endpoints sin caso de éxito en la colección Postman

Generado por `npm run api:collection`. Todos tienen caso de error (401/403/400/404 según corresponda);
60 de 152 tienen además caso de éxito. Los 92 de abajo no, y por qué:

| Endpoint | Motivo |
|---|---|
| `POST /events/inbox` | escritura: necesita datos y estado de dominio |
| `POST /events/outbox/retry-failed` | escritura: necesita datos y estado de dominio |
| `POST /events/outbox/{id}/retry` | escritura: necesita datos y estado de dominio |
| `POST /zones` | escritura: necesita datos y estado de dominio |
| `PATCH /zones/{id}` | escritura: necesita datos y estado de dominio |
| `DELETE /zones/{id}` | escritura: necesita datos y estado de dominio |
| `POST /zones/{id}/neighborhoods` | escritura: necesita datos y estado de dominio |
| `DELETE /zones/{id}/neighborhoods/{neighborhoodId}` | escritura: necesita datos y estado de dominio |
| `GET /neighborhoods` | depende del catalogo de M9 (503 sin acceso al Core) |
| `POST /service-types` | escritura: necesita datos y estado de dominio |
| `PATCH /service-types/{id}` | escritura: necesita datos y estado de dominio |
| `DELETE /service-types/{id}` | escritura: necesita datos y estado de dominio |
| `POST /disposal-sites` | escritura: necesita datos y estado de dominio |
| `PATCH /disposal-sites/{id}` | escritura: necesita datos y estado de dominio |
| `DELETE /disposal-sites/{id}` | escritura: necesita datos y estado de dominio |
| `POST /routes` | escritura: necesita datos y estado de dominio |
| `PATCH /routes/{id}` | escritura: necesita datos y estado de dominio |
| `DELETE /routes/{id}` | escritura: necesita datos y estado de dominio |
| `PUT /routes/{id}/stops` | escritura: necesita datos y estado de dominio |
| `POST /service-frequencies` | escritura: necesita datos y estado de dominio |
| `PATCH /service-frequencies/{id}` | escritura: necesita datos y estado de dominio |
| `DELETE /service-frequencies/{id}` | escritura: necesita datos y estado de dominio |
| `POST /crews` | escritura: necesita datos y estado de dominio |
| `PATCH /crews/{id}` | escritura: necesita datos y estado de dominio |
| `DELETE /crews/{id}` | escritura: necesita datos y estado de dominio |
| `POST /crews/{id}/members` | escritura: necesita datos y estado de dominio |
| `DELETE /crews/{id}/members/{userId}` | escritura: necesita datos y estado de dominio |
| `POST /crews/{id}/zone-assignments` | escritura: necesita datos y estado de dominio |
| `POST /vehicles` | escritura: necesita datos y estado de dominio |
| `PATCH /vehicles/{id}` | escritura: necesita datos y estado de dominio |
| `DELETE /vehicles/{id}` | escritura: necesita datos y estado de dominio |
| `POST /containers` | escritura: necesita datos y estado de dominio |
| `PATCH /containers/{id}` | escritura: necesita datos y estado de dominio |
| `POST /containers/{id}/report-overflow` | escritura: necesita datos y estado de dominio |
| `POST /containers/{id}/report-damage` | escritura: necesita datos y estado de dominio |
| `POST /containers/{id}/empty` | escritura: necesita datos y estado de dominio |
| `POST /containers/{id}/start-repair` | escritura: necesita datos y estado de dominio |
| `POST /containers/{id}/complete-repair` | escritura: necesita datos y estado de dominio |
| `POST /containers/{id}/relocate` | escritura: necesita datos y estado de dominio |
| `POST /containers/{id}/confirm-relocation` | escritura: necesita datos y estado de dominio |
| `POST /containers/{id}/remove` | escritura: necesita datos y estado de dominio |
| `POST /trees` | escritura: necesita datos y estado de dominio |
| `PATCH /trees/{id}` | escritura: necesita datos y estado de dominio |
| `DELETE /trees/{id}` | escritura: necesita datos y estado de dominio |
| `POST /trees/{treeId}/surveys` | escritura: necesita datos y estado de dominio |
| `POST /tree-interventions` | escritura: necesita datos y estado de dominio |
| `POST /tree-interventions/{id}/submit-for-authorization` | escritura: necesita datos y estado de dominio |
| `POST /tree-interventions/{id}/authorize` | escritura: necesita datos y estado de dominio |
| `POST /tree-interventions/{id}/reject` | escritura: necesita datos y estado de dominio |
| `POST /tree-interventions/{id}/assign-service` | escritura: necesita datos y estado de dominio |
| `POST /green-spaces` | escritura: necesita datos y estado de dominio |
| `PATCH /green-spaces/{id}` | escritura: necesita datos y estado de dominio |
| `DELETE /green-spaces/{id}` | escritura: necesita datos y estado de dominio |
| `POST /green-points` | escritura: necesita datos y estado de dominio |
| `PATCH /green-points/{id}` | escritura: necesita datos y estado de dominio |
| `DELETE /green-points/{id}` | escritura: necesita datos y estado de dominio |
| `POST /services` | escritura: necesita datos y estado de dominio |
| `PATCH /services/{id}` | escritura: necesita datos y estado de dominio |
| `POST /services/{id}/assign-crew` | escritura: necesita datos y estado de dominio |
| `POST /services/{id}/delay-notices` | escritura: necesita datos y estado de dominio |
| `POST /services/{id}/start` | escritura: necesita datos y estado de dominio |
| `POST /services/{id}/suspend` | escritura: necesita datos y estado de dominio |
| `POST /services/{id}/resume` | escritura: necesita datos y estado de dominio |
| `POST /services/{id}/complete` | escritura: necesita datos y estado de dominio |
| `POST /services/{id}/cancel` | escritura: necesita datos y estado de dominio |
| `POST /services/{id}/reschedule` | escritura: necesita datos y estado de dominio |
| `POST /services/{id}/confirm-reschedule` | escritura: necesita datos y estado de dominio |
| `POST /services/{id}/zone-results` | escritura: necesita datos y estado de dominio |
| `POST /services/{id}/collection-records` | escritura: necesita datos y estado de dominio |
| `POST /environmental-reports/{reportId}/inspections` | escritura: necesita datos y estado de dominio |
| `GET /environmental-inspections/{id}` | el listado del padre no existe para resolver el id |
| `POST /environmental-inspections/{id}/complete` | escritura: necesita datos y estado de dominio |
| `POST /environmental-inspections/{id}/violation-notice` | escritura: necesita datos y estado de dominio |
| `GET /environmental-inspections/{id}/violation-notice` | el listado del padre no existe para resolver el id |
| `POST /environmental-reports` | escritura: necesita datos y estado de dominio |
| `POST /environmental-reports/{id}/start-review` | escritura: necesita datos y estado de dominio |
| `POST /environmental-reports/{id}/forward` | escritura: necesita datos y estado de dominio |
| `POST /environmental-reports/{id}/dismiss` | escritura: necesita datos y estado de dominio |
| `POST /environmental-reports/{id}/request-information` | escritura: necesita datos y estado de dominio |
| `POST /environmental-reports/{id}/close` | escritura: necesita datos y estado de dominio |
| `POST /repair-requests` | escritura: necesita datos y estado de dominio |
| `POST /repair-requests/{id}/start` | escritura: necesita datos y estado de dominio |
| `POST /repair-requests/{id}/close` | escritura: necesita datos y estado de dominio |
| `POST /street-closure-requests` | escritura: necesita datos y estado de dominio |
| `POST /street-closure-requests/{id}/approve` | escritura: necesita datos y estado de dominio |
| `POST /street-closure-requests/{id}/reject` | escritura: necesita datos y estado de dominio |
| `POST /street-closure-requests/{id}/end` | escritura: necesita datos y estado de dominio |
| `GET /public/reports/{ticketId}` | el listado del padre no existe para resolver el id |
| `POST /evidence` | escritura: necesita datos y estado de dominio |
| `GET /evidence` | query requerido sin valor de demo |
| `PUT /role-assignments/{userId}` | escritura: necesita datos y estado de dominio |
| `DELETE /role-assignments/{userId}` | escritura: necesita datos y estado de dominio |

## Hallazgos de Schemathesis

Defectos reales del backend frente a `docs/api/openapi.json` (corrida local, solo GET, #572). No se arreglan en esta rama.

- **H-1, 400 no declarado (resuelto, #593):** los GET con parámetros declaran el 400 con `@ApiBadRequestParams()`, lo exige `openapi-contract.spec` y el step `status_code_conformance` de `api-tests.yml` es bloqueante.
- **H-2, 503 en `GET /neighborhoods`:** sin acceso al catálogo de M9 responde 503 (ST101, error de servidor). Se excluye del step bloqueante con `--exclude-path /neighborhoods`.
