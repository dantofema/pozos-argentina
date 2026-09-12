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

/**
 * Compara contra el manifiesto del build anterior. Las guardas de piso atajan
 * una caida gruesa -un volcado que vuelve vacio-, no una parcial: una fusion
 * por idpozo que deja de matchear un subconjunto mueve `sinProduccion` de 520 a
 * miles sin acercarse a ningun piso. Estas dos magnitudes tienen direccion
 * conocida -los pozos se acumulan, y los que no declaran produccion bajan a
 * medida que se declara produccion atrasada-, asi que un movimiento al reves es
 * sospechoso por si mismo. Sin manifiesto previo (clon nuevo) no hay nada que
 * comparar y la guarda no opina.
 */
export function assertSinRegresion(previo, actual) {
  if (!previo) return
  if (Number.isFinite(previo.pozos) && actual.pozos < previo.pozos * 0.98) {
    throw new Error(
      `El indice perdio pozos: ${actual.pozos} contra ${previo.pozos} del build anterior. ` +
      'Los pozos se acumulan; una caida asi es un volcado incompleto. No se publica nada.'
    )
  }
  if (Number.isFinite(previo.sinProduccion) && actual.sinProduccion > previo.sinProduccion * 3 + 100) {
    throw new Error(
      `Saltaron los pozos sin produccion: ${actual.sinProduccion} contra ${previo.sinProduccion} ` +
      'del build anterior. Es la firma de una fusion por idpozo que dejo de matchear. ' +
      'No se publica nada.'
    )
  }
}
