import { mkdir, writeFile, rename, readdir, unlink } from 'node:fs/promises'

/** Sufijo de los archivos a medio escribir. Nunca los sirve nadie. */
const PARCIAL = '.parcial'

/** Lo que el build es dueño de borrar: las particiones que él mismo genera. */
const GENERADOS = /^pozos-full-.*\.json$/

async function borrarSilencioso(rutas) {
  for (const ruta of rutas) {
    try {
      await unlink(ruta)
    } catch {
      // Si no se puede borrar un temporal, no vale voltear el build por eso.
    }
  }
}

/**
 * Escribe todo el lote a nombres temporales y recién después lo renombra a su
 * nombre final. Sin esto, un build que muere a mitad de camino —OOM, disco
 * lleno, un Ctrl-C— deja `pozos-lite.json` truncado y el sitio roto hasta la
 * próxima corrida exitosa: es el primer archivo que se escribía y el que carga
 * toda la app. Un `rename` en el mismo filesystem es atómico por archivo, así
 * que en el peor caso cada archivo queda entero viejo o entero nuevo.
 *
 * Devuelve los archivos huérfanos que borró.
 */
export async function publicar(destino, archivos) {
  await mkdir(destino, { recursive: true })

  const pendientes = []
  try {
    for (const [nombre, contenido] of archivos) {
      const temporal = new URL(nombre + PARCIAL, destino)
      await writeFile(temporal, contenido)
      pendientes.push([temporal, new URL(nombre, destino)])
    }
  } catch (error) {
    await borrarSilencioso(pendientes.map(([temporal]) => temporal))
    throw error
  }

  for (const [temporal, final] of pendientes) await rename(temporal, final)

  return podar(destino, archivos.map(([nombre]) => nombre))
}

/**
 * Borra las particiones de builds anteriores que ya no están en el manifiesto.
 * No es prolijidad: los índices de cada fila apuntan a los diccionarios de
 * `pozos-lite.json`, que se reconstruyen desde cero en cada build. Una
 * partición vieja decodifica contra el diccionario nuevo, así que un enlace
 * compartido a una cuenca renombrada no daría un 404 sino empresas y
 * yacimientos equivocados, en silencio.
 */
export async function podar(destino, vigentes) {
  const presentes = await readdir(destino)
  const sobran = presentes.filter(
    (n) => n.endsWith(PARCIAL) || (GENERADOS.test(n) && !vigentes.includes(n))
  )
  await borrarSilencioso(sobran.map((n) => new URL(n, destino)))
  return sobran
}
