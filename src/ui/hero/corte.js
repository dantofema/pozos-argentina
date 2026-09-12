import { COLUMNA_NEUQUINA } from '../../lib/estratigrafia.js'
import { defsDeTramas, idDeTrama } from './tramas.js'
import { normalizar } from '../../lib/catalogo.js'

/**
 * La geometría del dibujo. El horizonte está al 36% del alto: el subsuelo se
 * queda con casi dos tercios porque es donde está el dato.
 */
export const GEOMETRIA = { ANCHO: 1200, ALTO: 720, HORIZONTE: 260 }

/** Los tres balancines: x, escala y período del cabeceo. */
const BALANCINES = [
  { x: 210, escala: 1.0,  periodo: '4s' },
  { x: 560, escala: 0.78, periodo: '4.7s' },
  { x: 890, escala: 0.62, periodo: '5.3s' },
]

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

function unBalancin({ x, escala, periodo }, i) {
  const base = GEOMETRIA.HORIZONTE
  // Todo el balancín cuelga de un <g> con su propia escala, y la viga y el
  // contrapeso son hijos con pivote propio: es lo que permite animarlos
  // acoplados, que es la diferencia entre leer máquina y leer temblequeo.
  return `
    <g class="balancin" style="--periodo:${periodo}" transform="translate(${x} ${base}) scale(${escala})">
      <path class="balancin__base" d="M-34 0h68" />
      <path class="balancin__torre" d="M-16 0l16-58 16 58" />
      <g class="balancin__viga">
        <path d="M-52 -58h104" />
      </g>
      <g class="balancin__contrapeso" transform="translate(-52 -58)">
        <circle r="11" />
        <path d="M0 0l0 15" />
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
    const rotulo = b.rocaMadre
      ? `${b.nombre} · ROCA MADRE${cifra ? ` · ${cifra}` : ''}`
      : `${b.nombre}${cifra ? ` · ${cifra}` : ''}`
    return `
      <g class="corte__estrato${b.rocaMadre ? ' corte__estrato--madre' : ''}"
         data-formacion="${esc(b.nombre)}"
         style="--orden:${capas.length - 1 - b.indice}">
        <rect class="corte__relleno" x="0" y="${b.y}" width="${ANCHO}" height="${b.h}"
              fill="url(#${idDeTrama(b.trama)})" />
        <line class="corte__contacto" x1="0" y1="${b.y}" x2="${ANCHO}" y2="${b.y}" />
        <text class="corte__rotulo" x="24" y="${b.y + 20}">${esc(rotulo)}</text>
      </g>`
  }).join('')

  const pozosDibujados = BALANCINES.map(({ x }, i) => `
      <g class="corte__pozo">
        <line class="corte__casing" x1="${x}" y1="${HORIZONTE}" x2="${x}" y2="${profundidadLateral}" />
        <line class="corte__lateral" data-profundidad="${profundidadLateral}"
              x1="${x}" y1="${profundidadLateral}"
              x2="${x + (i % 2 === 0 ? 230 : -230)}" y2="${profundidadLateral}" />
      </g>`).join('')

  const escala = [0, 1000, 2000, 3000].map((m) => {
    const y = HORIZONTE + (m / 3000) * (ALTO - HORIZONTE)
    return `
      <g class="corte__marca">
        <line x1="0" y1="${y}" x2="14" y2="${y}" />
        <text x="20" y="${y - 5}">${m === 0 ? '0' : miles(m)}</text>
      </g>`
  }).join('')

  return `
<svg class="corte" viewBox="0 0 ${ANCHO} ${ALTO}" role="img"
     preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <title>Corte geológico esquemático de la cuenca Neuquina</title>
  <desc>Sobre la superficie, balancines y una torre de perforación. Bajo la
  superficie, nueve formaciones en orden estratigráfico; la formación Vaca
  Muerta, la roca madre, es el objetivo de los pozos horizontales.</desc>
  <defs>${defsDeTramas()}</defs>

  <g class="corte__subsuelo">${estratos}</g>
  <g class="corte__pozos">${pozosDibujados}</g>
  <g class="corte__escala">
    ${escala}
    <text class="corte__leyenda" x="20" y="${ALTO - 14}">PROFUNDIDAD (m) · ESQUEMÁTICO</text>
  </g>

  <line class="corte__horizonte" x1="0" y1="${HORIZONTE}" x2="${ANCHO}" y2="${HORIZONTE}" />
  <g class="corte__superficie">${BALANCINES.map(unBalancin).join('')}</g>

  <text class="corte__cuenca" x="${ANCHO - 24}" y="${HORIZONTE + 26}" text-anchor="end">CUENCA NEUQUINA</text>
</svg>`
}
