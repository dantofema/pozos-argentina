/**
 * La máquina de la composición. No sabe dibujar: recibe la raíz del hero ya
 * montada y le pone y saca clases. El CSS de `hero.css` es el que sabe qué
 * significa cada una.
 *
 * Los tiempos viven acá y en `hero.css`, y tienen que coincidir. Es la única
 * duplicación del módulo y es a propósito: el CSS necesita los números en su
 * sintaxis y el JS necesita saber cuándo cambiar de estado. El test de humo de
 * la Tarea 9 compara los dos.
 */
export const DURACIONES = { ENTRADA: 4400, SALIDA: 600 }

const CLASES = {
  entrando: 'hero--entrando',
  reposo: 'hero--reposo',
  pausado: 'hero--pausado',
  saliendo: 'hero--saliendo',
}

export function crearCoreografia(raiz, { reducido }) {
  let estado = 'inicial'
  let reloj = null

  const cancelar = () => { if (reloj) { clearTimeout(reloj); reloj = null } }

  function aReposo() {
    // La clase de entrada se saca al pasar a reposo: si quedara, sus
    // `animation` seguirían declaradas y pelearían con las del cabeceo.
    raiz.classList.remove(CLASES.entrando)
    raiz.classList.add(CLASES.reposo)
    estado = 'reposo'
  }

  return {
    estado: () => estado,

    /** Arranca la coreografía. Con movimiento reducido deja el cuadro final (G4). */
    entrar() {
      if (estado !== 'inicial') return
      if (reducido) { aReposo(); return }
      raiz.classList.add(CLASES.entrando)
      estado = 'entrando'
      reloj = setTimeout(() => { reloj = null; aReposo() }, DURACIONES.ENTRADA)
    },

    /** Congela el reposo. No cambia de estado: es una condición, no un acto. */
    pausar() { raiz.classList.add(CLASES.pausado) },
    reanudar() { raiz.classList.remove(CLASES.pausado) },

    /**
     * El relevo. Se puede pedir en medio de la entrada: quien llega y busca de
     * una no tiene por qué esperar 4,4 segundos.
     */
    salir() {
      if (estado === 'saliendo' || estado === 'ido') return
      cancelar()
      raiz.classList.remove(CLASES.entrando, CLASES.reposo, CLASES.pausado)
      if (reducido) { estado = 'ido'; return }
      raiz.classList.add(CLASES.saliendo)
      estado = 'saliendo'
      reloj = setTimeout(() => { reloj = null; estado = 'ido' }, DURACIONES.SALIDA)
    },
  }
}
