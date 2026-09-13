// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { crearCoreografia, DURACIONES } from './coreografia.js'

let raiz

beforeEach(() => {
  vi.useFakeTimers()
  raiz = document.createElement('div')
  document.body.appendChild(raiz)
})

afterEach(() => {
  vi.useRealTimers()
  raiz.remove()
})

const clases = () => [...raiz.classList]

describe('crearCoreografia', () => {
  it('arranca en inicial, sin ninguna clase de animación', () => {
    const c = crearCoreografia(raiz, { reducido: false })
    expect(c.estado()).toBe('inicial')
    expect(clases()).toEqual([])
  })

  it('entrar() pone la clase de entrada y pasa a reposo al terminar', () => {
    const c = crearCoreografia(raiz, { reducido: false })
    c.entrar()

    expect(c.estado()).toBe('entrando')
    expect(clases()).toContain('hero--entrando')

    vi.advanceTimersByTime(DURACIONES.ENTRADA)

    expect(c.estado()).toBe('reposo')
    expect(clases()).toContain('hero--reposo')
    // La clase de entrada se saca: si quedara, sus `animation` seguirían
    // declaradas y pelearían con las del reposo.
    expect(clases()).not.toContain('hero--entrando')
  })

  it('pausar() y reanudar() sólo tocan la pausa, no el estado', () => {
    const c = crearCoreografia(raiz, { reducido: false })
    c.entrar()
    vi.advanceTimersByTime(DURACIONES.ENTRADA)

    c.pausar()
    expect(clases()).toContain('hero--pausado')
    expect(c.estado()).toBe('reposo')

    c.reanudar()
    expect(clases()).not.toContain('hero--pausado')
    expect(c.estado()).toBe('reposo')
  })

  it('salir() lleva a ido después de la salida', () => {
    const c = crearCoreografia(raiz, { reducido: false })
    c.entrar()
    vi.advanceTimersByTime(DURACIONES.ENTRADA)

    c.salir()
    expect(c.estado()).toBe('saliendo')
    expect(clases()).toContain('hero--saliendo')

    vi.advanceTimersByTime(DURACIONES.SALIDA)
    expect(c.estado()).toBe('ido')
  })

  it('salir() en medio de la entrada no espera a que termine', () => {
    // Alguien que llega, no mira el dibujo y busca de una. La coreografía no
    // puede retenerlo 4,4 segundos.
    const c = crearCoreografia(raiz, { reducido: false })
    c.entrar()
    vi.advanceTimersByTime(800)

    c.salir()
    expect(c.estado()).toBe('saliendo')
    expect(clases()).not.toContain('hero--entrando')

    vi.advanceTimersByTime(DURACIONES.SALIDA)
    expect(c.estado()).toBe('ido')
    // Y el temporizador de la entrada no puede resucitarlo.
    vi.advanceTimersByTime(DURACIONES.ENTRADA)
    expect(c.estado()).toBe('ido')
  })

  it('no vuelve atrás: entrar() después de salir no hace nada (E3)', () => {
    const c = crearCoreografia(raiz, { reducido: false })
    c.entrar()
    vi.advanceTimersByTime(DURACIONES.ENTRADA)
    c.salir()
    vi.advanceTimersByTime(DURACIONES.SALIDA)

    c.entrar()
    expect(c.estado()).toBe('ido')
    expect(clases()).not.toContain('hero--entrando')
  })

  it('con movimiento reducido salta a reposo sin animar nada (G4)', () => {
    const c = crearCoreografia(raiz, { reducido: true })
    c.entrar()

    // Sin pasar el tiempo: el cuadro final tiene que estar ya.
    expect(c.estado()).toBe('reposo')
    expect(clases()).not.toContain('hero--entrando')
    expect(clases()).toContain('hero--reposo')
  })

  it('con movimiento reducido la salida también es inmediata (G4)', () => {
    const c = crearCoreografia(raiz, { reducido: true })
    c.entrar()
    c.salir()
    expect(c.estado()).toBe('ido')
  })

  it('pausar() antes de llegar a reposo no rompe la entrada', () => {
    const c = crearCoreografia(raiz, { reducido: false })
    c.entrar()
    c.pausar()
    vi.advanceTimersByTime(DURACIONES.ENTRADA)
    // Pausado o no, el reloj de la entrada corre: la clase de pausa sólo
    // congela las animaciones CSS.
    expect(c.estado()).toBe('reposo')
    expect(clases()).toContain('hero--pausado')
  })
})

/**
 * El cuerpo completo de un `@keyframes`, balanceando llaves en vez de buscar
 * un `\n}` en línea propia. Esta hoja mezcla keyframes de una sola línea
 * (`@keyframes corte-trazar { from {...} to {...} }`) con uno multilínea
 * (`antorcha-titilar`): buscar el primer `\n}` desde el nombre del keyframe
 * se pasaba de largo hasta el cierre del *siguiente* keyframe multilínea,
 * arrastrando varios keyframes de más adentro del cuerpo "de uno solo".
 * Devuelve `null` si el nombre no existe o si el CSS está roto (llave sin
 * cerrar).
 */
function bloqueDeKeyframe(css, nombre) {
  const inicio = css.indexOf(`@keyframes ${nombre}`)
  if (inicio < 0) return null
  const apertura = css.indexOf('{', inicio)
  let profundidad = 0
  for (let i = apertura; i < css.length; i++) {
    if (css[i] === '{') profundidad++
    else if (css[i] === '}') {
      profundidad--
      if (profundidad === 0) return css.slice(apertura, i + 1)
    }
  }
  return null
}

describe('presupuesto de propiedades animadas (G3)', () => {
  it('el reposo sólo anima transform y opacity', async () => {
    const { readFileSync } = await import('node:fs')
    // `import.meta.url` va a una variable y no como literal inline en
    // `new URL()`: ese patrón exacto es el que Vite reconoce como sintaxis
    // especial de asset URL (para resolver imports de recursos estáticos) y,
    // bajo `@vitest-environment jsdom`, lo resuelve contra el `location` falso
    // de jsdom (`http://localhost:3000/…`) en vez del archivo real -- y
    // `readFileSync` explota con "The URL must be of scheme file". Rompiendo
    // el patrón estático así, se resuelve con el `import.meta.url` real.
    const base = import.meta.url
    const css = readFileSync(new URL('../../estilos/hero.css', base), 'utf-8')

    // Los keyframes que usa el reposo, y las propiedades que tocan.
    const usadosEnReposo = [...css.matchAll(/\.hero--reposo[^{]*\{[^}]*animation:\s*([\w-]+)/g)]
      .map((m) => m[1])
    expect(usadosEnReposo.length).toBeGreaterThan(0)

    const PERMITIDAS = new Set(['transform', 'opacity', 'stroke-dashoffset'])
    for (const nombre of usadosEnReposo) {
      const cuerpo = bloqueDeKeyframe(css, nombre)
      expect(cuerpo, `no existe @keyframes ${nombre}`).not.toBeNull()

      // Cada declaración viene precedida por `{` (la primera de un
      // sub-bloque de porcentaje/from/to) o por `;` (las siguientes del
      // mismo sub-bloque) -- estén o no al principio de línea, que es
      // justo lo que no se puede asumir mezclando los dos formatos.
      const propiedades = [...cuerpo.matchAll(/[{;]\s*([a-z-]+)\s*:/g)].map((m) => m[1])
      expect(propiedades.length, `${nombre}: no se detectó ninguna declaración`).toBeGreaterThan(0)
      for (const prop of propiedades) {
        expect(PERMITIDAS.has(prop), `${nombre} anima "${prop}"`).toBe(true)
      }
    }
  })
})

/**
 * Revisión final, Important 2: el Acto VI era un fade, y el spec dice textual
 * "No un fade". `.corte__horizonte` no tenía ninguna regla de salida y vivía
 * fuera de los grupos que se animan, así que se desvanecía con todo lo demás:
 * el horizonte no subía ni se convertía en el borde del área del mapa, y con
 * eso se perdía lo único que el acto afirma -que hay un elemento continuo
 * entre los dos estados-.
 */
describe('Acto VI: el horizonte es la bisagra, no un fade (Important 2)', () => {
  function conHorizonte({ destino, ctm = { d: 2 }, caja = { top: 300, height: 4 } } = {}) {
    const raiz = document.createElement('div')
    const linea = document.createElement('div')
    linea.className = 'corte__horizonte'
    linea.getScreenCTM = () => ctm
    linea.getBoundingClientRect = () => caja
    raiz.appendChild(linea)
    document.body.appendChild(raiz)
    const c = crearCoreografia(raiz, {
      reducido: false,
      destinoHorizonte: destino === undefined ? null : () => destino,
    })
    return { raiz, c }
  }

  it('salir() deja medida la subida del horizonte, en unidades locales del SVG', () => {
    // El destino está 202px por encima del centro de la línea (300+2), y una
    // unidad local mide 2px: 101 unidades hacia arriba.
    const { raiz, c } = conHorizonte({ destino: 100 })
    c.entrar()
    c.salir()
    expect(raiz.style.getPropertyValue('--subida')).toBe('-101.0px')
    raiz.remove()
  })

  it('sin destino no rompe la salida: el horizonte se queda quieto', () => {
    const { raiz, c } = conHorizonte({ destino: undefined })
    c.entrar()
    c.salir()
    expect(raiz.style.getPropertyValue('--subida')).toBe('')
    expect(c.estado()).toBe('saliendo')
    raiz.remove()
  })

  it('la hoja saca al horizonte del fade y lo manda al borde del área', async () => {
    const { readFileSync } = await import('node:fs')
    const base = import.meta.url
    const hoja = readFileSync(new URL('../../estilos/hero.css', base), 'utf-8')

    // Tiene regla propia de salida, y es un transform (no una opacidad).
    const regla = /\.hero--saliendo \.corte__horizonte \{\s*animation:\s*([\w-]+)/.exec(hoja)
    expect(regla, 'el horizonte volvió a no tener regla de salida: el Acto VI es un fade').not.toBeNull()
    const keyframe = new RegExp(`@keyframes ${regla[1]} \\{[^}]*\\}[^}]*\\}`).exec(hoja)
      ?? new RegExp(`@keyframes ${regla[1]} \\{[\\s\\S]*?\\n\\}`).exec(hoja)
    expect(keyframe[0]).toContain('translateY')
    expect(keyframe[0]).toContain('--subida')

    // Y la raíz ya no se desvanece entera: si lo hiciera, se llevaría puesto
    // al horizonte por más regla propia que tenga.
    const irse = /@keyframes hero-irse \{[\s\S]*?\}/.exec(hoja)[0]
    expect(irse, 'la raíz vuelve a desvanecerse entera y arrastra al horizonte').not.toMatch(/opacity/)

    // El horizonte no está en el grupo que se hunde.
    const hundirse = /\.hero--saliendo[^{]*\{\s*animation:\s*corte-hundirse/.exec(hoja)
    expect(hundirse[0]).not.toContain('corte__horizonte')
  })
})
