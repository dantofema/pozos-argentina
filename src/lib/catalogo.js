import { LITE, TIPOS_FACETA, admiteCuenca } from './esquema.js'

/** Tipos de faceta buscables, y la posición de su índice en una fila lite. */
const COLUMNA_POR_TIPO = {
  area: LITE.AREA,
  yacimiento: LITE.YACIMIENTO,
  empresa: LITE.EMPRESA,
  cuenca: LITE.CUENCA,
  sigla: LITE.SIGLA,
}

const FACETAS = TIPOS_FACETA.map((tipo) => ({
  tipo,
  columna: COLUMNA_POR_TIPO[tipo],
  porCuenca: admiteCuenca(tipo),
}))

export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Un host que responde los 404 con el index.html del sitio haría fallar a
 * `r.json()` con un error de sintaxis que no nombra el archivo. Mirar `r.ok`
 * primero convierte eso en un mensaje que dice qué faltó.
 */
async function pedirJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`No se pudo cargar ${url}: ${r.status} ${r.statusText}`)
  return r.json()
}

/** El manifiesto: 2,8 kB. Es lo único que el hero necesita para empezar (G6). */
export async function cargarManifiesto(base = import.meta.env.BASE_URL) {
  return pedirJson(`${base}manifiesto.json`)
}

/** El índice: 1,26 MB gzip. Es lo que habilita buscar (G6). */
export async function cargarIndice(base = import.meta.env.BASE_URL) {
  const lite = await pedirJson(`${base}pozos-lite.json`)
  // Sin esto, un índice a medio generar explota más adentro con un TypeError
  // que no dice qué archivo estaba mal.
  if (!lite || !Array.isArray(lite.rows) || !lite.dicts) {
    throw new Error('pozos-lite.json no tiene la forma esperada (rows + dicts)')
  }
  return {
    dicts: lite.dicts,
    rows: lite.rows,
    porId: new Map(lite.rows.map((f) => [f[LITE.ID], f])),
  }
}

/** Las dos cosas, para quien las quiera juntas. */
export async function cargarCatalogo(base = import.meta.env.BASE_URL) {
  const [indice, manifiesto] = await Promise.all([cargarIndice(base), cargarManifiesto(base)])
  return { ...indice, manifiesto }
}

/** Arma la lista buscable, con la cantidad de pozos de cada valor. */
export function construirFacetas(catalogo) {
  const salida = []
  for (const { tipo, columna, porCuenca } of FACETAS) {
    // Un artefacto de un build anterior puede no traer este diccionario: se
    // saltea el tipo en vez de tirar la página entera.
    if (!catalogo.dicts[tipo]) continue
    const cuenta = new Map()
    for (const fila of catalogo.rows) {
      // Un yacimiento o un área con el mismo nombre en dos cuencas son dos cosas
      // distintas y se cuentan por separado. Una operadora no: trabaja en varias
      // cuencas y se pide entera.
      const clave = porCuenca ? `${fila[columna]}|${fila[LITE.CUENCA]}` : `${fila[columna]}|`
      cuenta.set(clave, (cuenta.get(clave) ?? 0) + 1)
    }
    for (const [clave, cantidad] of cuenta) {
      const [textoIndice, textoCuenca] = clave.split('|')
      const indice = Number(textoIndice)
      const valor = catalogo.dicts[tipo][indice]
      if (!valor) continue
      const cuenca = porCuenca ? catalogo.dicts.cuenca[Number(textoCuenca)] ?? null : null
      salida.push({ tipo, valor, indice, cuenca, cantidad, buscable: normalizar(valor) })
    }
  }
  return salida
}

/** Busca por coincidencia parcial. Primero los que empiezan con el texto. */
export function buscar(facetas, texto, limite = 20) {
  const t = normalizar(texto)
  if (t === '') return []
  return facetas
    .filter((f) => f.buscable.includes(t))
    .sort((a, b) => {
      const ea = a.buscable.startsWith(t) ? 0 : 1
      const eb = b.buscable.startsWith(t) ? 0 : 1
      if (ea !== eb) return ea - eb
      return b.cantidad - a.cantidad
    })
    .slice(0, limite)
}
