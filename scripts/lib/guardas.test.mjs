import { describe, it, expect } from 'vitest'
import { assertMinFilas, assertColumnas, assertSinRegresion } from './guardas.mjs'

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

describe('assertSinRegresion', () => {
  const previo = { pozos: 85611, sinProduccion: 520 }

  it('no opina si no hay build anterior', () => {
    expect(() => assertSinRegresion(null, { pozos: 1, sinProduccion: 1 })).not.toThrow()
  })

  it('deja pasar el crecimiento normal', () => {
    expect(() => assertSinRegresion(previo, { pozos: 85800, sinProduccion: 480 })).not.toThrow()
  })

  it('corta si el índice perdió pozos', () => {
    expect(() => assertSinRegresion(previo, { pozos: 70000, sinProduccion: 520 }))
      .toThrow(/perdio pozos/)
  })

  it('corta si los pozos sin producción se multiplican', () => {
    // La firma de una fusión por idpozo que dejó de matchear: el conteo total
    // no se mueve, así que ningún piso se entera.
    expect(() => assertSinRegresion(previo, { pozos: 85611, sinProduccion: 9000 }))
      .toThrow(/sin produccion/)
  })

  it('tolera el ruido chico cuando la base es casi cero', () => {
    expect(() => assertSinRegresion({ pozos: 85611, sinProduccion: 2 }, { pozos: 85611, sinProduccion: 60 }))
      .not.toThrow()
  })
})
