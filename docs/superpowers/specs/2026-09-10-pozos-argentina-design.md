# pozos-argentina — Diseño

- **Fecha:** 2026-09-10
- **Estado:** aprobado

## Historial de revisiones

| Revisión | Cambio |
|---|---|
| 2026-09-10 a | Versión inicial: CKAN consultado en runtime desde el navegador. |
| 2026-09-10 b | **`datos.energia.gob.ar` degrada HTTPS a HTTP con un 301, y el navegador bloquea ese salto por mixed content.** La consulta en runtime es imposible desde un sitio servido por HTTPS. Todo pasa a precomputarse en build time. |

## Qué es

Un sitio estático que permite buscar pozos de hidrocarburos de Argentina por área de
concesión, yacimiento, operadora o polígono dibujado, verlos en un mapa y **descargar un
CSV con una fila por pozo**: su ficha completa más el resumen de producción acumulada.

El producto es el armador de descargas. El mapa existe para elegir y para confirmar que se
eligió bien, no para analizar.

## El problema que resuelve

La Secretaría de Energía publica la geometría y la ficha de los pozos por un lado, y la
producción mensual por otro, en 44 recursos anuales con duplicados y truncados. Nadie
publicó las dos cosas unidas y listas para usar. Unirlas es una sola consulta SQL, pero hay
que saber cuál, y hay que saber cuáles de los 44 recursos son los buenos.

## Investigación previa

Todo lo que sigue se midió contra el origen los días 2026-09-09 y 2026-09-10. No hay
supuestos sin verificar.

### El origen de datos

| | WMS (`sig.energia.gob.ar`) | CKAN pozos | CKAN producción |
|---|---|---|---|
| Pozos | 85.337 | 85.611 | 85.253 con producción 2018+ |
| Geometría | sí | sí, columna `geojson` | sí, pero **transpuesta** |
| Consultable con SQL | no | sí | sí |
| Último dato | 2026-09-05 | 2026-06-12 | 2026-07 |

El recurso **"Capítulo IV - Pozos"** (`cb5c0f04-7835-45cd-b982-3e25ca7d7751`) contiene el
mismo universo de pozos que el WMS, con los mismos atributos más una columna `geojson` con
geometría de punto en WGS84 correcta y sin nulos.

### La restricción que define la arquitectura

`https://datos.energia.gob.ar` responde **301 hacia `http://`**. Los navegadores bloquean
ese descenso por mixed content, así que **una página servida por HTTPS no puede consultar el
API**, ni directamente ni siguiendo el redirect. Se buscó alternativa: `datos.gob.ar` sirve
HTTPS sano pero no federa el DataStore (`Resource ... was not found`), y no existe otro host.

Consecuencia: **todo el acceso al origen ocurre en build time, desde Node**, donde el HTTP
plano es irrelevante. El sitio publicado no hace ninguna llamada al origen.

### Capacidades verificadas del DataStore de CKAN

- `datastore_search_sql` acepta SQL completo: `JOIN` entre recursos, CTE, `UNION ALL`,
  `GROUP BY`, `FILTER`, funciones de ventana.
- Sin tope de 32.000 filas: se pidieron 60.000 y las devolvió.
- **PostGIS no está expuesto** (`st_makeenvelope` no existe).
- **Timeout de gateway a los 60 s.** El volcado de la tabla de pozos da 504 completo y
  responde bien paginado de a 20.000 filas.
- El agregado de producción de **todos** los pozos sobre 9 años entra en una sola consulta:
  85.253 filas en 16,7 s.

### Peso de los artefactos

Medido de punta a punta, con diccionario para los strings repetidos:

| Artefacto | Contenido | Crudo | Gzip |
|---|---|---|---|
| `pozos-lite.json` | 85.611 pozos: id, lon, lat, área, yacimiento, empresa, cuenca | 3,54 MB | **0,81 MB** |
| `pozos-full-<cuenca>.json` | Ficha completa y resumen de producción | 7,85 MB total | **0,69 MB** el mayor |

La partición mayor es Golfo San Jorge, con 44.390 pozos; le sigue Neuquina con 33.155. Entre
las dos son el 90% del país.

## Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Trabajo de la app | Llevarse el dato cruzado | El valor está en la descarga, no en la visualización. Un visor ya existe: `sig.energia.gob.ar/v`. |
| Forma del dato | Ficha + resumen por pozo, una fila por pozo | Cubre el 80% de los casos con el archivo más liviano y más abrible. |
| Ámbitos | Área/concesión, yacimiento, operadora, polígono | Los cuatro colapsan en dos mecanismos, no cuatro. |
| Formato | CSV con `lon`/`lat` | Cero dependencias. Lo abren Excel, QGIS, pandas y R. |
| Origen de datos | CKAN; el WMS sólo como teselas de contexto | El WMS no aporta datos que CKAN no tenga, y no se puede consultar con SQL. |
| Momento del cruce | Build time, precomputado | Obligado por el bloqueo de mixed content. Simplifica todo lo demás. |
| Pozos sin producción | `LEFT JOIN`, acumulados en cero | Son **520 pozos reales**. Con `INNER JOIN` desaparecían sin aviso. |

### Enfoques descartados

- **Proxy para consultar en runtime.** Un Worker de veinte líneas resolvería el mixed content,
  pero reintroduce infraestructura para comprar frescura diaria de un dato que se publica una
  vez por mes.
- **Reconciliar con el WMS para cubrir la brecha de frescura.** El WMS conoce pozos tres meses
  más nuevos que CKAN. Cubrirlo exige un segundo volcado, lidiar con la cadena TLS incompleta
  del WMS y decidir qué mostrar de un pozo sin producción. Se difiere.
- **WMS como espina, join en el navegador.** Entre tres y cuatro veces más trabajo, sin
  beneficio que los anteriores no den más barato.

## Arquitectura

Sitio estático puro. Sin backend, sin base de datos, sin `sql.js`, **y sin ninguna llamada al
origen desde el navegador**. Vite 6, JavaScript vanilla en módulos ES, Leaflet, Vitest. Las
mismas convenciones que `indec-descargas`.

### Build time — `scripts/build-index.mjs`

Corre en Node, contra `http://datos.energia.gob.ar`. Cuatro pasos:

1. **Resolver recursos.** Elegir, por año, el recurso de producción autoritativo entre los 44
   candidatos. Cubre 2018 hasta el año en curso; el rango es configurable en un solo lugar.
2. **Volcar pozos.** Paginado de 20.000 filas, con reintento.
3. **Agregar producción.** Una sola consulta con `UNION ALL` de los años elegidos y
   `GROUP BY idpozo`.
4. **Construir artefactos.** Fusionar por `idpozo`, codificar con diccionario, particionar el
   detalle por cuenca.

Salidas en `public/`:

- `pozos-lite.json` — índice para mapa, buscador y polígono.
- `pozos-full-<cuenca>.json` — una por cuenca, con ficha y producción.
- `manifiesto.json` — ids de recurso elegidos, fecha de build, conteos y fecha del dato más
  reciente.

### Runtime

| Módulo | Responsabilidad |
|---|---|
| `catalogo.js` | Cargar el lite, decodificar diccionarios, búsqueda por nombre. |
| `ambito.js` | Resolver los selectores a una lista de `idpozo`. Punto-en-polígono. |
| `detalle.js` | Cargar las particiones full que haga falta, bajo demanda. |
| `csv.js` | Construir el archivo. |
| `url.js` | Estado en la URL como única fuente de verdad. |
| `mapa.js` | Leaflet: pozos del ámbito y teselas WMS de contexto. |
| `buscador.js` | Entrada de texto y lista de resultados. |
| `descarga.js` | Resumen del ámbito y botón de descarga. |

## Flujo de datos

Los cuatro selectores se reducen a dos mecanismos. Área de concesión y yacimiento son
facetas de la misma tabla —la tabla de pozos trae `area`, `cod_area`, `yacimiento` y
`cod_yacimiento`—, así que "concesión" no necesita geometría propia para funcionar como
ámbito.

1. **Por nombre** (área, yacimiento, operadora) → filtro sobre el índice lite en memoria.
2. **Por polígono dibujado** → punto-en-polígono contra el índice lite.

Ambos producen una lista de `idpozo`. Con esa lista se determinan las cuencas involucradas,
se cargan sus particiones full y se arma el CSV. Todo en el navegador, sin red más allá de
los archivos estáticos del propio sitio.

### La consulta central (build time)

```sql
WITH prod AS (
  SELECT idpozo, anio, mes, prod_pet, prod_gas, prod_agua, tef FROM "<recurso 2026>"
  UNION ALL
  SELECT idpozo, anio, mes, prod_pet, prod_gas, prod_agua, tef FROM "<recurso 2025>"
  -- un recurso por año, según lo resuelto en el paso 1
)
SELECT idpozo,
       count(*)                      AS meses,
       min(anio * 100 + mes)         AS primer_periodo,
       max(anio * 100 + mes)         AS ultimo_periodo,
       round(sum(prod_pet)::numeric,  1) AS pet_acum,
       round(sum(prod_gas)::numeric,  1) AS gas_acum,
       round(sum(prod_agua)::numeric, 1) AS agua_acum,
       round(sum(tef)::numeric,       1) AS tef_total
FROM prod
GROUP BY idpozo
ORDER BY idpozo
```

El `LEFT JOIN` contra los pozos ocurre en Node al fusionar: un pozo sin fila en este agregado
queda con `meses = 0` y acumulados en cero.

### El CSV

Una fila por pozo, con estas columnas en este orden:

```
idpozo, sigla, lon, lat, empresa, area, yacimiento, cuenca, provincia,
tipo_recurso, tipo_estado, formacion, profundidad, meses,
primer_periodo, ultimo_periodo, pet_acum, gas_acum, agua_acum, tef_total
```

Escapado de comas, comillas y saltos de línea: los nombres de empresa los contienen.

## Errores y trampas del origen

El origen ya demostró que su metadato miente. El build asume mala fe del dato y **falla
ruidoso** antes que publicar datos incompletos.

| Trampa | Evidencia | Defensa |
|---|---|---|
| Recursos anuales duplicados y truncados | `- 2025` trae 90.000 filas; `– 2025` trae 991.844. Se distinguen por un guión | Comparar filas entre candidatos del mismo año y elegir el mayor; fallar si no supera el piso |
| `datastore_active: true` mintiendo | El recurso de generación eléctrica responde `relation does not exist` | `SELECT 1 FROM "<id>" LIMIT 1` sobre cada recurso antes de aceptarlo |
| Coordenadas transpuestas | 5.088 de 5.089 pozos con `coordenadax`/`coordenaday` invertidas | No se usan; la geometría válida es `geojson` de la tabla de pozos |
| 504 a los 60 s | El volcado completo muere; paginado de 20.000 responde | Paginación con reintento y backoff |
| Ids de recurso volátiles | Son UUID que cambian al republicar | Se resuelven por nombre en cada build y se congelan en `manifiesto.json`; si falta un año, el build falla |

No hay manejo de errores de red en runtime: el sitio sólo carga archivos propios. Un
artefacto que no carga es un error de despliegue, no del origen.

## Reglas de producto

Van a `docs/reglas/` durante la implementación:

1. La geometría válida de un pozo es `geojson` de la tabla de pozos. Las columnas
   `coordenadax`/`coordenaday` de la tabla de producción están transpuestas y no se usan.
2. Un pozo sin producción declarada aparece en el resultado con acumulados en cero y
   `meses = 0`. No se oculta. Son 520 pozos.
3. El sitio no consulta el origen en runtime. Todo dato mostrado o descargado proviene de un
   artefacto generado en build. La fecha de ese build es visible en la interfaz.

## Testing

**Unitarios sin red.** `csv.js`: dado un conjunto de filas, produce el CSV correcto con
escapado completo. `ambito.js`: punto-en-polígono, incluido el pozo sobre el borde.
`catalogo.js`: decodificación de diccionarios y búsqueda. `url.js`: ida y vuelta del estado.
`artefactos.mjs`: fusión, codificación y partición.

**Contra fixtures grabados.** Respuestas reales de CKAN guardadas como archivos, para probar
parseo y fusión sin red.

**Guardas del build.** El test de mayor valor: la resolución de recursos sobre el catálogo
real grabado debe elegir `– 2025` y descartar `- 2025`. Si esa lógica se rompe, el sitio
publica el 9% de los datos sin avisar.

**Contrato contra el origen vivo.** Corre aparte de `npm test`, como `npm run test:contrato`:
verifica que la tabla de pozos existe, que la consulta de agregación devuelve las columnas
esperadas y que el recurso del año en curso no encogió.

No se prueba que Leaflet dibuje.

## Fuera de alcance en v1

- Serie mensual completa. Sólo el resumen por pozo.
- GeoPackage, Excel y GeoJSON como formatos de descarga.
- Reconciliación con el WMS para cubrir la brecha de frescura de tres meses.
- Cualquier capa que no sean pozos: centrales, red eléctrica y ductos son sólo teselas de
  fondo. El cruce con producción no existe para ellas — el recurso de generación eléctrica
  está roto en el origen.
- Producción anterior a 2018.

## Riesgos abiertos

- **La frescura depende del build.** Si nadie lo corre, el sitio envejece en silencio. El
  `manifiesto.json` expone la fecha para que se note.
- **Los recursos "(DDJJ)".** Hay variantes por año cuyo contenido no se comparó con el del
  recurso principal. La elección por cantidad de filas es una heurística, no una certeza.
- **La brecha de frescura de tres meses** frente al WMS, si resulta que a alguien le importa.
- **Estabilidad del catálogo.** El build depende de que los nombres de recurso sigan siendo
  reconocibles. El test de contrato es la red, pero avisa tarde.
