import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf-8')

/** Los hex crudos viven una sola vez, en el `:root` a secas, como pares claro/oscuro. */
function crudos() {
  const cuerpo = css.slice(css.indexOf(':root'), css.indexOf('}'))
  const salida = {}
  for (const [, nombre, hex] of cuerpo.matchAll(/--c-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    salida[nombre] = hex
  }
  return salida
}

const canal = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const luminancia = (hex) => {
  const [r, g, b] = hex.match(/\w\w/g).map((h) => parseInt(h, 16))
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}
function contraste(a, b) {
  const [alta, baja] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (alta + 0.05) / (baja + 0.05)
}

describe('tokens', () => {
  const t = crudos()

  it('define los seis colores en sus dos temas', () => {
    for (const nombre of ['papel', 'tinta', 'cobre', 'vaca', 'apagado', 'linea']) {
      expect(t[`${nombre}-claro`], `falta --c-${nombre}-claro`).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(t[`${nombre}-oscuro`], `falta --c-${nombre}-oscuro`).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  // G7: se calcula, no se estima. Si alguien retoca un hex "para que se vea
  // mejor" y rompe el piso de AA, esto lo para acá y no en producción.
  for (const tema of ['claro', 'oscuro']) {
    it(`todo texto del tema ${tema} pasa AA sobre el fondo`, () => {
      const fondo = t[`papel-${tema}`]
      for (const nombre of ['tinta', 'cobre', 'vaca', 'apagado']) {
        const r = contraste(t[`${nombre}-${tema}`], fondo)
        expect(r, `--c-${nombre}-${tema} da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
      }
    })

    it(`el CTA del tema ${tema} pasa AA: papel sobre cobre`, () => {
      const r = contraste(t[`papel-${tema}`], t[`cobre-${tema}`])
      expect(r, `da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('declara los tokens en :root a secas antes de cualquier bloque de tema (C3)', () => {
    const iRoot = css.indexOf(':root {')
    const iMedia = css.indexOf('@media')
    const iTema = css.indexOf('[data-tema=')
    expect(iRoot).toBeGreaterThanOrEqual(0)
    expect(iRoot).toBeLessThan(iMedia)
    expect(iRoot).toBeLessThan(iTema)
  })
})
