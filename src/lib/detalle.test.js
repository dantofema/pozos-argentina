import { describe, it, expect } from 'vitest'
import { nombreArchivoCuenca } from './detalle.js'

describe('nombreArchivoCuenca', () => {
  it('normaliza "GOLFO SAN JORGE" a "golfo-san-jorge"', () => {
    expect(nombreArchivoCuenca('GOLFO SAN JORGE')).toBe('golfo-san-jorge')
  })

  it('normaliza "CAÑADON ASFALTO" a "canadon-asfalto"', () => {
    expect(nombreArchivoCuenca('CAÑADON ASFALTO')).toBe('canadon-asfalto')
  })

  it('normaliza "NEUQUINA" a "neuquina"', () => {
    expect(nombreArchivoCuenca('NEUQUINA')).toBe('neuquina')
  })

  it('normaliza "CUYANA" a "cuyana"', () => {
    expect(nombreArchivoCuenca('CUYANA')).toBe('cuyana')
  })

  it('normaliza "AUSTRAL" a "austral"', () => {
    expect(nombreArchivoCuenca('AUSTRAL')).toBe('austral')
  })

  it('normaliza "GENERAL LEVALLE" a "general-levalle"', () => {
    expect(nombreArchivoCuenca('GENERAL LEVALLE')).toBe('general-levalle')
  })

  it('normaliza "LOS BOLSONES" a "los-bolsones"', () => {
    expect(nombreArchivoCuenca('LOS BOLSONES')).toBe('los-bolsones')
  })

  it('normaliza "NIRIHUAU" a "nirihuau"', () => {
    expect(nombreArchivoCuenca('NIRIHUAU')).toBe('nirihuau')
  })

  it('normaliza "NORESTE" a "noreste"', () => {
    expect(nombreArchivoCuenca('NORESTE')).toBe('noreste')
  })

  it('normaliza "NOROESTE" a "noroeste"', () => {
    expect(nombreArchivoCuenca('NOROESTE')).toBe('noroeste')
  })
})
