# Reglas de datos

## D1 — La geometría válida es `geojson`

La geometría de un pozo se lee de la columna `geojson` de la tabla de pozos.

Las columnas `coordenadax` y `coordenaday` de la tabla de producción **están
transpuestas**: guardan la latitud en `coordenadax` y la longitud en `coordenaday`.
Se verificó sobre 5.089 pozos: 5.088 están invertidos. No se usan nunca.

## D2 — Un pozo sin producción no se oculta

La fusión entre pozos y producción es un `LEFT JOIN`: por cada pozo del volcado se busca su
agregado de producción por `idpozo`, y si no hay ninguno el pozo queda igual, con
`meses = 0` y acumulados en cero.

Con `INNER JOIN` esos pozos desaparecían sin que nadie se entere. El build de referencia
midió **520 pozos sin producción, sobre 85.611 en total**. La cifra exacta no es una
constante: la lleva cada build en `sinProduccion` de `manifiesto.json`, y baja a medida que
se declara producción atrasada.

## D3 — El sitio no consulta el origen en runtime

Todo dato mostrado o descargado proviene de un artefacto generado por
`npm run build:index`. Ningún módulo bajo `src/` puede pedirle nada al DataStore de
`datos.energia.gob.ar`.

`https://datos.energia.gob.ar` responde 301 hacia `http://`, y el navegador bloquea ese
descenso por mixed content: aunque el sitio quisiera consultar el origen en vivo, no
podría. El build sí usa `http://` sin problema — corre en Node, que no aplica mixed
content — y por eso `src/lib/esquema.js` define `API` en `http`: no es un descuido, es a
propósito.

La fecha del build es visible en el pie del sitio.

**Excepción que no contradice la regla:** el mapa carga teselas de fondo desde el WMS de la
Secretaría (`sig.energia.gob.ar`, ver `src/ui/wms.js`), un servidor distinto del DataStore y
sin relación con `datos.energia.gob.ar`. Son imágenes de contexto —concesiones, ductos,
yacimientos—, nunca datos: no hay ningún cruce entre lo que el WMS pinta y lo que el sitio
busca o descarga.

## D4 — El build falla antes que publicar datos incompletos

El paquete de producción tiene 44 recursos con duplicados. Dos se llaman casi igual y se
distinguen por un guión: uno trae 90.000 filas y el otro 991.844.

Ante cualquier duda —un año faltante, un volcado por debajo del piso, una tabla que no
existe— el build aborta con código distinto de cero.

## D5 — Los recursos `(DDJJ abiertas y cerradas)` quedan afuera

El paquete de producción publica, para algunos años, una variante del recurso anual llamada
`(DDJJ abiertas y cerradas)` además del recurso principal. Se excluyen siempre de la
selección de recursos: nunca compiten con el principal, ni siquiera cuando tienen más filas.

La razón es que, para el año en curso, la variante DDJJ tiene **más** filas que la
principal: 576.934 contra 561.000 en 2026. La heurística "se queda con el que tiene más
filas" —la misma que resuelve el problema de D4— elegiría la DDJJ si no se la excluyera
antes. Ninguna de las dos tiene claves `(idpozo, anio, mes)` repetidas, así que no se trata
de una con registros duplicados de la otra: "abiertas y cerradas" es un superconjunto que
además incluye declaraciones juradas todavía no cerradas.

En los años ya cerrados la principal suele ser mucho más grande que la DDJJ —en 2023,
974.971 contra 225.574—, pero no siempre: en 2020, un año cerrado, la DDJJ tiene 954.001
filas contra 953.660 de la principal (ver `tests/fixtures/recursos-candidatos.json`), apenas
341 más. Ahí también la heurística "se queda con el que tiene más filas" hubiera elegido mal
si no se excluyera la DDJJ sin condición. Esto refuerza la regla, no la debilita: el filtro
no es un parche para el año en curso, es necesario incluso en años ya cerrados. El problema es
más agudo en el año en curso, y es justo el que más importa: sin excluir la DDJJ, la serie
saldría de declaraciones cerradas para 2018–2025 y de declaraciones abiertas más cerradas
para el año en curso —un acumulado que no es reproducible mes a mes y que no se puede
comparar contra el resto de la serie. La homogeneidad de la serie completa pesa más que
llegar al mes más reciente posible.

## D6 — Los nombres de yacimiento y área se resuelven sin desambiguar por cuenca

`porFaceta` (`src/lib/ambito.js`) busca una faceta por nombre contra el diccionario del
catálogo y no distingue cuenca: si dos cuencas comparten el mismo nombre de yacimiento o de
área, elegir ese nombre en el buscador trae los pozos de ambas mezclados.

Medido sobre el índice publicado: afecta a **25 nombres de yacimiento y 1 nombre de área,
5.181 pozos en total, ≈6 % del padrón**. `EL TORDILLO` devuelve 1.621 pozos mezclando Golfo
San Jorge y Austral; `CERRO NEGRO` mezcla tres cuencas (Golfo San Jorge, Austral, Neuquina);
`POZOS SIN YACIMIENTO` —un valor de relleno para el pozo sin yacimiento declarado, no un
nombre de yacimiento real— aparece igual como opción buscable, con 513 pozos repartidos en
cinco cuencas.

Se decidió no cambiar el comportamiento. Desambiguar por cuenca no es un cambio local: la
cuenca tendría que viajar también en el estado de la URL (`src/lib/url.js`), porque si no un
enlace compartido a `EL TORDILLO` sigue siendo ambiguo al abrirse. Eso encadena cambios en el
catálogo, en la resolución de ámbito (`porFaceta`), en el buscador y en la URL —una
refactorización estructural, no una corrección puntual. Queda como limitación conocida hasta
que el dueño del producto decida si vale ese costo, con estos números delante.

Mientras tanto, el CSV que se descarga trae una columna `cuenca` (ver `COLUMNAS_CSV` en
`src/lib/esquema.js`), así que una descarga que mezcla cuencas es filtrable después.
