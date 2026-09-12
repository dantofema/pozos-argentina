import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  construirFacetas,
  buscar,
  normalizar,
  cargarCatalogo,
  cargarManifiesto,
  cargarIndice,
} from './catalogo.js'
import { LITE } from './esquema.js'

const catalogo = {
  dicts: {
    area: ['LOMA CAMPANA', 'EL TREBOL'],
    yacimiento: ['LOMA CAMPANA-LLL', 'CAÑADON SECO'],
    empresa: ['YPF S.A.', 'VISTA ENERGY ARGENTINA SAU'],
    cuenca: ['NEUQUINA', 'GOLFO SAN JORGE'],
    sigla: ['YPF.Nq.LC-1', 'YPF.Nq.LC-2', 'PBE.Ch.CS-9'],
  },
  rows: [
    // id, lon, lat, area, yacimiento, empresa, cuenca
    [1, -68.6, -38.3, 0, 0, 0, 0, 0],
    [2, -68.7, -38.4, 0, 0, 0, 0, 1],
    [3, -67.5, -45.9, 1, 1, 1, 1, 2],
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

  it('produce facetas de los cinco tipos buscables', () => {
    const tipos = new Set(construirFacetas(catalogo).map((f) => f.tipo))
    expect([...tipos].sort()).toEqual(['area', 'cuenca', 'empresa', 'sigla', 'yacimiento'])
  })

  it('saltea un tipo cuyo diccionario no está, sin tirar la página', () => {
    const viejo = { ...catalogo, dicts: { ...catalogo.dicts } }
    delete viejo.dicts.sigla
    const tipos = new Set(construirFacetas(viejo).map((f) => f.tipo))
    expect(tipos.has('sigla')).toBe(false)
    expect(tipos.has('yacimiento')).toBe(true)
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
    sigla: ['A-1', 'A-2', 'A-3'],
  },
  rows: [
    [1, -67.5, -45.9, 0, 0, 0, 0, 0],
    [2, -67.6, -45.8, 0, 0, 0, 0, 1],
    [3, -69.0, -51.0, 0, 0, 0, 1, 2],
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

describe('cargarCatalogo', () => {
  const LITE_OK = { dicts: { cuenca: ['NEUQUINA'] }, rows: [[7, -68.6, -38.3, 0, 0, 0, 0, 0]] }
  const MANIFIESTO_OK = { pozos: 1, ultimoPeriodo: 202607, generado: '2026-09-11T00:00:00.000Z' }

  function responder(porArchivo) {
    globalThis.fetch = vi.fn(async (url) => {
      const respuesta = Object.entries(porArchivo).find(([nombre]) => String(url).endsWith(nombre))
      if (!respuesta) return { ok: false, status: 404, statusText: 'Not Found' }
      return { ok: true, status: 200, json: async () => respuesta[1] }
    })
  }

  afterEach(() => { vi.unstubAllGlobals(); delete globalThis.fetch })

  it('indexa las filas por id para no recorrer 85.000 en cada consulta', async () => {
    responder({ 'pozos-lite.json': LITE_OK, 'manifiesto.json': MANIFIESTO_OK })

    const catalogo = await cargarCatalogo('/')

    expect(catalogo.porId.get(7)).toBe(catalogo.rows[0])
    expect(catalogo.manifiesto.ultimoPeriodo).toBe(202607)
  })

  it('pide los dos archivos en paralelo, no uno después del otro', async () => {
    responder({ 'pozos-lite.json': LITE_OK, 'manifiesto.json': MANIFIESTO_OK })

    await cargarCatalogo('/')

    // Las dos llamadas salen antes de que ninguna respuesta se haya resuelto.
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('dice qué archivo faltó en vez de un error de sintaxis del index.html', async () => {
    responder({ 'manifiesto.json': MANIFIESTO_OK })

    await expect(cargarCatalogo('/')).rejects.toThrow(/pozos-lite\.json: 404/)
  })

  it('rechaza un índice sin la forma esperada, y no más adentro', async () => {
    responder({ 'pozos-lite.json': { dicts: {} }, 'manifiesto.json': MANIFIESTO_OK })

    await expect(cargarCatalogo('/')).rejects.toThrow(/no tiene la forma esperada/)
  })
})

describe('carga partida en manifiesto e índice (G6)', () => {
  const LITE_OK = { dicts: { cuenca: ['NEUQUINA'] }, rows: [[7, -68.6, -38.3, 0, 0, 0, 0, 0]] }
  const MANIFIESTO_OK = { pozos: 1, ultimoPeriodo: 202607, generado: '2026-09-12T00:00:00.000Z' }

  afterEach(() => { delete globalThis.fetch })

  it('cargarManifiesto pide un solo archivo, el chico', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => MANIFIESTO_OK }))

    const m = await cargarManifiesto('/')

    expect(m.pozos).toBe(1)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('manifiesto.json')
  })

  it('cargarIndice pide sólo el índice y lo valida', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => LITE_OK }))

    const i = await cargarIndice('/')

    expect(i.porId.get(7)).toBe(i.rows[0])
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('pozos-lite.json')
  })

  it('cargarIndice rechaza un índice sin forma, y no más adentro', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ dicts: {} }) }))
    await expect(cargarIndice('/')).rejects.toThrow(/no tiene la forma esperada/)
  })

  it('cargarCatalogo sigue devolviendo las dos cosas juntas', async () => {
    globalThis.fetch = vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('manifiesto') ? MANIFIESTO_OK : LITE_OK),
    }))

    const c = await cargarCatalogo('/')

    expect(c.manifiesto.pozos).toBe(1)
    expect(c.porId.get(7)).toBeDefined()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })
})
