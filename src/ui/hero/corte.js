import { COLUMNA_NEUQUINA } from '../../lib/estratigrafia.js'
import { defsDeTramas, idDeTrama } from './tramas.js'
import { normalizar } from '../../lib/catalogo.js'

/**
 * La geometría del dibujo. El horizonte está al 36% del alto: el subsuelo se
 * queda con casi dos tercios porque es donde está el dato.
 */
export const GEOMETRIA = { ANCHO: 1200, ALTO: 720, HORIZONTE: 260 }

/**
 * Los tres balancines: x, escala y período del cabeceo. El primero vive más
 * lejos del margen que los otros dos (x=400 y no, por ejemplo, 210): el
 * rótulo de Vaca Muerta es el más largo de los nueve —suma "· ROCA
 * MADRE"— y con menos separación su casing de cobre lo atraviesa (I5: es
 * justo el rótulo que tiene que leerse completo). Ver CABEZA_CABLE_X: el
 * casing de este balancín cae en x=400+57=457, después del borde derecho
 * medido del rótulo (~434 con el manifiesto de referencia).
 */
const BALANCINES = [
  { x: 400, escala: 1.0,  periodo: '4s' },
  { x: 560, escala: 0.78, periodo: '4.7s' },
  { x: 890, escala: 0.62, periodo: '5.3s' },
]

/** La torre de perforación (§7.1): quieta, más alta y esbelta que el poste
 * Samson de cualquier balancín. Vive a la derecha del tercer balancín, en su
 * propio hueco, para no competir con ellos. */
const TORRE_X = 1030

/** La antorcha (§7.1): un mástil aparte, en el hueco entre el segundo y el
 * tercer balancín, lejos de la torre y de los tres balancines. */
const ANTORCHA_X = 680

/**
 * El punto del borde exterior de la cabeza de caballo del que cuelga el
 * cable (coordenada local del balancín, sin escalar). Es la única fuente de
 * verdad para dos dibujos que tienen que coincidir: acá mismo, para trazar
 * el cable, y en `pozosDibujados`, para plantar la boca del pozo justo
 * debajo. Sin este acople el cable cuelga de la cabeza pero el pozo queda
 * en otro lado, y los dos dibujos dejan de tener relación mecánica.
 */
const CABEZA_CABLE_X = 57

const miles = (n) => n.toLocaleString('es-AR')
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Busca el conteo de una formación tolerando acentos: el origen escribe
 * `HUITRÍN` y la columna pide `HUITRIN` (B2). Devuelve `null` —y no 0— cuando la
 * clave no está, porque un manifiesto de un build viejo no es lo mismo que una
 * formación sin pozos declarados (B1).
 */
function conteoDe(formaciones, nombre) {
  if (!formaciones) return null
  const buscado = normalizar(nombre)
  for (const [clave, valor] of Object.entries(formaciones)) {
    if (normalizar(clave) === buscado) return Number(valor)
  }
  return null
}

/** Reparte el subsuelo en nueve bandas. Los espesores no están a escala (I2). */
function bandas() {
  const alto = GEOMETRIA.ALTO - GEOMETRIA.HORIZONTE
  // Pesos relativos, no espesores reales: los reales varían en órdenes de
  // magnitud y dibujarlos a escala haría ilegible media columna. La roca madre
  // lleva algo más de alto porque es donde entran los laterales.
  const pesos = [1.05, 0.95, 1.1, 0.9, 1.0, 1.35, 0.95, 1.0, 1.15]
  const suma = pesos.reduce((a, b) => a + b, 0)
  let y = GEOMETRIA.HORIZONTE
  return COLUMNA_NEUQUINA.map((f, i) => {
    const h = i === COLUMNA_NEUQUINA.length - 1
      ? GEOMETRIA.ALTO - y                      // la última cierra exacto
      : Math.round((pesos[i] / suma) * alto)
    const banda = { ...f, y, h, indice: i }
    y += h
    return banda
  })
}

/**
 * La línea de la estepa (§7.1): un perfil suave e irregular, siempre por
 * encima del horizonte (y < 260). No es la línea de horizonte —esa sigue
 * recta y de ancho completo, porque el Acto I la traza con
 * `stroke-dasharray` y el Acto VI la usa de bisagra hacia el mapa—, es un
 * segundo trazo, más arriba, que sugiere las mesetas de la meseta patagónica.
 */
function estepa() {
  const d = 'M0 253 Q50 230 100 248 Q150 258 200 244 Q260 228 320 250 ' +
    'Q380 258 440 240 Q500 226 560 248 Q620 258 680 242 Q740 228 800 250 ' +
    'Q860 258 920 240 Q980 226 1040 248 Q1100 258 1200 245'
  return `<path class="corte__estepa" d="${d}" />`
}

/**
 * La torre de perforación (§7.1), quieta: un derrick de celosía, más alto y
 * esbelto que el poste Samson de un balancín (150 de alto contra 58, y se
 * afina hacia arriba en vez de ser un simple tranquil). No tiene viga ni
 * contrapeso: no bombea, perfora.
 */
function unaTorre(x) {
  return `
    <g class="corte__torre" transform="translate(${x} ${GEOMETRIA.HORIZONTE})">
      <path d="M-20 0L-8 -150M20 0L8 -150M-8 -150L8 -150" />
      <path d="M-17 -30h34M-15 -60h30M-13 -90h26M-11 -120h22" />
      <path d="M-20 0h40" />
    </g>`
}

/**
 * La antorcha (§7.1): un mástil con su llama, sobre su propio elemento
 * (`antorcha__llama`) porque el Acto V la hace titilar en un ritmo propio,
 * ajeno al de los balancines.
 */
function unaAntorcha(x) {
  return `
    <g class="corte__antorcha" transform="translate(${x} ${GEOMETRIA.HORIZONTE})">
      <line class="antorcha__mastil" x1="0" y1="0" x2="0" y2="-92" />
      <path class="antorcha__llama" d="M0 -92C-9 -102 -7 -115 -1 -126C4 -117 10 -106 6 -96C4 -93 2 -92 0 -92Z" />
    </g>`
}

/**
 * Un balancín reconocible, no uno de plaza: cabeza de caballo en la punta
 * delantera de la viga —la seña que lo hace un balancín petrolero y no un
 * subibaja— y contrapeso en una manivela cerca de la base, no clavado en la
 * punta trasera. Importa para la Tarea 6: el Acto V hace girar el contrapeso
 * 360° por ciclo, y eso sólo lee como máquina si gira sobre el eje de una
 * manivela y no sobre sí mismo en el aire. La biela conecta ese eje con el
 * extremo trasero de la viga; queda estática en este reposo (el acople de
 * movimiento real entre las dos animaciones es un problema de la Tarea 6, no
 * de este dibujo).
 *
 * La cabeza es una placa maciza —un sector circular, apoyado en la punta de
 * la viga con el borde curvo mirando hacia abajo y hacia afuera— y no un
 * trazo abierto: a este tamaño lo que la hace reconocible es la masa del
 * contorno, no el detalle, y un extremo suelto lee como rizo ornamental, no
 * como pieza. Del borde curvo cuelga el cable (`balancin__cable`), vertical,
 * hasta la boca del pozo: es lo que conecta la máquina con lo que perfora.
 *
 * Cabeza y cable viven dentro de `balancin__viga` a propósito: cuando la
 * Tarea 6 haga cabecear la viga, tienen que acompañarla. Afuera del grupo
 * quedarían quietos mientras la viga se mueve.
 */
function unBalancin({ x, escala, periodo }, i) {
  const base = GEOMETRIA.HORIZONTE
  return `
    <g class="balancin" style="--periodo:${periodo}" transform="translate(${x} ${base}) scale(${escala})">
      <path class="balancin__base" d="M-42 0h84" />
      <path class="balancin__torre" d="M-16 0l16-58 16 58" />
      <g class="balancin__viga">
        <path d="M-52 -58h104" />
        <path class="balancin__cabeza" d="M36 -58L66 -58A30 30 0 0 1 36 -28Z" />
        <line class="balancin__cable" x1="${CABEZA_CABLE_X}" y1="-37" x2="${CABEZA_CABLE_X}" y2="0" />
      </g>
      <path class="balancin__biela" d="M-52 -58 -40 -18" />
      <g class="balancin__contrapeso" transform="translate(-36 -8)">
        <path class="balancin__manivela" d="M0 0 -4 -10" />
        <circle cx="-4" cy="-10" r="11" />
      </g>
    </g>`
}

export function construirCorte({ formaciones, pozos, periodo }) {
  const { ANCHO, ALTO, HORIZONTE } = GEOMETRIA
  const capas = bandas()
  const madre = capas.find((b) => b.rocaMadre)
  const profundidadLateral = madre.y + Math.round(madre.h / 2)

  const estratos = capas.map((b) => {
    const n = conteoDe(formaciones, b.nombre)
    // Sin conteo se rotula sólo el nombre: nunca un 0 inventado ni un undefined.
    const cifra = n === null ? '' : `${miles(n)} pozos`
    // La roca madre es el único rótulo que la regla de pantallas angostas deja
    // visible a propósito (I5): a 390px sólo se ve hasta x=333 (xMinYMax
    // slice) y el rótulo completo, que arranca en x=74, no entra. Partido en
    // tspan propios, el CSS puede ocultar el rol y el conteo en ese ancho y
    // dejar sólo "VACA MUERTA", que sí entra. El resto de los rótulos se
    // ocultan enteros a ese ancho (ver hero.css), así que no necesitan esto.
    const rotulo = b.rocaMadre
      ? `<tspan class="corte__rotulo-nombre">${esc(b.nombre)}</tspan>` +
        '<tspan class="corte__rotulo-rol"> · ROCA MADRE</tspan>' +
        (cifra ? `<tspan class="corte__rotulo-cifra"> · ${esc(cifra)}</tspan>` : '')
      : `${esc(b.nombre)}${cifra ? ` · ${esc(cifra)}` : ''}`
    return `
      <g class="corte__estrato${b.rocaMadre ? ' corte__estrato--madre' : ''}"
         data-formacion="${esc(b.nombre)}"
         style="--orden:${capas.length - 1 - b.indice}">
        <rect class="corte__relleno" x="0" y="${b.y}" width="${ANCHO}" height="${b.h}"
              fill="url(#${idDeTrama(b.trama)})" />
        <line class="corte__contacto" x1="0" y1="${b.y}" x2="${ANCHO}" y2="${b.y}" />
        <text class="corte__rotulo" x="74" y="${b.y + 20}">${rotulo}</text>
      </g>`
  }).join('')

  // La boca de cada pozo va bajo el cable de su balancín, no bajo el poste:
  // es del borde de la cabeza de donde cuelga el cable que baja hasta acá
  // (CABEZA_CABLE_X, la misma constante que dibuja el cable en `unBalancin`),
  // y es esa coincidencia la que explica el mecanismo en el dibujo.
  const pozosDibujados = BALANCINES.map(({ x, escala }, i) => {
    const xPozo = Math.round(x + CABEZA_CABLE_X * escala)
    return `
      <g class="corte__pozo">
        <line class="corte__casing" x1="${xPozo}" y1="${HORIZONTE}" x2="${xPozo}" y2="${profundidadLateral}" />
        <line class="corte__lateral" data-profundidad="${profundidadLateral}"
              x1="${xPozo}" y1="${profundidadLateral}"
              x2="${xPozo + (i % 2 === 0 ? 230 : -230)}" y2="${profundidadLateral}" />
      </g>`
  }).join('')

  // Las marcas viven en su propio canal, pegado al margen izquierdo
  // (x=0..~60): el rótulo de cada banda arranca en x=74 (arriba) para que
  // ninguno de los dos se pise (antes ambos arrancaban cerca de x=20/24).
  //
  // La última marca (3.000 m) no llega hasta el borde inferior del todo: le
  // resto MARGEN_LEYENDAS al recorrido para dejarle un canal propio a las dos
  // leyendas que viven pegadas ahí abajo -- "CUENCA NEUQUINA" y "PROFUNDIDAD
  // (m) · ESQUEMÁTICO" (ver más abajo). 56 y no 40 (el valor de antes de que
  // la cuenca se mudara acá): son dos líneas de 11px, no una, y la segunda
  // pide su propio espacio para no pisar a la primera.
  //
  // Esto NO tiene en cuenta -ni tiene por qué- la banda opaca del buscador
  // (`.hero__buscador` en hero.css): en una ronda anterior de esta misma
  // revisión, ese cálculo vivía hecho a ciegas de la banda, y hubo que subir
  // este margen a 150 para que el bloque de leyendas sobreviviera tapado por
  // ella en el viewport de escala más chica. El ruling del coordinador movió
  // el problema de acá: ahora es `.hero` (grid de tres filas, hero.css) el
  // que garantiza que el dibujo entero -y por lo tanto esta esquina- termine
  // arriba de esa banda, así que el 56 de acá no necesita saber que la banda
  // existe. Volver a subirlo sin que la banda vuelva a superponerse sería
  // resolver un problema que ya no existe.
  const MARGEN_LEYENDAS = 56
  const escala = [0, 1000, 2000, 3000].map((m) => {
    const y = HORIZONTE + (m / 3000) * (ALTO - MARGEN_LEYENDAS - HORIZONTE)
    return `
      <g class="corte__marca">
        <line x1="0" y1="${y}" x2="14" y2="${y}" />
        <text x="20" y="${y - 5}">${m === 0 ? '0' : miles(m)}</text>
      </g>`
  }).join('')

  const superficie = [
    estepa(),
    unaAntorcha(ANTORCHA_X),
    unaTorre(TORRE_X),
    BALANCINES.map(unBalancin).join(''),
  ].join('')

  return `
<svg class="corte" viewBox="0 0 ${ANCHO} ${ALTO}" role="img"
     preserveAspectRatio="xMinYMax slice" xmlns="http://www.w3.org/2000/svg">
  <title>Corte geológico esquemático de la cuenca Neuquina</title>
  <desc>Sobre la superficie, tres balancines, una torre de perforación y una
  antorcha con su llama. Bajo la superficie, nueve formaciones en orden
  estratigráfico; la formación Vaca Muerta, la roca madre, es el objetivo de
  los pozos horizontales.</desc>
  <defs>${defsDeTramas()}</defs>

  <g class="corte__subsuelo">${estratos}</g>
  <g class="corte__pozos">${pozosDibujados}</g>
  <g class="corte__escala">
    ${escala}
    <!-- Revisión de la Tarea 8 (hallazgo 2): esto vivía arriba a la derecha,
         corrido para librar el casing del tercer balancín sin que el recorte
         de "slice" lo cortara -- dos condiciones sobre la MISMA coordenada,
         y a 1280x900 resultaron incompatibles: la ventana visible llega
         hasta x=1024, pero librar el casing pedía x>1034. No hay ningún
         valor que cumpla las dos a la vez ahí; el problema era el lugar, no
         el número.

         Bajarlo junto a "PROFUNDIDAD (m) · ESQUEMÁTICO" resuelve las dos
         cosas de una vez, sin depender del viewport: con la proyección
         xMinYMax slice el borde izquierdo (x=0) y el borde inferior (y=ALTO)
         son justo los dos que quedan anclados, así que nunca se recortan --
         es la única esquina de la que eso vale sin medir nada por pantalla.
         Y por ahí no pasa ningún casing: los laterales de los pozos viven a
         mitad de columna (profundidadLateral, más arriba), no al fondo. Por
         eso vive DENTRO de .corte__escala y no como hermano suelto del svg
         (como antes): las dos leyendas que hablan SOBRE el dibujo -de qué
         cuenca es, que la escala es esquemática- son un mismo bloque, y
         anidarlo hace que se esconda a pantallas angostas y se hunda en el
         relevo con el resto del grupo, sin reglas de CSS repetidas para
         cada uno.

         "y=ALTO nunca se recorta" resultó ser sólo la mitad de la historia
         la primera vez que se verificó esto: con el bloque pegado del todo
         al fondo (y=ALTO-30/ALTO-14), .hero__buscador (hero.css) -una caja
         opaca pegada al borde inferior del viewport- lo tapaba entero en los
         cinco viewports, confirmado con getBoundingClientRect() real. El
         parche de esa ronda subió este bloque con un MARGEN_LEYENDAS de 150
         para esquivarla desde ACÁ. El ruling de la revisión siguiente lo
         resolvió del otro lado: .hero pasó a ser una grilla de tres filas
         donde el dibujo (.hero__dibujo, hero.css) abarca sólo las
         primeras dos, nunca la del buscador, así que esa banda ya no se
         superpone con NADA de este SVG -y=ALTO ahora sí es, de verdad, el
         borde que nunca se tapa-. Por eso el bloque vuelve a y=ALTO-30/
         ALTO-14, el valor original. -->
    <text class="corte__cuenca" x="20" y="${ALTO - 30}">CUENCA NEUQUINA</text>
    <text class="corte__leyenda" x="20" y="${ALTO - 14}">PROFUNDIDAD (m) · ESQUEMÁTICO</text>
  </g>

  <line class="corte__horizonte" x1="0" y1="${HORIZONTE}" x2="${ANCHO}" y2="${HORIZONTE}" />
  <g class="corte__superficie">${superficie}</g>
</svg>`
}
