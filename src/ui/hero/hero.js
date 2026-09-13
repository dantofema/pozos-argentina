import { construirCorte } from './corte.js'
import { crearCoreografia, DURACIONES } from './coreografia.js'
import { crearBuscador, campoDeshabilitado } from '../buscador.js'
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
      <div class="hero__escena">
        <div class="hero__dibujo">${construirCorte({
          formaciones: manifiesto.formaciones,
          pozos: manifiesto.pozos,
          periodo: manifiesto.ultimoPeriodo,
        })}</div>
        <div class="hero__texto">
          <h1 class="hero__titulo">${TITULO}</h1>
          <p class="hero__bajada">${BAJADA}</p>
        </div>
      </div>
      <div class="hero__buscador">
        <div class="hero__buscador-fila">
          <div class="hero__buscador-campo">${campoDeshabilitado(manifiesto.pozos)}</div>
          <p class="hero__dato">${manifiesto.pozos.toLocaleString('es-AR')} pozos · hasta ${periodoLegible(manifiesto.ultimoPeriodo)}</p>
        </div>
      </div>
    </div>`

  const raiz = contenedor.querySelector('.hero')
  // Ronda 4 (ruling del coordinador): el dato se mudó a la banda del
  // buscador, pero `cajaBuscador` -lo que `crearBuscador()` reemplaza
  // entero y lo que se pausa/reanuda al enfocar- sigue siendo sólo el
  // campo, no la banda completa. Si apuntara a `.hero__buscador`,
  // `crearBuscador()` se comería `.hero__dato` al reemplazar el innerHTML
  // (el cuidado que pidió la revisión: que el dato y el "Cargando…" no se
  // pisen ni se dupliquen -acá ni se tocan, porque viven en contenedores
  // distintos).
  const cajaBuscador = contenedor.querySelector('.hero__buscador-campo')
  // El Acto VI: el horizonte sube hasta el borde superior del área del mapa y
  // se queda ahí -es el único elemento continuo entre el hero y la
  // herramienta-. Dónde está ese borde lo sabe el documento, no el hero, así
  // que la medición se le pasa a la coreografía como función en vez de que
  // ella salga a buscarla (A2). Se resuelve en el momento de la salida y no
  // ahora: el área puede cambiar de alto si la barra se envuelve.
  const coreografia = crearCoreografia(raiz, {
    reducido,
    destinoHorizonte: () => document.querySelector('.area')?.getBoundingClientRect().top ?? null,
  })

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
      // Si el foco vive adentro del hero -y vive ahí siempre que se llegó acá
      // eligiendo en su buscador, con mouse o con teclado-, sacar el hero del
      // DOM lo deja en BODY: quien venía navegando con el teclado se queda sin
      // lugar y tiene que tabular desde el principio del documento (revisión
      // final, Important 5). Se anota ANTES de la salida, porque después el
      // elemento que lo tenía ya no existe.
      const teniaFoco = contenedor.contains(document.activeElement)
      coreografia.salir()
      setTimeout(() => {
        desconectar()
        contenedor.innerHTML = ''
        // El destino natural es el buscador de la barra: es el mismo control,
        // ya refleja el ámbito que se acaba de elegir, y es desde donde se
        // sigue trabajando. `preventScroll` porque el foco no tiene por qué
        // mover la página, y sólo si el hero lo tenía: un relevo disparado por
        // otra vía (un popstate, por ejemplo) no debe robarle el foco a nadie.
        if (teniaFoco) {
          document.querySelector('.barra .buscador__entrada')?.focus({ preventScroll: true })
        }
      }, reducido ? 0 : DURACIONES.SALIDA)
    },
  }
}
