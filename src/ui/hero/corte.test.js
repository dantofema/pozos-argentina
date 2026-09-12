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
})
