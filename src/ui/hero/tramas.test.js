// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { TRAMAS, defsDeTramas, idDeTrama } from './tramas.js'

describe('tramas litológicas', () => {
  it('son las cinco que pide el dibujo', () => {
    expect(TRAMAS).toEqual(['arenisca', 'lutita', 'caliza', 'evaporita', 'bituminosa'])
  })

  it('cada una produce un <pattern> con su id', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.innerHTML = `<defs>${defsDeTramas()}</defs>`
    for (const t of TRAMAS) {
      expect(svg.querySelector(`#${idDeTrama(t)}`), t).not.toBeNull()
    }
  })

  it('se tiñen con currentColor y no con un color fijo', () => {
    // Es toda la razón por la que redibujamos las tramas en vez de adoptar los
    // SVG del FGDC: los del estándar traen #000000 fijo y no se pueden pintar
    // con la paleta ni invertir en el tema cianotipo.
    const defs = defsDeTramas()
    expect(defs).toContain('currentColor')
    expect(defs).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })

  it('teselan: cada pattern declara su caja en userSpaceOnUse', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.innerHTML = `<defs>${defsDeTramas()}</defs>`
    for (const p of svg.querySelectorAll('pattern')) {
      expect(p.getAttribute('patternUnits'), p.id).toBe('userSpaceOnUse')
      expect(Number(p.getAttribute('width')), p.id).toBeGreaterThan(0)
      expect(Number(p.getAttribute('height')), p.id).toBeGreaterThan(0)
    }
  })

  it('idDeTrama rechaza una trama que no existe', () => {
    expect(() => idDeTrama('granito')).toThrow(/granito/)
  })
})
