/** Los dos controles del mapa: dibujar una zona y volver al inicio. */
export function crearHerramientas(contenedor, { alDibujar, alVolver }) {
  contenedor.innerHTML = `
    <div class="herramientas">
      <button type="button" class="herramientas__boton" data-accion="dibujar" aria-pressed="false">
        Dibujar zona
      </button>
      <button type="button" class="herramientas__boton" data-accion="volver">
        Volver al inicio
      </button>
    </div>`

  const dibujar = contenedor.querySelector('[data-accion="dibujar"]')
  contenedor.querySelector('[data-accion="volver"]').onclick = alVolver
  dibujar.onclick = alDibujar

  return {
    /** Refleja en el botón si el modo dibujo está armado. */
    marcarDibujando(activo) {
      dibujar.classList.toggle('herramientas__boton--activo', activo)
      dibujar.setAttribute('aria-pressed', String(activo))
      dibujar.textContent = activo ? 'Cancelar dibujo' : 'Dibujar zona'
    },
  }
}
