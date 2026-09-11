import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LITE } from '../lib/esquema.js'
import { WMS, CAPAS_CONTEXTO } from './wms.js'

function capaWms(capa) {
  return L.tileLayer.wms(WMS, {
    layers: capa,
    styles: '',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
  })
}

export function crearMapa(contenedor) {
  // preferCanvas: con una cuenca entera (33k+ pozos) un <path> SVG por marcador
  // traba el paneo; canvas reposiciona todo en un solo elemento.
  const mapa = L.map(contenedor, { preferCanvas: true }).setView([-38.5, -68.5], 6)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18,
  }).addTo(mapa)

  const contexto = Object.fromEntries(
    Object.entries(CAPAS_CONTEXTO).map(([etiqueta, capa]) => [etiqueta, capaWms(capa)])
  )
  L.control.layers(null, contexto, { collapsed: true }).addTo(mapa)

  const grupoPozos = L.layerGroup().addTo(mapa)
  let alDibujarCallback = null
  let dibujoHabilitado = false

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

    alDibujar(callback) {
      alDibujarCallback = callback
    },

    /**
     * Dibujo de rectángulo: shift + arrastrar. Leaflet ya lo trae para zoom; acá se reusa.
     * Sólo engancha handlers una vez: llamar dos veces sería aditivo y disparía
     * `alDibujar` por duplicado en cada gesto.
     */
    habilitarDibujo() {
      if (dibujoHabilitado) return
      dibujoHabilitado = true

      mapa.boxZoom.disable()
      let inicio = null
      let rectangulo = null

      // mousemove/mouseup del arrastre se siguen sobre document (no sobre el
      // contenedor del mapa), igual que el Draggable interno de Leaflet: si el
      // botón se suelta fuera del mapa, el mouseup del contenedor nunca llega,
      // `inicio` queda seteado para siempre y `dragging` no se reactiva más.
      function alMover(e) {
        if (!inicio) return
        if (rectangulo) rectangulo.remove()
        const actual = mapa.mouseEventToLatLng(e)
        rectangulo = L.rectangle(L.latLngBounds(inicio, actual), {
          color: '#0369A1', weight: 1, fillOpacity: 0.08,
        }).addTo(mapa)
      }

      function alSoltar(e) {
        if (!inicio) return
        const actual = mapa.mouseEventToLatLng(e)
        const limites = L.latLngBounds(inicio, actual)
        inicio = null
        mapa.dragging.enable()
        L.DomEvent.off(document, 'mousemove', alMover)
        L.DomEvent.off(document, 'mouseup', alSoltar)
        if (rectangulo) { rectangulo.remove(); rectangulo = null }
        const o = limites.getWest(), es = limites.getEast()
        const s = limites.getSouth(), n = limites.getNorth()
        const anillo = [[o, s], [es, s], [es, n], [o, n]]
        if (alDibujarCallback) alDibujarCallback(anillo)
      }

      mapa.on('mousedown', (e) => {
        if (!e.originalEvent.shiftKey) return
        if (inicio) return // gesto ya en curso
        inicio = e.latlng
        mapa.dragging.disable()
        L.DomEvent.on(document, 'mousemove', alMover)
        L.DomEvent.on(document, 'mouseup', alSoltar)
      })
    },
  }
}
