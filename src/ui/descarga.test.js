// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { nombreArchivo } from './descarga.js'

describe('nombreArchivo', () => {
  it('usa el valor de la faceta, normalizado', () => {
    expect(nombreArchivo({ modo: 'faceta', tipo: 'area', valor: 'LOMA CAMPANA' }))
      .toBe('pozos-area-loma-campana.csv')
  })

  it('saca acentos del nombre', () => {
    expect(nombreArchivo({ modo: 'faceta', tipo: 'yacimiento', valor: 'CAÑADON SECO' }))
      .toBe('pozos-yacimiento-canadon-seco.csv')
  })

  it('nombra el recorte dibujado', () => {
    expect(nombreArchivo({ modo: 'poligono' })).toBe('pozos-recorte.csv')
  })

  it('tiene un nombre por defecto', () => {
    expect(nombreArchivo({ modo: 'vacio' })).toBe('pozos.csv')
  })
})
