import { describe, it, expect } from 'vitest'
import { sql, existeRecurso } from '../../scripts/lib/ckan.mjs'
import { resolverRecursos } from '../../scripts/lib/recursos.mjs'
import { sqlPozos, sqlAgregado } from '../../scripts/lib/consultas.mjs'
import { RECURSO_POZOS, ANIO_DESDE } from '../../src/lib/esquema.js'

/**
 * Estos tests pegan contra el origen vivo. No corren en `npm test`.
 * Son la alarma de que la Secretaría de Energía cambió algo.
 */
describe('contrato con el origen', () => {
  it('la tabla de pozos sigue existiendo', async () => {
    expect(await existeRecurso(RECURSO_POZOS)).toBe(true)
  })

  it('la tabla de pozos conserva las columnas que usamos', async () => {
    const [fila] = await sql(sqlPozos(1, 0))
    for (const c of ['idpozo', 'sigla', 'empresa', 'area', 'yacimiento',
                     'cuenca', 'provincia', 'tipo_recurso', 'tipoestado',
                     'formacion', 'profundidad', 'geojson']) {
      expect(fila, `falta la columna ${c}`).toHaveProperty(c)
    }
  })

  it('el geojson sigue siendo un punto parseable', async () => {
    const [fila] = await sql(sqlPozos(1, 0))
    const g = JSON.parse(fila.geojson)
    expect(g.type).toBe('Point')
    expect(g.coordinates).toHaveLength(2)
  })

  it('sigue habiendo un recurso de producción por año', async () => {
    const anioHasta = new Date().getFullYear()
    const recursos = await resolverRecursos({ anioDesde: ANIO_DESDE, anioHasta })
    expect(recursos).toHaveLength(anioHasta - ANIO_DESDE + 1)
  })

  it('el agregado devuelve las columnas esperadas', async () => {
    const anioHasta = new Date().getFullYear()
    const recursos = await resolverRecursos({ anioDesde: anioHasta, anioHasta })
    const consulta = `${sqlAgregado(recursos)}\nLIMIT 1`
    const [fila] = await sql(consulta)
    for (const c of ['idpozo', 'meses', 'prim', 'ult', 'pet', 'gas', 'agua', 'tef']) {
      expect(fila, `falta la columna ${c}`).toHaveProperty(c)
    }
  })

  it('el recurso del año en curso no encogió', async () => {
    const anioHasta = new Date().getFullYear()
    const [recurso] = await resolverRecursos({ anioDesde: anioHasta, anioHasta })
    expect(recurso.filas).toBeGreaterThan(50000)
  })

  it('el recurso del año en curso no es la variante DDJJ (D5)', async () => {
    // D5 en docs/reglas/datos.md: para el año en curso el recurso "(DDJJ abiertas y
    // cerradas)" tiene más filas que el principal y por eso hay que excluirlo a mano
    // en lugar de confiar en la heurística de "más filas gana". Si esto falla, o bien
    // el origen sacó el recurso DDJJ (dejó de haber ambigüedad) o bien resolverRecursos
    // dejó de filtrarlo — cualquiera de las dos es una alarma real.
    const anioHasta = new Date().getFullYear()
    const [recurso] = await resolverRecursos({ anioDesde: anioHasta, anioHasta })
    expect(recurso.nombre).not.toMatch(/DDJJ/i)
  })
})
