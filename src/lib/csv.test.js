import { describe, it, expect } from 'vitest'
import { escaparCampo, construirCsv } from './csv.js'
import { COLUMNAS_CSV } from './esquema.js'

const dicts = {
  empresa: ['PETROLERA, S.A.'],
  area: ['EL AREA'],
  yacimiento: ['EL YAC'],
  cuenca: ['NEUQUINA'],
  provincia: ['Neuquén'],
  tipo_recurso: ['NO CONVENCIONAL'],
  tipoestado: ['Extracción Efectiva'],
  formacion: ['vaca muerta'],
}

const catalogo = {
  porId: new Map([[1, [1, -68.65028, -38.36952, 0, 0, 0, 0]]]),
}

// id, sigla, empresa, area, yac, cuenca, prov, tipoRec, tipoEst, form,
// prof, meses, prim, ult, pet, gas, agua, tef
const filas = [
  [1, 'YPF.Nq.LLL-1577(h)', 0, 0, 0, 0, 0, 0, 0, 0, 2585, 86, 201901, 202607, 244920.3, 39406.3, 1200, 2500],
  [2, 'SIN.PROD-1', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]

describe('escaparCampo', () => {
  it('deja pasar un valor simple', () => {
    expect(escaparCampo('YPF S.A.')).toBe('YPF S.A.')
  })

  it('entrecomilla cuando hay coma', () => {
    expect(escaparCampo('PETROLERA, S.A.')).toBe('"PETROLERA, S.A."')
  })

  it('duplica las comillas internas', () => {
    expect(escaparCampo('EL "POZO"')).toBe('"EL ""POZO"""')
  })

  it('entrecomilla cuando hay salto de línea', () => {
    expect(escaparCampo('una\notra')).toBe('"una\notra"')
  })

  it('convierte null y undefined en vacío', () => {
    expect(escaparCampo(null)).toBe('')
    expect(escaparCampo(undefined)).toBe('')
  })

  it('conserva el cero', () => {
    expect(escaparCampo(0)).toBe('0')
  })
})

describe('construirCsv', () => {
  it('arranca con el encabezado declarado', () => {
    const csv = construirCsv({ filas, dicts, catalogo })
    expect(csv.split('\r\n')[0]).toBe(COLUMNAS_CSV.join(','))
  })

  it('emite una fila por pozo', () => {
    const csv = construirCsv({ filas, dicts, catalogo })
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('resuelve los índices de diccionario a texto', () => {
    const csv = construirCsv({ filas, dicts, catalogo })
    expect(csv).toContain('vaca muerta')
    expect(csv).toContain('"PETROLERA, S.A."')
  })

  it('pone lon y lat del catálogo', () => {
    const linea = construirCsv({ filas, dicts, catalogo }).split('\r\n')[1]
    expect(linea).toContain('-68.65028')
    expect(linea).toContain('-38.36952')
  })

  it('deja lon y lat vacíos si el pozo no está en el catálogo', () => {
    const linea = construirCsv({ filas, dicts, catalogo }).split('\r\n')[2]
    const campos = linea.split(',')
    expect(campos[2]).toBe('')
    expect(campos[3]).toBe('')
  })

  it('el pozo sin producción sale con ceros, no se omite', () => {
    const csv = construirCsv({ filas, dicts, catalogo })
    expect(csv).toContain('SIN.PROD-1')
  })

  it('usa CRLF, que es lo que espera Excel', () => {
    expect(construirCsv({ filas, dicts, catalogo })).toContain('\r\n')
  })
})
