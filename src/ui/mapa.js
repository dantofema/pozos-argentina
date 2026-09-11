import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LITE } from '../lib/esquema.js'
import { WMS, CAPAS_CONTEXTO, ARGENMAP } from './capas.js'

/** Vista de arranque: el país entero. */
export const VISTA_INICIAL = { centro: [-40, -64], zoom: 4 }

function capaWms(capa) {
  return L.tileLayer.wms(WMS, {
    layers: capa,
    styles: '',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
  })
}

/**
 * @param contenedor  el div del mapa
 * @param preferCanvas  con una cuenca entera (33k+ pozos) un <path> SVG por
 *   marcador traba el paneo, así que por defecto se dibuja en canvas. Se puede
 *   pedir SVG: es lo que hacen los tests, porque jsdom no tiene contexto 2D y
 *   cualquier vector sobre canvas ahí lanza.
 */
export function crearMapa(contenedor, { preferCanvas = true } = {}) {
  const mapa = L.map(contenedor, { preferCanvas })
    .setView(VISTA_INICIAL.centro, VISTA_INICIAL.zoom)

  L.tileLayer(ARGENMAP.url, ARGENMAP.opciones).addTo(mapa)

  const contexto = Object.fromEntries(
    Object.entries(CAPAS_CONTEXTO).map(([etiqueta, capa]) => [etiqueta, capaWms(capa)])
  )
  L.control.layers(null, contexto, { collapsed: true }).addTo(mapa)

  const grupoPozos = L.layerGroup().addTo(mapa)
  let alDibujarCallback = null
  let alCambiarDibujo = null

  // --- Dibujo de zona -------------------------------------------------------
  // Se arma con un botón y después se arrastra sin tecla modificadora. Antes era
  // shift + arrastrar: además de indescubrible, no funcionaba con un mouse real,
  // porque sin cancelar el comportamiento por defecto el navegador arranca una
  // selección de texto que se come el gesto. Leaflet hace lo mismo en su BoxZoom.
  let armado = false
  let inicio = null
  let rectangulo = null

  function limpiarGesto() {
    inicio = null
    if (rectangulo) { rectangulo.remove(); rectangulo = null }
    L.DomEvent.off(document, 'mousemove', alMover)
    L.DomEvent.off(document, 'mouseup', alSoltar)
    L.DomUtil.enableTextSelection()
    L.DomUtil.enableImageDrag()
  }

  function alMover(e) {
    if (!inicio) return
    if (rectangulo) rectangulo.remove()
    rectangulo = L.rectangle(L.latLngBounds(inicio, mapa.mouseEventToLatLng(e)), {
      color: '#0369A1', weight: 1, fillOpacity: 0.08,
    }).addTo(mapa)
  }

  function alSoltar(e) {
    if (!inicio) return
    const limites = L.latLngBounds(inicio, mapa.mouseEventToLatLng(e))
    limpiarGesto()
    desarmar()

    // Un click sin arrastrar no es una zona.
    if (limites.getWest() === limites.getEast() || limites.getSouth() === limites.getNorth()) return

    const o = limites.getWest(), es = limites.getEast()
    const s = limites.getSouth(), n = limites.getNorth()
    if (alDibujarCallback) alDibujarCallback([[o, s], [es, s], [es, n], [o, n]])
  }

  function alApretar(e) {
    if (!armado || inicio) return
    L.DomEvent.preventDefault(e.originalEvent)
    L.DomUtil.disableTextSelection()
    L.DomUtil.disableImageDrag()
    inicio = e.latlng
    L.DomEvent.on(document, 'mousemove', alMover)
    L.DomEvent.on(document, 'mouseup', alSoltar)
  }

  function armar() {
    if (armado) return
    armado = true
    mapa.dragging.disable()
    mapa.boxZoom.disable()
    L.DomUtil.addClass(contenedor, 'mapa--dibujando')
    if (alCambiarDibujo) alCambiarDibujo(true)
  }

  function desarmar() {
    if (!armado) return
    armado = false
    mapa.dragging.enable()
    mapa.boxZoom.enable()
    L.DomUtil.removeClass(contenedor, 'mapa--dibujando')
    if (alCambiarDibujo) alCambiarDibujo(false)
  }

  mapa.on('mousedown', alApretar)

  return {
    mapa,

    mostrarPozos(filas) {
      grupoPozos.clearLayers()
      for (const f of filas) {
        L.circleMarker([f[LITE.LAT], f[LITE.LON]], {
          radius: 3, weight: 1, color: '#AD5520', fillOpacity: 0.7,
        }).addTo(grupoPozos)
      }
    },

    limpiarPozos() {
      grupoPozos.clearLayers()
    },

    encuadrar(filas) {
      if (filas.length === 0) return
      const limites = L.latLngBounds(filas.map((f) => [f[LITE.LAT], f[LITE.LON]]))
      mapa.fitBounds(limites, { padding: [24, 24] })
    },

    /** Vuelve a la vista de arranque, sin tocar el ámbito elegido. */
    volverAlInicio() {
      limpiarGesto()
      desarmar()
      mapa.setView(VISTA_INICIAL.centro, VISTA_INICIAL.zoom)
    },

    alDibujar(callback) {
      alDibujarCallback = callback
    },

    /** Avisa cuándo el modo dibujo se arma o se desarma, para reflejarlo en el botón. */
    alCambiarModoDibujo(callback) {
      alCambiarDibujo = callback
    },

    /** Arma o desarma el modo dibujo. Se desarma solo al terminar un gesto. */
    alternarDibujo() {
      if (armado) { limpiarGesto(); desarmar() } else { armar() }
    },

    estaDibujando() {
      return armado
    },
  }
}
