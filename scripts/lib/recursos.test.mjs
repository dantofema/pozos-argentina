import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFile } from 'node:fs/promises'

vi.mock('./ckan.mjs', () => ({
  paquete: vi.fn(),
  sql: vi.fn(),
  existeRecurso: vi.fn(),
}))

import { candidatosDelPaquete, elegirPorAnio, resolverRecursos } from './recursos.mjs'
import { paquete, sql, existeRecurso } from './ckan.mjs'

const fixture = JSON.parse(
  await readFile(new URL('../../tests/fixtures/recursos-candidatos.json', import.meta.url))
)
// Retrato del catálogo del 2026-09-10, DDJJ incluidos. Las cifras son de esa
// fecha: el origen republica recursos y los conteos se mueven.
const candidatos = fixture.candidatos

describe('elegirPorAnio', () => {
  it('elige el recurso con más filas cuando hay duplicados del mismo año', () => {
    const elegidos = elegirPorAnio([
      { anio: 2025, id: 'chico', nombre: '- 2025', filas: 90000 },
      { anio: 2025, id: 'grande', nombre: '– 2025', filas: 991844 },
    ])
    expect(elegidos.get(2025).id).toBe('grande')
  })

  it('descarta el 2025 truncado del catálogo real', () => {
    const elegidos = elegirPorAnio(candidatos)
    const elegido2025 = elegidos.get(2025)
    const truncado = candidatos.find((c) => c.anio === 2025 && c.filas < 200000)
    expect(truncado).toBeDefined()
    expect(elegido2025.id).not.toBe(truncado.id)
    expect(elegido2025.filas).toBeGreaterThan(truncado.filas)
  })

  it('devuelve un único recurso por año', () => {
    const elegidos = elegirPorAnio(candidatos)
    const anios = candidatos.map((c) => c.anio)
    expect(elegidos.size).toBe(new Set(anios).size)
  })

  it('para 2026 descarta el recurso DDJJ del catálogo real aunque tenga más filas', () => {
    // El fixture se grabó con la versión de candidatosDelPaquete previa al filtro
    // DDJJ, así que trae ambas variantes de 2026. Reconstruimos un paquete falso
    // con esos mismos datos para ejercitar la función real (ya con el filtro) y
    // probar que el DDJJ (576934 filas) no le gana al principal (561000 filas).
    const paqueteFixture = {
      resources: candidatos.map((c) => ({ id: c.id, name: c.nombre, datastore_active: true })),
    }
    const filtrados = candidatosDelPaquete(paqueteFixture, 2018, 2026)
    const conFilas = filtrados.map((c) => ({
      ...c,
      filas: candidatos.find((x) => x.id === c.id).filas,
    }))
    const elegidos = elegirPorAnio(conFilas)
    const elegido2026 = elegidos.get(2026)
    const ddjj2026 = candidatos.find((c) => c.anio === 2026 && /DDJJ/i.test(c.nombre))

    expect(ddjj2026).toBeDefined()
    expect(elegido2026.id).not.toBe(ddjj2026.id)
    expect(elegido2026.filas).toBeLessThan(ddjj2026.filas)
    expect(elegido2026.nombre).not.toMatch(/DDJJ/i)
  })

  it('para 2020 —un año cerrado— también descarta el DDJJ con más filas', () => {
    // El de 2026 solo prueba el año en curso. Sin este, angostar el filtro a
    // `anio === anioHasta` deja verde toda la suite y corrompe en silencio la
    // serie histórica: 2020 cerrado tiene un DDJJ de 954.001 filas contra
    // 953.660 del principal, apenas 341 más, y ganaría por cantidad.
    const paqueteFixture = {
      resources: candidatos.map((c) => ({ id: c.id, name: c.nombre, datastore_active: true })),
    }
    const conFilas = candidatosDelPaquete(paqueteFixture, 2018, 2026).map((c) => ({
      ...c,
      filas: candidatos.find((x) => x.id === c.id).filas,
    }))
    const elegido2020 = elegirPorAnio(conFilas).get(2020)
    const ddjj2020 = candidatos.find((c) => c.anio === 2020 && /DDJJ/i.test(c.nombre))

    expect(ddjj2020).toBeDefined()
    expect(ddjj2020.filas).toBeGreaterThan(elegido2020.filas)
    expect(elegido2020.nombre).not.toMatch(/DDJJ/i)
    expect(elegido2020.id).not.toBe(ddjj2020.id)
  })

  it('el fixture trae DDJJ: sin ellos los dos tests de arriba no probarían nada', () => {
    // Guarda contra el modo silencioso de romperlos: regrabar el fixture ya
    // filtrado los dejaría verdes y vacíos. Por eso `grabar-fixture-recursos.mjs`
    // usa `recursosDeProduccion` y no `candidatosDelPaquete`.
    const ddjj = candidatos.filter((c) => /DDJJ/i.test(c.nombre))
    expect(ddjj.length).toBeGreaterThan(0)
    expect(new Set(ddjj.map((c) => c.anio)).size).toBeGreaterThan(1)
  })

  it('elige el recurso con filas por sobre el que tiene cero', () => {
    const elegidos = elegirPorAnio([
      { anio: 2024, id: 'roto', nombre: 'roto', filas: 0 },
      { anio: 2024, id: 'sano', nombre: 'sano', filas: 500 },
    ])
    expect(elegidos.get(2024).id).toBe('sano')
  })
})

describe('candidatosDelPaquete', () => {
  const paqueteFalso = {
    resources: [
      { id: 'a', name: 'Producción de Pozos de Gas y Petróleo – 2026', datastore_active: true },
      { id: 'b', name: 'Producción de Pozos de Gas y Petróleo - 2017', datastore_active: true },
      { id: 'c', name: 'Capítulo IV - Pozos', datastore_active: true },
      { id: 'd', name: 'Producción de Pozos de Gas y Petróleo – 2026', datastore_active: false },
      {
        id: 'e',
        name: 'Producción de Pozos de Gas y Petróleo - 2026 (DDJJ abiertas y cerradas)',
        datastore_active: true,
      },
    ],
  }

  it('toma sólo recursos de producción con año dentro del rango', () => {
    const r = candidatosDelPaquete(paqueteFalso, 2018, 2026)
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('a')
  })

  it('descarta los que no están en el datastore', () => {
    const r = candidatosDelPaquete(paqueteFalso, 2018, 2026)
    expect(r.map((x) => x.id)).not.toContain('d')
  })

  it('descarta las variantes DDJJ abiertas y cerradas', () => {
    const r = candidatosDelPaquete(paqueteFalso, 2018, 2026)
    expect(r.map((x) => x.id)).not.toContain('e')
  })
})

describe('resolverRecursos', () => {
  // Mockea el borde de red (ckan.mjs): no se prueba la red, se prueba si
  // resolverRecursos aborta o no ante cada situación del origen.
  beforeEach(() => {
    vi.resetAllMocks()
  })

  const recurso = (anio, id) => ({
    id,
    name: `Producción de Pozos de Gas y Petróleo - ${anio}`,
    datastore_active: true,
  })

  it('devuelve un recurso por año cuando el catálogo está completo, ordenado del año más nuevo al más viejo', async () => {
    paquete.mockResolvedValue({
      resources: [recurso(2023, 'r2023'), recurso(2024, 'r2024'), recurso(2025, 'r2025')],
    })
    existeRecurso.mockResolvedValue(true)
    sql.mockResolvedValue([{ n: 300000 }])

    const resultado = await resolverRecursos({ anioDesde: 2023, anioHasta: 2025 })

    expect(resultado.map((r) => r.anio)).toEqual([2025, 2024, 2023])
  })

  it('lanza cuando falta un año del rango pedido, y el mensaje nombra el año que falta', async () => {
    paquete.mockResolvedValue({
      resources: [recurso(2023, 'r2023'), recurso(2025, 'r2025')],
    })
    existeRecurso.mockResolvedValue(true)
    sql.mockResolvedValue([{ n: 300000 }])

    await expect(resolverRecursos({ anioDesde: 2023, anioHasta: 2025 }))
      .rejects.toThrow(/Faltan.*2024/)
  })

  it('lanza cuando el paquete no trae ningún recurso de producción', async () => {
    paquete.mockResolvedValue({ resources: [] })

    await expect(resolverRecursos({ anioDesde: 2023, anioHasta: 2025 }))
      .rejects.toThrow(/no trajo recursos de producción/)
  })

  it('saltea los recursos cuya tabla no existe y, si eso deja un año sin recurso, lanza', async () => {
    paquete.mockResolvedValue({
      resources: [recurso(2023, 'r2023'), recurso(2024, 'r2024')],
    })
    existeRecurso.mockImplementation(async (id) => id !== 'r2024')
    sql.mockResolvedValue([{ n: 300000 }])

    await expect(resolverRecursos({ anioDesde: 2023, anioHasta: 2024 }))
      .rejects.toThrow(/Faltan.*2024/)
  })

  it('aplica el piso de filas a los años cerrados', async () => {
    paquete.mockResolvedValue({
      resources: [recurso(2023, 'r2023'), recurso(2024, 'r2024')],
    })
    existeRecurso.mockResolvedValue(true)
    sql.mockImplementation(async (consulta) => {
      const [, id] = /FROM "(.+)"/.exec(consulta)
      return [{ n: id === 'r2023' ? 100000 : 300000 }]
    })

    await expect(resolverRecursos({ anioDesde: 2023, anioHasta: 2024 }))
      .rejects.toThrow(/producción 2023/)
  })

  it('exime del piso al año en curso', async () => {
    paquete.mockResolvedValue({
      resources: [recurso(2023, 'r2023'), recurso(2024, 'r2024')],
    })
    existeRecurso.mockResolvedValue(true)
    sql.mockImplementation(async (consulta) => {
      const [, id] = /FROM "(.+)"/.exec(consulta)
      return [{ n: id === 'r2024' ? 1000 : 300000 }]
    })

    const resultado = await resolverRecursos({ anioDesde: 2023, anioHasta: 2024 })

    expect(resultado.find((r) => r.anio === 2024).filas).toBe(1000)
  })
})
