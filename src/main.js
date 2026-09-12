import './style.css'
import { cargarManifiesto, cargarIndice, construirFacetas } from './lib/catalogo.js'
import { porFaceta, porPoligono, cuencasDe } from './lib/ambito.js'
import { cargarDetalle } from './lib/detalle.js'
import { construirCsv } from './lib/csv.js'
import { leerEstado, escribirEstado } from './lib/url.js'
import { periodoLegible, filasDelAmbito } from './lib/resumen.js'
import { crearMapa } from './ui/mapa.js'
import { crearBuscador } from './ui/buscador.js'
import { crearHerramientas } from './ui/herramientas.js'
import { crearPanelDescarga, nombreArchivo, descargarCsv } from './ui/descarga.js'
import { crearHero } from './ui/hero/hero.js'

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
  </div>
  <div id="hero"></div>`

// Todo lo que sigue depende de que el catálogo haya cargado. Si `cargarCatalogo`
// rechaza (fetch caído, JSON roto), el catch deja un mensaje visible en el pie
// en vez de una página con el buscador, la descarga y el mapa vacíos y sin
// ninguna señal de que algo salió mal.
try {
  // Los dos pedidos salen juntos y se esperan por separado: el manifiesto son
  // 2,8 kB y monta el hero enseguida; el índice son 1,26 MB y habilita buscar.
  // En serie, el hero esperaría al índice y la pantalla seguiría en blanco.
  const pedidoManifiesto = cargarManifiesto()
  const pedidoIndice = cargarIndice()

  const estadoInicial = leerEstado(location.search)
  const manifiesto = await pedidoManifiesto

  const mapa = crearMapa(document.querySelector('#mapa'))
  const panel = crearPanelDescarga(document.querySelector('#descarga'))

  document.querySelector('#pie').textContent =
    `${manifiesto.pozos.toLocaleString('es-AR')} pozos · producción hasta ${periodoLegible(manifiesto.ultimoPeriodo)} · ` +
    `datos generados el ${manifiesto.generado.slice(0, 10)}. ` +
    'Sitio no oficial: no representa a la Secretaría de Energía.'

  // El hero sólo existe para quien llega sin nada en la URL: un enlace
  // compartido entra directo a la herramienta (E1).
  const hero = estadoInicial.modo === 'vacio'
    ? crearHero(document.querySelector('#hero'), { manifiesto })
    : null

  const indice = await pedidoIndice
  const catalogo = { ...indice, manifiesto }
  const facetas = construirFacetas(catalogo)

  /**
   * Punto único de sincronización. `aplicar` la envuelve para contener los
   * errores: se la llama desde callbacks del buscador, del mapa y de popstate,
   * que corren fuera del `try` de arranque, así que una excepción acá sería un
   * rechazo sin manejar y dejaría mapa, buscador, URL y panel desincronizados
   * sin ninguna señal.
   */
  async function sincronizar(estado, { empujarHistorial = true } = {}) {
    // El relevo es de una sola vía: el hero es una entrada, no un estado al que
    // se vuelva. "Volver al inicio" y el botón Atrás no lo reponen (E3).
    if (estado.modo !== 'vacio') hero?.relevar()

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
      filas: filasDelAmbito(estado, ids.length, manifiesto.ultimoPeriodo),
      alDescargar: async () => {
        const detalle = await cargarDetalle(cuencasDe(catalogo, ids))
        const filas = ids.map((id) => detalle.get(id)).filter(Boolean)
        const csv = construirCsv({ filas, dicts: catalogo.dicts, catalogo })
        descargarCsv(csv, nombreArchivo(estado))
      },
    })
  }

  async function aplicar(estado, opciones) {
    try {
      await sincronizar(estado, opciones)
    } catch (error) {
      console.error('No se pudo aplicar la selección:', error)
      panel.mostrarVacio('No se pudo mostrar esa selección. Probá con otra o recargá la página.')
    }
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

  hero?.montarBuscador(facetas, (faceta) => {
    aplicar({
      modo: 'faceta', tipo: faceta.tipo, valor: faceta.valor,
      cuenca: faceta.cuenca ?? null, poligono: null,
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
