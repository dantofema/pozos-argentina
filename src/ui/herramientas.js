/**
 * Controles del mapa. Las acciones sobre la zona aparecen sólo cuando hay una
 * zona dibujada: el patrón de las búsquedas por área dibujada —Zillow, Redfin—
 * es que la forma quede a la vista y desde ahí se ofrezca rehacerla o borrarla.
 */
export function crearHerramientas(contenedor, { alDibujar, alBorrarZona, alVolver }) {
  contenedor.innerHTML = `
    <div class="herramientas">
      <button type="button" class="herramientas__boton" data-accion="dibujar" aria-pressed="false">
        Dibujar zona
      </button>
      <button type="button" class="herramientas__boton" data-accion="borrar" hidden>
        Borrar zona
      </button>
      <button type="button" class="herramientas__boton" data-accion="volver">
        Volver al inicio
      </button>
    </div>`

  const dibujar = contenedor.querySelector('[data-accion="dibujar"]')
  const borrar = contenedor.querySelector('[data-accion="borrar"]')
  dibujar.onclick = alDibujar
  borrar.onclick = alBorrarZona
  contenedor.querySelector('[data-accion="volver"]').onclick = alVolver

  let hayZona = false
  let dibujando = false

  function rotular() {
    dibujar.textContent = dibujando
      ? 'Cancelar dibujo'
      : hayZona ? 'Redibujar zona' : 'Dibujar zona'
    dibujar.setAttribute('aria-pressed', String(dibujando))
    dibujar.classList.toggle('herramientas__boton--activo', dibujando)
    // Borrar no tiene sentido mientras se está por reemplazar la zona.
    borrar.hidden = !hayZona || dibujando
  }

  return {
    /** Refleja si el modo dibujo está armado. */
    marcarDibujando(activo) {
      dibujando = activo
      rotular()
    },

    /** Refleja si hay una zona en el mapa, que es lo que habilita borrarla. */
    marcarZona(presente) {
      hayZona = presente
      rotular()
    },
  }
}
