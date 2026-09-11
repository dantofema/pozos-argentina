import { describe, it, expect } from 'vitest'
import { construirArtefactos, construirDiccionarios, nombreArchivoCuenca } from './artefactos.mjs'
import { LITE, FULL } from '../../src/lib/esquema.js'

const pozos = [
  {
    idpozo: '212', sigla: 'CH.CH.EaLE.x-1', empresa: 'YPF S.A.', area: 'EL AREA',
    yacimiento: 'EL YAC', cuenca: 'GOLFO SAN JORGE', provincia: 'Chubut',
    tipo_recurso: 'CONVENCIONAL', tipoestado: 'Extracción Efectiva',
    formacion: 'comodoro rivadavia', profundidad: '1702',
    geojson: '{"type":"Point","coordinates":[-68.287852,-45.591132]}',
  },
  {
    idpozo: '999', sigla: 'SIN.PROD-1', empresa: 'YPF S.A.', area: 'EL AREA',
    yacimiento: 'OTRO YAC', cuenca: 'NEUQUINA', provincia: 'Neuquén',
    tipo_recurso: 'NO CONVENCIONAL', tipoestado: 'A Abandonar',
    formacion: 'vaca muerta', profundidad: '2585',
    geojson: '{"type":"Point","coordinates":[-68.65,-38.36]}',
  },
]

const agregados = new Map([
  [212, { meses: '103', prim: '201801', ult: '202607', pet: '8808.2', gas: '1417.4', agua: '106520.8', tef: '2943.5' }],
])

describe('construirDiccionarios', () => {
  it('deduplica los valores repetidos', () => {
    const d = construirDiccionarios(pozos)
    expect(d.empresa).toEqual(['YPF S.A.'])
    expect(d.cuenca).toEqual(['GOLFO SAN JORGE', 'NEUQUINA'])
  })

  it('mapea nulos y vacíos a la cadena vacía', () => {
    const d = construirDiccionarios([{ ...pozos[0], formacion: null }])
    expect(d.formacion).toEqual([''])
  })
})

describe('construirArtefactos', () => {
  it('desprende lon y lat del geojson', () => {
    const { lite } = construirArtefactos(pozos, agregados)
    expect(lite.rows[0][LITE.LON]).toBeCloseTo(-68.28785, 5)
    expect(lite.rows[0][LITE.LAT]).toBeCloseTo(-45.59113, 5)
  })

  it('deja el pozo sin producción con meses en cero y acumulados en cero', () => {
    const { full, sinProduccion } = construirArtefactos(pozos, agregados)
    const neuquina = full.get('NEUQUINA').rows
    expect(neuquina).toHaveLength(1)
    expect(neuquina[0][FULL.MESES]).toBe(0)
    expect(neuquina[0][FULL.PET]).toBe(0)
    expect(neuquina[0][FULL.PRIMER_PERIODO]).toBe(0)
    expect(sinProduccion).toBe(1)
  })

  it('conserva los acumulados del pozo con producción', () => {
    const { full } = construirArtefactos(pozos, agregados)
    const fila = full.get('GOLFO SAN JORGE').rows[0]
    expect(fila[FULL.MESES]).toBe(103)
    expect(fila[FULL.PET]).toBeCloseTo(8808.2, 1)
    expect(fila[FULL.ULTIMO_PERIODO]).toBe(202607)
  })

  it('particiona el detalle por cuenca', () => {
    const { full } = construirArtefactos(pozos, agregados)
    expect([...full.keys()].sort()).toEqual(['GOLFO SAN JORGE', 'NEUQUINA'])
  })

  it('el lite y el full comparten los mismos diccionarios', () => {
    const { lite, full } = construirArtefactos(pozos, agregados)
    const filaLite = lite.rows.find((r) => r[LITE.ID] === 212)
    const filaFull = full.get('GOLFO SAN JORGE').rows[0]
    expect(lite.dicts.empresa[filaLite[LITE.EMPRESA]]).toBe('YPF S.A.')
    expect(lite.dicts.empresa[filaFull[FULL.EMPRESA]]).toBe('YPF S.A.')
  })

  it('descarta el pozo cuyo geojson no se puede parsear', () => {
    const roto = [{ ...pozos[0], geojson: 'no es json' }]
    const { lite } = construirArtefactos(roto, new Map())
    expect(lite.rows).toHaveLength(0)
  })
})

describe('nombreArchivoCuenca', () => {
  it('normaliza a minúscula sin acentos ni espacios', () => {
    expect(nombreArchivoCuenca('GOLFO SAN JORGE')).toBe('golfo-san-jorge')
    expect(nombreArchivoCuenca('CAÑADON ASFALTO')).toBe('canadon-asfalto')
  })
})
