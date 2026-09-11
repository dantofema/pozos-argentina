import { paquete, sql, existeRecurso } from './ckan.mjs'
import { assertMinFilas } from './guardas.mjs'
import { PAQUETE_PRODUCCION } from '../../src/lib/esquema.js'

/** Piso de filas para un año completo. El más flaco medido rondó las 500.000. */
const MIN_FILAS_ANIO = 200000

/**
 * Extrae del paquete los recursos de producción anual dentro del rango.
 * Deja afuera la tabla de pozos y cualquier recurso fuera del datastore.
 */
export function candidatosDelPaquete(p, anioDesde, anioHasta) {
  return (p.resources ?? [])
    .filter((r) => r.datastore_active)
    .filter((r) => /producc/i.test(r.name ?? ''))
    // Los "(DDJJ abiertas y cerradas)" son un conjunto distinto: incluyen
    // declaraciones juradas todavía abiertas. Sólo en el año en curso superan
    // en filas al recurso principal (cerradas nomás); mezclarlos rompe la
    // comparabilidad de la serie histórica.
    .filter((r) => !/DDJJ/i.test(r.name ?? ''))
    .map((r) => {
      const encontrado = /(20\d\d)/.exec(r.name ?? '')
      return encontrado
        ? { anio: Number(encontrado[1]), id: r.id, nombre: r.name }
        : null
    })
    .filter((c) => c && c.anio >= anioDesde && c.anio <= anioHasta)
}

/**
 * Entre varios candidatos del mismo año, se queda con el que más filas tiene.
 * Es una heurística, no una certeza: el catálogo publica duplicados que sólo
 * se distinguen por un guión, y uno de ellos está truncado.
 */
export function elegirPorAnio(candidatosConFilas) {
  const porAnio = new Map()
  for (const c of candidatosConFilas) {
    const actual = porAnio.get(c.anio)
    if (!actual || c.filas > actual.filas) porAnio.set(c.anio, c)
  }
  return porAnio
}

/** Resuelve contra el origen vivo. Devuelve un recurso por año, del más nuevo al más viejo. */
export async function resolverRecursos({ anioDesde, anioHasta }) {
  const p = await paquete(PAQUETE_PRODUCCION)
  const candidatos = candidatosDelPaquete(p, anioDesde, anioHasta)
  if (candidatos.length === 0) {
    throw new Error(`El paquete "${PAQUETE_PRODUCCION}" no trajo recursos de producción`)
  }

  const conFilas = []
  for (const c of candidatos) {
    if (!(await existeRecurso(c.id))) continue
    const [{ n }] = await sql(`SELECT count(*) AS n FROM "${c.id}"`)
    conFilas.push({ ...c, filas: Number(n) })
  }

  const elegidos = [...elegirPorAnio(conFilas).values()]
    .sort((a, b) => b.anio - a.anio)

  const aniosEsperados = anioHasta - anioDesde + 1
  if (elegidos.length !== aniosEsperados) {
    const faltan = []
    for (let a = anioDesde; a <= anioHasta; a++) {
      if (!elegidos.some((e) => e.anio === a)) faltan.push(a)
    }
    throw new Error(`Faltan recursos de producción para: ${faltan.join(', ')}`)
  }

  // El año en curso está incompleto por definición: no se le exige el piso.
  for (const e of elegidos) {
    if (e.anio < anioHasta) assertMinFilas(`producción ${e.anio}`, e.filas, MIN_FILAS_ANIO)
  }

  return elegidos
}
