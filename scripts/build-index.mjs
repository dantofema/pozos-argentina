#!/usr/bin/env node
import { writeFile, mkdir } from 'node:fs/promises'
import { sql } from './lib/ckan.mjs'
import { resolverRecursos } from './lib/recursos.mjs'
import { sqlPozos, sqlAgregado } from './lib/consultas.mjs'
import { construirArtefactos, nombreArchivoCuenca } from './lib/artefactos.mjs'
import { assertMinFilas, assertColumnas } from './lib/guardas.mjs'
import { ANIO_DESDE, FILAS_POR_PAGINA } from '../src/lib/esquema.js'

const SALIDA = new URL('../public/', import.meta.url)
const MIN_POZOS = 80000
const MIN_AGREGADOS = 75000

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

async function volcarPozos() {
  const filas = []
  for (let desplazamiento = 0; ; desplazamiento += FILAS_POR_PAGINA) {
    const pagina = await sql(sqlPozos(FILAS_POR_PAGINA, desplazamiento))
    log(`  pozos: ${desplazamiento} + ${pagina.length}`)
    filas.push(...pagina)
    if (pagina.length < FILAS_POR_PAGINA) break
  }
  assertMinFilas('pozos', filas.length, MIN_POZOS)
  assertColumnas('pozos', filas[0], ['idpozo', 'sigla', 'cuenca', 'geojson'])
  return filas
}

async function main() {
  const anioHasta = new Date().getFullYear()
  log(`Resolviendo recursos de producción ${ANIO_DESDE}–${anioHasta}…`)
  const recursos = await resolverRecursos({ anioDesde: ANIO_DESDE, anioHasta })
  for (const r of recursos) log(`  ${r.anio}: ${r.filas} filas — ${r.nombre}`)

  log('Volcando pozos…')
  const pozos = await volcarPozos()
  log(`  ${pozos.length} pozos`)

  log('Agregando producción…')
  const agregadosCrudos = await sql(sqlAgregado(recursos))
  assertMinFilas('agregado de producción', agregadosCrudos.length, MIN_AGREGADOS)
  assertColumnas('agregado de producción', agregadosCrudos[0], ['idpozo', 'meses', 'pet', 'ult'])
  const agregados = new Map(agregadosCrudos.map((a) => [Number(a.idpozo), a]))
  log(`  ${agregados.size} pozos con producción`)

  log('Construyendo artefactos…')
  const { lite, full, sinProduccion } = construirArtefactos(pozos, agregados)
  log(`  ${lite.rows.length} pozos en el índice, ${sinProduccion} sin producción`)

  await mkdir(SALIDA, { recursive: true })
  await writeFile(new URL('pozos-lite.json', SALIDA), JSON.stringify(lite))

  const cuencas = []
  for (const [cuenca, datos] of full) {
    const archivo = `pozos-full-${nombreArchivoCuenca(cuenca)}.json`
    await writeFile(new URL(archivo, SALIDA), JSON.stringify(datos))
    cuencas.push({ cuenca, archivo, pozos: datos.rows.length })
  }

  const ultimoPeriodo = agregadosCrudos.reduce((m, a) => Math.max(m, Number(a.ult)), 0)
  await writeFile(
    new URL('manifiesto.json', SALIDA),
    JSON.stringify({
      generado: new Date().toISOString(),
      pozos: lite.rows.length,
      sinProduccion,
      ultimoPeriodo,
      recursos: recursos.map(({ anio, id, nombre, filas }) => ({ anio, id, nombre, filas })),
      cuencas,
    }, null, 2)
  )

  log(`Listo. Último período con producción: ${ultimoPeriodo}`)
}

main().catch((error) => {
  console.error('\nEl build falló y no se publicó nada:\n', error.message)
  process.exit(1)
})
