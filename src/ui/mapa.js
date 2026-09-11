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
  const mapa = L.map(contenedor).setView([-38.5, -68.5], 6)

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

    /** Dibujo de rectángulo: shift + arrastrar. Leaflet ya lo trae para zoom; acá se reusa. */
    habilitarDibujo() {
      mapa.boxZoom.disable()
      let inicio = null
      let rectangulo = null

      mapa.on('mousedown', (e) => {
        if (!e.originalEvent.shiftKey) return
        inicio = e.latlng
        mapa.dragging.disable()
      })

      mapa.on('mousemove', (e) => {
        if (!inicio) return
        if (rectangulo) rectangulo.remove()
        rectangulo = L.rectangle(L.latLngBounds(inicio, e.latlng), {
          color: '#0369A1', weight: 1, fillOpacity: 0.08,
        }).addTo(mapa)
      })

      mapa.on('mouseup', (e) => {
        if (!inicio) return
        const limites = L.latLngBounds(inicio, e.latlng)
        inicio = null
        mapa.dragging.enable()
        if (rectangulo) { rectangulo.remove(); rectangulo = null }
        const o = limites.getWest(), es = limites.getEast()
        const s = limites.getSouth(), n = limites.getNorth()
        const anillo = [[o, s], [es, s], [es, n], [o, n]]
        if (alDibujarCallback) alDibujarCallback(anillo)
      })
    },
  }
}
