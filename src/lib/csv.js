import { FULL, LITE, COLUMNAS_CSV } from './esquema.js'

export function escaparCampo(valor) {
  const s = valor === null || valor === undefined ? '' : String(valor)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Un CSV con una fila por pozo. `filas` son filas FULL. */
export function construirCsv({ filas, dicts, catalogo }) {
  const lineas = [COLUMNAS_CSV.join(',')]

  for (const f of filas) {
    const lite = catalogo.porId?.get(f[FULL.ID])
    const lon = lite ? lite[LITE.LON] : ''
    const lat = lite ? lite[LITE.LAT] : ''

    lineas.push([
      f[FULL.ID],
      f[FULL.SIGLA],
      lon,
      lat,
      dicts.empresa[f[FULL.EMPRESA]],
      dicts.area[f[FULL.AREA]],
      dicts.yacimiento[f[FULL.YACIMIENTO]],
      dicts.cuenca[f[FULL.CUENCA]],
      dicts.provincia[f[FULL.PROVINCIA]],
      dicts.tipo_recurso[f[FULL.TIPO_RECURSO]],
      dicts.tipoestado[f[FULL.TIPO_ESTADO]],
      dicts.formacion[f[FULL.FORMACION]],
      f[FULL.PROFUNDIDAD],
      f[FULL.MESES],
      f[FULL.PRIMER_PERIODO] || '',
      f[FULL.ULTIMO_PERIODO] || '',
      f[FULL.PET],
      f[FULL.GAS],
      f[FULL.AGUA],
      f[FULL.TEF],
    ].map(escaparCampo).join(','))
  }

  return lineas.join('\r\n')
}
