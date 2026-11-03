# Datos de referencia del seed

| Archivo | Qué es | Origen |
|---|---|---|
| `m9-barrios.json`, `m9-zonas.json` | Snapshot del catálogo de M9 (64 barrios, 48 activos; 20 zonas administrativas, 15 comunas activas) | `GET /api/v1/catalogos/barrios` y `/zonas` del Core, foto del 27/10/2026. Ver `docs/deploy.md` |
| `espacios-verdes.json` | 1366 plazas, parques, plazoletas y paseos de CABA, con punto representativo y superficie | Ver abajo |
| `contenedores-ciudad.json` | 448 contenedores reales (325 negros + 123 verdes) que, con los 52 escritos a mano del seed, completan los 500 de la base | IDECABA, ver «Inventario de IDECABA» |
| `puntos-verdes-ciudad.json` | Los 19 puntos verdes de la Ciudad | IDECABA |
| `arbolado-ciudad.json` | 408 árboles del censo 2017-2018, 8 a 9 por barrio | IDECABA |

## `espacios-verdes.json`

- **Fuente**: dataset «Espacios verdes» de BA Data, Gobierno de la Ciudad de Buenos Aires (https://data.buenosaires.gob.ar/dataset/espacios-verdes). Descargado el 27/10/2026.
- **Licencia**: Creative Commons Atribución 2.5 Argentina (CC BY 2.5 AR), https://creativecommons.org/licenses/by/2.5/ar/ (dada por el PO; fuente https://data.buenosaires.gob.ar/es_AR/dataset/espacios-verdes). Los datos se usan con fines académicos y adaptados para el proyecto.
- **Crudo**: `docs/geojson/espacio_verde_publico.geojson` (18 MB, versionado tal cual; 2176 polígonos). El seed **no** lo carga: usa este JSON compacto.
- **Qué se conserva**: toda `PLAZA`, `PARQUE` y `PLAZOLETA` (1358), más `PARQUE SEMIPÚBLICO`, `JARDÍN BOTÁNICO` y `PASEO` (8). Quedan afuera canteros centrales, patios, jardines y complejos.
- **Campos**: `id` del dataset, `nombre`, `clasificacion`, `barrio` (el `codigo` de M9), `comuna`, `lat`/`lng` (un punto que cae dentro del polígono: el centroide si está adentro, si no el punto de grilla más cercano) y `areaM2`.
- **Nombre**: el del dataset; si falta, la ubicación con el tipo adelante (`Plazoleta Conde - Matienzo, Benjamin…`) y `nombreDerivado: true`. Si tampoco hay ubicación, `Plazoleta s/n <id>`.
- **Barrios**: el dataset escribe `Monserrat` y `Paternal` donde M9 usa `montserrat` y `la-paternal`; el script los aliasa y falla si algún barrio no empareja.

### Regenerarlo

```bash
npm run espacios-verdes:build                       # lee docs/geojson/espacio_verde_publico.geojson
npm run espacios-verdes:build -- ruta/otro.geojson  # o un archivo distinto
```

Tras regenerarlo, `npm test` valida que estén los 48 barrios, que las coordenadas caigan dentro de CABA y que el archivo siga compacto (< 300 KB).

## Inventario de IDECABA (`*-ciudad.json`)

Muestra **determinista** del inventario real de la Ciudad que reemplaza al inventario pseudoaleatorio del seed (#439). El seed lee solo estos JSON, nunca la red. Cada archivo es `{ "meta": {…}, "datos": […] }`: la cabecera trae fuente, capa, URL, fecha de descarga, consulta, licencia, atribución y qué se adaptó; los datos van de a una fila por línea. Los crudos no se guardan (31 mil contenedores y 422 mil árboles).

- **Fuente**: IDECABA, WFS del GeoServer de la Ciudad, `https://geoserver.buenosaires.gob.ar/geoserver/catalogo_og_130/wfs`. Descargado el 27/10/2026 (`contenedores_verdes` 4352 filas, `contenedores_negros` 27735, `puntos_verdes` 19, `arbolado_publico` 422255). Todas las capas son `Point`; con `outputFormat=application/json` las coordenadas vienen `[lng, lat]` (verificado con el Parque Las Heras y la Estación Lugano).
- **Atribución**: «Fuente: Gobierno de la Ciudad Autónoma de Buenos Aires (IDECABA / BA Data). Datos utilizados con fines académicos y adaptados para su integración en el proyecto».

### Licencia por capa

| Capa | Metadato (GeoNetwork de IDECABA, consultado el 27/10/2026) | Estado |
|---|---|---|
| `espacios_verdes` (dataset aparte, arriba) | CC BY 2.5 AR, https://creativecommons.org/licenses/by/2.5/ar/ | **Confirmada** por el PO |
| `contenedores_negros`, `contenedores_verdes`, `puntos_verdes` | «Uso personal e intransferible. Prohibido cualquier aprovechamiento o explotación […] con fines comerciales. Sin perjuicio de ello, la información podrá ser utilizada con fines informativos e ilustrativos en el contexto de un proyecto educacional o de divulgación científica, y siempre que se aclare la fuente.» | **Verificada: NO es CC BY 2.5 AR.** Uso educativo con fuente citada |
| `arbolado_publico` | Mismo texto en el registro «Arbolado público: censo 2017-2018» (uuid `86ed2312-00fa-4cfc-b68b-8ded11ce52b3`). Existe un segundo registro con el mismo título (`acc6a0f0-bdfd-402c-add0-cb71c1b2cdd3`) **sin restricciones cargadas** | Texto idéntico al de las otras; **no verificado** a cuál de los dos registros corresponde la capa del WFS |

Registros: `Puntos Verdes` `f8e0d695-4c22-4fef-b3c4-cb8161e67018`, `Contenedores Verdes` `2a32f946-2a93-41c9-9ba3-1927cbe15381`, `Contenedores Negros` `855ec46e-47eb-49ba-94dd-32af5aa7d020`. Este uso (proyecto académico, con la fuente citada) entra en la excepción educativa del texto. Las capas de contenedores y puntos verdes dicen además «uso personal e intransferible»: como este repositorio se comparte entre los grupos del TPO, el uso queda limitado al fin educativo con la fuente citada y los JSON **no deben redistribuirse como dataset** (ni con fines comerciales).

### Cómo se arma la muestra

```bash
npm run datos-ciudad:build                             # necesita red; ≈3 minutos, 274 pedidos
npm run datos-ciudad:build -- --descargado=2026-10-27  # fija la fecha de la cabecera
```

Pedidos (secuenciales, 300 ms de pausa, 3 reintentos, `User-Agent` de navegador porque el GeoServer lo exige). Todos con `service=WFS&version=2.0.0&request=GetFeature&typeNames=catalogo_og_130:<capa>&outputFormat=application/json&srsName=EPSG:4326&sortBy=id`:

- **Contenedores**: las dos capas completas, paginadas con `count=1000&startIndex=0,1000,…` (5 y 28 páginas; tope de 40).
- **Puntos verdes**: sin paginar, `sortBy=fna` (19 filas).
- **Árboles**: por cada uno de los 48 barrios, la caja del polígono `bbox=<lngMin>,<latMin>,<lngMax>,<latMax>,EPSG:4326`: primero `resultType=hits` (`numberMatched`) y después 4 ventanas de `count=75` con `startIndex` sorteado (si la caja tiene ≤300 árboles, se piden todos). No se bajan los 422 mil.

Luego, para todo punto:

1. **Barrio por geometría**: punto-en-polígono contra `docs/geojson/caba_barrios.geojson`, con los mismos `codigo` de M9 y alias que `build-espacios-verdes.ts` (`slugBarrio`). El campo `bar` del WFS se ignora. Coordenadas a 5 decimales y se asigna con la coordenada ya redondeada. Se rechaza lo que cae fuera de la caja de CABA o de todo barrio.
2. **Muestra**: PRNG con semilla (`datos-ciudad-439`, mulberry32 vía `semillaDe`), sin `Math.random`; los candidatos se ordenan por `id` antes de sortear, así que el resultado no depende del orden de la respuesta. Reparto parejo entre barrios (siempre al barrio con menos, contando los contenedores escritos a mano del seed, `CONTENEDORES_A_MANO`; un barrio sin capacidad cede su cupo a los demás): negros 325, verdes 123, árboles 408. **Cuenta de contenedores**: la base queda en exactamente 500 = 448 reales + 52 a mano; de esos 52 hay 31 `HOUSEHOLD`, 16 `RECYCLABLE`, 3 `GREEN` y 2 `BULKY`, que no entran en negros/verdes, así que la base es 356 `HOUSEHOLD` + 139 `RECYCLABLE` + 5 de otros tipos (para 360/140 exactos haría falta una muestra de 329 + 124 y la base sumaría 505). Falla si algún barrio queda con menos de 4 contenedores (contando los de mano) o 3 árboles. En la corrida del 27/10 ningún barrio quedó corto de capacidad (no hubo redistribución): 9 a 13 contenedores y 2 a 3 verdes por barrio contando todos, 8 a 9 árboles.

### Mapeos

| Origen | Destino |
|---|---|
| `contenedores_negros` | `ContainerType.HOUSEHOLD` |
| `contenedores_verdes` | `ContainerType.RECYCLABLE` |
| Árbol `nam` («Fraxinus Pennsylvanica») | `species` en forma de binomial («Fraxinus pennsylvanica»). Ojo: `nam` es el nombre **científico** y `nco` el común («Fresno Americano»), al revés de lo que sugiere el nombre del campo; `nco` queda como `commonName` |
| `alt`, `dmt` | `heightM` (m), `diameterCm` (cm); se exigen > 0 |
| `vta` = «Vital» | `HEALTHY` |
| `vta` = «En Observación» | `DISEASED` (el censo lo tiene bajo seguimiento sanitario) |
| `vta` = «Escasa Foliación» | `WEAKENED` (sigue en pie, con la copa rala) |
| `vta` = «Tocón», «Cepa» | `DEAD` (queda el tronco o la base, sin copa) |
| `vta` vacío | el árbol no se usa (en el censo es un hueco sin ejemplar) |
| — | `sta` (estructura) y `uve` (ubicación) no se usan. Estados en la muestra: 386 `HEALTHY`, 12 `DISEASED`, 9 `WEAKENED`, 1 `DEAD` |
| Punto verde `wsc` | siempre `RECYCLABLE` (pilas, aceite, RAEE, cápsulas, cartón, vidrio…); además `GREEN` si dice «Orgánicos» y `BULKY` si dice «Voluminosos» |

Lo que **no** existe en IDECABA y el seed completa: capacidad de los contenedores (alterna 2400/3200 L), su estado (todos `ACTIVE`; los de demostración están en `CONTENEDORES_DEMO` de `prisma/seed-lugares.ts`), el riesgo de los relevamientos de árboles (ver `docs/seed.md`) y los códigos `CT-<codigo>-NNNN`, `GP-<codigo>-NN`, `ARB-<codigo>-9NNNN`.

### Aplicarlo a una base que ya tiene el inventario viejo

**El vaciado previo es obligatorio.** El inventario se siembra con `createMany` + `skipDuplicates` y los códigos `CT-<barrio>-NNNN`, `GP-<barrio>-01` y `ARB-<barrio>-9NNNN` coinciden con los del generador anterior: sin vaciar, el seed conserva las coordenadas pseudoaleatorias viejas mezcladas con las reales y quedan huérfanos los códigos que ya no existen (p. ej. los `GP-<barrio>-01` de los barrios sin punto verde real). Ver el procedimiento de vaciado en `docs/seed.md` §5.

### Límites conocidos

- `descargado` de la cabecera es la fecha de la corrida (o `--descargado=AAAA-MM-DD`): regenerar sin fijarla cambia esa línea de los tres JSON. El seed no lee ese campo.
- `especie()` deja todo en minúsculas salvo la inicial («Fraxinus Pennsylvanica» pasa a «Fraxinus pennsylvanica»). En una regeneración futura puede dañar un cultivar con comillas o mayúsculas internas (p. ej. `Prunus cerasifera 'Pissardii'`). Con la muestra actual no se detectó ninguno.
