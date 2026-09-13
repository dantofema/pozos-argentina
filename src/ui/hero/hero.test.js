// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { crearHero } from './hero.js'
import { DURACIONES } from './coreografia.js'

const MANIFIESTO = {
  pozos: 85609,
  ultimoPeriodo: 202607,
  generado: '2026-09-12T13:34:25.865Z',
  formaciones: {
    RAYOSO: 1750, HUITRIN: 2660, AGRIO: 3980, MULICHINCO: 1039, QUINTUCO: 4062,
    'VACA MUERTA': 3547, TORDILLO: 1699, LOTENA: 2119, LAJAS: 1887,
  },
}

const FACETAS = [
  { tipo: 'area', valor: 'LOMA CAMPANA', cuenca: 'NEUQUINA', indice: 0, cantidad: 1058, buscable: 'loma campana' },
]

let contenedor

beforeEach(() => {
  vi.useFakeTimers()
  // jsdom devuelve matches:false para todo. Sin stub no se puede probar el
  // camino de movimiento reducido, que es el que no se puede romper.
  window.matchMedia = vi.fn((consulta) => ({
    matches: false, media: consulta, addEventListener() {}, removeEventListener() {},
  }))
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
})

afterEach(() => {
  vi.useRealTimers()
  contenedor.remove()
})

describe('crearHero', () => {
  it('pinta el título, la bajada y la línea de dato desde el manifiesto (G5)', () => {
    crearHero(contenedor, { manifiesto: MANIFIESTO })

    expect(contenedor.querySelector('.hero__titulo').textContent)
      .toContain('Todos los pozos de hidrocarburos del país')
    expect(contenedor.querySelector('.hero__bajada').textContent)
      .toContain('Secretaría de Energía')
    const dato = contenedor.querySelector('.hero__dato').textContent
    expect(dato).toContain('85.609')
    expect(dato).toContain('07/2026')
  })

  // Revisión de la Tarea 8 (ruling, ronda 3): el dibujo y el texto viven
  // dentro de `.hero__escena`, que es la fila de la grilla que NO es el
  // buscador -así el dibujo nunca se extiende detrás de la banda (hallazgo
  // 2). jsdom no mide layout real (eso se verificó con CDP, ver el reporte),
  // pero sí puede guardar que la estructura no se pierda en un refactor.
  it('el dibujo y el texto viven dentro de .hero__escena, no directo en .hero (E2/hallazgo 2)', () => {
    crearHero(contenedor, { manifiesto: MANIFIESTO })
    const escena = contenedor.querySelector('.hero__escena')
    expect(escena).not.toBeNull()
    expect(escena.querySelector('.hero__dibujo')).not.toBeNull()
    expect(escena.querySelector('.hero__texto')).not.toBeNull()
    // El buscador, en cambio, es hermano de la escena: no comparte su fila.
    expect(escena.querySelector('.hero__buscador')).toBeNull()
  })

  // Ronda 4 (ruling del coordinador): el dato se mudó de .hero__texto a
  // .hero__buscador -al lado del campo, no debajo de la bajada- para
  // liberarle alto al bloque de texto sin comprimir la escala de
  // profundidad (ver corte.js) ni esconder la bajada. jsdom no mide layout
  // real (el "no crece de alto" y "mismo margen en los cinco viewports" se
  // verificaron con CDP, ver el reporte), pero sí puede guardar que el dato
  // no vuelva a vivir en .hero__texto por accidente.
  it('el dato vive en .hero__buscador, no en .hero__texto (ronda 4)', () => {
    crearHero(contenedor, { manifiesto: MANIFIESTO })
    const texto = contenedor.querySelector('.hero__texto')
    const buscador = contenedor.querySelector('.hero__buscador')
    expect(texto.querySelector('.hero__dato')).toBeNull()
    expect(buscador.querySelector('.hero__dato')).not.toBeNull()
  })

  // El campo real (`crearBuscador`) y el placeholder deshabilitado
  // (`campoDeshabilitado`) reemplazan el innerHTML entero de lo que reciben
  // (ver buscador.js) -si `montarBuscador` les diera `.hero__buscador`
  // completo, el dato desaparecería la primera vez que se reemplaza. Por
  // eso vive en `.hero__buscador-campo`, un hijo dedicado, y no en
  // `.hero__buscador` directo.
  it('montarBuscador no borra el dato al reemplazar el campo (cuidado de la ronda 4)', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    hero.montarBuscador(FACETAS, () => {})
    const dato = contenedor.querySelector('.hero__dato')
    expect(dato).not.toBeNull()
    expect(dato.textContent).toContain('85.609')
  })

  it('dibuja el corte con los conteos del manifiesto', () => {
    crearHero(contenedor, { manifiesto: MANIFIESTO })
    expect(contenedor.querySelector('[data-formacion="VACA MUERTA"]').textContent)
      .toContain('3.547')
  })

  it('arranca la coreografía al montarse', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    expect(hero.estado()).toBe('entrando')
    expect(contenedor.querySelector('.hero').classList).toContain('hero--entrando')
  })

  it('deja el buscador deshabilitado hasta que llegan las facetas (E5)', () => {
    crearHero(contenedor, { manifiesto: MANIFIESTO })
    const entrada = contenedor.querySelector('.hero__buscador input')
    expect(entrada.disabled).toBe(true)
    expect(entrada.placeholder).toMatch(/cargando/i)
  })

  it('montarBuscador lo habilita y le cambia el placeholder', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    hero.montarBuscador(FACETAS, () => {})

    const entrada = contenedor.querySelector('.hero__buscador .buscador__entrada')
    expect(entrada.disabled).toBe(false)
    expect(entrada.placeholder).not.toMatch(/cargando/i)
  })

  it('elegir en el buscador del hero avisa hacia afuera', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    const elegido = vi.fn()
    hero.montarBuscador(FACETAS, elegido)

    const entrada = contenedor.querySelector('.hero__buscador .buscador__entrada')
    entrada.value = 'loma'
    entrada.dispatchEvent(new Event('input'))
    contenedor.querySelector('.buscador__opcion').click()

    expect(elegido).toHaveBeenCalledWith(expect.objectContaining({ valor: 'LOMA CAMPANA' }))
  })

  it('relevar() saca el hero del DOM cuando termina la salida', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    vi.advanceTimersByTime(DURACIONES.ENTRADA)

    hero.relevar()
    expect(contenedor.querySelector('.hero')).not.toBeNull()

    vi.advanceTimersByTime(DURACIONES.SALIDA)
    expect(contenedor.querySelector('.hero')).toBeNull()
    expect(hero.estado()).toBe('ido')
  })

  it('relevar() dos veces no explota', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    hero.relevar()
    hero.relevar()
    vi.advanceTimersByTime(DURACIONES.SALIDA)
    expect(hero.estado()).toBe('ido')
  })

  it('pausa el reposo al enfocar el buscador (M1)', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    hero.montarBuscador(FACETAS, () => {})
    vi.advanceTimersByTime(DURACIONES.ENTRADA)

    const entrada = contenedor.querySelector('.hero__buscador .buscador__entrada')
    entrada.dispatchEvent(new Event('focusin', { bubbles: true }))
    expect(contenedor.querySelector('.hero').classList).toContain('hero--pausado')

    entrada.dispatchEvent(new Event('focusout', { bubbles: true }))
    expect(contenedor.querySelector('.hero').classList).not.toContain('hero--pausado')
  })

  it('pausa el reposo con la pestaña oculta (M2)', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    vi.advanceTimersByTime(DURACIONES.ENTRADA)

    // Si `vi.spyOn(document, 'hidden', 'get')` falla porque jsdom define la
    // propiedad como no configurable, reemplazarlo por:
    //   Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    // y restaurarlo en el afterEach con `delete document.hidden`.
    const oculto = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(contenedor.querySelector('.hero').classList).toContain('hero--pausado')

    oculto.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(contenedor.querySelector('.hero').classList).not.toContain('hero--pausado')
  })

  it('con movimiento reducido deja el cuadro final sin animar (G4)', () => {
    window.matchMedia = vi.fn((consulta) => ({
      matches: consulta.includes('prefers-reduced-motion'),
      media: consulta, addEventListener() {}, removeEventListener() {},
    }))

    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    expect(hero.estado()).toBe('reposo')
    expect(contenedor.querySelector('.hero').classList).not.toContain('hero--entrando')
  })

  it('dibuja el corte sin conteos si el manifiesto es de un build viejo (B1)', () => {
    const { formaciones, ...viejo } = MANIFIESTO
    crearHero(contenedor, { manifiesto: viejo })

    const banda = contenedor.querySelector('[data-formacion="QUINTUCO"]').textContent
    expect(banda).toContain('QUINTUCO')
    expect(banda).not.toMatch(/undefined|NaN/)
  })

  // El flujo real: montarBuscador() agrega SU PROPIA escucha de click en
  // document (para cerrar la lista al clickear afuera) además de las que
  // pone hero.js. Un test que nunca llama a montarBuscador() no puede ver
  // esa fuga -es la que encontró la revisión (Important 1)-, así que este
  // pasa por el camino completo: montar, elegir, y recién ahí relevar.
  it('saca sus escuchas del document al irse, incluida la del buscador montado (Important 1)', () => {
    const agregados = []
    const sacados = []
    const addOriginal = document.addEventListener.bind(document)
    const removeOriginal = document.removeEventListener.bind(document)
    vi.spyOn(document, 'addEventListener').mockImplementation((tipo, fn, opciones) => {
      agregados.push(tipo)
      return addOriginal(tipo, fn, opciones)
    })
    vi.spyOn(document, 'removeEventListener').mockImplementation((tipo, fn, opciones) => {
      sacados.push(tipo)
      return removeOriginal(tipo, fn, opciones)
    })

    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    const elegido = vi.fn()
    hero.montarBuscador(FACETAS, elegido)

    const entrada = contenedor.querySelector('.hero__buscador .buscador__entrada')
    entrada.value = 'loma'
    entrada.dispatchEvent(new Event('input'))
    contenedor.querySelector('.buscador__opcion').click()
    expect(elegido).toHaveBeenCalled()

    hero.relevar()
    vi.advanceTimersByTime(DURACIONES.SALIDA)

    // Por tipo de evento: lo que se agregó en document durante el flujo se
    // tiene que haber sacado, uno a uno -- ni de más ni de menos.
    const contar = (arr, tipo) => arr.filter((t) => t === tipo).length
    for (const tipo of new Set(agregados)) {
      expect(contar(sacados, tipo), `"${tipo}" en document: agregado ${contar(agregados, tipo)}, sacado ${contar(sacados, tipo)}`)
        .toBe(contar(agregados, tipo))
    }
    expect(agregados, 'no se agregó ninguna escucha en document: el test no está probando nada').not.toHaveLength(0)

    // Si alguna escucha siguiera puesta, esto tiraría sobre un nodo ya removido.
    expect(() => document.dispatchEvent(new Event('visibilitychange'))).not.toThrow()
    expect(() => document.dispatchEvent(new Event('click'))).not.toThrow()
  })
})
