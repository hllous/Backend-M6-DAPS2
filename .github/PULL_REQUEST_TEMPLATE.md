## Descripción

<!-- Qué hace y por qué. -->

Closes #XXX

## Tipo de cambio

<!-- Debe coincidir con el prefijo de la rama y del commit. Dejar uno. -->

feature · fix · docs · refactor · tests · chore

## Cambios

<!-- Lista corta. Si tocó documentación, cuál. Si algo queda pendiente en otro PR, cuál. -->

## Evidencias

<!-- Salida de build/lint/tests, capturas, o el comando que prueba el cambio. -->

## Checklist

- [ ] El código compila y los tests pasan localmente
- [ ] Cobertura de tests ≥ 85% en los archivos tocados (medida con `npm run test:cov`)
- [ ] Si es un endpoint: cumple el [estándar Swagger](../docs/api/estandar-swagger.md) y `docs/api/openapi.json` está regenerado
- [ ] Si es un endpoint: declara `@Roles` en las escrituras, valida pertenencia del recurso (no solo el rol) y no expone campos internos en la respuesta
- [ ] Si cambia un endpoint o DTO público: avisado al Frontend con un issue en `hllous/Frontend-M6-DAPS2`
- [ ] Si es un evento nuevo o cambia un payload: `docs/eventos/` y el schema JSON actualizados, y avisado a los consumidores
- [ ] Si es una decisión técnica: hay un ADR en [`docs/decisiones/`](../docs/decisiones/)
- [ ] Ninguna variable de entorno queda hardcodeada (y está en `.env.example`)
- [ ] El linter no arroja warnings nuevos
- [ ] Docs actualizadas (`npm run docs:check` en verde)

## Uso de IA

<!-- No / Sí (qué partes: código, tests, docs). Todo lo generado con IA fue revisado y lo puede explicar su autor, incluidos los tests. -->

- [ ] Declarado arriba y entendido por el autor
