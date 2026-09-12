import { describe, it, expect } from 'vitest'
import { periodoLegible, filasDelAmbito } from './resumen.js'

describe('periodoLegible', () => {
  it('parte el período del origen en mes y año', () => {
    expect(periodoLegible(202607)).toBe('07/2026')
  })

  it('conserva el cero del mes', () => {
    expect(periodoLegible(202601)).toBe('01/2026')
  })
})

describe('filasDelAmbito', () => {
  const etiquetas = (filas) => filas.map((f) => f.etiqueta)

  it('abre con la cantidad de pozos, agrupada en miles', () => {
    const filas = filasDelAmbito({ modo: 'faceta', tipo: 'empresa', valor: 'YPF S.A.' }, 12093, 202607)
    expect(filas[0]).toEqual({ etiqueta: 'Pozos', valor: '12.093' })
  })

  it('traduce el tipo a la etiqueta que se muestra', () => {
    const filas = filasDelAmbito({ modo: 'faceta', tipo: 'sigla', valor: 'YPF.Nq.LoAm.x-1' }, 1, 202607)
    expect(filas.find((f) => f.etiqueta === 'Tipo').valor).toBe('Pozo')
  })

  it('muestra la cuenca sólo cuando desambigua', () => {
    const conCuenca = filasDelAmbito(
      { modo: 'faceta', tipo: 'yacimiento', valor: 'EL TORDILLO', cuenca: 'AUSTRAL' }, 1, 202607)
    const sinCuenca = filasDelAmbito(
      { modo: 'faceta', tipo: 'empresa', valor: 'YPF S.A.', cuenca: null }, 12093, 202607)

    expect(etiquetas(conCuenca)).toContain('Cuenca')
    expect(etiquetas(sinCuenca)).not.toContain('Cuenca')
  })

  it('nombra la zona dibujada en vez de un tipo y un nombre que no existen', () => {
    const filas = filasDelAmbito({ modo: 'poligono' }, 37, 202607)

    expect(etiquetas(filas)).toEqual(['Pozos', 'Ámbito', 'Producción hasta'])
    expect(filas[1].valor).toBe('Zona dibujada en el mapa')
  })

  it('en el estado inicial dice la cantidad y hasta cuándo llega el dato, nada más', () => {
    expect(etiquetas(filasDelAmbito({ modo: 'vacio' }, 0, 202607)))
      .toEqual(['Pozos', 'Producción hasta'])
  })

  it('cierra siempre diciendo hasta qué mes llega la producción', () => {
    const filas = filasDelAmbito({ modo: 'faceta', tipo: 'area', valor: 'X' }, 1, 202512)
    expect(filas.at(-1)).toEqual({ etiqueta: 'Producción hasta', valor: '12/2025' })
  })
})
