import { describe, it, expect } from 'vitest'
import { COLUMNA_NEUQUINA } from './estratigrafia.js'
import { TRAMAS } from '../ui/hero/tramas.js'

describe('COLUMNA_NEUQUINA', () => {
  it('tiene las nueve formaciones', () => {
    expect(COLUMNA_NEUQUINA).toHaveLength(9)
  })

  it('está en el orden estratigráfico real, de la más joven a la más antigua', () => {
    // Verificado contra la literatura de la cuenca: de abajo hacia arriba es
    // Lajas -> Lotena -> Tordillo -> Vaca Muerta -> Quintuco -> Centenario ->
    // Agrio -> Huitrin -> Rayoso. Este test es lo único que impide que alguien
    // "ordene alfabéticamente" y publique una estratigrafía falsa.
    expect(COLUMNA_NEUQUINA.map((f) => f.nombre)).toEqual([
      'RAYOSO', 'HUITRIN', 'AGRIO', 'CENTENARIO', 'QUINTUCO',
      'VACA MUERTA', 'TORDILLO', 'LOTENA', 'LAJAS',
    ])
  })

  it('marca Vaca Muerta como roca madre, y sólo a ella', () => {
    const madres = COLUMNA_NEUQUINA.filter((f) => f.rocaMadre)
    expect(madres).toHaveLength(1)
    expect(madres[0].nombre).toBe('VACA MUERTA')
  })

  it('cada formación tiene una trama de las cinco que existen', () => {
    for (const f of COLUMNA_NEUQUINA) {
      expect(TRAMAS, `${f.nombre} pide la trama "${f.trama}"`).toContain(f.trama)
    }
  })

  it('la roca madre es la única con la trama bituminosa', () => {
    const bituminosas = COLUMNA_NEUQUINA.filter((f) => f.trama === 'bituminosa')
    expect(bituminosas.map((f) => f.nombre)).toEqual(['VACA MUERTA'])
  })

  it('cada formación dice su litología, que es lo que justifica su trama', () => {
    for (const f of COLUMNA_NEUQUINA) {
      expect(f.litologia, f.nombre).toBeTruthy()
    }
  })

  it('sus nombres coinciden con los que cuenta el build (D8)', async () => {
    // El build duplica la lista a propósito —no importa del árbol del
    // navegador— así que algo tiene que atar las dos copias. Es esto.
    const fuente = await import('node:fs').then((fs) =>
      fs.readFileSync(new URL('../../scripts/lib/artefactos.mjs', import.meta.url), 'utf-8'))
    const bloque = fuente.slice(fuente.indexOf('const FORMACIONES_DEL_HERO'))
    for (const f of COLUMNA_NEUQUINA) {
      expect(bloque.slice(0, bloque.indexOf(']')), f.nombre).toContain(`'${f.nombre}'`)
    }
  })
})
