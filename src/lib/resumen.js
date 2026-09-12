import { ETIQUETA_TIPO } from './esquema.js'

/** 202607 -> "07/2026". Es lo que ve el usuario, no un formato interno. */
export function periodoLegible(periodo) {
  const p = String(periodo)
  return `${p.slice(4)}/${p.slice(0, 4)}`
}

/**
 * Los datos del ámbito elegido, etiquetados, uno por fila. Vive acá y no en
 * `main.js` porque es la única parte del armado de la página que decide algo:
 * qué se dice y en qué orden, según el modo. El resto de `main.js` es cableado.
 */
export function filasDelAmbito(estado, cantidad, ultimoPeriodo) {
  const filas = [{ etiqueta: 'Pozos', valor: cantidad.toLocaleString('es-AR') }]

  if (estado.modo === 'faceta') {
    filas.push({ etiqueta: 'Tipo', valor: ETIQUETA_TIPO[estado.tipo] ?? estado.tipo })
    filas.push({ etiqueta: 'Nombre', valor: estado.valor })
    // La cuenca sólo aparece cuando desambigua: una operadora trabaja en varias.
    if (estado.cuenca) filas.push({ etiqueta: 'Cuenca', valor: estado.cuenca })
  } else if (estado.modo === 'poligono') {
    filas.push({ etiqueta: 'Ámbito', valor: 'Zona dibujada en el mapa' })
  }

  filas.push({ etiqueta: 'Producción hasta', valor: periodoLegible(ultimoPeriodo) })
  return filas
}
