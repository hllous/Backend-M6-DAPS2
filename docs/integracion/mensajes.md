# Mensajes a otros módulos

> Registro de lo **enviado** a otros módulos y **todavía sin respuesta**, del más nuevo al más viejo. Acá solo quedan mensajes ya enviados, con su fecha y hora: los borradores y los pendientes no se guardan en este archivo. Enviarlos y anotar la hora es trabajo de una persona, no del repo. Al responder el módulo, la respuesta va a su ficha (`mX.md`), la novedad al [historial](historial.md) y el mensaje sale de acá. Depurado el 23/11/2026: se quitaron los mensajes respondidos, superados o cerrados (M1, M2, M3, M7, M9 y los de M4 de octubre y del 5/11 de las 14:06); el texto de cada uno queda en el historial de git (`git show 1729d90:docs/integracion/mensajes.md`).

## Enviado el 23/11 a las 19:40 (M4)

**→ M4 (Faltas / Sanciones), respuesta sobre el typo del Core y el DEAD de `commercialFineGenerated`** — *enviado el 23 nov 2026 a las 19:40; espera respuesta de M4*

> Hola! Contestamos sus dos puntos:
>
> **1. Nombre del evento ambiental.** M6 publica `environmentalViolationDetected`, escrito correctamente. El nombre con typo, `envirometnalViolationDetected`, es solo del registro del Core. Lo teníamos anotado desde el 27/10 como pendiente de su lado. Tienen que suscribirse al nombre correcto y dar de baja el del typo. Si siguen suscriptos solo al del typo, no les va a llegar nada.
>
> **2. `commercialFineGenerated` en DEAD.** Nuestro consumidor rechaza (nack) el mensaje si falta `sourceViolationId` (o `violationId`) o si no tiene forma de UUID. Ese campo tiene que ser el `violationId` del acta que les derivamos en `environmentalViolationDetected`. No sirve un id propio de ustedes (`FINE-…`, `EST-…`) ni uno inventado. También se rechaza si el sobre trae un `correlationId` que no es UUID. Si el UUID es válido pero el acta no existe en M6, no da DEAD: lo descartamos con un aviso y confirmamos la recepción.
>
> No podemos confirmar la causa sin ver el mensaje, porque los inválidos no quedan guardados de nuestro lado. ¿Nos pasan el `eventId` y el `data` que mandaron? Con eso les decimos exactamente qué campo falló. Para la prueba, usen el `violationId` de un acta real derivada desde M6.
>
> **Para coordinar la prueba ambiental**, necesitamos primero tres respuestas que tienen pendientes desde hace semanas:
>
> 1. La búsqueda de establecimientos por REST (dirección, CUIT o barrio) del #500, que les pedimos el 5/11. Si no la implementan, el inspector carga el `establishmentId` a mano, pero necesitamos que lo confirmen.
> 2. Los nombres exactos que emiten hoy en el Core (`commercialFineGenerated` y `closureUpdate`, o los viejos `commercialFineIssued` y `closureOrdered`).
> 3. Si `decidedAt` y `externalRef` viajan en los eventos reales.
>
> Avisen cuando lo tengan y coordinamos.

## Enviado el 5/11 (M4)

**→ M4 (Faltas / Sanciones), versión con plan B** — *enviado el 5 nov 2026 a las 14:36 ([#500](https://github.com/hllous/Backend-M6-DAPS2/issues/500)); sin respuesta al 23/11. Redactado tras leer su contrato v1.2 RC del 2/11*

> Leímos su contrato integral v1.2 RC del 2/11. Nuestro `environmentalViolationDetected` coincide con lo que dicen recibir, incluido `FORMAL_NOTICE`. Dos cosas para destrabar la derivación de actas:
>
> 1. **Búsqueda de establecimientos por REST** (dirección, CUIT o barrio): su documento no la menciona y sin `establishmentId` no podemos derivar un acta. ¿Piensan implementarla? Si sí, necesitamos la ruta, los parámetros, el identificador que devuelven y qué responden con cero o varias coincidencias.
> 2. **UUID de integración:** el §11 dice que el mapeo `EST-…` → UUID todavía no está persistido. El `establishmentId` que les mandemos tiene que ser ese UUID estable. ¿Cuándo lo tendrían?
>
> Estamos en la recta final. Si no llegan, del lado nuestro el inspector cargaría el `establishmentId` a mano. Necesitamos saberlo hoy o mañana para decidir.
