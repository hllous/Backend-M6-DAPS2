# GeoJSON de CABA: comunas y barrios

Límites oficiales para ubicar lugares en el seed y para que el frontend dibuje las comunas con borde y los barrios como áreas de color dentro de su comuna ([#422](https://github.com/hllous/Backend-M6-DAPS2/issues/422), Frontend #708 y #709). Son datos de referencia: ni el backend ni el seed los consultan en vivo.

| Archivo | Features | Geometría | Propiedades |
|---|---|---|---|
| `caba_comunas.geojson` | 15 | `MultiPolygon` | `ID`, `OBJETO`, `COMUNAS` (número), `BARRIOS` (lista de barrios), `PERIMETRO`, `AREA` |
| `caba_barrios.geojson` | 48 | `MultiPolygon` | `BARRIO` (nombre en mayúsculas), `COMUNA` (número), `PERIMETRO`, `AREA`, `OBJETO` |
| `espacio_verde_publico.geojson` (18 MB) | 2176 | `Polygon` / `MultiPolygon` | `id`, `nombre`, `nom_mapa`, `barrio`, `comuna`, `ubicacion`, `clasificac`, `tiene_pati`, `apadrinada`, `area`, `perimetro` y otras (decretos, boletines, etc.) |

CRS: `urn:ogc:def:crs:OGC:1.3:CRS84` (longitud, latitud; equivale a EPSG:4326).

## Emparejar con el catálogo de M9

El catálogo de M9 (`GET /api/v1/catalogos/barrios`) identifica el barrio por `codigo` (slug sin acentos) y la comuna en `zona` (`comuna-N`).

- Barrio: normalizar `BARRIO` (sin acentos, minúsculas, espacios y signos a `-`, `GRAL.` como `general`) y buscar el `codigo`. Controlado el 27/10/2026 contra el catálogo real: coinciden los 48 barrios activos. Caso a mano: `BOCA` ↔ `la-boca`.
- Comuna: `COMUNA` (o `COMUNAS`) `N` ↔ `comuna-N`. Controlado el mismo día: el número coincide con el `zona` de M9 en los 48 barrios.
- El catálogo de M9 también trae 16 barrios ficticios dados de baja (`activo: false`) que no aparecen en estos archivos.

El dataset de espacios verdes escribe `MONSERRAT` y `LA BOCA` donde los otros dos archivos dicen `MONTSERRAT` y `BOCA`; M9 usa `montserrat` y `la-boca`. Al emparejar hay que aliasar esos dos nombres. De él sale `prisma/data/espacios-verdes.json` (ver `prisma/data/README.md`); el seed no carga los 18 MB en runtime.

## Fuente

Cargados por el equipo el 27/10/2026. Las propiedades corresponden a los datasets abiertos de la Ciudad de Buenos Aires (BA Data, comunas y barrios). Licencia: Creative Commons Atribución 2.5 Argentina (CC BY 2.5 AR, https://creativecommons.org/licenses/by/2.5/ar/), fuente https://data.buenosaires.gob.ar/es_AR/dataset/espacios-verdes; los datos se utilizaron con fines académicos y adaptados para su integración en el proyecto.

`espacio_verde_publico.geojson`: dataset «Espacios verdes» de BA Data (https://data.buenosaires.gob.ar/dataset/espacios-verdes), descargado el 27/10/2026, versionado tal cual. Licencia: CC BY 2.5 AR (https://creativecommons.org/licenses/by/2.5/ar/), confirmada por el PO.

`caba_barrios.geojson` también decide el barrio de cada contenedor, punto verde y árbol de IDECABA (`scripts/build-datos-ciudad.ts`, ver `prisma/data/README.md`): por punto-en-polígono, no por el campo `bar` del WFS.
