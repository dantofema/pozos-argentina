import './style.css'
import { cargarCatalogo, construirFacetas } from './lib/catalogo.js'
import { porFaceta, porPoligono, cuencasDe } from './lib/ambito.js'
import { cargarDetalle } from './lib/detalle.js'
import { construirCsv } from './lib/csv.js'
import { leerEstado, escribirEstado } from './lib/url.js'
import { crearMapa } from './ui/mapa.js'
import { crearBuscador } from './ui/buscador.js'
import { crearPanelDescarga, nombreArchivo, descargarCsv } from './ui/descarga.js'

const app = document.querySelector('#app')
app.innerHTML = `
  <header class="cabecera">
    <h1>Pozos de hidrocarburos de Argentina</h1>
    <p class="cabecera__bajada">
      Elegí un área, un yacimiento, una operadora o dibujá un recorte con Shift + arrastrar,
      y bajate el CSV con la producción acumulada de cada pozo.
    </p>
  </header>
  <div class="panel">
    <div id="buscador"></div>
    <div id="descarga"></div>
    <p class="pie" id="pie"></p>
  </div>
  <div id="mapa" class="mapa"></div>`

// Todo lo que sigue depende de que el catálogo haya cargado. Si `cargarCatalogo`
// rechaza (fetch caído, JSON roto), el catch deja un mensaje visible en el pie
// en vez de una página con el buscador, la descarga y el mapa vacíos y sin
// ninguna señal de que algo salió mal.
try {
  const catalogo = await cargarCatalogo()
  const facetas = construirFacetas(catalogo)

  const mapa = crearMapa(document.querySelector('#mapa'))
  mapa.habilitarDibujo()
  const panel = crearPanelDescarga(document.querySelector('#descarga'))

  const m = catalogo.manifiesto
  document.querySelector('#pie').textContent =
    `${m.pozos.toLocaleString('es-AR')} pozos · producción hasta ${String(m.ultimoPeriodo).slice(4)}/` +
    `${String(m.ultimoPeriodo).slice(0, 4)} · datos generados el ${m.generado.slice(0, 10)}. ` +
    'Sitio no oficial: no representa a la Secretaría de Energía.'

  async function aplicar(estado, { empujarHistorial = true } = {}) {
    const ids = estado.modo === 'faceta'
      ? porFaceta(catalogo, estado.tipo, estado.valor)
      : estado.modo === 'poligono'
        ? porPoligono(catalogo, estado.poligono)
        : []

    if (ids.length === 0) {
      mapa.limpiarPozos()
      // 'vacio' es el estado inicial, antes de elegir nada: no es un error, no
      // hay nada que anunciar. 'faceta'/'poligono' en cambio sí eligieron un
      // ámbito -típicamente un enlace compartido- que hoy no tiene pozos.
      if (estado.modo === 'faceta' || estado.modo === 'poligono') {
        panel.mostrarVacio('Ese ámbito no tiene pozos.')
      } else {
        panel.ocultar()
      }
      return
    }

    const filasLite = ids.map((id) => catalogo.porId.get(id)).filter(Boolean)
    mapa.mostrarPozos(filasLite)
    mapa.encuadrar(filasLite)

    if (empujarHistorial) {
      history.pushState(estado, '', escribirEstado(estado) || location.pathname)
    }

    const etiqueta = estado.modo === 'faceta' ? estado.valor : 'el recorte dibujado'
    panel.mostrar({
      texto: `${ids.length.toLocaleString('es-AR')} pozos en ${etiqueta}.`,
      alDescargar: async () => {
        const detalle = await cargarDetalle(cuencasDe(catalogo, ids))
        const filas = ids.map((id) => detalle.get(id)).filter(Boolean)
        const csv = construirCsv({ filas, dicts: catalogo.dicts, catalogo })
        descargarCsv(csv, nombreArchivo(estado))
      },
    })
  }

  crearBuscador(document.querySelector('#buscador'), facetas, (faceta) => {
    aplicar({ modo: 'faceta', tipo: faceta.tipo, valor: faceta.valor, poligono: null })
  })

  mapa.alDibujar((anillo) => {
    aplicar({ modo: 'poligono', tipo: null, valor: null, poligono: anillo })
  })

  window.addEventListener('popstate', () => {
    aplicar(leerEstado(location.search), { empujarHistorial: false })
  })

  await aplicar(leerEstado(location.search), { empujarHistorial: false })
} catch (error) {
  console.error('No se pudo inicializar la aplicación:', error)
  document.querySelector('#pie').textContent =
    'No se pudo cargar el catálogo de pozos. Recargá la página en unos minutos; ' +
    'si el problema sigue, es un problema del sitio, no de tu conexión.'
}
