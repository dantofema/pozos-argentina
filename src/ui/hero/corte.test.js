// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { construirCorte, GEOMETRIA } from './corte.js'
import { COLUMNA_NEUQUINA } from '../../lib/estratigrafia.js'
import { idDeTrama } from './tramas.js'

const MANIFIESTO = {
  RAYOSO: 1750, HUITRIN: 2660, AGRIO: 3980, MULICHINCO: 1039, QUINTUCO: 4062,
  'VACA MUERTA': 3547, TORDILLO: 1699, LOTENA: 2119, LAJAS: 1887,
}

function montar(opciones = {}) {
  const caja = document.createElement('div')
  caja.innerHTML = construirCorte({
    formaciones: MANIFIESTO, pozos: 85609, periodo: 202607, ...opciones,
  })
  return caja
}

describe('construirCorte', () => {
  it('devuelve un svg con el viewBox de la geometría', () => {
    const svg = montar().querySelector('svg')
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${GEOMETRIA.ANCHO} ${GEOMETRIA.ALTO}`)
  })

  it('dibuja las nueve bandas en el orden de la columna', () => {
    const nombres = [...montar().querySelectorAll('[data-formacion]')]
      .map((n) => n.dataset.formacion)
    expect(nombres).toEqual(COLUMNA_NEUQUINA.map((f) => f.nombre))
  })

  it('le da a cada banda la trama de su litología', () => {
    const caja = montar()
    for (const f of COLUMNA_NEUQUINA) {
      const banda = caja.querySelector(`[data-formacion="${f.nombre}"] .corte__relleno`)
      expect(banda.getAttribute('fill'), f.nombre).toBe(`url(#${idDeTrama(f.trama)})`)
    }
  })

  it('las bandas no se solapan ni dejan huecos, y llenan el subsuelo', () => {
    const bandas = [...montar().querySelectorAll('.corte__relleno')]
      .map((r) => ({ y: Number(r.getAttribute('y')), h: Number(r.getAttribute('height')) }))
    expect(bandas[0].y).toBe(GEOMETRIA.HORIZONTE)
    for (let i = 1; i < bandas.length; i++) {
      expect(bandas[i].y, `banda ${i}`).toBe(bandas[i - 1].y + bandas[i - 1].h)
    }
    const ultima = bandas.at(-1)
    expect(ultima.y + ultima.h).toBe(GEOMETRIA.ALTO)
  })

  it('rotula cada banda con su conteo del manifiesto, agrupado en miles', () => {
    const caja = montar()
    const texto = caja.querySelector('[data-formacion="QUINTUCO"]').textContent
    expect(texto).toContain('4.062')
  })

  it('una formación ausente del manifiesto se dibuja sin conteo, no con cero ni undefined', () => {
    const { QUINTUCO, ...incompleto } = MANIFIESTO
    const texto = montar({ formaciones: incompleto })
      .querySelector('[data-formacion="QUINTUCO"]').textContent
    expect(texto).toContain('QUINTUCO')
    expect(texto).not.toMatch(/undefined|NaN/)
    expect(texto).not.toContain('0 pozos')
  })

  it('un conteo en cero sí se dibuja: es un dato, no una ausencia', () => {
    const texto = montar({ formaciones: { ...MANIFIESTO, LAJAS: 0 } })
      .querySelector('[data-formacion="LAJAS"]').textContent
    expect(texto).toContain('0')
  })

  it('encuentra HUITRIN aunque el manifiesto traiga HUITRÍN con acento', () => {
    const { HUITRIN, ...resto } = MANIFIESTO
    const texto = montar({ formaciones: { ...resto, 'HUITRÍN': 2660 } })
      .querySelector('[data-formacion="HUITRIN"]').textContent
    expect(texto).toContain('2.660')
  })

  it('marca la roca madre y la rotula como tal (I5)', () => {
    const madre = montar().querySelector('.corte__estrato--madre')
    expect(madre.dataset.formacion).toBe('VACA MUERTA')
    expect(madre.textContent.toUpperCase()).toContain('ROCA MADRE')
  })

  it('no le atribuye a Vaca Muerta un primer puesto que no tiene (I5)', () => {
    const texto = montar().textContent.toLowerCase()
    for (const mentira of ['la más grande', 'la mayor', 'la principal', 'la más importante']) {
      expect(texto, mentira).not.toContain(mentira)
    }
  })

  it('dice que la escala es esquemática (I2)', () => {
    expect(montar().textContent.toUpperCase()).toContain('ESQUEMÁTICO')
  })

  it('rotula la cuenca, para no pasar por columna nacional (I6)', () => {
    expect(montar().textContent.toUpperCase()).toContain('CUENCA NEUQUINA')
  })

  it('dibuja tres balancines, cada uno con viga y contrapeso propios', () => {
    const caja = montar()
    const balancines = caja.querySelectorAll('.balancin')
    expect(balancines).toHaveLength(3)
    for (const b of balancines) {
      expect(b.querySelector('.balancin__viga')).not.toBeNull()
      expect(b.querySelector('.balancin__contrapeso')).not.toBeNull()
    }
  })

  it('le da a cada balancín un período distinto, para que el campo no sincronice', () => {
    const periodos = [...montar().querySelectorAll('.balancin')]
      .map((b) => b.style.getPropertyValue('--periodo'))
    expect(new Set(periodos).size).toBe(3)
    expect(periodos.every(Boolean)).toBe(true)
  })

  it('numera los estratos de abajo hacia arriba, porque así se deposita la roca', () => {
    // --orden 0 es la más antigua (Lajas, abajo) y 8 la más joven (Rayoso,
    // arriba). El CSS lo usa como retardo, así que este orden ES el Acto II.
    const caja = montar()
    const lajas = caja.querySelector('[data-formacion="LAJAS"]')
    const rayoso = caja.querySelector('[data-formacion="RAYOSO"]')
    expect(lajas.style.getPropertyValue('--orden')).toBe('0')
    expect(rayoso.style.getPropertyValue('--orden')).toBe('8')
  })

  it('los pozos entran a la roca madre, que es lo que explica el lateral', () => {
    const caja = montar()
    const laterales = caja.querySelectorAll('.corte__lateral')
    const madre = caja.querySelector('[data-formacion="VACA MUERTA"] .corte__relleno')
    const techo = Number(madre.getAttribute('y'))
    const piso = techo + Number(madre.getAttribute('height'))
    expect(laterales.length).toBeGreaterThan(0)
    for (const l of laterales) {
      const y = Number(l.dataset.profundidad)
      expect(y, 'un lateral quedó fuera de la roca madre').toBeGreaterThanOrEqual(techo)
      expect(y).toBeLessThanOrEqual(piso)
    }
  })

  it('tiene alternativa textual para lectores de pantalla (X1)', () => {
    const svg = montar().querySelector('svg')
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.querySelector('title').textContent).toBeTruthy()
    expect(svg.querySelector('desc').textContent).toMatch(/roca madre/i)
  })

  it('es puro: no toca el document', () => {
    const antes = document.body.innerHTML
    construirCorte({ formaciones: MANIFIESTO, pozos: 85609, periodo: 202607 })
    expect(document.body.innerHTML).toBe(antes)
  })

  // --- Fix round: §7.1 completo y colisiones de rótulo, halladas al renderizar ---

  it('dibuja la línea de la estepa sobre el horizonte, distinta de la recta (§7.1)', () => {
    const caja = montar()
    const estepa = caja.querySelector('.corte__superficie .corte__estepa')
    expect(estepa).not.toBeNull()
    expect(estepa).not.toBe(caja.querySelector('.corte__horizonte'))
  })

  it('dibuja una torre de perforación quieta, sobre la superficie (§7.1)', () => {
    const torre = montar().querySelector('.corte__superficie .corte__torre')
    expect(torre).not.toBeNull()
  })

  it('dibuja una antorcha con su llama en un elemento propio, sobre un mástil (§7.1)', () => {
    const antorcha = montar().querySelector('.corte__superficie .corte__antorcha')
    expect(antorcha).not.toBeNull()
    expect(antorcha.querySelector('.antorcha__llama')).not.toBeNull()
  })

  it('el <desc> nombra la antorcha: el alt text no puede describir lo que no está dibujado', () => {
    const desc = montar().querySelector('svg desc').textContent.toLowerCase()
    expect(desc).toContain('antorcha')
    expect(desc).toMatch(/roca madre/i)
  })

  it('los rótulos de formación no arrancan en la misma banda de x que la escala de profundidad', () => {
    const caja = montar()
    const xEscala = Number(caja.querySelector('.corte__marca text').getAttribute('x'))
    const xRotulos = [...caja.querySelectorAll('.corte__rotulo')].map((t) => Number(t.getAttribute('x')))
    expect(xRotulos.length).toBeGreaterThan(0)
    for (const x of xRotulos) {
      expect(x, 'un rótulo de banda quedó en el canal de la escala').toBeGreaterThan(xEscala + 40)
    }
  })

  it('el balancín tiene cabeza de caballo en la viga, la seña que lo hace reconocible', () => {
    const caja = montar()
    for (const b of caja.querySelectorAll('.balancin')) {
      expect(b.querySelector('.balancin__viga .balancin__cabeza')).not.toBeNull()
    }
  })

  it('el contrapeso cuelga de una manivela cerca de la base, no de la punta de la viga', () => {
    const caja = montar()
    for (const b of caja.querySelectorAll('.balancin')) {
      expect(b.querySelector('.balancin__manivela')).not.toBeNull()
      const contrapeso = b.querySelector('.balancin__contrapeso')
      const [, , ty] = contrapeso.getAttribute('transform').match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/)
      // La punta de la viga está en y=-58; la base, en y=0. Cerca de la base
      // es "más cerca de 0 que del punto medio hacia la punta".
      expect(Math.abs(Number(ty)), 'el contrapeso quedó cerca de la punta de la viga').toBeLessThan(29)
    }
  })

  // --- Segunda ronda de arreglos: la cabeza leía como espiral, no como pieza ---

  it('la cabeza de caballo es una placa cerrada (sector circular), no un rizo abierto', () => {
    const caja = montar()
    for (const b of caja.querySelectorAll('.balancin')) {
      const cabeza = b.querySelector('.balancin__viga .balancin__cabeza')
      const d = cabeza.getAttribute('d')
      // Un sector circular usa un arco (comando A) y cierra (Z): un rizo
      // hecho de curvas Bézier (C) sin cerrar es exactamente lo que se sacó.
      expect(d, 'la cabeza no tiene un borde curvo en arco (A): no es un sector circular').toMatch(/A/)
      expect(/Z\s*$/i.test(d.trim()), 'la cabeza queda con un extremo suelto: no es una placa cerrada').toBe(true)
    }
  })

  it('cabeza y cable son hijos de la viga, para que la acompañen cuando cabecee', () => {
    const caja = montar()
    for (const b of caja.querySelectorAll('.balancin')) {
      const viga = b.querySelector('.balancin__viga')
      expect(viga.querySelector('.balancin__cabeza')).not.toBeNull()
      expect(viga.querySelector('.balancin__cable')).not.toBeNull()
    }
  })

  it('el cable cuelga vertical del borde de la cabeza y cae alineado con el pozo de su balancín', () => {
    const caja = montar()
    const balancines = [...caja.querySelectorAll('.balancin')]
    const casings = [...caja.querySelectorAll('.corte__casing')]
    expect(balancines).toHaveLength(casings.length)

    balancines.forEach((b, i) => {
      const cable = b.querySelector('.balancin__viga .balancin__cable')
      expect(cable).not.toBeNull()
      const x1 = Number(cable.getAttribute('x1'))
      const x2 = Number(cable.getAttribute('x2'))
      expect(x1, 'el cable no es vertical').toBe(x2)

      // El cable vive en coordenadas locales del balancín: lo llevo a
      // coordenadas absolutas con el mismo translate/scale que el SVG le
      // aplica al grupo, para compararlo con el casing del pozo (que ya está
      // en absolutas).
      const transform = b.getAttribute('transform')
      const [, tx, , escala] = transform.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/)
      const xAbsolutoCable = Number(tx) + x1 * Number(escala)
      const xAbsolutoCasing = Number(casings[i].getAttribute('x1'))
      expect(xAbsolutoCable, 'el cable no cae sobre el pozo de su balancín').toBeCloseTo(xAbsolutoCasing, 0)
    })
  })
})
