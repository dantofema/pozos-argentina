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

/** Carga las particiones de las cuencas pedidas y devuelve las filas por id de pozo. */
export async function cargarDetalle(cuencas, base = '/') {
  const porId = new Map()
  for (const cuenca of cuencas) {
    const archivo = `pozos-full-${nombreArchivoCuenca(cuenca)}.json`
    if (!cache.has(archivo)) {
      cache.set(archivo, fetch(`${base}${archivo}`).then((r) => r.json()))
    }
    const datos = await cache.get(archivo)
    for (const fila of datos.rows) porId.set(fila[FULL.ID], fila)
  }
  return porId
}
