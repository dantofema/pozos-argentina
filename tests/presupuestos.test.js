import { describe, it, expect, beforeAll } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

// `new URL('literal', import.meta.url)` escrito inline es el patrón que Vite
// reconoce en tiempo de build y reescribe como URL de asset -bajo jsdom (sin
// ese paso de build) resuelve contra un `location` falso en vez del archivo
// real, y el test explota o mide el directorio equivocado sin avisar. Ya
// mordió una vez en este plan (ver docs/reglas u otro archivo de test de una
// tarea anterior); la salida es sacar el literal a una variable intermedia
// para que Vite no lo detecte como asset e import.meta.url se resuelva de
// verdad contra este archivo.
const rutaDist = '../dist/assets/'
const DIST = new URL(rutaDist, import.meta.url)

const rutaCoreografia = '../src/ui/hero/coreografia.js'
const rutaHeroCss = '../src/estilos/hero.css'

function pesoGzip(patron) {
  const archivos = readdirSync(DIST).filter((n) => patron.test(n))
  return archivos.reduce((s, n) => s + gzipSync(readFileSync(new URL(n, DIST))).length, 0)
}

describe('presupuestos (G8)', () => {
  beforeAll(() => {
    if (!existsSync(DIST)) {
      throw new Error('Falta dist/. Correr `npx vite build` antes de este test.')
    }
  })

  it('el CSS entra en 20 kB gzip', () => {
    const b = pesoGzip(/\.css$/)
    expect(b, `${(b / 1024).toFixed(1)} kB`).toBeLessThanOrEqual(20 * 1024)
  })

  it('el JS entra en 62 kB gzip', () => {
    const b = pesoGzip(/\.js$/)
    expect(b, `${(b / 1024).toFixed(1)} kB`).toBeLessThanOrEqual(62 * 1024)
  })

  it('las tipografías entran en 110 kB', () => {
    const total = readdirSync(DIST).filter((n) => n.endsWith('.woff2'))
      .reduce((s, n) => s + statSync(new URL(n, DIST)).size, 0)
    expect(total, `${(total / 1024).toFixed(1)} kB`).toBeLessThanOrEqual(110 * 1024)
  })

  it('los tiempos del JS y del CSS de la coreografía coinciden', () => {
    const js = readFileSync(new URL(rutaCoreografia, import.meta.url), 'utf-8')
    const css = readFileSync(new URL(rutaHeroCss, import.meta.url), 'utf-8')

    const entrada = Number(/ENTRADA:\s*(\d+)/.exec(js)[1])
    const salida = Number(/SALIDA:\s*(\d+)/.exec(js)[1])

    // El último acto de la entrada no puede terminar después de que el JS ya
    // pasó a reposo: si no, la animación se corta a mitad de camino.
    const retardos = [...css.matchAll(/(\d+)ms\s+both/g)].map((m) => Number(m[1]))
    expect(Math.max(...retardos)).toBeLessThan(entrada)
    expect(css).toContain(`${salida}ms`)
  })
})
