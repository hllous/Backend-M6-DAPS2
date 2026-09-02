# ADR-004: JWT de usuario emitido por M1 y consulta a identidad desacoplada por puerto

## Estado

**Aceptado** — 2026-09-01

## Contexto

El acuerdo con M1 establece que ese módulo autentica a las personas y emite el JWT de usuario, mientras que M6 debe validar el token al proteger sus recursos. M1 todavía no publicó el contrato criptográfico verificable ni M6 necesita, en sus casos de uso actuales, consultar ciudadanos u organizaciones de M1.

El transporte futuro de una eventual consulta de identidad tampoco es necesario para implementar el dominio: M1 documentó alternativas REST y eventos, y la cohorte todavía debe cerrar cuándo aplica cada una.

## Decisión

M6 no emite JWT propios. Valida los JWT emitidos por M1 mediante una configuración basada en el contrato que M1 publique. Mientras falten sus parámetros técnicos, las claves de desarrollo son locales, configurables y no representan un contrato de integración.

Cuando un caso de uso necesite datos de identidad de M1, dependerá de un puerto de aplicación; un adaptador de infraestructura implementará REST o Kafka request/response. No se agrega ese adaptador ni se consumen eventos de M1 hasta que exista un caso de uso de M6 que lo requiera.

## Alternativas consideradas

- **Que M6 emita un JWT propio**: descartada. Duplica la autoridad de identidad y contradice el acuerdo con M1.
- **Acoplar el dominio ya a endpoints o eventos de M1**: descartada. No hay consumidor actual y el transporte todavía no hace falta decidirlo.
- **JWT de M1 + puerto de identidad diferido**: elegida. Permite implementar autenticación y dominio de M6 sin inventar contratos ajenos.

## Consecuencias

### Positivas

- Una sola autoridad para la identidad de usuarios.
- La lógica de dominio no cambia si una consulta futura usa REST o Kafka.

### Negativas

- No se puede activar validación JWT real fuera de desarrollo hasta que M1 publique firma, claves, claims, emisor, audiencia y TTL.
- Una integración futura requerirá un adaptador y pruebas de contrato adicionales.

### Neutras

- El token de servicio del Core/M9, si se usa para comunicación máquina-a-máquina, se trata como una credencial distinta del JWT de usuario.

## Referencias

- [`../bloqueantes.md`](../bloqueantes.md)
- Catálogo M1 v2 compartido el 2026-09-01.
