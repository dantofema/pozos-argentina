import { API } from '../../src/lib/esquema.js'

/** Espera `ms` milisegundos. */
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Ejecuta SQL contra el DataStore y devuelve las filas.
 * Reintenta ante 5xx y timeouts: el gateway corta a los 60 s.
 */
export async function sql(consulta, { reintentos = 3, timeoutMs = 150000 } = {}) {
  let ultimoError
  for (let intento = 1; intento <= reintentos; intento++) {
    const control = new AbortController()
    const corte = setTimeout(() => control.abort(), timeoutMs)
    try {
      const respuesta = await fetch(`${API}/datastore_search_sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: consulta }),
        signal: control.signal,
      })
      const cuerpo = await respuesta.json()
      if (!cuerpo.success) {
        throw new Error(`CKAN rechazó la consulta: ${JSON.stringify(cuerpo.error).slice(0, 400)}`)
      }
      return cuerpo.result.records
    } catch (error) {
      ultimoError = error
      if (intento < reintentos) await esperar(2000 * intento)
    } finally {
      clearTimeout(corte)
    }
  }
  throw new Error(`Falló la consulta tras ${reintentos} intentos: ${ultimoError.message}`)
}

/** Devuelve un paquete CKAN por su nombre. */
export async function paquete(nombre) {
  const respuesta = await fetch(`${API}/package_show?id=${encodeURIComponent(nombre)}`)
  const cuerpo = await respuesta.json()
  if (!cuerpo.success) throw new Error(`No se encontró el paquete "${nombre}"`)
  return cuerpo.result
}

/**
 * Verifica que la tabla del recurso exista de verdad.
 * `datastore_active: true` miente: hay recursos marcados activos cuya
 * tabla responde "relation does not exist".
 */
export async function existeRecurso(id) {
  try {
    await sql(`SELECT 1 FROM "${id}" LIMIT 1`, { reintentos: 1, timeoutMs: 30000 })
    return true
  } catch {
    return false
  }
}
