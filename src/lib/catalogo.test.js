import { describe, it, expect } from 'vitest'
import { construirFacetas, buscar, normalizar } from './catalogo.js'
import { LITE } from './esquema.js'

const catalogo = {
  dicts: {
    area: ['LOMA CAMPANA', 'EL TREBOL'],
    yacimiento: ['LOMA CAMPANA-LLL', 'CAÑADON SECO'],
    empresa: ['YPF S.A.', 'VISTA ENERGY ARGENTINA SAU'],
    cuenca: ['NEUQUINA', 'GOLFO SAN JORGE'],
  },
  rows: [
    // id, lon, lat, area, yacimiento, empresa, cuenca
    [1, -68.6, -38.3, 0, 0, 0, 0],
    [2, -68.7, -38.4, 0, 0, 0, 0],
    [3, -67.5, -45.9, 1, 1, 1, 1],
  ],
}

describe('normalizar', () => {
  it('baja a minúscula y saca acentos', () => {
    expect(normalizar('CAÑADÓN Seco')).toBe('canadon seco')
  })
})

describe('construirFacetas', () => {
  it('cuenta pozos por cada valor de faceta', () => {
    const f = construirFacetas(catalogo)
    const loma = f.find((x) => x.tipo === 'area' && x.valor === 'LOMA CAMPANA')
    expect(loma.cantidad).toBe(2)
  })

  it('produce facetas de área, yacimiento y empresa', () => {
    const tipos = new Set(construirFacetas(catalogo).map((f) => f.tipo))
    expect([...tipos].sort()).toEqual(['area', 'empresa', 'yacimiento'])
  })

  it('no inventa facetas para valores sin pozos', () => {
    const f = construirFacetas(catalogo)
    expect(f.every((x) => x.cantidad > 0)).toBe(true)
  })
})

describe('buscar', () => {
  const facetas = construirFacetas(catalogo)

  it('encuentra sin distinguir acentos ni mayúsculas', () => {
    const r = buscar(facetas, 'canadon')
    expect(r.map((x) => x.valor)).toContain('CAÑADON SECO')
  })

  it('encuentra por coincidencia parcial', () => {
    const r = buscar(facetas, 'loma')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((x) => normalizar(x.valor).includes('loma'))).toBe(true)
  })

  it('prioriza los que empiezan con el texto', () => {
    const r = buscar(facetas, 'ypf')
    expect(r[0].valor).toBe('YPF S.A.')
  })

  it('respeta el límite', () => {
    expect(buscar(facetas, 'a', 2)).toHaveLength(2)
  })

  it('con texto vacío no devuelve nada', () => {
    expect(buscar(facetas, '')).toEqual([])
  })
})
