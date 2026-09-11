import { LITE } from './esquema.js'

/** Tipos de faceta buscables, y la posición de su índice en una fila lite. */
const FACETAS = [
  { tipo: 'area', columna: LITE.AREA },
  { tipo: 'yacimiento', columna: LITE.YACIMIENTO },
  { tipo: 'empresa', columna: LITE.EMPRESA },
]

export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Carga el índice y el manifiesto que dejó el build. */
export async function cargarCatalogo(base = import.meta.env.BASE_URL) {
  const [lite, manifiesto] = await Promise.all([
    fetch(`${base}pozos-lite.json`).then((r) => r.json()),
    fetch(`${base}manifiesto.json`).then((r) => r.json()),
  ])
  const porId = new Map(lite.rows.map((f) => [f[LITE.ID], f]))
  return { dicts: lite.dicts, rows: lite.rows, manifiesto, porId }
}

/** Arma la lista buscable, con la cantidad de pozos de cada valor. */
export function construirFacetas(catalogo) {
  const salida = []
  for (const { tipo, columna } of FACETAS) {
    const cuenta = new Map()
    for (const fila of catalogo.rows) {
      const i = fila[columna]
      cuenta.set(i, (cuenta.get(i) ?? 0) + 1)
    }
    for (const [indice, cantidad] of cuenta) {
      const valor = catalogo.dicts[tipo][indice]
      if (!valor) continue
      salida.push({ tipo, valor, indice, cantidad, buscable: normalizar(valor) })
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
