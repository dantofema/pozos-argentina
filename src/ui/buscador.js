import { buscar } from '../lib/catalogo.js'
import { ETIQUETA_TIPO } from '../lib/esquema.js'

/** Opciones del selector, en el orden en que se muestran. */
const OPCIONES = [
  ['todos', 'Todos'],
  ['area', 'Áreas'],
  ['yacimiento', 'Yacimientos'],
  ['empresa', 'Operadoras'],
  ['cuenca', 'Cuencas'],
  ['sigla', 'Pozos'],
]

/** Cuántos pozos sueltos entran cuando se busca en "Todos". */
const TOPE_POZOS_EN_TODOS = 5
const TOPE = 20

/**
 * El campo antes de que existan facetas para buscar: deshabilitado, con el
 * motivo dicho en el propio placeholder. No es un estado de error y no se
 * anuncia como tal (E5) -es una espera, y una espera que dice de qué espera.
 *
 * Dos arranques necesitan exactamente este mismo campo: el hero (Tarea 7,
 * mientras el índice de 1,26 MB no llegó) y, desde la Tarea 8, la barra de
 * la herramienta cuando se entra sin hero -un enlace compartido- y el índice
 * tampoco llegó todavía. Vive acá, un solo lugar, para que ninguno de los
 * dos escriba el texto por su cuenta y se desincronicen si el motivo cambia.
 * Devuelve un string y no monta nada: cada arranque lo interpola donde le
 * corresponde (el hero, dentro de su propio marcado; la herramienta,
 * directo en el contenedor del buscador).
 */
export function campoDeshabilitado(pozos) {
  return `
    <label class="buscador__campo">
      <span class="buscador__etiqueta">Buscar</span>
      <input class="buscador__entrada" type="search" disabled
             placeholder="Cargando los ${pozos.toLocaleString('es-AR')} pozos…" />
    </label>`
}

export function crearBuscador(contenedor, facetas, alElegir) {
  contenedor.innerHTML = `
    <div class="buscador">
      <label class="buscador__campo">
        <span class="buscador__etiqueta">Buscar</span>
        <span class="buscador__caja">
          <input type="search" class="buscador__entrada" autocomplete="off"
                 placeholder="Loma Campana, YPF, Cañadón Seco…" />
          <button type="button" class="buscador__limpiar" hidden aria-label="Borrar la búsqueda">×</button>
        </span>
      </label>
      <label class="buscador__campo buscador__campo--tipo">
        <span class="buscador__etiqueta">En</span>
        <select class="buscador__tipo-sel">
          ${OPCIONES.map(([v, t]) => `<option value="${v}">${t}</option>`).join('')}
        </select>
      </label>
    </div>
    <ul class="buscador__resultados"></ul>`

  const entrada = contenedor.querySelector('.buscador__entrada')
  const selector = contenedor.querySelector('.buscador__tipo-sel')
  const lista = contenedor.querySelector('.buscador__resultados')
  const botonLimpiar = contenedor.querySelector('.buscador__limpiar')

  // Con algo elegido la lista se cierra: lo que importa pasa a ser la selección.
  // Alcanza con saber si hay algo elegido; quién lo eligió no cambia nada.
  let hayEleccion = false

  function cerrarLista() {
    lista.innerHTML = ''
    lista.hidden = true
  }

  // Se agrupa una sola vez: en "Todos" hay ~80.000 facetas de pozo y filtrarlas
  // en cada tecla sería rehacer el array entero cada vez.
  const porTipo = new Map()
  for (const f of facetas) {
    if (!porTipo.has(f.tipo)) porTipo.set(f.tipo, [])
    porTipo.get(f.tipo).push(f)
  }
  const sinPozos = facetas.filter((f) => f.tipo !== 'sigla')
  const soloPozos = porTipo.get('sigla') ?? []

  function resultados(texto) {
    const tipo = selector.value
    if (tipo !== 'todos') return buscar(porTipo.get(tipo) ?? [], texto, TOPE)
    // En "Todos" los pozos sueltos van al final y con cupo: son ~80.000 con una
    // cantidad de 1 cada uno, y si no inundarían cualquier búsqueda amplia.
    return [
      ...buscar(sinPozos, texto, TOPE - TOPE_POZOS_EN_TODOS),
      ...buscar(soloPozos, texto, TOPE_POZOS_EN_TODOS),
    ]
  }

  function pintar() {
    lista.innerHTML = ''
    const encontrados = resultados(entrada.value)
    // Sin resultados la lista se esconde: dejarla abierta y vacía deja un
    // recuadro flotando sobre el mapa que no dice nada.
    lista.hidden = encontrados.length === 0
    for (const r of encontrados) {
      const li = document.createElement('li')
      const boton = document.createElement('button')
      boton.type = 'button'
      boton.className = 'buscador__opcion'
      boton.innerHTML =
        `<span class="buscador__tipo">${ETIQUETA_TIPO[r.tipo] ?? r.tipo}</span>` +
        '<span class="buscador__valor"></span>' +
        '<span class="buscador__cuenca"></span>' +
        `<span class="buscador__cantidad">${r.cantidad.toLocaleString('es-AR')} ` +
        `${r.cantidad === 1 ? 'pozo' : 'pozos'}</span>`
      // textContent y no innerHTML: estos dos vienen del dato.
      boton.querySelector('.buscador__valor').textContent = r.valor
      boton.querySelector('.buscador__cuenca').textContent = r.cuenca ?? ''
      boton.onclick = () => {
        hayEleccion = true
        entrada.value = r.cuenca ? `${r.valor} (${r.cuenca})` : r.valor
        botonLimpiar.hidden = false
        cerrarLista()
        // cerrarLista saca del DOM el botón que tiene el foco, y el foco se
        // caería al body: quien navega con teclado perdería el lugar.
        entrada.focus()
        alElegir(r)
      }
      li.appendChild(boton)
      lista.appendChild(li)
    }
  }

  function limpiarTodo() {
    hayEleccion = false
    entrada.value = ''
    selector.value = 'todos'
    botonLimpiar.hidden = true
    cerrarLista()
  }

  entrada.addEventListener('input', () => {
    // Escribir sobre una selección la descarta: se vuelve a buscar.
    if (hayEleccion) { hayEleccion = false; botonLimpiar.hidden = true }
    pintar()
  })
  selector.addEventListener('change', () => {
    if (hayEleccion) { hayEleccion = false; entrada.value = ''; botonLimpiar.hidden = true }
    pintar()
  })
  botonLimpiar.addEventListener('click', () => {
    limpiarTodo()
    entrada.focus()
  })

  // Escape y un click afuera cierran las sugerencias, que si no quedan flotando
  // sobre el mapa hasta que se elija algo.
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { cerrarLista(); e.stopPropagation() }
  })
  // En `document` y no en `contenedor`: es la única forma de detectar un click
  // AFUERA del buscador. Pero eso la hace sobrevivir aunque `contenedor` se
  // destruya -el buscador de la herramienta vive mientras vive la página, así
  // que ahí nunca importó-, y queda un closure apuntando a un nodo desmontado
  // que corre en cada click futuro. `desconectar()` la saca; quien no la
  // necesita (`main.js`) simplemente ignora el valor de retorno.
  const alClickearAfuera = (e) => {
    if (!contenedor.contains(e.target)) cerrarLista()
  }
  document.addEventListener('click', alClickearAfuera)

  return {
    limpiar: limpiarTodo,

    /**
     * Muestra en el campo el ámbito que está vigente. Lo llama `aplicar`, así
     * que un enlace compartido y el botón Atrás del navegador muestran lo que
     * está aplicado y no lo que se había elegido antes.
     */
    reflejar(estado) {
      if (estado?.modo === 'faceta' && estado.valor) {
        hayEleccion = true
        entrada.value = estado.cuenca ? `${estado.valor} (${estado.cuenca})` : estado.valor
        botonLimpiar.hidden = false
        cerrarLista()
      } else {
        limpiarTodo()
      }
    },

    /** Saca la escucha de `document`. Necesario para quien destruye el
     * contenedor mientras la página sigue viva (el hero, Tarea 7). */
    desconectar() {
      document.removeEventListener('click', alClickearAfuera)
    },
  }
}
