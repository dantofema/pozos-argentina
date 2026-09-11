// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { urlTeselasWms, CAPAS_CONTEXTO, ARGENMAP } from './capas.js'

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

describe('ARGENMAP', () => {
  it('apunta al servicio del IGN', () => {
    expect(ARGENMAP.url).toContain('wms.ign.gob.ar')
    expect(ARGENMAP.url).toContain('capabaseargenmap')
  })

  it('se sirve como TMS, que invierte el eje Y', () => {
    expect(ARGENMAP.opciones.tms).toBe(true)
  })

  it('lleva las tres variables de tesela', () => {
    for (const v of ['{z}', '{x}', '{y}']) expect(ARGENMAP.url).toContain(v)
  })

  it('atribuye al IGN', () => {
    expect(ARGENMAP.opciones.attribution).toContain('IGN')
  })

  it('no queda ninguna referencia a OpenStreetMap como capa base', () => {
    expect(ARGENMAP.url).not.toContain('openstreetmap')
  })
})
