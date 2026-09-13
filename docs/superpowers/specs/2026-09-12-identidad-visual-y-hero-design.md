# Identidad visual y hero compuesto — Diseño

**Fecha:** 2026-09-12
**Estado:** aprobado por el usuario en la sesión de brainstorming del 2026-09-12.
**Reemplaza:** la capa visual de `2026-09-10-pozos-argentina-design.md`. Ese spec sigue
siendo la autoridad sobre datos, build y arquitectura de la herramienta; este manda sobre
identidad visual, hero y movimiento.

## 1. Propósito

El sitio funciona y es honesto, pero no tiene identidad visual: cero assets, cero
tipografías, `index.html` de doce líneas, y el mapa ocupa la pantalla desde el primer
pixel sin decirle a nadie qué está mirando. Este diseño define la paleta, la tipografía,
la ilustración del hero, su composición animada, los textos y los assets.

Un segundo objetivo, no estético: hoy la página está **en blanco** hasta que llega el
catálogo de 1,26 MB gzip. Ese tiempo ya se paga y no se ve. El hero lo ocupa.

## 2. Con qué no hay que parecerse

`indec-descargas`, del mismo autor, es "la consola": oscura por defecto, un solo eje de
matiz (250, azul frío), dos acentos que comparten croma y sólo cambian de matiz, todo en
OKLCH, Space Grotesk + IBM Plex Sans + IBM Plex Mono, radio 8px, cuatro páginas, y un hero
puramente tipográfico con tiles de totales entrando en cascada. No tiene ilustración.

Este sitio se separa en los cinco ejes: **claro por defecto** en vez de oscuro, **anclado
en cálido** en vez de azul frío, **serif de monografía** en vez de todo-sans, **una página
con el hero como estado** en vez de multipágina, y **una ilustración compuesta y animada**
donde el otro no tiene ninguna.

## 3. Restricciones globales

Vinculan a todas las tareas.

- **G1.** Nada de frameworks. Módulos ES nativos, como el resto del sitio.
- **G2.** `public/` está en `.gitignore`: ahí viven los artefactos generados por el build.
  Los assets versionados van en `src/estaticos/` y `src/fuentes/`, referenciados desde CSS,
  JS o `index.html`, y los procesa y versiona Vite. Verificado: un `<link rel="icon"
  href="./src/estaticos/x.svg">` sale en `dist/assets/x-<hash>.svg`.
- **G3.** El movimiento en reposo —el que corre para siempre— sólo anima `transform` y
  `opacity`. La entrada, que corre una vez sobre una página quieta, puede usar propiedades
  de paint (`stroke-dashoffset`), con presupuesto de cuadros medido.
- **G4.** `prefers-reduced-motion: reduce` apaga toda animación y transición, y deja el
  corte completo y quieto en su cuadro final.
- **G5.** Ninguna cifra visible se escribe a mano. Todas salen de `manifiesto.json`.
- **G6.** El hero no puede retrasar la carga del catálogo, y el catálogo no puede
  retrasar al hero. Se parte la carga en dos: **`manifiesto.json` (2,8 kB) habilita el
  hero** —trae las cifras y los conteos por formación— y **`pozos-lite.json` (1,26 MB)
  habilita el buscador**. Los dos pedidos salen juntos; el hero empieza a dibujarse con el
  primero que llega, que es un solo round trip. Ver §12.5.
- **G7.** Contraste mínimo AA (4,5:1) para todo texto, en los dos temas. Lo verifica un
  test, no una tabla.
- **G8.** Presupuestos: CSS ≤ 20 kB gzip; el módulo del hero ≤ 12 kB gzip sobre los
  50,22 kB actuales de JS; tipografías ≤ 110 kB en total.
- **G9.** El sitio no es oficial y lo dice en el pie. No se toca esa frase.

## 4. Decisiones tomadas

| # | Decisión | Por qué |
|---|---|---|
| D-A | El hero es un **estado inicial**, no un lugar fijo. Sin estado en la URL ocupa la pantalla; al buscar, el mapa lo releva y no vuelve. Un enlace compartido (`?t=…`) no lo monta nunca. | El estado ya vive entero en la URL, así que el sitio ya distingue una visita nueva de un enlace compartido. El hero es importante para quien llega y nunca estorba a quien sabe qué quiere. |
| D-B | La imagen es un **corte geológico**: superficie arriba, roca abajo. | Es como la industria dibuja esto, y la composición cuenta el sitio: arriba se busca, abajo está el dato. Da objetos animables independientes de sobra. |
| D-C | Registro **informe geológico**: papel, tinta, tramas litológicas reales, un acento cobre, tinta propia para la roca madre. | El lenguaje gráfico de la litología está codificado desde hace un siglo. Carga un detalle que ningún otro tema podría tener, y son patrones SVG: cuestan casi nada. |
| D-D | **Source Serif 4** (voz) + **Archivo Narrow** en mayúsculas espaciadas (rótulos) + **JetBrains Mono** (siglas y cifras). | Los planos geológicos se rotulan con condensada espaciada, así que la ilustración y la interfaz quedan rotuladas con la misma letra y leen como un solo objeto. La serif es lo que la consola de indec no tiene. |
| D-E | Animación **compuesta en seis actos**, con quiebre de tempo y foco; reposo compuesto de varios objetos en contrafase. | Pedido explícito del usuario: componer la animación es importante para el producto. |
| D-F | Textos **con contexto**: qué publica el Estado, por qué es inusable, qué hace el sitio. | Es lo que le da derecho al hero a ocupar la pantalla completa. |

## 5. Color

Dos temas, y el oscuro no es un trámite: **papel** y **cianotipo** son las dos tradiciones
reales del dibujo geológico —el informe impreso y la copia heliográfica—. Claro por
defecto; `prefers-color-scheme: dark` y un `data-tema` explícito eligen el otro.

| token | papel | cianotipo | rol |
|---|---|---|---|
| `--papel` | `#F2EFE9` | `#141A1E` | fondo |
| `--tinta` | `#1A1714` | `#E8EDF0` | texto, líneas del dibujo |
| `--cobre` | `#A8481C` | `#E8853F` | el dato: pozos, cifras, CTA |
| `--vaca` | `#2E4A4F` | `#7FB2BA` | la roca madre, y sólo ella |
| `--apagado` | `#6B6257` | `#93A2AA` | texto secundario, rótulos |
| `--linea` | `#D8D2C7` | `#26323A` | bordes de interfaz |
| `--superficie` | `#FBFAF7` | `#1C242A` | lo que se apoya sobre la página: inputs, botones, panel lateral, desplegable |

Contrastes calculados sobre el fondo de cada tema:

| | papel | cianotipo |
|---|---|---|
| tinta | 15,55:1 · AAA | 14,88:1 · AAA |
| cobre | 5,07:1 · AA | 6,57:1 · AA |
| vaca | 8,29:1 · AAA | 7,51:1 · AAA |
| apagado | 5,21:1 · AA | 6,68:1 · AA |
| papel sobre cobre (CTA) | 5,07:1 · AA | 6,57:1 · AA |

Y sobre `--superficie`, porque los inputs y el panel lateral llevan texto encima:

| | papel | cianotipo |
|---|---|---|
| tinta | 17,10:1 · AAA | 13,33:1 · AAA |
| cobre | 5,58:1 · AA | 5,89:1 · AA |
| vaca | 9,11:1 · AAA | 6,73:1 · AA |
| apagado | 5,73:1 · AA | 5,98:1 · AA |

La superficie se separa de la página por apenas 1,10:1, a propósito: en un registro de
papel la jerarquía la hace el borde (`--linea`) y no el contraste, que es cómo se ve un
formulario impreso sobre una hoja. Subir esa diferencia haría que los controles floten
como software.

Reglas de color:

- **C1.** `--cobre` es el único acento y significa una cosa: el dato. Pozos, cifras,
  el botón de descarga. No se usa para decorar.
- **C2.** `--vaca` se reserva para la roca madre en el corte. No se recicla como
  "segundo acento".
- **C3.** Todo token se declara en `:root` a secas antes de que cualquier bloque de
  media query o `[data-tema]` lo redefina. Un color cuyo única definición viva dentro
  de un bloque de tema no aplica en el estado sin estampar.
- **C4.** `body` pinta su fondo desde un token, explícitamente.

## 6. Tipografía

Tres familias, tres trabajos. Variables, subset latin de Google, self-hosted en
`src/fuentes/`, `font-display: swap`.

| familia | rol | licencia | peso |
|---|---|---|---|
| Source Serif 4 | títulos y prosa | OFL 1.1 (Adobe) | 50 kB |
| Archivo Narrow | rótulos del corte y de la UI, mayúsculas espaciadas | OFL 1.1 (Omnibus-Type) | 19 kB |
| JetBrains Mono | siglas, cifras tabulares | OFL 1.1 (JetBrains) | 31 kB |

Total 99 kB, dentro del presupuesto de 110 kB (G8).

- **T1.** Se sirve el **subset latin de Google tal cual**, sin subsetear por glifo. Los
  nombres de formación, empresa y yacimiento salen del dato: un juego de glifos elegido a
  mano se rompe el día que aparezca un carácter que no previmos.
- **T2.** Se precargan sólo las dos caras del primer pintado (serif y narrow). La mono
  carga normal.
- **T3.** Cada familia declara una pila de respaldo real. `font-display: swap`: el texto
  se lee desde el primer cuadro con la del sistema.
- **T4.** Cifras siempre con `font-variant-numeric: tabular-nums`.
- **T5.** Los rótulos en Archivo Narrow van en mayúsculas con `letter-spacing` de
  0,08–0,12em. Es la convención de rotulación de planos, y es lo que une dibujo e interfaz.
- **T6.** `src/fuentes/LICENCIAS.md` nombra las tres familias, su foundry y OFL 1.1, con
  el texto de la licencia. Es obligación de la OFL al redistribuir.

Escala de tipos, base 16px, razón 1,25:

Corregida por la revisión final: las dos primeras filas decían `5vw` y `2vw`,
que es lo que esta tabla pedía antes de que existiera `--escala`. El tamaño del
título y de la bajada no puede depender del ANCHO: el texto se apoya sobre el
cielo del dibujo, y el cielo mide `HORIZONTE · --escala`, que depende del ALTO
de la escena. Atados al ancho, los dos sistemas se movían por separado y el
texto terminaba impreso sobre la roca (ver §7). Los coeficientes son una
medida con `getBoundingClientRect()` real, no una fórmula cerrada.

| uso | tamaño | familia |
|---|---|---|
| H1 del hero | `clamp(1.8rem, calc(var(--escala) * 24), 2.8rem)`, medida 34ch | serif 600 |
| bajada | `clamp(0.95rem, calc(var(--escala) * 13), 1.12rem)`, medida 58ch | serif 400 |
| H1 de la herramienta | 1,375rem | serif 600 |
| cuerpo | 1rem | serif 400 |
| rótulos y etiquetas | 0,6875rem | narrow 600, mayúsculas |
| cifras y siglas | 0,875rem | mono 400 |
| pie | 0,72rem | narrow 400 |

## 7. La ilustración: anatomía del corte

Un solo SVG inline, construido en JS a partir del manifiesto. `viewBox="0 0 1900 720"`,
`preserveAspectRatio="xMinYMax slice"`, y **llena el hero entero**, con el texto
superpuesto sobre el cielo.

Corregido dos veces el 2026-09-12, y la segunda corrige a la primera. El spec decía
`xMidYMid slice` con el dibujo metido en una fila del grid que compartía el alto con el
texto. Medido, eso perdía la banda de Vaca Muerta entera en 1920×1080. La primera corrección
pasó a `meet`, que no pierde nada, pero al mirarlo el dibujo quedaba a 733×440 flotando con
márgenes vacíos y rótulos de 6 a 8 píxeles: no perdía dato y perdía el hero.

La salida es que el dibujo **llene el hero entero** y el texto se apoye encima, sobre el
cielo. Es además la composición aprobada en el brainstorming —título, ilustración,
buscador— que la primera versión de la hoja desvió.

**Corregido una tercera vez el 2026-09-13, y esta corrección es la que hace que lo
anterior sea cierto.** La aritmética que justificaba el lienzo de 1200x720 decía: "el
corte es 1,67:1 y el aspecto de un viewport típico va de 1,60 a 1,78, casi el mismo, así
que a pantalla completa el recorte es de 45 unidades de cielo o ninguno". Estaba mal por
dos motivos, y la revisión final los midió:

1. Lo que importa no es el aspecto del VIEWPORT sino el de la ESCENA —el viewport menos la
   banda del buscador, que le resta 109px de alto—. Medido en los siete viewports reales,
   el aspecto de la escena va de **1,98 a 2,57:1**, no de 1,60 a 1,78.
2. "Un viewport típico" se había calculado con el alto de la PANTALLA. Ningún navegador
   maximizado tiene esa altura: 1920x1080 de pantalla es 1920x990 de viewport, y
   1366x768 es 1366x641.

Con el lienzo a 1,67:1 y la escena entre 1,98 y 2,57:1, el término del ancho manda
SIEMPRE, el cielo vale `altoEscena − 460·(ancho/1200)` y se achica a medida que la
pantalla se ensancha —a 1366x641 quedaba en 8px— así que el texto quedaba impreso sobre la
roca en cinco de los siete viewports medidos.

El lienzo pasa a **1900x720 (2,64:1)**, por encima del aspecto de escena más ancho que se
mide, y `.hero__dibujo` lleva además un techo de ancho a ese mismo aspecto para que la
invariante valga también más allá de la tabla. Con eso el término del alto manda siempre y
**el cielo vale `HORIZONTE/ALTO` del alto de la escena —36,1%— en cualquier viewport**. Los
rótulos se ven a entre 9,6 y 22 píxeles, y los cinco objetos de superficie viven en la
mitad derecha del lienzo (entre las unidades 775 y 1400), que es la única forma de que no
le crucen las últimas líneas a la bajada: el texto se ancla a la izquierda y llega hasta la
unidad 745 en el viewport de escala más chica.

**En angosto (≤720px) la composición se apila**: texto, dibujo y buscador en tres filas, sin
superposición. La aritmética de arriba es de escritorio; un teléfono es 0,59:1, fuera de
ese rango por un factor de tres, y ahí el cielo (166px) no alcanza para un bloque de texto
que ya está en su piso de legibilidad (216px). No hay reparto posible: o el texto se
superpone a la roca, o la composición se apila.

El anclaje `xMinYMax` tiene dos razones: **abajo**, porque lo prescindible es el cielo y el
subsuelo tiene que apoyarse sobre el buscador; y **a la izquierda**, porque en pantallas
angostas el recorte pasa a ser horizontal y los rótulos de las formaciones viven en el borde
izquierdo — centrado, un móvil los cortaría al medio.

La línea de horizonte está en `y=260`: **el subsuelo ocupa casi dos tercios**, porque es
donde está el dato. Esa misma línea es la base sobre la que se apoya el buscador, así que
composición e interfaz comparten una línea.

**Legibilidad por tamaño.** El dibujo encaja entero en la fila que le toque, así que en
pantallas angostas se achica y sus rótulos con él: medido, un rótulo de 13px se ve a 13,5px
en escritorio grande, 10,3px en escritorio, 7,9px en laptop y 4,2px en móvil. Por debajo del
breakpoint angosto se **ocultan los rótulos de banda secundarios** y queda sólo el de la roca
madre, que es el foco. Es preferible un dibujo simplificado y legible a nueve rótulos de
cuatro píxeles que nadie puede leer. Los conteos por formación siguen estando en el
manifiesto y en el dibujo de escritorio: lo que se oculta en móvil es una capa de
enriquecimiento, no el dato que el sitio entrega, que es el CSV.

### 7.1 Sobre el horizonte (y < 260)

- La línea de la estepa, con un perfil suave irregular.
- **Tres balancines** a distintas distancias, de distinto tamaño: el repertorio del
  reposo. Cada uno es un `<g>` con viga, contrapeso, torre y base como hijos, de modo que
  la viga y el contrapeso se puedan animar acoplados.
- **Una torre de perforación**, quieta.
- **Una antorcha** con su llama, sobre un mástil.

### 7.2 Bajo el horizonte: la columna de la cuenca Neuquina

Las nueve formaciones, en el orden estratigráfico real —verificado contra la literatura:
de abajo hacia arriba Lajas → Lotena → Tordillo → **Vaca Muerta** → Quintuco → Mulichinco
→ Agrio → Huitrín → Rayoso— con su litología y su trama.

Corregido el 2026-09-12: este spec decía **Centenario** en la posición 4. Está mal y la
revisión de la Tarea 4 lo encontró verificando contra CONICET e IDEAN/UBA. Centenario no es
una capa apilada entre Quintuco y Agrio: es el **equivalente lateral de subsuelo de Agrio**
en el borde este de la cuenca, el mismo intervalo de tiempo con otro nombre según la facies.
En un corte vertical de un mismo punto no coexisten como dos bandas. La unidad que ocupa esa
posición es Mulichinco, arenisca reservorio, con 1.039 pozos en el dato publicado.

| orden (arriba→abajo) | formación | litología | trama |
|---|---|---|---|
| 1 | Rayoso | evaporitas y continental | chevrons |
| 2 | Huitrín | evaporitas | chevrons |
| 3 | Agrio | lutitas | guiones |
| 4 | Mulichinco | areniscas y conglomerados | puntos |
| 5 | Quintuco | carbonatos | ladrillos |
| 6 | **Vaca Muerta** | lutita bituminosa — **roca madre** | tinta sólida `--vaca` |
| 7 | Tordillo | areniscas | puntos |
| 8 | Lotena | areniscas y carbonatos | ladrillos |
| 9 | Lajas | areniscas | puntos |

- **I1.** El conteo de pozos de cada formación sale de `manifiesto.json`, no del código
  (G5). El build lo calcula; ver §10.
- **I2.** El espesor de las bandas **no está a escala** y el dibujo lo dice: el rótulo de
  la escala de profundidad lleva la palabra "esquemático". Los espesores reales varían en
  órdenes de magnitud y dibujarlos a escala haría ilegible la mitad de la columna. No se
  miente por omisión.
- **I3.** Las cinco tramas se redibujan como `<pattern>` propios con
  `stroke="currentColor"`, tomando **FGDC-STD-013-2006 (patrones sedimentarios, serie
  600)** como referencia. No se adoptan los archivos del estándar: sus SVG traen
  `#000000` fijo y 400+ elementos por tesela, así que no se tiñen con la paleta ni son
  livianos. Al ser CC0 no hay obligación de atribuir; la referencia se cita igual en un
  comentario, porque el dibujo es fiel a un estándar real y eso es parte del punto.
- **I4.** La escala de profundidad baja por el margen izquierdo con marcas en 0, 1.000,
  2.000 y 3.000 m.
- **I5.** Vaca Muerta es el foco por ser la **roca madre**, no por tamaño: tiene 3.547
  pozos y Bajo Barreal, en Golfo San Jorge, tiene 9.218. El rótulo dice "roca madre". No
  se le atribuye un primer puesto que no tiene.
- **I6.** La columna es la de **Neuquina** y el dibujo lo rotula así. No es una columna
  genérica ni un promedio nacional, que no existe.

### 7.3 Los pozos

Tres pozos, uno por balancín: casing vertical desde la superficie, y al llegar a Vaca
Muerta un **lateral horizontal** que se extiende. Es la geometría real de un pozo no
convencional, y es lo que explica por qué la roca madre es el objetivo.

## 8. La composición

Seis actos. Lo que la vuelve composición y no un stagger es que tiene quiebres de tempo,
un foco, y que cada movimiento significa algo que es cierto.

### Acto I · El instrumento se dibuja — 0 → 1,2s

El marco y la línea de horizonte se trazan de izquierda a derecha. Bajan las marcas de
profundidad por el margen. Todavía no hay roca ni pozos: primero aparece el instrumento de
medición. Técnica: `stroke-dashoffset`, paint, una sola vez (G3).

### Acto II · La roca se deposita, de abajo hacia arriba — 1,2 → 2,6s

Los estratos entran **Lajas primero y Rayoso último**, porque así se depositó la roca: lo
viejo abajo, ciento sesenta millones de años antes. Es al revés del wipe obvio, y es la
verdad. Cada banda entra con su trama y su rótulo deslizándose desde el margen, y su
conteo real contando hacia arriba.

Son **ocho** bandas, no nueve: Vaca Muerta no entra en esta cascada, sale a su propio acto
y deja su hueco a la vista. Escalonado, **125ms** entre bandas —precisado por la revisión
final: el "~150ms" de antes, con ocho bandas de 520ms, cerraba en 2,77s e invadía el Acto
III, que es justamente el acto que tiene que quedarse solo. 125ms = (1400 − 520) / 7 es el
paso que hace entrar las ocho dentro de su ventana: la última arranca en 2,075s y cierra
en 2,595s—. Las ocho respetan el orden de abajo hacia arriba sin excepción.

### Acto III · Vaca Muerta — 2,6 → 3,2s · *el foco*

El tempo se quiebra: todo lo demás queda quieto. La banda llega con su tinta propia, el
rótulo se compone en la serif y no en la condensada, y un brillo fino la barre a lo largo.
El rótulo dice **roca madre** (I5).

Precisado por la revisión final: "todo lo demás queda quieto" es una condición sobre el
Acto II, no un adorno de este. Cuando la roca madre arranca (2,6s) las otras ocho ya
cerraron (2,595s): ninguna se está moviendo. El brillo es una banda de degradé que cruza el
lienzo con `transform`, no un pulso de opacidad sobre el relleno —un pulso prende y apaga,
no barre—.

### Acto IV · Lo que hizo la gente — 3,2 → 4,4s

Los pozos. Las verticales bajan con una curva quebrada —rápido, enganche, rápido— que lee
como máquina y no como interfaz. Al llegar a la roca madre, los laterales se extienden.
Los balancines y la torre suben últimos.

### Acto V · El campo trabaja — 4,4s → ∞ · *reposo compuesto*

- Tres balancines cabeceando **en contrafase**, con períodos de 4,0 / 4,7 / 5,3 s, para
  que el campo nunca sincronice. El período combinado no se repite en más de un minuto:
  es lo que hace que lea como campo real y no como loop.
- Los contrapesos giran **acoplados a la viga**. Es la diferencia entre leer máquina y
  leer temblequeo, y es la razón por la que cada balancín es un `<g>` con hijos propios.
- La antorcha titila en un ritmo irregular, ajeno a los balancines.
- Partículas bajando por los laterales: la producción fluyendo, desde la punta del lateral
  hacia el casing, que es para donde corre de verdad. La trama vive en una línea propia
  dentro de un grupo recortado al largo del lateral, y lo que se anima es el
  desplazamiento del grupo: un paso de trama por ciclo, con `transform` y no con
  `stroke-dashoffset`, que G3 prohíbe en el reposo (adjudicado en la revisión final: la
  salvedad que el ledger había anotado se cierra cambiando la técnica, no escribiendo la
  excepción).

Todo `transform`/`opacity` (G3). Con tres condiciones de apagado, que son lo que permite
que exista:

- **M1.** Se pausa al enfocar el buscador. Nadie escribe con movimiento en la periferia.
- **M2.** Se pausa con la pestaña oculta (`document.hidden`).
- **M3.** `prefers-reduced-motion` lo apaga entero y deja el cuadro final (G4).

### Acto VI · El relevo — al elegir un ámbito

No un fade. **El corte se hunde** —los estratos se van hacia abajo— mientras la línea de
horizonte **sube y se convierte en el borde superior del área del mapa**, y el mapa emerge
por debajo. El horizonte es la bisagra: el único elemento continuo entre los dos estados.
~600ms, `transform` y `opacity`.

Precisado por la revisión final: para que la bisagra exista, el hero **no puede
desvanecerse entero**. Lo que se apaga es su fondo de papel; los estratos se hunden, el
texto, la superficie y la banda del buscador se desvanecen, y el horizonte se queda opaco
hasta el último cuadro. Cuánto sube no se puede escribir en la hoja de estilos —depende de
dónde cae el horizonte y de dónde arranca el área del mapa, y va de −214px a +35px según el
viewport—: lo mide la coreografía al arrancar la salida. Y el área del mapa lleva un
`border-top`, que es aquello en lo que el horizonte se convierte.

## 9. Textos

Finales, en voseo, sin adjetivos de marketing. Las cifras salen del manifiesto (G5).

**Hero, H1:**
> Todos los pozos de hidrocarburos del país, en un CSV

**Hero, bajada:**
> La Secretaría de Energía publica la producción mes a mes de cada pozo del país: nueve
> tablas de casi un millón de filas cada una. Acá están cruzadas con la ubicación de cada
> pozo. Elegí un ámbito y bajate sólo lo que te interesa.

**Hero, línea de dato:** `{pozos} pozos · hasta {período}` — del manifiesto.

**Rótulo de la escala:** `PROFUNDIDAD (m) · ESQUEMÁTICO` (I2)

**Rótulo de la columna:** `CUENCA NEUQUINA` (I6)

**Rótulo de la roca madre:** `VACA MUERTA · ROCA MADRE · {n} pozos`

**Alternativa textual del SVG** (`<title>` y `<desc>`, y `role="img"`):
> Corte geológico esquemático de la cuenca Neuquina. Sobre la superficie, balancines y una
> torre de perforación. Bajo la superficie, nueve formaciones en orden estratigráfico; la
> formación Vaca Muerta, la roca madre, es el objetivo de los pozos horizontales.

**Meta description:**
> Buscá pozos de hidrocarburos de Argentina por área, yacimiento, operadora, cuenca o
> pozo, o dibujando una zona en el mapa, y descargá su producción acumulada en CSV.

**H1 de la herramienta** (cuando el hero no está): el actual, sin cambios.

**Pie:** el actual, sin cambios (G9).

## 10. Cambio en el build

`construirArtefactos` ya recorre todos los pozos y tiene el diccionario de `formacion`.
Agrega al resultado un conteo por formación de la cuenca Neuquina, y `build-index.mjs` lo
escribe en `manifiesto.json`:

```json
"formaciones": {
  "RAYOSO": 1750, "HUITRIN": 2660, "AGRIO": 3980, "MULICHINCO": 1039,
  "QUINTUCO": 4062, "VACA MUERTA": 3547, "TORDILLO": 1699,
  "LOTENA": 2119, "LAJAS": 1887
}
```

Son las nueve formaciones de §7.2 y nada más: el objeto no es un volcado de las 79
formaciones del dato, es exactamente lo que el dibujo necesita. Las claves van
normalizadas (mayúsculas, sin acentos) por B2.

- **B1.** El hero pide las nueve formaciones de §7.2 por nombre. Si el manifiesto no trae
  alguna, esa banda se dibuja **sin conteo** en vez de con un cero o un `undefined`. Un
  build viejo no puede romper la página ni inventar un número.
- **B2.** Las claves se normalizan igual que el resto del dato: mayúsculas, sin acentos
  para comparar. `HUITRÍN` en el dato y `HUITRIN` en el código tienen que encontrarse.
- **B3.** El build no falla si una formación desaparece del origen: no es una guarda de
  volumen, es un adorno con dato. Loguea el faltante.

## 11. Arquitectura

```
src/
  estaticos/
    favicon.svg              marca: un balancín, trazo de tinta
    og.png                   1200x630, render del corte
  fuentes/
    source-serif-4.woff2
    archivo-narrow.woff2
    jetbrains-mono.woff2
    LICENCIAS.md
  estilos/
    tokens.css               los dos temas, nada más
    base.css                 reset, tipografía, body
    hero.css                 el hero y su movimiento
    herramienta.css          barra, mapa, lateral, descarga
  lib/
    estratigrafia.js         la columna Neuquina como dato: orden, litología, trama
  ui/
    hero/
      corte.js               dato -> SVG. Sin animación, sin DOM externo.
      tramas.js              los cinco <pattern>
      coreografia.js         la máquina de la composición: entrada, reposo, salida
      hero.js                el componente: monta, releva, aplica las pausas
```

- **A0.** `estratigrafia.js` exporta `COLUMNA_NEUQUINA`: un array en orden de arriba
  hacia abajo, un objeto por formación con `{ nombre, litologia, trama, rocaMadre }`,
  donde `trama` es una de las cinco de §7.2 y `rocaMadre` es `true` sólo en Vaca Muerta.
  Es dato, no lógica: sin funciones, sin dependencias. `corte.js` lo recorre y le pega
  los conteos del manifiesto.
- **A1.** `corte.js` es **puro**: recibe `{formaciones, pozos, periodo}` y devuelve una
  cadena SVG o un elemento. No toca `document` fuera del SVG, no sabe de animación, no
  lee el manifiesto. Se testea comparando estructura.
- **A2.** `coreografia.js` no sabe dibujar. Recibe el SVG ya montado y le aplica clases y
  tiempos. Expone `entrar()`, `reposo()`, `pausar()`, `reanudar()`, `salir()`.
- **A3.** `hero.js` es el único que habla con `main.js`. Expone
  `crearHero(contenedor, { manifiesto })`, que devuelve
  `{ montarBuscador(facetas, alElegir), relevar(), estado() }`. No hay `destruir()`: la
  limpieza —sacar el hero del DOM y desconectar sus escuchas— ocurre dentro de `relevar()`,
  porque el hero se releva una sola vez y no vuelve (E3), así que no existe un caso donde
  haga falta destruirlo sin relevarlo. `estado()` es lo que `main.js` necesita para saber si
  ya se fue. El hero no construye el
  buscador: recibe las facetas cuando el índice llega y delega en `crearBuscador`, el
  mismo componente de la herramienta (X2). Así el buscador no se duplica ni se reimplementa.
- **A4.** `style.css` pasa a ser el punto de entrada que importa los cuatro parciales. Un
  archivo por responsabilidad: hoy son 223 líneas en uno, y con la identidad completa eso
  se vuelve inmanejable.
- **A5.** `main.js` lee el estado de la URL, dispara los dos pedidos juntos, y monta el
  hero en cuanto resuelve el manifiesto, sin esperar el índice (G6, §12.5).
- **A6.** `catalogo.js` expone `cargarManifiesto()` y `cargarIndice()` además de
  `cargarCatalogo()`, que se queda como la composición de las dos para quien quiera
  ambas. Hoy `cargarCatalogo` ya pide los dos archivos en paralelo: el cambio es poder
  esperar cada uno por separado, no pedirlos distinto.

## 12. Estado: cuándo vive el hero

- **E1.** El hero se monta **sólo si** `leerEstado(location.search)` da modo `vacio`.
- **E2.** El mapa se monta siempre, debajo, a tamaño completo. El hero es una capa encima
  con su propio contexto de apilado. Así el mapa está listo sin `invalidateSize` ni
  contenedores de tamaño cero, que es la forma clásica de romper Leaflet.
- **E3.** El hero se releva una sola vez y **no vuelve**. "Volver al inicio" y el botón
  Atrás del navegador resetean mapa, buscador y URL, pero no reponen el hero: es una
  entrada, no un estado al que se regresa, y repetir una coreografía de 4,4s que ya se vio
  sería un castigo.
- **E4.** El hero se releva recién cuando hay un ámbito elegido, así que elegir es
  imposible antes de que el índice esté: no hay forma de relevar el hero sin datos.

### 12.5 Secuencia de carga

| t | qué llegó | qué se ve |
|---|---|---|
| 0 | nada | fondo pintado, H1 y bajada en la tipografía de respaldo. Nada de saltos de layout: el corte reserva su caja desde el primer cuadro. |
| ~1 round trip | `manifiesto.json` | arranca el Acto I. La línea de dato y los conteos por formación ya son reales. El buscador está presente y **deshabilitado**, con el texto "Cargando los 85.609 pozos…" |
| catálogo listo | `pozos-lite.json` | el buscador se habilita y cambia a su placeholder normal. Si la coreografía sigue corriendo, no se interrumpe. |
| al elegir | — | Acto VI: el relevo. |

- **E5.** El buscador deshabilitado no es un estado de error y no se anuncia como tal: es
  una espera con su motivo dicho. Si el manifiesto falla, cae en el `catch` que ya existe
  en `main.js` y muestra el mensaje del pie: no se dibuja medio hero.
- **E6.** El corte reserva su caja (`aspect-ratio`) desde el primer cuadro, antes de tener
  datos. Sin eso, el hero salta de alto cuando llega el manifiesto.

## 13. Accesibilidad

- **X1.** El SVG lleva `role="img"` con `<title>` y `<desc>` (§9). Los rótulos de las
  formaciones son texto real en el SVG: se leen, se buscan y se traducen.
- **X2.** El buscador del hero es el mismo componente que el de la herramienta, con su
  foco, su Escape y su cierre por click afuera ya resueltos.
- **X3.** El movimiento respeta G4/M3. El cuadro final es completo y legible: la
  información no vive en la animación.
- **X4.** Contraste AA verificado por test en los dos temas (G7).
- **X5.** Foco visible en todo control, en los dos temas.

## 14. Verificación

Honestamente separada en lo que un test puede afirmar y lo que no.

**Tests automáticos (vitest, jsdom):**

- `corte.js` produce las nueve bandas, en el orden de §7.2, con la trama que le toca a cada
  litología.
- El conteo de cada banda sale del manifiesto que se le pasa, y una formación ausente
  sale sin conteo, no con cero ni `undefined` (B1).
- La normalización de claves encuentra `HUITRÍN` desde `HUITRIN` (B2).
- `coreografia.js`: la máquina pasa por entrada → reposo → salida y no se saltea estados;
  `pausar()` detiene el reposo; `reanudar()` lo sigue.
- Con `prefers-reduced-motion` simulado, no se aplica ninguna clase de animación y el
  corte queda en su cuadro final (G4).
- `hero.js` no monta nada si la URL trae estado (E1), y no repone el hero tras relevarlo (E3).
- Contraste: los pares de §5 se recalculan desde los tokens y se exige AA (G7).
- Presupuestos de §G8 medidos sobre `dist/` después de `vite build`.

**Verificación visual y temporal, no automatizable en jsdom:**

- Capturas por CDP en `t = 0,6 / 1,8 / 2,9 / 4,0 / 5,0 s` para ver que cada acto llega a
  donde dice.
- Medición de cuadros del reposo y de la entrada en la máquina de referencia
  (Ryzen 7 5825U, 14 GB), con piso de 55 fps.
- Captura del relevo (Acto VI) para confirmar que el horizonte es continuo.
- Los dos temas y `prefers-reduced-motion`, por captura.

Esto lo verifica el autor mirando, no un test. Se dice acá para que nadie confunda "216
tests verdes" con "la animación se ve bien".

## 15. Qué queda afuera

- **Scroll.** El hero ocupa una pantalla y se releva por interacción, no por scroll. Nada
  de scroll-driven animations.
- **Multipágina.** Una sola página. Es de lo que hay que diferenciarse.
- **Hover en los estratos.** Tentador —mostrar la formación y su conteo al pasar el
  mouse— pero el hero se va apenas se elige un ámbito, así que el que explore los estratos
  está perdiendo el tiempo en una pantalla que existe para irse. Si después se quiere,
  es otro spec.
- **Parallax con el mouse.** Descartado: movimiento continuo atado al puntero, justo
  encima del buscador.
- **Ilustración de las otras nueve cuencas.** Una columna, la de Neuquina, rotulada como
  tal.
- **Lottie, GSAP, cualquier librería de animación.** CSS y un controlador propio.
