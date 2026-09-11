import { describe, it, expect, vi, afterEach } from 'vitest'
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

// `fetch` se mockea explícitamente: con URL relativa, el `fetch` real de Node
// rechaza con un TypeError al intentar parsear la URL, antes de tocar la red.
// Eso hacía pasar los tres tests de este bloque sin ejercitar el código de
// `cargarDetalle` (`if (!r.ok)`, el guard de `datos.rows`, la cache) — el texto
// del TypeError o de la propia URL de prueba contenía por casualidad la
// substring que el test buscaba. Cada test usa una cuenca ficticia propia para
// no compartir la cache de `archivo` (module-level) entre tests.
describe('cargarDetalle - errores y cache', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('si la respuesta no es ok, el error nombra el archivo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })))

    const error = await cargarDetalle(['CUENCA MOCK NO OK'], '/base/').catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    expect(error.message).toContain('pozos-full-cuenca-mock-no-ok.json')
  })

  it('si la respuesta ok no trae rows, rechaza con el mensaje del guard', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ algo: 'que no es rows' }),
    })))

    const error = await cargarDetalle(['CUENCA MOCK SIN FILAS'], '/base/').catch((e) => e)

    expect(error).toBeInstanceOf(Error)
    // El texto exacto del guard, no sólo "rows": si el guard se saltea, la
    // función igual explota más abajo al iterar `datos.rows` (undefined) en el
    // `for...of`, y ese TypeError también contiene la palabra "rows" — por eso
    // no alcanza con un toContain('rows') genérico para probar que el guard
    // explícito es el que corrió.
    expect(error.message).toContain("no contiene un array 'rows'")
  })

  it('no envenena la cache: si el fetch falla, el siguiente intento vuelve a pedir la red', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rows: [[212, 'CH.CH.EaLE.x-1']] }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const primerIntento = await cargarDetalle(['CUENCA MOCK RETRY'], '/base/').catch((e) => e)
    expect(primerIntento).toBeInstanceOf(Error)

    // Si la cache hubiera guardado la promesa rechazada, este segundo intento
    // volvería a rechazar sin llamar a fetch de nuevo.
    const porId = await cargarDetalle(['CUENCA MOCK RETRY'], '/base/')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(porId.get(212)).toEqual([212, 'CH.CH.EaLE.x-1'])
  })
})
