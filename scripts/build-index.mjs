#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { sql } from './lib/ckan.mjs'
import { resolverRecursos } from './lib/recursos.mjs'
import { sqlPozos, sqlAgregado } from './lib/consultas.mjs'
import { construirArtefactos, nombreArchivoCuenca } from './lib/artefactos.mjs'
import { assertMinFilas, assertColumnas, assertSinRegresion } from './lib/guardas.mjs'
import { publicar } from './lib/publicar.mjs'
import { ANIO_DESDE, FILAS_POR_PAGINA } from '../src/lib/esquema.js'

const SALIDA = new URL('../public/', import.meta.url)
const MIN_POZOS = 80000
const MIN_AGREGADOS = 75000

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

/** El manifiesto del build anterior, o null si es la primera corrida. */
async function manifiestoPrevio() {
  try {
    return JSON.parse(await readFile(new URL('manifiesto.json', SALIDA), 'utf-8'))
  } catch {
    return null
  }
}

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
  assertColumnas('agregado de producción', agregadosCrudos[0], [
    'idpozo', 'meses', 'prim', 'ult', 'pet', 'gas', 'agua', 'tef',
  ])
  const agregados = new Map(agregadosCrudos.map((a) => [Number(a.idpozo), a]))
  log(`  ${agregados.size} pozos con producción`)

  log('Construyendo artefactos…')
  const { lite, full, sinProduccion, descartados, fueraDeCaja, formaciones } = construirArtefactos(pozos, agregados)
  log(`  ${lite.rows.length} pozos en el índice, ${sinProduccion} sin producción, ${descartados} descartados`)
  // Se nombran uno por uno: son coordenadas mentirosas del origen, y el único
  // modo de reclamarlas -o de notar que se multiplican- es verlas.
  for (const f of fueraDeCaja) {
    log(`  fuera de la caja de Argentina, descartado: ${f.idpozo} ${f.sigla} (${f.lon}, ${f.lat})`)
  }

  // No es una guarda de volumen, es un rótulo: si el origen renombra o retira
  // una formación de la columna, el build sigue y lo deja loggeado (B3).
  const sinPozos = Object.entries(formaciones).filter(([, n]) => n === 0).map(([f]) => f)
  if (sinPozos.length > 0) {
    log(`  formaciones del hero sin pozos declarados: ${sinPozos.join(', ')}`)
  }

  // Guarda contra los dos filtros silenciosos que corren después de las guardas
  // sobre el volcado crudo: geometría no parseable (construirArtefactos descarta
  // el pozo) y una fusión por idpozo que no matchea nada (todo cae en sinProduccion).
  // Sin esto el build podía escribir un índice chico o un dataset entero en cero
  // y salir con código 0.
  assertMinFilas('pozos en el índice publicado', lite.rows.length, MIN_POZOS)
  assertMinFilas('pozos con producción publicados', lite.rows.length - sinProduccion, MIN_AGREGADOS)

  const previo = await manifiestoPrevio()
  if (previo?.generado) {
    const dias = (Date.now() - Date.parse(previo.generado)) / 86400000
    log(`  el build anterior fue hace ${dias.toFixed(1)} días`)
  }
  assertSinRegresion(previo, { pozos: lite.rows.length, sinProduccion })

  const ultimoPeriodo = agregadosCrudos.reduce((m, a) => Math.max(m, Number(a.ult)), 0)

  // Se arma el lote entero en memoria y se publica de una: nada toca `public/`
  // hasta que todas las guardas pasaron y todo el JSON está serializado.
  const archivos = [['pozos-lite.json', JSON.stringify(lite)]]
  const cuencas = []
  for (const [cuenca, datos] of full) {
    const archivo = `pozos-full-${nombreArchivoCuenca(cuenca)}.json`
    archivos.push([archivo, JSON.stringify(datos)])
    cuencas.push({ cuenca, archivo, pozos: datos.rows.length })
  }
  archivos.push(['manifiesto.json', JSON.stringify({
    generado: new Date().toISOString(),
    pozos: lite.rows.length,
    sinProduccion,
    descartados,
    fueraDeCaja,
    formaciones,
    ultimoPeriodo,
    recursos: recursos.map(({ anio, id, nombre, filas }) => ({ anio, id, nombre, filas })),
    cuencas,
  }, null, 2)])

  const borrados = await publicar(SALIDA, archivos)
  if (borrados.length > 0) log(`  huérfanos borrados: ${borrados.join(', ')}`)

  log(`Listo. Último período con producción: ${ultimoPeriodo}`)
}

main().catch((error) => {
  console.error('\nEl build falló y no se publicó nada:\n', error.message)
  process.exit(1)
})
