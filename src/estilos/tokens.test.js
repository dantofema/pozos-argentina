import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf-8')

const HOJAS = ['tokens.css', 'base.css', 'hero.css', 'herramienta.css']
const hojas = Object.fromEntries(
  HOJAS.map((n) => [n, readFileSync(new URL(`./${n}`, import.meta.url), 'utf-8')]),
)

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

  it('define los siete colores en sus dos temas', () => {
    for (const nombre of ['papel', 'tinta', 'cobre', 'vaca', 'apagado', 'linea', 'superficie']) {
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

    it(`todo texto del tema ${tema} pasa AA sobre la superficie`, () => {
      const fondo = t[`superficie-${tema}`]
      for (const nombre of ['tinta', 'cobre', 'vaca', 'apagado']) {
        const r = contraste(t[`${nombre}-${tema}`], fondo)
        expect(r, `--c-${nombre}-${tema} da ${r.toFixed(2)}:1 sobre superficie`).toBeGreaterThanOrEqual(4.5)
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

  // C2: --vaca es la roca madre del corte geológico, no un segundo acento.
  // Si algo en herramienta.css lo reusa como color de estado, esto lo frena acá.
  it('no usa --vaca fuera del corte: está reservado para la roca madre (C2)', () => {
    const herramienta = readFileSync(new URL('./herramienta.css', import.meta.url), 'utf-8')
    expect(herramienta).not.toContain('var(--vaca)')
  })
})

/**
 * Revisión final, Critical 4: el bloque de tests de arriba calcula el
 * contraste entre TOKENS, y el CSS real no siempre usa tokens. Probado por
 * mutación en la revisión: con `.descarga__boton { color: var(--cobre) }`
 * —texto del mismo color que su propio fondo, 1:1, botón ilegible— los nueve
 * tests pasaban en verde. G7 dice "Lo verifica un test, no una tabla"; eso
 * era una tabla disfrazada de test.
 *
 * Lo que sigue lee las cuatro hojas, resuelve los `var()` en los dos temas y
 * mide el contraste de cada caja que declara un fondo contra el color de
 * texto que de verdad le toca. Es deliberadamente chico: no es un motor de
 * CSS, no resuelve cascada ni especificidad. Lo que sí cubre es el agujero
 * exacto por el que se coló C3 —un literal hexadecimal en una regla de
 * `:hover`, escrito pensando en el tema claro y heredado tal cual por el
 * oscuro—.
 */

/** Las declaraciones de cada regla de estilo, aplanando `@media`/`@container`. */
function reglas(css) {
  const limpio = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const salida = []
  let i = 0
  const bloque = () => {
    let prelude = ''
    while (i < limpio.length) {
      const c = limpio[i]
      if (c === '{') {
        i++
        const nombre = prelude.trim()
        prelude = ''
        // `@keyframes` y `@font-face` no describen cajas con texto: los
        // porcentajes de un keyframe no son selectores.
        if (/^@(keyframes|font-face|supports)/.test(nombre)) { saltar() }
        else if (nombre.startsWith('@')) { bloque() }  // media/container: se aplana
        else { salida.push({ selector: nombre, decls: declaraciones() }) }
      } else if (c === '}') { i++; return }
      else { prelude += c; i++ }
    }
  }
  const saltar = () => {
    let profundidad = 1
    while (i < limpio.length && profundidad > 0) {
      if (limpio[i] === '{') profundidad++
      else if (limpio[i] === '}') profundidad--
      i++
    }
  }
  const declaraciones = () => {
    const mapa = new Map()
    let acumulado = ''
    while (i < limpio.length) {
      const c = limpio[i]
      if (c === '}') { i++; break }
      if (c === '{') {  // regla anidada: no la hay hoy, pero no se traga el cierre
        i++; saltar(); acumulado = ''; continue
      }
      if (c === ';') {
        const corte = acumulado.indexOf(':')
        if (corte > 0) mapa.set(acumulado.slice(0, corte).trim(), acumulado.slice(corte + 1).trim())
        acumulado = ''
        i++
        continue
      }
      acumulado += c
      i++
    }
    const corte = acumulado.indexOf(':')
    if (corte > 0) mapa.set(acumulado.slice(0, corte).trim(), acumulado.slice(corte + 1).trim())
    return mapa
  }
  bloque()
  return salida
}

const TODAS = HOJAS.flatMap((n) => reglas(hojas[n]).map((r) => ({ ...r, hoja: n })))

/**
 * Los custom properties que valen en cada tema: `:root` a secas es el estado
 * base (papel) y `:root[data-tema="cianotipo"]` lo reapunta. Se lee de la
 * hoja y no se copia a mano, que es de lo que se trata este archivo.
 */
function variablesDelTema(tema) {
  const mapa = new Map()
  for (const r of reglas(hojas['tokens.css'])) {
    const esBase = r.selector === ':root'
    const esOscuro = r.selector.includes('[data-tema="cianotipo"]')
    if (esBase || (tema === 'oscuro' && esOscuro)) {
      for (const [k, v] of r.decls) if (k.startsWith('--')) mapa.set(k, v)
    }
  }
  return mapa
}

/** Resuelve cadenas de `var(--a)` hasta llegar a un valor concreto. */
function resolver(valor, vars, visto = new Set()) {
  if (!valor) return null
  let v = valor.trim()
  for (let vuelta = 0; vuelta < 10; vuelta++) {
    const m = /var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)/.exec(v)
    if (!m) return v
    if (visto.has(m[1])) return v
    visto.add(m[1])
    const reemplazo = vars.get(m[1]) ?? (m[2] ?? '').trim()
    if (!reemplazo) return v
    v = (v.slice(0, m.index) + reemplazo + v.slice(m.index + m[0].length)).trim()
  }
  return v
}

const NOMBRADOS = { white: '#ffffff', black: '#000000' }

/** Un color opaco, o null si el valor no es uno (degradés, `transparent`, `inherit`). */
function aHex(valor) {
  if (!valor) return null
  const v = valor.trim().toLowerCase()
  if (NOMBRADOS[v]) return NOMBRADOS[v]
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(v)
  if (!m) return null
  const h = m[1]
  return h.length === 3 ? `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}` : `#${h}`
}

/** El selector sin sus pseudo-clases: `.x:hover` -> `.x`. */
const base = (selector) => selector.split(',')[0].trim().replace(/:{1,2}[\w-]+(\([^)]*\))?/g, '').trim()

describe('contraste del CSS real (G7, X4)', () => {
  for (const tema of ['claro', 'oscuro']) {
    it(`toda caja con fondo propio pasa AA con su texto en el tema ${tema}`, () => {
      const vars = variablesDelTema(tema)
      const hex = (valor) => aHex(resolver(valor, vars, new Set()))

      // El color de texto heredado por default: el que declara `body`. Se
      // lee, no se supone.
      const cuerpo = TODAS.find((r) => r.selector === 'body')
      const heredado = hex(cuerpo.decls.get('color'))
      expect(heredado, 'body no declara un color de texto resoluble').not.toBeNull()

      // El `color` propio de cada selector base, para las reglas de `:hover`
      // que cambian el fondo y no el texto: es el caso exacto de C3.
      const colorDe = new Map()
      for (const r of TODAS) {
        const c = r.decls.get('color')
        if (c && c.trim() !== 'inherit') colorDe.set(r.selector, c)
      }

      // Los cuatro colores que la paleta usa PARA TEXTO. Una caja que no
      // declara color propio hereda, y lo que hereda puede ser cualquiera de
      // los cuatro: `.buscador__opcion` lleva adentro el tipo de faceta en
      // --cobre y la cuenca y la cantidad en --apagado, ninguno de los cuales
      // aparece en su propia regla. Medir sólo contra el heredado dejaba
      // pasar un fondo que rompe a los hijos -- pasó al escribir este mismo
      // arreglo: `var(--linea)` como hover daba 15:1 contra --tinta y 3,87:1
      // contra --cobre.
      const DE_TEXTO = ['tinta', 'cobre', 'vaca', 'apagado']
      const paleta = DE_TEXTO.map((n) => ({ nombre: n, hex: hex(`var(--${n})`) }))

      const fallas = []
      for (const r of TODAS) {
        const fondo = hex(r.decls.get('background') ?? r.decls.get('background-color'))
        if (!fondo) continue
        const propio = r.decls.get('color')
        const declarado = (propio && propio.trim() !== 'inherit')
          ? propio
          : colorDe.get(base(r.selector))
        // Con color propio declarado, la caja dice qué texto lleva y se mide
        // ese par y nada más (es el caso de un botón invertido). Sin él, el
        // texto lo pone quien la use, así que tienen que pasar los cuatro.
        const contra = declarado
          ? [{ nombre: declarado.trim(), hex: hex(declarado) }]
          : paleta
        for (const { nombre, hex: texto } of contra) {
          if (!texto) continue
          const r2 = contraste(texto, fondo)
          if (r2 < 4.5) {
            fallas.push(`${r.hoja} · ${r.selector}: ${nombre} (${texto}) sobre ${fondo} = ${r2.toFixed(2)}:1`)
          }
        }
      }
      expect(fallas, `pares por debajo de AA en el tema ${tema}:\n${fallas.join('\n')}`).toEqual([])
    })
  }
})
