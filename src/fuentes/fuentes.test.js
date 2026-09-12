import { describe, it, expect } from 'vitest'
import { readFileSync, statSync } from 'node:fs'

const ruta = (n) => new URL(`./${n}`, import.meta.url)
const ARCHIVOS = ['source-serif-4.woff2', 'archivo-narrow.woff2', 'jetbrains-mono.woff2']

describe('tipografías', () => {
  it('los tres archivos están y son woff2 de verdad', () => {
    for (const n of ARCHIVOS) {
      const buf = readFileSync(ruta(n))
      // Firma wOF2. Un HTML de error de 404 guardado con extensión .woff2
      // pasaría cualquier chequeo de existencia.
      expect(buf.subarray(0, 4).toString('latin1'), n).toBe('wOF2')
    }
  })

  it('entran en el presupuesto de 110 kB (G8)', () => {
    const total = ARCHIVOS.reduce((s, n) => s + statSync(ruta(n)).size, 0)
    expect(total, `${(total / 1024).toFixed(1)} kB`).toBeLessThanOrEqual(110 * 1024)
  })

  it('LICENCIAS.md nombra las tres familias y la OFL', () => {
    const texto = readFileSync(ruta('LICENCIAS.md'), 'utf-8')
    for (const familia of ['Source Serif 4', 'Archivo Narrow', 'JetBrains Mono']) {
      expect(texto).toContain(familia)
    }
    expect(texto).toMatch(/SIL Open Font License/i)
  })
})
