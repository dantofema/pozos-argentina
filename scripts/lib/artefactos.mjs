import { COLUMNAS_DICT } from '../../src/lib/esquema.js'

/** Devuelve el índice del valor en el diccionario, agregándolo si no estaba. */
export function indiceDe(diccionario, valor) {
  const v = valor ?? ''
  let i = diccionario.indexOf(v)
  if (i === -1) {
    i = diccionario.length
    diccionario.push(v)
  }
  return i
}

export function construirDiccionarios(pozos) {
  const dicts = Object.fromEntries(COLUMNAS_DICT.map((c) => [c, []]))
  for (const p of pozos) {
    for (const c of COLUMNAS_DICT) indiceDe(dicts[c], p[c] ?? '')
  }
  return dicts
}

export function nombreArchivoCuenca(cuenca) {
  return cuenca
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Lee las coordenadas del geojson. Devuelve null si no se puede parsear. */
function coordenadas(geojson) {
  try {
    const g = JSON.parse(geojson)
    const [lon, lat] = g.coordinates
    if (typeof lon !== 'number' || typeof lat !== 'number') return null
    return [Number(lon.toFixed(5)), Number(lat.toFixed(5))]
  } catch {
    return null
  }
}

/**
 * Fusiona pozos y agregados de producción en los artefactos que publica el sitio.
 * La fusión es un LEFT JOIN: un pozo sin producción declarada queda con ceros,
 * no se oculta.
 */
export function construirArtefactos(pozos, agregados) {
  const dicts = construirDiccionarios(pozos)
  const idx = (columna, pozo) => indiceDe(dicts[columna], pozo[columna] ?? '')

  const lite = []
  const full = new Map()
  let sinProduccion = 0

  for (const p of pozos) {
    const c = coordenadas(p.geojson)
    if (!c) continue

    const id = Number(p.idpozo)
    const iEmpresa = idx('empresa', p)
    const iArea = idx('area', p)
    const iYacimiento = idx('yacimiento', p)
    const iCuenca = idx('cuenca', p)

    lite.push([id, c[0], c[1], iArea, iYacimiento, iEmpresa, iCuenca])

    const a = agregados.get(id)
    if (!a) sinProduccion++

    const fila = [
      id, p.sigla ?? '', iEmpresa, iArea, iYacimiento, iCuenca,
      idx('provincia', p), idx('tipo_recurso', p),
      idx('tipoestado', p), idx('formacion', p),
      Number(p.profundidad ?? 0) || 0,
      a ? Number(a.meses ?? 0) : 0,
      a ? Number(a.prim ?? 0) : 0,
      a ? Number(a.ult ?? 0) : 0,
      a ? Number(a.pet ?? 0) : 0,
      a ? Number(a.gas ?? 0) : 0,
      a ? Number(a.agua ?? 0) : 0,
      a ? Number(a.tef ?? 0) : 0,
    ]

    const cuenca = p.cuenca ?? ''
    if (!full.has(cuenca)) full.set(cuenca, { rows: [] })
    full.get(cuenca).rows.push(fila)
  }

  return { lite: { dicts, rows: lite }, full, sinProduccion }
}
