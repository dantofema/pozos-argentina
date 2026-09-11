import { LITE } from './esquema.js'

/** Tipos de faceta buscables, y la posición de su índice en una fila lite. */
const FACETAS = [
  { tipo: 'area', columna: LITE.AREA, porCuenca: true },
  { tipo: 'yacimiento', columna: LITE.YACIMIENTO, porCuenca: true },
  { tipo: 'empresa', columna: LITE.EMPRESA, porCuenca: false },
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
  for (const { tipo, columna, porCuenca } of FACETAS) {
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
