import './style.css'
import { cargarCatalogo, construirFacetas } from './lib/catalogo.js'
import { porFaceta, porPoligono, cuencasDe } from './lib/ambito.js'
import { cargarDetalle } from './lib/detalle.js'
import { construirCsv } from './lib/csv.js'
import { leerEstado, escribirEstado } from './lib/url.js'
import { ETIQUETA_TIPO } from './lib/esquema.js'
import { crearMapa } from './ui/mapa.js'
import { crearBuscador } from './ui/buscador.js'
import { crearHerramientas } from './ui/herramientas.js'
import { crearPanelDescarga, nombreArchivo, descargarCsv } from './ui/descarga.js'

const app = document.querySelector('#app')
app.innerHTML = `
  <header class="cabecera">
    <h1>Pozos de hidrocarburos de Argentina</h1>
    <p class="cabecera__bajada">
      Elegí un área, un yacimiento, una operadora, una cuenca o un pozo —o dibujá una zona
      sobre el mapa— y bajate el CSV con la producción acumulada de cada pozo.
    </p>
  </header>
  <div class="barra">
    <div id="buscador"></div>
    <div id="herramientas"></div>
  </div>
  <div class="area">
    <div id="mapa" class="mapa"></div>
    <aside class="lateral">
      <div id="descarga"></div>
      <p class="pie" id="pie"></p>
    </aside>
  </div>`

/** 202607 -> "07/2026" */
const periodoLegible = (p) => `${String(p).slice(4)}/${String(p).slice(0, 4)}`

// Todo lo que sigue depende de que el catálogo haya cargado. Si `cargarCatalogo`
// rechaza (fetch caído, JSON roto), el catch deja un mensaje visible en el pie
// en vez de una página con el buscador, la descarga y el mapa vacíos y sin
// ninguna señal de que algo salió mal.
try {
  const catalogo = await cargarCatalogo()
  const facetas = construirFacetas(catalogo)

  const mapa = crearMapa(document.querySelector('#mapa'))
  const panel = crearPanelDescarga(document.querySelector('#descarga'))

  const m = catalogo.manifiesto
  document.querySelector('#pie').textContent =
    `${m.pozos.toLocaleString('es-AR')} pozos · producción hasta ${periodoLegible(m.ultimoPeriodo)} · ` +
    `datos generados el ${m.generado.slice(0, 10)}. ` +
    'Sitio no oficial: no representa a la Secretaría de Energía.'

  /** Los datos del ámbito, etiquetados, uno por fila. */
  function filasDelAmbito(estado, cantidad) {
    const filas = [{ etiqueta: 'Pozos', valor: cantidad.toLocaleString('es-AR') }]
    if (estado.modo === 'faceta') {
      filas.push({ etiqueta: 'Tipo', valor: ETIQUETA_TIPO[estado.tipo] ?? estado.tipo })
      filas.push({ etiqueta: 'Nombre', valor: estado.valor })
      if (estado.cuenca) filas.push({ etiqueta: 'Cuenca', valor: estado.cuenca })
    } else if (estado.modo === 'poligono') {
      filas.push({ etiqueta: 'Ámbito', valor: 'Zona dibujada en el mapa' })
    }
    filas.push({ etiqueta: 'Producción hasta', valor: periodoLegible(m.ultimoPeriodo) })
    return filas
  }

  async function aplicar(estado, { empujarHistorial = true } = {}) {
    // La zona dibujada se queda en el mapa mientras sea el ámbito elegido, y se
    // va apenas el ámbito pasa a ser otra cosa.
    if (estado.modo === 'poligono') mapa.mostrarZona(estado.poligono)
    else mapa.borrarZona()
    herramientas.marcarZona(mapa.hayZona())
    buscador.reflejar(estado)

    const ids = estado.modo === 'faceta'
      ? porFaceta(catalogo, estado.tipo, estado.valor, estado.cuenca)
      : estado.modo === 'poligono'
        ? porPoligono(catalogo, estado.poligono)
        : []

    if (empujarHistorial) {
      history.pushState(estado, '', escribirEstado(estado) || location.pathname)
    }

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
    // Con una zona dibujada se encuadra la zona y no los pozos: los pozos están
    // adentro, así que encuadrarlos a ellos deja los bordes de la zona fuera de
    // la pantalla y el usuario no ve lo que seleccionó.
    if (estado.modo === 'poligono') mapa.encuadrarZona()
    else mapa.encuadrar(filasLite)

    panel.mostrar({
      filas: filasDelAmbito(estado, ids.length),
      alDescargar: async () => {
        const detalle = await cargarDetalle(cuencasDe(catalogo, ids))
        const filas = ids.map((id) => detalle.get(id)).filter(Boolean)
        const csv = construirCsv({ filas, dicts: catalogo.dicts, catalogo })
        descargarCsv(csv, nombreArchivo(estado))
      },
    })
  }

  const buscador = crearBuscador(document.querySelector('#buscador'), facetas, (faceta) => {
    aplicar({
      modo: 'faceta',
      tipo: faceta.tipo,
      valor: faceta.valor,
      cuenca: faceta.cuenca ?? null,
      poligono: null,
    })
  })

  mapa.alDibujar((anillo) => {
    aplicar({ modo: 'poligono', tipo: null, valor: null, cuenca: null, poligono: anillo })
  })

  const herramientas = crearHerramientas(document.querySelector('#herramientas'), {
    alDibujar: () => mapa.alternarDibujo(),
    // `aplicar` con el estado vacío ya borra la zona y limpia el buscador.
    alBorrarZona: () => {
      history.pushState(null, '', location.pathname)
      aplicar(leerEstado(''), { empujarHistorial: false })
    },
    alVolver: () => {
      mapa.volverAlInicio()
      history.pushState(null, '', location.pathname)
      aplicar(leerEstado(''), { empujarHistorial: false })
    },
  })
  mapa.alCambiarModoDibujo((activo) => herramientas.marcarDibujando(activo))

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
