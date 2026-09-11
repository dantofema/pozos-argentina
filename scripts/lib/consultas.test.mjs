import { describe, it, expect } from 'vitest'
import { sqlPozos, sqlAgregado } from './consultas.mjs'
import { RECURSO_POZOS } from '../../src/lib/esquema.js'

describe('sqlPozos', () => {
  it('pide el recurso de pozos con orden estable y paginado', () => {
    const q = sqlPozos(20000, 40000)
    expect(q).toContain(`FROM "${RECURSO_POZOS}"`)
    expect(q).toContain('ORDER BY idpozo')
    expect(q).toContain('LIMIT 20000')
    expect(q).toContain('OFFSET 40000')
  })

  it('trae geojson, que es la geometría válida', () => {
    expect(sqlPozos(1, 0)).toContain('geojson')
  })

  it('no toca coordenadax ni coordenaday, que están transpuestas', () => {
    const q = sqlPozos(1, 0)
    expect(q).not.toContain('coordenadax')
    expect(q).not.toContain('coordenaday')
  })
})

describe('sqlAgregado', () => {
  const recursos = [{ anio: 2026, id: 'aaa' }, { anio: 2025, id: 'bbb' }]

  it('une todos los años con UNION ALL', () => {
    const q = sqlAgregado(recursos)
    expect(q).toContain('FROM "aaa"')
    expect(q).toContain('FROM "bbb"')
    expect(q.match(/UNION ALL/g)).toHaveLength(1)
  })

  it('agrupa por pozo', () => {
    expect(sqlAgregado(recursos)).toContain('GROUP BY idpozo')
  })

  it('con un solo año no emite UNION ALL', () => {
    expect(sqlAgregado([{ anio: 2026, id: 'aaa' }])).not.toContain('UNION ALL')
  })

  it('falla si no le pasan recursos', () => {
    expect(() => sqlAgregado([])).toThrow(/sin recursos/i)
  })
})
