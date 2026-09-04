/**
 * Límites de tasa del portal público.
 *
 * Viven en su propio archivo y no en el módulo porque los usan **el módulo y
 * el controller**: tenerlos en el módulo cerraba un ciclo de imports que
 * TypeScript acepta y Node rompe al arrancar.
 *
 * `CONSULTA` cubre el uso normal: el frontend carga zonas, puntos verdes y el
 * calendario al abrir la página, y un vecino mirando el mapa hace unos pocos
 * más. Sesenta por minuto le sobra a una persona y no le alcanza a nadie que
 * quiera bajarse la base.
 *
 * `SEGUIMIENTO` es más estricto porque `GET /public/reports/:ticketId` deja
 * **probar números de reclamo de a uno** para averiguar cuáles tienen
 * expediente ambiental. Devolver el mismo 404 exista o no el ticket evita
 * confirmar uno puntual, pero no evita insistir: el límite sí.
 *
 * Es **un solo throttler** con una excepción por endpoint, no dos nombrados.
 * Con dos, `@SkipThrottle` a nivel de clase se fusiona con el del método en
 * vez de reemplazarlo, así que la excepción terminaba salteando los dos y
 * ningún límite se aplicaba. El contador de `@nestjs/throttler` ya es por
 * handler, así que un throttler alcanza para tener dos límites distintos.
 */
export const CONSULTA = { ttl: 60_000, limit: 60 } as const;

export const SEGUIMIENTO = { ttl: 60_000, limit: 20 } as const;
