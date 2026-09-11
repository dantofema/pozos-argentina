/** Guardas del build. Cualquiera que no pase aborta la corrida. */

export function assertMinFilas(nombre, cantidad, minimo) {
  if (cantidad < minimo) {
    throw new Error(
      `Volcado corto en "${nombre}": ${cantidad} filas, se esperaban al menos ${minimo}. ` +
      'El origen cambió o devolvió datos incompletos; no se publica nada.'
    )
  }
}

export function assertColumnas(nombre, fila, columnas) {
  const faltan = columnas.filter((c) => !(c in fila))
  if (faltan.length > 0) {
    throw new Error(
      `Faltan columnas en "${nombre}": ${faltan.join(', ')}. ` +
      `Llegaron: ${Object.keys(fila).join(', ')}`
    )
  }
}
