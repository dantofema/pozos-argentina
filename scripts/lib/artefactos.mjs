import { COLUMNAS_DICT } from '../../src/lib/esquema.js'

/**
 * Las nueve formaciones que dibuja el hero, en el orden estratigráfico de la
 * cuenca Neuquina. Se duplican acá a propósito: `src/lib/estratigrafia.js` es el
 * dato del dibujo y este es el del build, y no queremos que el script de build
 * importe del árbol del navegador. El test de la Tarea 4 exige que coincidan.
 */
const FORMACIONES_DEL_HERO = [
  'RAYOSO', 'HUITRIN', 'AGRIO', 'CENTENARIO', 'QUINTUCO',
  'VACA MUERTA', 'TORDILLO', 'LOTENA', 'LAJAS',
]

/** Mayúsculas sin acentos, para que `huitrín` del origen matchee `HUITRIN`. */
function claveFormacion(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

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

/**
 * Caja de plausibilidad, no un contorno del pais: sirve para descartar puntos
 * imposibles, no para decidir jurisdicciones. El origen publica algunos pozos
 * con lon/lat invertidos dentro del propio `geojson` -dos en el volcado del
 * 2026-09-11-, y un punto invertido cae en el oceano Indico: se dibuja en
 * cualquier lado, ninguna zona dibujada lo captura y el CSV exporta una
 * coordenada falsa. Los 85.609 pozos restantes de ese volcado caen en
 * lon [-72,11; -57,76] y lat [-54,02; -22,00], bien adentro de esta caja.
 */
export const CAJA_ARGENTINA = { lonMin: -75, lonMax: -52, latMin: -57, latMax: -20 }

function enCaja([lon, lat]) {
  return lon >= CAJA_ARGENTINA.lonMin && lon <= CAJA_ARGENTINA.lonMax &&
    lat >= CAJA_ARGENTINA.latMin && lat <= CAJA_ARGENTINA.latMax
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
  let descartados = 0
  // Se listan enteros, no se cuentan: son pocos y el build los nombra para que
  // se pueda reclamar al origen pozo por pozo.
  const fueraDeCaja = []
  // Arranca en cero y no vacío: una formación de la columna sin pozos declarados
  // es un dato, y es distinto de un manifiesto viejo que no trae la clave.
  const formaciones = Object.fromEntries(FORMACIONES_DEL_HERO.map((f) => [f, 0]))

  for (const p of pozos) {
    const c = coordenadas(p.geojson)
    if (!c) {
      descartados++
      continue
    }
    // Se descarta, no se corrige: invertir lon/lat por nuestra cuenta seria
    // publicar una coordenada que el origen nunca dijo. Un pozo sin ubicacion
    // confiable no entra al indice.
    if (!enCaja(c)) {
      fueraDeCaja.push({ idpozo: Number(p.idpozo), sigla: p.sigla ?? '', lon: c[0], lat: c[1] })
      continue
    }

    if (claveFormacion(p.cuenca) === 'NEUQUINA') {
      const f = claveFormacion(p.formacion)
      if (f in formaciones) formaciones[f]++
    }

    const id = Number(p.idpozo)
    const iEmpresa = idx('empresa', p)
    const iArea = idx('area', p)
    const iYacimiento = idx('yacimiento', p)
    const iCuenca = idx('cuenca', p)

    lite.push([id, c[0], c[1], iArea, iYacimiento, iEmpresa, iCuenca, idx('sigla', p)])

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

  return { lite: { dicts, rows: lite }, full, sinProduccion, descartados, fueraDeCaja, formaciones }
}
