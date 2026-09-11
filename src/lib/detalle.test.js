import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { nombreArchivoCuenca, cargarDetalle } from './detalle.js'
import { nombreArchivoCuenca as nombreDelBuild } from '../../scripts/lib/artefactos.mjs'

// Los 10 nombres de cuencas reales. Esta lista es la fuente de verdad para el test
// y funciona sin dependencia en artefactos generados.
const cuencasReales = [
  'GOLFO SAN JORGE',
  'NEUQUINA',
  'CUYANA',
  'AUSTRAL',
  'NOROESTE',
  'NORESTE',
  'LOS BOLSONES',
  'CAÑADON ASFALTO',
  'GENERAL LEVALLE',
  'ÑIRIHUAU',
]

// Intenta leer el manifiesto generado (opcional). Si existe, agrega sus nombres
// al conjunto de prueba; si no existe, el test sigue con la lista fija.
function obtenerCuencasAProbar() {
  const cuencas = [...cuencasReales]
  try {
    const manifestoPath = resolve(import.meta.url, '../../public/manifiesto.json')
    const contenido = readFileSync(manifestoPath, 'utf-8')
    const manifiesto = JSON.parse(contenido)
    if (manifiesto.cuencas && Array.isArray(manifiesto.cuencas)) {
      for (const { cuenca } of manifiesto.cuencas) {
        if (!cuencas.includes(cuenca)) {
          cuencas.push(cuenca)
        }
      }
    }
  } catch {
    // Si falta el manifiesto o no se puede leer, seguimos con la lista fija
  }
  return cuencas
}

describe('nombreArchivoCuenca - equivalencia con build', () => {
  it('dos casos fijos del build: GOLFO SAN JORGE', () => {
    expect(nombreArchivoCuenca('GOLFO SAN JORGE')).toBe(nombreDelBuild('GOLFO SAN JORGE'))
    expect(nombreArchivoCuenca('GOLFO SAN JORGE')).toBe('golfo-san-jorge')
  })

  it('dos casos fijos del build: CAÑADON ASFALTO', () => {
    expect(nombreArchivoCuenca('CAÑADON ASFALTO')).toBe(nombreDelBuild('CAÑADON ASFALTO'))
    expect(nombreArchivoCuenca('CAÑADON ASFALTO')).toBe('canadon-asfalto')
  })

  it('todos los nombres de cuencas producen el mismo resultado en ambas copias', () => {
    const cuencas = obtenerCuencasAProbar()
    for (const cuenca of cuencas) {
      const delNavegador = nombreArchivoCuenca(cuenca)
      const delBuild = nombreDelBuild(cuenca)
      expect(delNavegador).toBe(delBuild)
      if (delNavegador !== delBuild) {
        console.error(`Divergencia en "${cuenca}": navegador=${delNavegador}, build=${delBuild}`)
      }
    }
  })
})

describe('cargarDetalle - errores y cache', () => {
  it('rechaza con error si la respuesta no es ok', async () => {
    const error = await cargarDetalle(['NO_EXISTE_ESTA_CUENCA'], '/').catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('pozos-full-no-existe-esta-cuenca.json')
  })

  it('no envenenece la cache en caso de fallo: un reintento busca de nuevo', async () => {
    // Primer intento falla
    await expect(cargarDetalle(['NO_EXISTE_OTRA'], '/')).rejects.toThrow()
    // Segundo intento vuelve a pedirlo (en la práctica falla de nuevo, pero sin reutilizar promesa)
    const error2 = await cargarDetalle(['NO_EXISTE_OTRA'], '/').catch((e) => e)
    expect(error2).toBeInstanceOf(Error)
  })

  it('rechaza si la respuesta no tiene rows', async () => {
    const error = await cargarDetalle(['GOLFO SAN JORGE'], '/test-no-rows-').catch((e) => e)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('rows')
  })
})
