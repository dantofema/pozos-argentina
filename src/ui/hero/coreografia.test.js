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
      const i = css.indexOf(`@keyframes ${nombre}`)
      expect(i, `no existe @keyframes ${nombre}`).toBeGreaterThanOrEqual(0)
      const cuerpo = css.slice(i, css.indexOf('\n}', i))
      for (const [, prop] of cuerpo.matchAll(/^\s*([a-z-]+):/gm)) {
        expect(PERMITIDAS.has(prop), `${nombre} anima "${prop}"`).toBe(true)
      }
    }
  })
})
