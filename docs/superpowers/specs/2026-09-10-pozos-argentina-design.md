# pozos-argentina — Diseño

- **Fecha:** 2026-09-10
- **Estado:** aprobado, pendiente de plan de implementación

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
| Pozos | 85.337 | 85.611 | 83.197 (2026) |
| Geometría | sí | sí, columna `geojson` | sí, pero **transpuesta** |
| Consultable con SQL | no | sí | sí |
| Último dato | 2026-09-05 | 2026-06-12 | 2026-07 |

El recurso **"Capítulo IV - Pozos"** (`cb5c0f04-7835-45cd-b982-3e25ca7d7751`) contiene el
mismo universo de pozos que el WMS, con los mismos atributos más una columna `geojson` con
geometría de punto en WGS84 correcta y sin nulos.

### Capacidades verificadas del DataStore de CKAN

- `datastore_search_sql` acepta SQL completo: `JOIN` entre recursos, CTE, `UNION ALL`,
  `GROUP BY`, `FILTER`, funciones de ventana.
- CORS abierto: `Access-Control-Allow-Origin: *`. `POST` con `Content-Type: application/json`
  funciona y está permitido por los headers CORS.
- Sin tope de 32.000 filas: se pidieron 60.000 y las devolvió.
- **PostGIS no está expuesto** (`st_makeenvelope` no existe). No hay consulta espacial en SQL.
- **Timeout de gateway a los 60 s.** El volcado completo de la tabla de pozos da 504; paginado
  de 20.000 filas responde bien.

### Rendimiento de la consulta central

| Ámbito | Pozos | Tiempo | Peso |
|---|---|---|---|
| Yacimiento (Loma Campana) | 194 | 2,07 s | — |
| Operadora (YPF S.A.) | 12.093 | 2,50 s | — |
| Cuenca Neuquina entera | 32.924 | 13,55 s | 17,1 MB |

Todas sobre 9 años de producción unidos con `UNION ALL` (2018–2026). Extrapolando, el país
completo rondaría los 45 MB y se acercaría al timeout: queda fuera de alcance.

### Índice de pozos

Un índice compacto de los 85.611 pozos con coordenadas y seis campos de faceta pesa
**12,4 MB en crudo y 1,25 MB comprimido**. Es el doble del `catalog.json` de
`indec-descargas`, que ya se demostró viable.

## Decisiones tomadas

| Decisión | Elegido | Por qué |
|---|---|---|
| Trabajo de la app | Llevarse el dato cruzado | El valor está en la descarga, no en la visualización. Un visor ya existe: `sig.energia.gob.ar/v`. |
| Forma del dato | Ficha + resumen por pozo, una fila por pozo | Cubre el 80% de los casos con el archivo más liviano y más abrible. |
| Ámbitos | Área/concesión, yacimiento, operadora, polígono | Los cuatro colapsan en dos mecanismos, no cuatro. |
| Formato | CSV con `lon`/`lat` | Cero dependencias. Lo abren Excel, QGIS, pandas y R. |
| Arquitectura | CKAN como espina, WMS solo de contexto | El WMS no aporta datos que CKAN no tenga, y no se puede consultar con SQL. |
| Pozos sin producción | `LEFT JOIN`, acumulados en cero | Un pozo perforado y sin producción declarada es información, no ruido. |

### Enfoques descartados

- **Reconciliar con el WMS para cubrir la brecha de frescura.** El WMS conoce pozos tres
  meses más nuevos que CKAN. Cubrirlo exige un segundo volcado en build, lidiar con la cadena
  TLS incompleta del WMS y decidir qué mostrar de un pozo sin producción. Se difiere hasta
  saber si a alguien le importa esa brecha.
- **WMS como espina, join en el navegador.** Entre tres y cuatro veces más trabajo, y su único
  beneficio —frescura— lo da más barato el punto anterior.

## Arquitectura

Sitio estático. Sin backend, sin base de datos propia, sin `sql.js`. Vite 6, JavaScript
vanilla en módulos ES, Leaflet, Vitest. Las mismas convenciones que `indec-descargas`.

### Build time — `scripts/build-index.mjs`

| Función | Responsabilidad |
|---|---|
| `resolveResources()` | Elegir, por año, el recurso de producción autoritativo entre los 44 candidatos. Cubre **2018 hasta el año en curso**; el rango es configurable en un solo lugar. |
| `dumpPozos()` | Volcado paginado de la tabla de pozos, 20.000 filas por página, con reintento. |
| `buildFacetas()` | Cuencas, provincias, 457 áreas, 1.184 yacimientos y 79 empresas, con conteos. |

Salidas:

- `public/pozos.json` — índice compacto, ~1,25 MB comprimido.
- `public/facetas.json` — catálogo de nombres para el buscador.
- `public/recursos.json` — ids de recurso elegidos y fecha de build.

### Runtime

| Módulo | Responsabilidad |
|---|---|
| `catalogo.js` | Cargar el índice; búsqueda por nombre sobre las facetas. |
| `ambito.js` | Resolver los selectores a un ámbito: faceta con valor, o lista de `idpozo`. |
| `consulta.js` | Armar el SQL y hacer el `POST` a CKAN. |
| `mapa.js` | Leaflet: pozos del ámbito y teselas WMS de contexto. |
| `csv.js` | Construir el archivo a partir de las filas devueltas. |
| `url.js` | Estado en la URL como única fuente de verdad. |

## Flujo de datos

Los cuatro selectores se reducen a dos mecanismos. Área de concesión y yacimiento son
facetas de la misma tabla —la tabla de pozos trae `area`, `cod_area`, `yacimiento` y
`cod_yacimiento`—, así que "concesión" no necesita geometría propia para funcionar como
ámbito.

1. **Por nombre** (área, yacimiento, operadora) → filtro directo en SQL: `WHERE p.area = ?`.
2. **Por polígono dibujado** → punto-en-polígono local contra el índice → lista de `idpozo`
   → `WHERE p.idpozo IN (...)`, enviada por `POST` para no chocar con el largo de URL.

En ambos casos el join lo hace Postgres del otro lado. El navegador no une nada.

### La consulta central

```sql
WITH prod AS (
  SELECT idpozo, anio, mes, prod_pet, prod_gas, prod_agua, tef FROM "<recurso 2026>"
  UNION ALL
  SELECT idpozo, anio, mes, prod_pet, prod_gas, prod_agua, tef FROM "<recurso 2025>"
  -- un recurso por año, según recursos.json
)
SELECT p.idpozo, p.sigla, p.empresa, p.area, p.yacimiento, p.cuenca,
       p.provincia, p.tipo_recurso, p.tipoestado, p.formacion,
       p.profundidad, p.geojson,
       count(q.idpozo)                    AS meses,
       min(q.anio * 100 + q.mes)          AS primer_periodo,
       max(q.anio * 100 + q.mes)          AS ultimo_periodo,
       coalesce(sum(q.prod_pet),  0)      AS pet_acum,
       coalesce(sum(q.prod_gas),  0)      AS gas_acum,
       coalesce(sum(q.prod_agua), 0)      AS agua_acum,
       coalesce(sum(q.tef),       0)      AS tef_total
FROM "<recurso pozos>" p
LEFT JOIN prod q ON p.idpozo = q.idpozo
WHERE <ámbito>
GROUP BY 1,2,3,4,5,6,7,8,9,10,11,12
```

`count(q.idpozo)` y no `count(*)`: con `LEFT JOIN`, un pozo sin producción debe dar
`meses = 0`, no `meses = 1`.

### El CSV

Una fila por pozo. Las columnas son las de la consulta, con `geojson` reemplazado por `lon`
y `lat` desprendidos en el cliente. Escapado de comas, comillas y saltos de línea: los
nombres de empresa los contienen.

## Errores y trampas del origen

El origen ya demostró que su metadato miente. El diseño asume mala fe del dato.

| Trampa | Evidencia | Defensa |
|---|---|---|
| Recursos anuales duplicados y truncados | `- 2025` trae 90.000 filas; `– 2025` trae 991.844. Se distinguen por un guión | `resolveResources()` compara filas entre candidatos del mismo año y elige el mayor; el build falla si no supera el piso |
| `datastore_active: true` mintiendo | El recurso de generación eléctrica responde `relation does not exist` | `SELECT 1 FROM "<id>" LIMIT 1` sobre cada recurso antes de aceptarlo |
| Coordenadas transpuestas | 5.088 de 5.089 pozos con `coordenadax`/`coordenaday` invertidas | No se usan; la geometría válida es `geojson` de la tabla de pozos |
| 504 a los 60 s | El volcado completo muere; paginado de 20.000 responde | Paginación con reintento y backoff |
| Ids de recurso volátiles | Son UUID que cambian al republicar | Se resuelven por nombre en cada build y se congelan en `recursos.json`; si falta un año, el build falla ruidoso |

### Techo de ámbito

El índice local sabe cuántos pozos tiene un ámbito antes de consultar. El armador estima y
avisa —"32.924 pozos, ~17 MB, unos 15 segundos"— y pide confirmación por encima de **5.000
pozos**. El país completo se bloquea: se va contra el timeout.

### SQL armado en el cliente

El endpoint es público, anónimo y de solo lectura: cualquiera puede enviar el SQL que quiera.
Esto **no es un problema de seguridad**, es uno de corrección. Los nombres provienen del
catálogo, no de texto libre, y los `idpozo` se validan como enteros antes de armar el `IN`.

### Errores en runtime

CKAN devuelve 409 con el SQL en el detalle. Ese detalle se registra pero no se muestra: al
usuario se le dice qué pasó y qué puede hacer. El origen caído y el ámbito vacío son mensajes
distintos.

## Reglas de producto

Decisiones que van a `docs/reglas/` durante la implementación:

1. La geometría válida de un pozo es `geojson` de la tabla de pozos. Las columnas
   `coordenadax`/`coordenaday` de la tabla de producción están transpuestas y no se usan.
2. Un pozo sin producción declarada aparece en el resultado con acumulados en cero y
   `meses = 0`. No se oculta.
3. Un ámbito de más de 5.000 pozos requiere confirmación explícita. El país completo no es un
   ámbito válido.

## Testing

**Unitarios sin red.** `consulta.js`: dado un ámbito, produce el SQL esperado. `csv.js`: dado
un conjunto de filas, produce el CSV correcto, con `lon`/`lat` desprendidos y escapado
completo. `ambito.js`: punto-en-polígono, incluido el pozo sobre el borde. `url.js`: ida y
vuelta del estado.

**Contra fixtures grabados.** Respuestas reales de CKAN guardadas como archivos, para probar
parseo y agregación sin red.

**Guardas del build.** El test de mayor valor: `resolveResources()` sobre el catálogo real
grabado debe elegir `– 2025` y descartar `- 2025`. Si esa lógica se rompe, el sitio publica el
9% de los datos sin avisar.

**Contrato contra el origen vivo.** Corre aparte de `npm test`, como `npm run test:contrato`:
verifica que la tabla de pozos existe, que la consulta central devuelve las columnas
esperadas y que el recurso del año en curso no encogió. Es la alarma de que Energía cambió
algo.

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

- **La brecha de frescura de tres meses.** Los pozos de CKAN van detrás de los del WMS. Si
  resulta que a los usuarios les importa, hay que hacer la reconciliación diferida.
- **Los recursos "(DDJJ)".** Hay variantes por año cuyo contenido no se comparó con el del
  recurso principal. `resolveResources()` elige por cantidad de filas, que es una heurística,
  no una certeza. Conviene documentar qué son antes de confiar del todo.
- **Estabilidad del catálogo.** Todo el build depende de que los nombres de recurso sigan
  siendo reconocibles. El test de contrato es la red, pero es una red que avisa tarde.
