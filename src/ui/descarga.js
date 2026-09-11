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
    /**
     * Ámbito con pozos: resumen + botón habilitado. El click deshabilita el
     * botón mientras dura la descarga (así un segundo click no dispara una
     * segunda carga de la misma cuenca) y, si `alDescargar` rechaza, lo dice
     * en el propio resumen en vez de dejar el rechazo sin manejar.
     */
    mostrar({ texto, alDescargar }) {
      resumen.textContent = texto
      boton.hidden = false
      boton.disabled = false
      boton.onclick = async () => {
        if (boton.disabled) return
        boton.disabled = true
        resumen.textContent = 'Preparando el CSV…'
        try {
          await alDescargar()
          resumen.textContent = texto
        } catch (error) {
          console.error('No se pudo generar el CSV:', error)
          resumen.textContent = 'No se pudo generar el CSV. Probá de nuevo en unos minutos.'
        } finally {
          boton.disabled = false
        }
      }
      panel.hidden = false
    },

    /** Ámbito sin pozos (p.ej. un enlace compartido a una faceta que ya no existe): sólo texto, sin botón. */
    mostrarVacio(texto) {
      resumen.textContent = texto
      boton.onclick = null
      boton.hidden = true
      panel.hidden = false
    },

    ocultar() {
      panel.hidden = true
    },
  }
}
