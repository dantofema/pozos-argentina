import { construirCorte } from './corte.js'
import { crearCoreografia, DURACIONES } from './coreografia.js'
import { crearBuscador } from '../buscador.js'
import { periodoLegible } from '../../lib/resumen.js'

const TITULO = 'Todos los pozos de hidrocarburos del país, en un CSV'

const BAJADA =
  'La Secretaría de Energía publica la producción mes a mes de cada pozo del país: ' +
  'nueve tablas de casi un millón de filas cada una. Acá están cruzadas con la ' +
  'ubicación de cada pozo. Elegí un ámbito y bajate sólo lo que te interesa.'

/**
 * El hero: la pantalla de entrada. Ocupa el tiempo que el catálogo de 1,26 MB ya
 * se tomaba en blanco, y se releva apenas hay un ámbito elegido.
 *
 * Es el único módulo del hero que habla con `main.js`. No construye el buscador:
 * lo recibe cuando llegan las facetas y delega en `crearBuscador`, el mismo
 * componente de la herramienta, para no tener dos buscadores que mantener.
 */
export function crearHero(contenedor, { manifiesto }) {
  const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  contenedor.innerHTML = `
    <div class="hero">
      <div class="hero__dibujo">${construirCorte({
        formaciones: manifiesto.formaciones,
        pozos: manifiesto.pozos,
        periodo: manifiesto.ultimoPeriodo,
      })}</div>
      <div class="hero__texto">
        <h1 class="hero__titulo">${TITULO}</h1>
        <p class="hero__bajada">${BAJADA}</p>
        <p class="hero__dato">${manifiesto.pozos.toLocaleString('es-AR')} pozos · hasta ${periodoLegible(manifiesto.ultimoPeriodo)}</p>
      </div>
      <div class="hero__buscador">
        <label class="buscador__campo">
          <span class="buscador__etiqueta">Buscar</span>
          <input class="buscador__entrada" type="search" disabled
                 placeholder="Cargando los ${manifiesto.pozos.toLocaleString('es-AR')} pozos…" />
        </label>
      </div>
    </div>`

  const raiz = contenedor.querySelector('.hero')
  const cajaBuscador = contenedor.querySelector('.hero__buscador')
  const coreografia = crearCoreografia(raiz, { reducido })

  // Nadie escribe con tres balancines moviéndose en la visión periférica (M1),
  // y una pestaña de fondo no tiene por qué gastar batería (M2).
  const alEnfocar = () => coreografia.pausar()
  const alDesenfocar = () => { if (!document.hidden) coreografia.reanudar() }
  const alCambiarVisibilidad = () => {
    if (document.hidden) coreografia.pausar()
    else if (!cajaBuscador.contains(document.activeElement)) coreografia.reanudar()
  }

  cajaBuscador.addEventListener('focusin', alEnfocar)
  cajaBuscador.addEventListener('focusout', alDesenfocar)
  document.addEventListener('visibilitychange', alCambiarVisibilidad)

  // crearBuscador() pone su propia escucha de click en `document` (para
  // cerrar la lista al clickear afuera), que sobrevive a que este contenedor
  // se destruya si nadie la saca -en `main.js` nunca importa, ese buscador
  // vive mientras vive la página; acá sí, porque el hero se releva- (Important
  // 1, revisión). Se completa recién cuando montarBuscador() corre.
  let desconectarBuscador = null

  function desconectar() {
    cajaBuscador.removeEventListener('focusin', alEnfocar)
    cajaBuscador.removeEventListener('focusout', alDesenfocar)
    document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    desconectarBuscador?.()
  }

  coreografia.entrar()

  return {
    estado: () => coreografia.estado(),

    /** Llega cuando el índice cargó: recién ahí se puede buscar (G6). */
    montarBuscador(facetas, alElegir) {
      const buscador = crearBuscador(cajaBuscador, facetas, alElegir)
      desconectarBuscador = buscador.desconectar
    },

    /** El relevo: el corte se hunde y el hero se saca del DOM. */
    relevar() {
      if (coreografia.estado() === 'ido' || coreografia.estado() === 'saliendo') return
      coreografia.salir()
      setTimeout(() => {
        desconectar()
        contenedor.innerHTML = ''
      }, reducido ? 0 : DURACIONES.SALIDA)
    },
  }
}
