import { describe, it, expect } from 'vitest'
import { puntoEnPoligono, porFaceta, porPoligono, cuencasDe } from './ambito.js'

const catalogo = {
  dicts: {
    area: ['LOMA CAMPANA', 'EL TREBOL'],
    yacimiento: ['LOMA CAMPANA-LLL', 'CAÑADON SECO'],
    empresa: ['YPF S.A.', 'VISTA ENERGY ARGENTINA SAU'],
    cuenca: ['NEUQUINA', 'GOLFO SAN JORGE'],
  },
  rows: [
    [1, -68.6, -38.3, 0, 0, 0, 0],
    [2, -68.7, -38.4, 0, 0, 0, 0],
    [3, -67.5, -45.9, 1, 1, 1, 1],
  ],
}

const cuadrado = [[-69, -39], [-68, -39], [-68, -38], [-69, -38]]

describe('puntoEnPoligono', () => {
  it('reconoce un punto adentro', () => {
    expect(puntoEnPoligono(-68.5, -38.5, cuadrado)).toBe(true)
  })

  it('reconoce un punto afuera', () => {
    expect(puntoEnPoligono(-67, -38.5, cuadrado)).toBe(false)
  })

  it('es estable con un punto sobre el borde', () => {
    expect(typeof puntoEnPoligono(-69, -38.5, cuadrado)).toBe('boolean')
  })

  it('devuelve falso para un anillo degenerado', () => {
    expect(puntoEnPoligono(0, 0, [[0, 0], [1, 1]])).toBe(false)
  })
})

describe('porFaceta', () => {
  it('devuelve los pozos del área', () => {
    expect(porFaceta(catalogo, 'area', 'LOMA CAMPANA').sort()).toEqual([1, 2])
  })

  it('devuelve los pozos de la operadora', () => {
    expect(porFaceta(catalogo, 'empresa', 'VISTA ENERGY ARGENTINA SAU')).toEqual([3])
  })

  it('devuelve vacío para un valor inexistente', () => {
    expect(porFaceta(catalogo, 'area', 'NO EXISTE')).toEqual([])
  })
})

describe('porPoligono', () => {
  it('devuelve sólo los pozos de adentro', () => {
    expect(porPoligono(catalogo, cuadrado).sort()).toEqual([1, 2])
  })

  it('devuelve vacío si no cae ninguno', () => {
    expect(porPoligono(catalogo, [[0, 0], [1, 0], [1, 1], [0, 1]])).toEqual([])
  })
})

describe('cuencasDe', () => {
  it('lista las cuencas involucradas sin repetir', () => {
    expect(cuencasDe(catalogo, [1, 2]).sort()).toEqual(['NEUQUINA'])
    expect(cuencasDe(catalogo, [1, 3]).sort()).toEqual(['GOLFO SAN JORGE', 'NEUQUINA'])
  })

  it('ignora ids que no están en el catálogo', () => {
    expect(cuencasDe(catalogo, [999])).toEqual([])
  })

  it('ignora índices de cuenca fuera de rango', () => {
    const catalogoBroto = {
      dicts: {
        cuenca: ['NEUQUINA'],
      },
      rows: [
        [1, -68.6, -38.3, 0, 0, 0, 0],
        [2, -68.7, -38.4, 0, 0, 0, 99], // Índice 99 no existe en dicts.cuenca
      ],
    }
    expect(cuencasDe(catalogoBroto, [1, 2])).toEqual(['NEUQUINA'])
  })
})
