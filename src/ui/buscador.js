import { buscar } from '../lib/catalogo.js'

const ETIQUETA = { area: 'Área', yacimiento: 'Yacimiento', empresa: 'Operadora' }

export function crearBuscador(contenedor, facetas, alElegir) {
  contenedor.innerHTML = `
    <label class="buscador">
      <span class="buscador__etiqueta">Buscar área, yacimiento u operadora</span>
      <input type="search" class="buscador__entrada" autocomplete="off"
             placeholder="Loma Campana, YPF, Cañadón Seco…" />
    </label>
    <ul class="buscador__resultados"></ul>`

  const entrada = contenedor.querySelector('.buscador__entrada')
  const lista = contenedor.querySelector('.buscador__resultados')

  function pintar(resultados) {
    lista.innerHTML = ''
    for (const r of resultados) {
      const li = document.createElement('li')
      const boton = document.createElement('button')
      boton.type = 'button'
      boton.className = 'buscador__opcion'
      boton.innerHTML =
        `<span class="buscador__tipo">${ETIQUETA[r.tipo]}</span>` +
        `<span class="buscador__valor"></span>` +
        `<span class="buscador__cuenca"></span>` +
        `<span class="buscador__cantidad">${r.cantidad.toLocaleString('es-AR')} pozos</span>`
      // textContent y no innerHTML: estos dos vienen del dato.
      boton.querySelector('.buscador__valor').textContent = r.valor
      boton.querySelector('.buscador__cuenca').textContent = r.cuenca ?? ''
      boton.onclick = () => alElegir(r)
      li.appendChild(boton)
      lista.appendChild(li)
    }
  }

  entrada.addEventListener('input', () => pintar(buscar(facetas, entrada.value)))

  return {
    limpiar() {
      entrada.value = ''
      lista.innerHTML = ''
    },
  }
}
