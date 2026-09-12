// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { crearHerramientas } from './herramientas.js'

let contenedor

beforeEach(() => {
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
})

describe('crearHerramientas', () => {
  it('avisa cuando se pide dibujar', () => {
    const alDibujar = vi.fn()
    crearHerramientas(contenedor, { alDibujar, alBorrarZona: () => {}, alVolver: () => {} })
    contenedor.querySelector('[data-accion="dibujar"]').click()
    expect(alDibujar).toHaveBeenCalledTimes(1)
  })

  it('avisa cuando se pide volver al inicio', () => {
    const alVolver = vi.fn()
    crearHerramientas(contenedor, { alDibujar: () => {}, alBorrarZona: () => {}, alVolver })
    contenedor.querySelector('[data-accion="volver"]').click()
    expect(alVolver).toHaveBeenCalledTimes(1)
  })

  it('el botón dice cómo salir cuando el modo está armado', () => {
    const h = crearHerramientas(contenedor, { alDibujar: () => {}, alBorrarZona: () => {}, alVolver: () => {} })
    const boton = contenedor.querySelector('[data-accion="dibujar"]')
    expect(boton.textContent.trim()).toBe('Dibujar zona')

    h.marcarDibujando(true)
    expect(boton.textContent.trim()).toBe('Cancelar dibujo')
    expect(boton.getAttribute('aria-pressed')).toBe('true')

    h.marcarDibujando(false)
    expect(boton.textContent.trim()).toBe('Dibujar zona')
    expect(boton.getAttribute('aria-pressed')).toBe('false')
  })
})

describe('acciones sobre la zona', () => {
  it('sin zona no se ofrece borrarla', () => {
    crearHerramientas(contenedor, { alDibujar: () => {}, alBorrarZona: () => {}, alVolver: () => {} })
    expect(contenedor.querySelector('[data-accion="borrar"]').hidden).toBe(true)
  })

  it('con zona aparece borrar y el botón pasa a ofrecer redibujar', () => {
    const h = crearHerramientas(contenedor, { alDibujar: () => {}, alBorrarZona: () => {}, alVolver: () => {} })
    h.marcarZona(true)
    expect(contenedor.querySelector('[data-accion="borrar"]').hidden).toBe(false)
    expect(contenedor.querySelector('[data-accion="dibujar"]').textContent.trim()).toBe('Redibujar zona')
  })

  it('mientras se dibuja no se ofrece borrar: la zona está por reemplazarse', () => {
    const h = crearHerramientas(contenedor, { alDibujar: () => {}, alBorrarZona: () => {}, alVolver: () => {} })
    h.marcarZona(true)
    h.marcarDibujando(true)
    expect(contenedor.querySelector('[data-accion="borrar"]').hidden).toBe(true)
    expect(contenedor.querySelector('[data-accion="dibujar"]').textContent.trim()).toBe('Cancelar dibujo')
  })

  it('avisa cuando se pide borrar la zona', () => {
    const alBorrarZona = vi.fn()
    const h = crearHerramientas(contenedor, { alDibujar: () => {}, alBorrarZona, alVolver: () => {} })
    h.marcarZona(true)
    contenedor.querySelector('[data-accion="borrar"]').click()
    expect(alBorrarZona).toHaveBeenCalledTimes(1)
  })

  it('al sacar la zona vuelve a ofrecer dibujarla', () => {
    const h = crearHerramientas(contenedor, { alDibujar: () => {}, alBorrarZona: () => {}, alVolver: () => {} })
    h.marcarZona(true)
    h.marcarZona(false)
    expect(contenedor.querySelector('[data-accion="dibujar"]').textContent.trim()).toBe('Dibujar zona')
    expect(contenedor.querySelector('[data-accion="borrar"]').hidden).toBe(true)
  })
})
