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

// Mismo nombre de yacimiento y de área en dos cuencas distintas, y una operadora
// que trabaja en las dos: los dos primeros son ambigüedad, el tercero no.
const catalogoHomonimo = {
  dicts: {
    area: ['JACHAL'],
    yacimiento: ['EL TORDILLO'],
    empresa: ['YPF S.A.'],
    cuenca: ['GOLFO SAN JORGE', 'AUSTRAL'],
  },
  rows: [
    [1, -67.5, -45.9, 0, 0, 0, 0],
    [2, -67.6, -45.8, 0, 0, 0, 0],
    [3, -69.0, -51.0, 0, 0, 0, 1],
  ],
}

describe('construirFacetas con nombres homónimos', () => {
  it('parte un yacimiento homónimo en una faceta por cuenca', () => {
    const f = construirFacetas(catalogoHomonimo).filter((x) => x.tipo === 'yacimiento')
    expect(f).toHaveLength(2)
    expect(f.map((x) => x.cuenca).sort()).toEqual(['AUSTRAL', 'GOLFO SAN JORGE'])
    expect(f.find((x) => x.cuenca === 'GOLFO SAN JORGE').cantidad).toBe(2)
    expect(f.find((x) => x.cuenca === 'AUSTRAL').cantidad).toBe(1)
  })

  it('parte un área homónima en una faceta por cuenca', () => {
    const f = construirFacetas(catalogoHomonimo).filter((x) => x.tipo === 'area')
    expect(f).toHaveLength(2)
    expect(f.map((x) => x.cuenca).sort()).toEqual(['AUSTRAL', 'GOLFO SAN JORGE'])
  })

  it('NO parte la operadora: una empresa trabaja en varias cuencas legítimamente', () => {
    const f = construirFacetas(catalogoHomonimo).filter((x) => x.tipo === 'empresa')
    expect(f).toHaveLength(1)
    expect(f[0].cantidad).toBe(3)
    expect(f[0].cuenca).toBeNull()
  })

  it('un yacimiento que vive en una sola cuenca igual lleva su cuenca', () => {
    const f = construirFacetas(catalogo).filter((x) => x.tipo === 'yacimiento')
    expect(f.every((x) => typeof x.cuenca === 'string')).toBe(true)
  })
})
