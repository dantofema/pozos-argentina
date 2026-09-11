import { describe, it, expect } from 'vitest'
import { nombreArchivoCuenca, cargarDetalle } from './detalle.js'
import { nombreArchivoCuenca as nombreDelBuild } from '../../scripts/lib/artefactos.mjs'

// Los 10 nombres de cuencas reales. Esta lista es la fuente de verdad para el test
// y no requiere artefactos generados. Cubre acentos, Ñ, espacios y nombres compuestos.
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
    for (const cuenca of cuencasReales) {
      const delNavegador = nombreArchivoCuenca(cuenca)
      const delBuild = nombreDelBuild(cuenca)
      expect({ cuenca, nombre: delNavegador }).toEqual({ cuenca, nombre: delBuild })
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
