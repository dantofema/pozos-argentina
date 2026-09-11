import { normalizar } from '../lib/catalogo.js'

function aRanura(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function nombreArchivo(estado) {
  if (estado.modo === 'faceta') return `pozos-${estado.tipo}-${aRanura(estado.valor)}.csv`
  if (estado.modo === 'poligono') return 'pozos-recorte.csv'
  return 'pozos.csv'
}

/** El BOM hace que Excel abra el archivo como UTF-8 en vez de romper los acentos. */
export function descargarCsv(texto, nombre) {
  const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function crearPanelDescarga(contenedor) {
  contenedor.innerHTML = `
    <div class="descarga" hidden>
      <p class="descarga__resumen"></p>
      <button type="button" class="descarga__boton">Descargar CSV</button>
    </div>`
  const panel = contenedor.querySelector('.descarga')
  const resumen = contenedor.querySelector('.descarga__resumen')
  const boton = contenedor.querySelector('.descarga__boton')

  return {
    mostrar({ texto, alDescargar }) {
      resumen.textContent = texto
      boton.onclick = alDescargar
      panel.hidden = false
    },
    ocultar() {
      panel.hidden = true
    },
  }
}
