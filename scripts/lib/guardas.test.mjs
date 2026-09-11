import { describe, it, expect } from 'vitest'
import { assertMinFilas, assertColumnas } from './guardas.mjs'

describe('assertMinFilas', () => {
  it('pasa cuando hay filas de sobra', () => {
    expect(() => assertMinFilas('pozos', 85611, 80000)).not.toThrow()
  })

  it('falla cuando el volcado vino corto', () => {
    expect(() => assertMinFilas('produccion 2025', 90000, 500000))
      .toThrow(/produccion 2025.*90000.*500000/)
  })

  it('falla con cero filas', () => {
    expect(() => assertMinFilas('pozos', 0, 1)).toThrow()
  })
})

describe('assertColumnas', () => {
  it('pasa cuando están todas', () => {
    const fila = { idpozo: 1, sigla: 'X', geojson: '{}' }
    expect(() => assertColumnas('pozos', fila, ['idpozo', 'sigla'])).not.toThrow()
  })

  it('nombra exactamente la columna que falta', () => {
    const fila = { idpozo: 1 }
    expect(() => assertColumnas('pozos', fila, ['idpozo', 'geojson']))
      .toThrow(/geojson/)
  })
})
