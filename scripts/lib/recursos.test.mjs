import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { candidatosDelPaquete, elegirPorAnio } from './recursos.mjs'

const candidatos = JSON.parse(
  await readFile(new URL('../../tests/fixtures/recursos-candidatos.json', import.meta.url))
)

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

  it('ignora los candidatos cuya tabla no existe', () => {
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
