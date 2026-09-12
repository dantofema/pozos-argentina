import { normalizar } from '../lib/catalogo.js'

function aRanura(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function nombreArchivo(estado) {
  if (estado.modo === 'faceta') {
    // La cuenca entra al nombre para que dos yacimientos homónimos no se pisen
    // en la carpeta de descargas.
    const base = `pozos-${estado.tipo}-${aRanura(estado.valor)}`
    return estado.cuenca ? `${base}-${aRanura(estado.cuenca)}.csv` : `${base}.csv`
  }
  if (estado.modo === 'poligono') return 'pozos-zona.csv'
  return 'pozos.csv'
}

/** El BOM hace que Excel abra el archivo como UTF-8 en vez de romper los acentos. */
export function descargarCsv(texto, nombre) {
  const blob = new Blob(['\ufeff' + texto], { type: 'text/csv;charset=utf-8;' })
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
      <dl class="descarga__datos"></dl>
      <p class="descarga__aviso" hidden></p>
      <button type="button" class="descarga__boton">Descargar CSV</button>
    </div>`
  const panel = contenedor.querySelector('.descarga')
  const datos = contenedor.querySelector('.descarga__datos')
  const aviso = contenedor.querySelector('.descarga__aviso')
  const boton = contenedor.querySelector('.descarga__boton')

  /** Pinta pares etiqueta/valor, uno por fila. `textContent` porque vienen del dato. */
  function pintarDatos(filas) {
    datos.innerHTML = ''
    for (const { etiqueta, valor } of filas) {
      const dt = document.createElement('dt')
      dt.textContent = etiqueta
      const dd = document.createElement('dd')
      dd.textContent = valor
      datos.append(dt, dd)
    }
    datos.hidden = filas.length === 0
  }

  function mostrarAviso(texto) {
    aviso.textContent = texto
    aviso.hidden = !texto
  }

  return {
    /**
     * Ámbito con pozos: los datos etiquetados y el botón habilitado. El click
     * deshabilita el botón mientras dura la descarga (así un segundo click no
     * dispara una segunda carga de la misma cuenca) y, si `alDescargar`
     * rechaza, lo dice en el aviso en vez de dejar el rechazo sin manejar.
     */
    mostrar({ filas, alDescargar }) {
      pintarDatos(filas)
      mostrarAviso('')
      boton.hidden = false
      boton.disabled = false
      boton.onclick = async () => {
        if (boton.disabled) return
        boton.disabled = true
        mostrarAviso('Preparando el CSV…')
        try {
          await alDescargar()
          mostrarAviso('')
        } catch (error) {
          console.error('No se pudo generar el CSV:', error)
          mostrarAviso('No se pudo generar el CSV. Probá de nuevo en unos minutos.')
        } finally {
          boton.disabled = false
        }
      }
      panel.hidden = false
    },

    /** Ámbito sin pozos (p.ej. un enlace compartido a una faceta que ya no existe). */
    mostrarVacio(texto) {
      pintarDatos([])
      mostrarAviso(texto)
      boton.hidden = true
      panel.hidden = false
    },

    ocultar() {
      panel.hidden = true
    },
  }
}
