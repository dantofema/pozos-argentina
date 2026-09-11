import { describe, it, expect } from 'vitest'
import { COLUMNAS_DICT, LITE, FULL, COLUMNAS_CSV, admiteCuenca } from './esquema.js'

describe('esquema', () => {
  it('declara las ocho columnas que van a diccionario', () => {
    expect(COLUMNAS_DICT).toEqual([
      'empresa', 'area', 'yacimiento', 'cuenca',
      'provincia', 'tipo_recurso', 'tipoestado', 'formacion',
    ])
  })

  it('los índices de LITE son consecutivos y sin huecos', () => {
    expect(Object.values(LITE).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('los índices de FULL son consecutivos y sin huecos', () => {
    const esperado = Array.from({ length: 18 }, (_, i) => i)
    expect(Object.values(FULL).sort((a, b) => a - b)).toEqual(esperado)
  })

  it('el CSV declara una columna por campo, más lon y lat', () => {
    expect(COLUMNAS_CSV).toHaveLength(20)
    expect(COLUMNAS_CSV.slice(0, 4)).toEqual(['idpozo', 'sigla', 'lon', 'lat'])
  })
})

describe('admiteCuenca', () => {
  it('acota yacimiento y área, que pueden ser homónimos entre cuencas', () => {
    expect(admiteCuenca('yacimiento')).toBe(true)
    expect(admiteCuenca('area')).toBe(true)
  })

  it('no acota la operadora: trabaja en varias cuencas y se pide entera', () => {
    expect(admiteCuenca('empresa')).toBe(false)
  })

  it('no acota un tipo desconocido', () => {
    expect(admiteCuenca('chirimbolo')).toBe(false)
  })
})
