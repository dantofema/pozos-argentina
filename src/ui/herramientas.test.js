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
    crearHerramientas(contenedor, { alDibujar, alVolver: () => {} })
    contenedor.querySelector('[data-accion="dibujar"]').click()
    expect(alDibujar).toHaveBeenCalledTimes(1)
  })

  it('avisa cuando se pide volver al inicio', () => {
    const alVolver = vi.fn()
    crearHerramientas(contenedor, { alDibujar: () => {}, alVolver })
    contenedor.querySelector('[data-accion="volver"]').click()
    expect(alVolver).toHaveBeenCalledTimes(1)
  })

  it('el botón dice cómo salir cuando el modo está armado', () => {
    const h = crearHerramientas(contenedor, { alDibujar: () => {}, alVolver: () => {} })
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
