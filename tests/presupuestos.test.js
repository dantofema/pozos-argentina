import { describe, it, expect, beforeAll } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { COLUMNA_NEUQUINA } from '../src/lib/estratigrafia.js'

/**
 * El valor más alto que puede tomar cada variable que entra en un retardo de
 * la entrada. `--paso` es el lugar en la cascada del Acto II, que recorre las
 * bandas MENOS la roca madre (corte.js), así que su máximo es esa cuenta
 * menos uno; sale de la columna y no de un número copiado, para que agregar
 * una formación mueva este techo solo.
 */
const MAXIMOS = {
  paso: COLUMNA_NEUQUINA.filter((f) => !f.rocaMadre).length - 1,
  orden: COLUMNA_NEUQUINA.length - 1,
}

/** Un tiempo de CSS en ms: `520ms`, o un `calc()` con variables de la columna. */
function enMilisegundos(valor) {
  const limpio = valor.trim()
  const directo = /^(\d+)ms$/.exec(limpio)
  if (directo) return Number(directo[1])
  if (!limpio.startsWith('calc(')) return null
  let total = 0
  // Los términos con variable primero, para no contar dos veces sus ms.
  const conVariable = /var\(--([\w-]+)\)\s*\*\s*(\d+)ms/g
  let resto = limpio
  for (const m of limpio.matchAll(conVariable)) {
    const maximo = MAXIMOS[m[1]]
    if (maximo === undefined) return null
    total += maximo * Number(m[2])
    resto = resto.replace(m[0], '')
  }
  for (const m of resto.matchAll(/(\d+)ms/g)) total += Number(m[1])
  return total
}

/**
 * El fin (retardo + duración) de cada animación declarada bajo
 * `.hero--entrando`, incluidas las que sobreescriben el retardo con una regla
 * más específica -la roca madre del Acto III es una de ésas-.
 */
function finesDeLaEntrada(css) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const reglas = [...limpio.matchAll(/(\.hero--entrando[^{}]*)\{([^{}]*)\}/g)]
  const salida = []
  const heredadas = new Map()   // selector base -> { nombre, duracion }

  for (const [, selector, cuerpo] of reglas) {
    const corto = /animation:\s*([\w-]+)\s+(\d+)ms([^;]*)/.exec(cuerpo)
    const propio = /animation-delay:\s*([^;]+)/.exec(cuerpo)
    let nombre = null
    let duracion = null
    let retardo = null

    if (corto) {
      nombre = corto[1]
      duracion = Number(corto[2])
      // El segundo tiempo del atajo, si lo hay, es el retardo.
      const segundo = /(\d+)ms/.exec(corto[3].replace(/cubic-bezier\([^)]*\)/g, ''))
      if (segundo) retardo = Number(segundo[1])
      heredadas.set(selector.trim(), { nombre, duracion })
    }
    if (propio) retardo = enMilisegundos(propio[1])

    if (nombre === null) {
      // Regla que sólo cambia el retardo (Acto III): la duración la hereda de
      // la regla general de los estratos.
      const general = [...heredadas.values()].at(-1)
      if (!general || retardo === null) continue
      nombre = general.nombre
      duracion = general.duracion
    }
    if (retardo === null) retardo = 0
    if (duracion === null) continue
    salida.push({ selector: selector.trim(), nombre, fin: retardo + duracion })
  }
  return salida
}

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

  it('ningún acto de la entrada termina después de que el JS pasa a reposo', () => {
    const js = readFileSync(new URL(rutaCoreografia, import.meta.url), 'utf-8')
    const css = readFileSync(new URL(rutaHeroCss, import.meta.url), 'utf-8')

    const entrada = Number(/ENTRADA:\s*(\d+)/.exec(js)[1])
    const salida = Number(/SALIDA:\s*(\d+)/.exec(js)[1])

    // Este test decía medir esto y medía otra cosa (revisión final, Important
    // 4): comparaba `max(retardo) < ENTRADA`, o sea el momento en que la
    // última animación ARRANCA, no el momento en que termina. Con eso en
    // verde, `corte-extender` (3900+520) y `corte-subir` (3800+620) cerraban
    // en 4420 contra una ENTRADA de 4400: el JS sacaba la clase de entrada con
    // dos animaciones a mitad de camino y el navegador las cortaba. Lo que
    // hay que medir es el FIN, que es retardo + duración.
    const fines = finesDeLaEntrada(css)
    expect(fines.length, 'no se detectó ninguna animación de entrada').toBeGreaterThan(0)
    for (const { selector, nombre, fin } of fines) {
      expect(fin, `${selector} (${nombre}) termina en ${fin}ms, después de ENTRADA=${entrada}ms`)
        .toBeLessThanOrEqual(entrada)
    }
    expect(css).toContain(`${salida}ms`)
  })
})
