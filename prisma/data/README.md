# Datos de referencia del seed

| Archivo | Qué es | Origen |
|---|---|---|
| `m9-barrios.json`, `m9-zonas.json` | Snapshot del catálogo de M9 (64 barrios, 48 activos; 20 zonas administrativas, 15 comunas activas) | `GET /api/v1/catalogos/barrios` y `/zonas` del Core, foto del 27/10/2026. Ver `docs/deploy.md` |
| `espacios-verdes.json` | 1366 plazas, parques, plazoletas y paseos de CABA, con punto representativo y superficie | Ver abajo |

## `espacios-verdes.json`

- **Fuente**: dataset «Espacios verdes» de BA Data, Gobierno de la Ciudad de Buenos Aires (https://data.buenosaires.gob.ar/dataset/espacios-verdes). Descargado el 27/10/2026.
- **Licencia**: a confirmar en el portal oficial antes de redistribuirlo fuera del proyecto.
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
