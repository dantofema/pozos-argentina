import { buscar } from '../lib/catalogo.js'

const ETIQUETA = {
  area: 'Área',
  yacimiento: 'Yacimiento',
  empresa: 'Operadora',
  cuenca: 'Cuenca',
  sigla: 'Pozo',
}

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

export function crearBuscador(contenedor, facetas, alElegir) {
  contenedor.innerHTML = `
    <div class="buscador">
      <label class="buscador__campo">
        <span class="buscador__etiqueta">Buscar</span>
        <input type="search" class="buscador__entrada" autocomplete="off"
               placeholder="Loma Campana, YPF, Cañadón Seco…" />
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
    for (const r of resultados(entrada.value)) {
      const li = document.createElement('li')
      const boton = document.createElement('button')
      boton.type = 'button'
      boton.className = 'buscador__opcion'
      boton.innerHTML =
        `<span class="buscador__tipo">${ETIQUETA[r.tipo] ?? r.tipo}</span>` +
        '<span class="buscador__valor"></span>' +
        '<span class="buscador__cuenca"></span>' +
        `<span class="buscador__cantidad">${r.cantidad.toLocaleString('es-AR')} ` +
        `${r.cantidad === 1 ? 'pozo' : 'pozos'}</span>`
      // textContent y no innerHTML: estos dos vienen del dato.
      boton.querySelector('.buscador__valor').textContent = r.valor
      boton.querySelector('.buscador__cuenca').textContent = r.cuenca ?? ''
      boton.onclick = () => alElegir(r)
      li.appendChild(boton)
      lista.appendChild(li)
    }
  }

  entrada.addEventListener('input', pintar)
  selector.addEventListener('change', pintar)

  return {
    limpiar() {
      entrada.value = ''
      selector.value = 'todos'
      lista.innerHTML = ''
    },
  }
}
