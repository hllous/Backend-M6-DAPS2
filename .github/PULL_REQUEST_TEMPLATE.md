## Descripción

<!-- Qué hace y por qué. -->

Closes #XXX

## Cambios

<!-- Lista corta. Si tocó documentación, cuál. Si algo queda pendiente en otro PR, cuál. -->

## Evidencias

<!-- Salida de build/lint/tests, capturas, o el comando que prueba el cambio. -->

## Checklist

- [ ] El código compila y los tests pasan localmente
- [ ] Cobertura de tests ≥ 85% en los archivos tocados
- [ ] Si es un endpoint: cumple el [estándar Swagger](../docs/api/estandar-swagger.md) y `docs/api/openapi.json` está regenerado
- [ ] Si es un evento nuevo o cambia un payload: `docs/eventos/` y el schema JSON actualizados, y avisado a los consumidores
- [ ] Si es una decisión técnica: hay un ADR en [`docs/decisiones/`](../docs/decisiones/)
- [ ] Ninguna variable de entorno queda hardcodeada (y está en `.env.example`)
- [ ] El linter no arroja warnings nuevos
- [ ] Docs actualizadas (`npm run docs:check` en verde)
