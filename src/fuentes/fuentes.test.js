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

  it('OFL.txt trae la licencia completa, no un resumen', () => {
    const ofl = readFileSync(ruta('OFL.txt'), 'utf-8')
    // Marcadores estructurales: una descarga truncada o una paráfrasis no los tiene todos.
    for (const seccion of ['Version 1.1', 'PREAMBLE', 'DEFINITIONS', 'PERMISSION & CONDITIONS', 'TERMINATION', 'DISCLAIMER']) {
      expect(ofl, `falta la sección ${seccion}`).toContain(seccion)
    }
    expect(ofl.length, 'demasiado corto para ser el texto completo').toBeGreaterThan(3000)
  })

  it('el aviso de cada tipografía coincide con el archivo que se distribuye', async () => {
    // Ata el aviso al binario: si alguien cambia un archivo de fuente, este test
    // falla hasta que actualice el aviso. Sin esto, LICENCIAS.md se desincroniza
    // en silencio de lo que el sitio realmente sirve.
    //
    // No hay librería de fuentes en las dependencias JS del proyecto (G1, presupuesto):
    // el copyright (tabla `name`, nameID 0) se extrae con fontTools en `bajar.sh`,
    // que lo escribe a `copyright.json` junto con cada descarga. Este test compara
    // LICENCIAS.md contra ese JSON —contra lo que salió del binario—, no contra una
    // constante tipeada a mano.
    const licencias = readFileSync(ruta('LICENCIAS.md'), 'utf-8')
    const copyrights = JSON.parse(readFileSync(ruta('copyright.json'), 'utf-8'))
    expect(Object.keys(copyrights).sort(), 'copyright.json debe cubrir los tres archivos').toEqual([...ARCHIVOS].sort())
    for (const n of ARCHIVOS) {
      expect(licencias, `LICENCIAS.md no cita textual el aviso de ${n}`).toContain(copyrights[n])
    }
  })
})
