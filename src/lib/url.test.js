import { describe, it, expect } from 'vitest'
import { leerEstado, escribirEstado } from './url.js'

describe('leerEstado', () => {
  it('lee un ámbito por faceta', () => {
    expect(leerEstado('?t=area&v=LOMA%20CAMPANA')).toEqual({
      modo: 'faceta', tipo: 'area', valor: 'LOMA CAMPANA', poligono: null,
    })
  })

  it('lee un polígono', () => {
    const e = leerEstado('?p=-69,-39;-68,-39;-68,-38')
    expect(e.modo).toBe('poligono')
    expect(e.poligono).toEqual([[-69, -39], [-68, -39], [-68, -38]])
  })

  it('sin parámetros devuelve vacío', () => {
    expect(leerEstado('')).toEqual({ modo: 'vacio', tipo: null, valor: null, poligono: null })
  })

  it('descarta un tipo de faceta desconocido', () => {
    expect(leerEstado('?t=chirimbolo&v=X').modo).toBe('vacio')
  })

  it('descarta un polígono con menos de tres vértices', () => {
    expect(leerEstado('?p=-69,-39;-68,-39').modo).toBe('vacio')
  })

  it('descarta un polígono con coordenadas no numéricas', () => {
    expect(leerEstado('?p=a,b;c,d;e,f').modo).toBe('vacio')
  })
})

describe('escribirEstado', () => {
  it('escribe una faceta', () => {
    expect(escribirEstado({ modo: 'faceta', tipo: 'empresa', valor: 'YPF S.A.' }))
      .toBe('?t=empresa&v=YPF+S.A.')
  })

  it('escribe un polígono', () => {
    expect(escribirEstado({ modo: 'poligono', poligono: [[-69, -39], [-68, -39], [-68, -38]] }))
      .toBe('?p=-69,-39;-68,-39;-68,-38')
  })

  it('el estado vacío no deja querystring', () => {
    expect(escribirEstado({ modo: 'vacio' })).toBe('')
  })

  it('sobrevive la ida y vuelta de una faceta con acentos', () => {
    const original = { modo: 'faceta', tipo: 'yacimiento', valor: 'CAÑADON SECO' }
    const vuelta = leerEstado(escribirEstado(original))
    expect(vuelta.tipo).toBe(original.tipo)
    expect(vuelta.valor).toBe(original.valor)
  })

  it('sobrevive la ida y vuelta de un polígono', () => {
    const original = { modo: 'poligono', poligono: [[-69.5, -39.25], [-68, -39], [-68, -38]] }
    expect(leerEstado(escribirEstado(original)).poligono).toEqual(original.poligono)
  })
})
