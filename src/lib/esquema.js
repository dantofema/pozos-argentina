/** Constantes compartidas entre el build (Node) y el sitio (navegador). */

export const API = 'http://datos.energia.gob.ar/api/3/action'
export const RECURSO_POZOS = 'cb5c0f04-7835-45cd-b982-3e25ca7d7751'
export const PAQUETE_PRODUCCION = 'produccion-de-petroleo-y-gas-por-pozo'
export const ANIO_DESDE = 2018
export const FILAS_POR_PAGINA = 20000

/** Columnas cuyos valores se reemplazan por un índice a un diccionario. */
export const COLUMNAS_DICT = [
  'empresa', 'area', 'yacimiento', 'cuenca',
  'provincia', 'tipo_recurso', 'tipoestado', 'formacion',
]

/** Tipos de faceta buscables. */
export const TIPOS_FACETA = ['area', 'yacimiento', 'empresa']

/**
 * Si la cuenca acota o no a ese tipo de faceta.
 *
 * Dos yacimientos —o dos áreas— con el mismo nombre en cuencas distintas son
 * cosas distintas y se separan. Una operadora que trabaja en varias cuencas es
 * una sola operadora y se pide entera: partirla dejaría imposible pedir "toda
 * YPF". Esta es la única definición de esa regla; todo lo demás la consulta.
 */
export function admiteCuenca(tipo) {
  return tipo === 'area' || tipo === 'yacimiento'
}

/** Posición de cada campo en una fila de `pozos-lite.json`. */
export const LITE = {
  ID: 0, LON: 1, LAT: 2, AREA: 3, YACIMIENTO: 4, EMPRESA: 5, CUENCA: 6,
}

/** Posición de cada campo en una fila de `pozos-full-<cuenca>.json`. */
export const FULL = {
  ID: 0, SIGLA: 1, EMPRESA: 2, AREA: 3, YACIMIENTO: 4, CUENCA: 5,
  PROVINCIA: 6, TIPO_RECURSO: 7, TIPO_ESTADO: 8, FORMACION: 9,
  PROFUNDIDAD: 10, MESES: 11, PRIMER_PERIODO: 12, ULTIMO_PERIODO: 13,
  PET: 14, GAS: 15, AGUA: 16, TEF: 17,
}

/** Encabezado del CSV, en orden. */
export const COLUMNAS_CSV = [
  'idpozo', 'sigla', 'lon', 'lat', 'empresa', 'area', 'yacimiento',
  'cuenca', 'provincia', 'tipo_recurso', 'tipo_estado', 'formacion',
  'profundidad', 'meses', 'primer_periodo', 'ultimo_periodo',
  'pet_acum', 'gas_acum', 'agua_acum', 'tef_total',
]
