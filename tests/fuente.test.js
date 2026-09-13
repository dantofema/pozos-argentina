import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * Guarda de higiene de fuente: un carácter combinante crudo (rango Unicode
 * U+0300 a U+036F) en un archivo de fuente nunca es texto plausible. Los
 * acentos del español son precompuestos -"á" es un único punto de código,
 * no una "a" seguida de un combinante-, así que la única forma en que ese
 * rango aparece crudo en el repo es un regex de normalización escrito con los
 * puntos de código literales en vez de escapados.
 * Pasó cinco veces en esta rama -dos escribiendo el plan y un módulo a mano,
 * una en el brief de una tarea, y dos aplicando ediciones con una
 * herramienta, una en este mismo regex y otra al escribir este archivo de
 * guarda- y cada vez el código funcionaba igual pero quedaba ilegible, y
 * sólo se detectaba mirando los bytes uno por uno.
 */

const RANGO_COMBINANTE_CRUDO = /[\u0300-\u036f]/

const PATRONES = ['src/**/*.js', 'src/**/*.css', 'scripts/**/*.mjs', 'index.html', 'docs/**/*.md', 'tests/*.js']

// Este archivo, que por fuerza menciona el rango en el comentario de arriba y
// en el mensaje de abajo, no se escanea a sí mismo.
const PROPIO = 'tests/fuente.test.js'

/**
 * Los archivos versionados que matchean los patrones. `git ls-files` ve el
 * ÍNDICE, no el directorio de trabajo (minor de la revisión final): un archivo
 * nuevo que todavía no pasó por `git add` no aparece acá y esta guarda no lo
 * mira. Es a propósito -lo que se quiere vigilar es lo que se va a commitear-
 * pero conviene saberlo cuando el test pasa en verde y el editor muestra el
 * combinante igual: falta agregarlo al índice.
 */
function archivosDeFuente() {
  const salida = execFileSync('git', ['ls-files', ...PATRONES], { encoding: 'utf-8' })
  return salida.split('\n').filter(Boolean).filter((archivo) => archivo !== PROPIO)
}

describe('higiene de fuente', () => {
  it('ningún archivo versionado trae un combinante U+0300-U+036F sin escapar', () => {
    const hallazgos = []
    for (const archivo of archivosDeFuente()) {
      const lineas = readFileSync(archivo, 'utf-8').split('\n')
      lineas.forEach((linea, indice) => {
        if (RANGO_COMBINANTE_CRUDO.test(linea)) {
          hallazgos.push(`${archivo}:${indice + 1}`)
        }
      })
    }

    const mensaje = hallazgos.length === 0 ? '' :
      `Carácter combinante crudo (U+0300-U+036F) en:\n${hallazgos.join('\n')}\n\n` +
      'Los acentos del español son precompuestos (una vocal con tilde es un único ' +
      'punto de código, no la vocal seguida de un combinante), así que esto nunca ' +
      'es texto plausible: es un regex de normalización que quedó con el rango ' +
      'escrito literal en vez de escapado. Usá la forma escapada: ' +
      '/[\\u0300-\\u036f]/.'

    expect(hallazgos, mensaje).toEqual([])
  })
})
