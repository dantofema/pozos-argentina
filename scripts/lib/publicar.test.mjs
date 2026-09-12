import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { publicar, podar } from './publicar.mjs'

let destino
let carpeta

beforeEach(async () => {
  carpeta = await mkdtemp(join(tmpdir(), 'publicar-'))
  // Con la barra final, `new URL(nombre, destino)` resuelve adentro de la carpeta.
  destino = pathToFileURL(carpeta + '/')
})

afterEach(async () => {
  await rm(carpeta, { recursive: true, force: true })
})

describe('publicar', () => {
  it('deja los archivos con su nombre final y sin temporales', async () => {
    await publicar(destino, [
      ['pozos-lite.json', '{"rows":[1]}'],
      ['pozos-full-neuquina.json', '{"rows":[2]}'],
    ])

    expect((await readdir(carpeta)).sort()).toEqual(['pozos-full-neuquina.json', 'pozos-lite.json'])
    expect(await readFile(join(carpeta, 'pozos-lite.json'), 'utf-8')).toBe('{"rows":[1]}')
  })

  it('no pisa el índice anterior si un archivo del lote falla al serializarse', async () => {
    await writeFile(join(carpeta, 'pozos-lite.json'), 'EL INDICE VIEJO')

    // Un contenido que `writeFile` rechaza: es el análogo comprobable de que el
    // proceso se muera antes de terminar el lote.
    await expect(publicar(destino, [
      ['pozos-lite.json', 'EL INDICE NUEVO'],
      ['pozos-full-neuquina.json', Symbol('no serializable')],
    ])).rejects.toThrow()

    expect(await readFile(join(carpeta, 'pozos-lite.json'), 'utf-8')).toBe('EL INDICE VIEJO')
    expect(await readdir(carpeta)).toEqual(['pozos-lite.json'])
  })

  it('borra las particiones de cuencas que ya no están en el lote', async () => {
    await writeFile(join(carpeta, 'pozos-full-cuenca-que-ya-no-existe.json'), '{"rows":[]}')

    const borrados = await publicar(destino, [['pozos-full-neuquina.json', '{"rows":[]}']])

    expect(borrados).toEqual(['pozos-full-cuenca-que-ya-no-existe.json'])
    expect(await readdir(carpeta)).toEqual(['pozos-full-neuquina.json'])
  })
})

describe('podar', () => {
  it('barre los temporales que dejó una corrida anterior interrumpida', async () => {
    await writeFile(join(carpeta, 'pozos-lite.json.parcial'), 'a medio escribir')
    await writeFile(join(carpeta, 'pozos-lite.json'), '{}')

    const borrados = await podar(destino, ['pozos-lite.json'])

    expect(borrados).toEqual(['pozos-lite.json.parcial'])
    expect(await readdir(carpeta)).toEqual(['pozos-lite.json'])
  })

  it('no toca archivos que el build no genera', async () => {
    await writeFile(join(carpeta, 'manifiesto.json'), '{}')
    await writeFile(join(carpeta, 'favicon.ico'), 'x')

    expect(await podar(destino, ['pozos-full-neuquina.json'])).toEqual([])
    expect((await readdir(carpeta)).sort()).toEqual(['favicon.ico', 'manifiesto.json'])
  })
})
