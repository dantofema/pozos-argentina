import { LITE, admiteCuenca } from './esquema.js'

const COLUMNA_POR_TIPO = {
  area: LITE.AREA,
  yacimiento: LITE.YACIMIENTO,
  empresa: LITE.EMPRESA,
  cuenca: LITE.CUENCA,
  sigla: LITE.SIGLA,
}

/** Ray casting. El caso del punto exactamente sobre el borde no está definido. */
export function puntoEnPoligono(lon, lat, anillo) {
  if (!anillo || anillo.length < 3) return false
  let dentro = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]
    const [xj, yj] = anillo[j]
    const cruza = (yi > lat) !== (yj > lat) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (cruza) dentro = !dentro
  }
  return dentro
}

/**
 * Ids de los pozos cuyo valor de faceta coincide.
 *
 * `cuenca` es opcional y sólo acota yacimiento y área, donde dos nombres iguales
 * en cuencas distintas son cosas distintas. Una operadora se pide entera aunque
 * trabaje en varias cuencas. Omitirla devuelve la unión, que es lo que hacen los
 * enlaces anteriores a esta desambiguación.
 */
export function porFaceta(catalogo, tipo, valor, cuenca) {
  const columna = COLUMNA_POR_TIPO[tipo]
  if (columna === undefined) throw new Error(`Tipo de faceta desconocido: ${tipo}`)
  // Un artefacto cacheado de un build anterior puede no traer este diccionario
  // —`sigla` es el caso concreto—, y un enlace compartido a un pozo lo pediría.
  // Sin ámbito es mejor que una excepción que el usuario lee como "no cargó el
  // catálogo" cuando el catálogo sí cargó.
  const diccionario = catalogo.dicts[tipo]
  if (!diccionario) return []
  const indice = diccionario.indexOf(valor)
  if (indice === -1) return []

  const acota = cuenca != null && admiteCuenca(tipo)
  const indiceCuenca = acota ? catalogo.dicts.cuenca.indexOf(cuenca) : -1
  if (acota && indiceCuenca === -1) return []

  return catalogo.rows
    .filter((f) => f[columna] === indice && (!acota || f[LITE.CUENCA] === indiceCuenca))
    .map((f) => f[LITE.ID])
}

/** Ids de los pozos que caen dentro del anillo dibujado. */
export function porPoligono(catalogo, anillo) {
  return catalogo.rows
    .filter((f) => puntoEnPoligono(f[LITE.LON], f[LITE.LAT], anillo))
    .map((f) => f[LITE.ID])
}

/** Cuencas involucradas por un conjunto de pozos. Determina qué particiones cargar. */
export function cuencasDe(catalogo, ids) {
  const cuencas = new Set()
  for (const id of ids) {
    const fila = catalogo.porId?.get(id) ?? catalogo.rows.find((f) => f[LITE.ID] === id)
    if (!fila) continue
    const cuenca = catalogo.dicts.cuenca[fila[LITE.CUENCA]]
    if (!cuenca) continue
    cuencas.add(cuenca)
  }
  return [...cuencas]
}
