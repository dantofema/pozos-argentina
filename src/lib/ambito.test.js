import { describe, it, expect } from 'vitest'
import { puntoEnPoligono, porFaceta, porPoligono, cuencasDe } from './ambito.js'

const catalogo = {
  dicts: {
    area: ['LOMA CAMPANA', 'EL TREBOL'],
    yacimiento: ['LOMA CAMPANA-LLL', 'CAÑADON SECO'],
    empresa: ['YPF S.A.', 'VISTA ENERGY ARGENTINA SAU'],
    cuenca: ['NEUQUINA', 'GOLFO SAN JORGE'],
    sigla: ['YPF.Nq.LC-1', 'YPF.Nq.LC-2', 'PBE.Ch.CS-9'],
  },
  rows: [
    [1, -68.6, -38.3, 0, 0, 0, 0, 0],
    [2, -68.7, -38.4, 0, 0, 0, 0, 1],
    [3, -67.5, -45.9, 1, 1, 1, 1, 2],
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
        [1, -68.6, -38.3, 0, 0, 0, 0, 0],
        [2, -68.7, -38.4, 0, 0, 0, 99], // Índice 99 no existe en dicts.cuenca
      ],
    }
    expect(cuencasDe(catalogoBroto, [1, 2])).toEqual(['NEUQUINA'])
  })
})

const catalogoHomonimo = {
  dicts: {
    area: ['JACHAL'],
    yacimiento: ['EL TORDILLO'],
    empresa: ['YPF S.A.'],
    cuenca: ['GOLFO SAN JORGE', 'AUSTRAL'],
    sigla: ['A-1', 'A-2', 'A-3'],
  },
  rows: [
    [1, -67.5, -45.9, 0, 0, 0, 0, 0],
    [2, -67.6, -45.8, 0, 0, 0, 0, 1],
    [3, -69.0, -51.0, 0, 0, 0, 1, 2],
  ],
}

describe('porFaceta acotada por cuenca', () => {
  it('sin cuenca devuelve la unión, que es el comportamiento de los enlaces viejos', () => {
    expect(porFaceta(catalogoHomonimo, 'yacimiento', 'EL TORDILLO').sort()).toEqual([1, 2, 3])
  })

  it('con cuenca devuelve sólo los pozos de esa cuenca', () => {
    expect(porFaceta(catalogoHomonimo, 'yacimiento', 'EL TORDILLO', 'AUSTRAL')).toEqual([3])
    expect(porFaceta(catalogoHomonimo, 'yacimiento', 'EL TORDILLO', 'GOLFO SAN JORGE').sort())
      .toEqual([1, 2])
  })

  it('una cuenca donde ese valor no existe devuelve vacío, no la unión', () => {
    expect(porFaceta(catalogoHomonimo, 'yacimiento', 'EL TORDILLO', 'NEUQUINA')).toEqual([])
  })

  it('una cuenca que no está en el diccionario devuelve vacío', () => {
    expect(porFaceta(catalogoHomonimo, 'yacimiento', 'EL TORDILLO', 'NO EXISTE')).toEqual([])
  })

  it('la operadora ignora la cuenca: se pide toda la empresa', () => {
    expect(porFaceta(catalogoHomonimo, 'empresa', 'YPF S.A.', 'AUSTRAL').sort()).toEqual([1, 2, 3])
  })
})

describe('porFaceta ante un artefacto cacheado incompleto', () => {
  it('devuelve vacío en vez de lanzar cuando falta el diccionario del tipo', () => {
    const viejo = { ...catalogo, dicts: { ...catalogo.dicts } }
    delete viejo.dicts.sigla
    // Es el caso real: un enlace compartido a un pozo con el lite viejo en caché.
    expect(() => porFaceta(viejo, 'sigla', 'YPF.Nq.LC-1')).not.toThrow()
    expect(porFaceta(viejo, 'sigla', 'YPF.Nq.LC-1')).toEqual([])
  })

  it('los tipos que sí están siguen funcionando', () => {
    const viejo = { ...catalogo, dicts: { ...catalogo.dicts } }
    delete viejo.dicts.sigla
    expect(porFaceta(viejo, 'empresa', 'YPF S.A.').length).toBeGreaterThan(0)
  })
})
