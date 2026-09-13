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

export function crearCoreografia(raiz, { reducido, destinoHorizonte = null }) {
  let estado = 'inicial'
  let reloj = null

  const cancelar = () => { if (reloj) { clearTimeout(reloj); reloj = null } }

  /**
   * Cuánto tiene que subir la línea de horizonte en el Acto VI para quedar
   * donde arranca el área del mapa. El spec la llama "la bisagra: el único
   * elemento continuo entre los dos estados", así que el número no puede
   * escribirse en la hoja de estilos: depende de dónde cae el horizonte -que
   * sale de la escala del dibujo, o sea del alto de la escena- y de dónde
   * empieza el área del mapa -que sale del alto de la cabecera y la barra-.
   * Medido con getBoundingClientRect() real en los siete viewports de la
   * revisión: entre -214px (2560x1329) y +35px (1366x641, el único donde el
   * horizonte ya está más arriba que el área y por lo tanto baja).
   *
   * El resultado va en UNIDADES LOCALES del SVG y no en píxeles: un
   * `transform` sobre un elemento SVG se aplica en el espacio de usuario.
   * `getScreenCTM().d` es la escala real de ese espacio en el eje y, y
   * evita que esta función tenga que conocer la geometría del dibujo.
   *
   * `destinoHorizonte` lo inyecta `hero.js`, que es el que sabe qué hay
   * afuera del hero (A2: esta máquina no dibuja ni sale a buscar nada al
   * documento). Si no llega, o si el navegador no da CTM -jsdom no lo
   * implementa-, la salida se queda sin `--subida` y el keyframe cae en su
   * default de 0: el horizonte no sube, pero nada se rompe.
   */
  function subidaDelHorizonte() {
    const linea = raiz.querySelector?.('.corte__horizonte')
    const destino = destinoHorizonte?.()
    if (!linea || typeof destino !== 'number' || !linea.getScreenCTM) return null
    const ctm = linea.getScreenCTM()
    if (!ctm?.d) return null
    const caja = linea.getBoundingClientRect()
    return (destino - (caja.top + caja.height / 2)) / ctm.d
  }

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
      // Se mide ANTES de poner la clase: después, el propio keyframe ya está
      // moviendo la línea y la medición sería contra un blanco en movimiento.
      const subida = subidaDelHorizonte()
      if (subida !== null) raiz.style.setProperty('--subida', `${subida.toFixed(1)}px`)
      raiz.classList.add(CLASES.saliendo)
      estado = 'saliendo'
      reloj = setTimeout(() => { reloj = null; estado = 'ido' }, DURACIONES.SALIDA)
    },
  }
}
