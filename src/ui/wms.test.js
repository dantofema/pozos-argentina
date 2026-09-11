// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { urlTeselasWms, CAPAS_CONTEXTO } from './wms.js'

describe('urlTeselasWms', () => {
  it('apunta al WMS de la Secretaría', () => {
    expect(urlTeselasWms()).toContain('sig.energia.gob.ar/wmsenergia')
  })

  it('incluye STYLES vacío, que MapServer 8 exige', () => {
    expect(urlTeselasWms()).toMatch(/[?&]styles=(&|$)/i)
  })

  it('pide PNG transparente', () => {
    const u = urlTeselasWms()
    expect(u).toContain('format=image%2Fpng')
    expect(u).toContain('transparent=true')
  })
})

describe('CAPAS_CONTEXTO', () => {
  it('declara sólo capas de contexto, ninguna de pozos', () => {
    const nombres = Object.values(CAPAS_CONTEXTO).join(' ')
    expect(nombres).not.toContain('pozos')
  })

  it('incluye concesiones y ductos', () => {
    const capas = Object.values(CAPAS_CONTEXTO).join(' ')
    expect(capas).toContain('concesiones')
    expect(capas).toContain('ductos')
  })
})
