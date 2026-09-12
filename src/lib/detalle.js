import { FULL } from './esquema.js'

/** Misma regla que `scripts/lib/artefactos.mjs`: los nombres deben coincidir. */
export function nombreArchivoCuenca(cuenca) {
  return cuenca
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const cache = new Map()

/**
 * Pide una partición una sola vez. Un rechazo se saca del cache: si no, un
 * fallo transitorio dejaría la cuenca rota hasta recargar la página.
 */
function pedirParticion(archivo, base) {
  if (!cache.has(archivo)) {
    cache.set(archivo, fetch(`${base}${archivo}`)
      .then((r) => {
        if (!r.ok) {
          throw new Error(`No se pudo cargar ${archivo}: ${r.status} ${r.statusText}`)
        }
        return r.json()
      })
      .then((datos) => {
        if (!datos || typeof datos.rows === 'undefined') {
          throw new Error(`${archivo} no contiene un array 'rows'`)
        }
        return datos
      })
      .catch((error) => {
        cache.delete(archivo)
        throw error
      }))
  }
  return cache.get(archivo)
}

/** Carga las particiones de las cuencas pedidas y devuelve las filas por id de pozo. */
export async function cargarDetalle(cuencas, base = import.meta.env.BASE_URL) {
  // Los pedidos salen todos juntos y recién después se esperan: una zona que
  // cruza Golfo San Jorge y Neuquina son 3,6 MB + 2,8 MB, y en serie se paga la
  // suma en vez del máximo.
  const pedidos = cuencas.map((cuenca) => pedirParticion(`pozos-full-${nombreArchivoCuenca(cuenca)}.json`, base))
  const particiones = await Promise.all(pedidos)

  const porId = new Map()
  for (const datos of particiones) {
    for (const fila of datos.rows) porId.set(fila[FULL.ID], fila)
  }
  return porId
}
