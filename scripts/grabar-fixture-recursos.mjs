import { writeFile } from 'node:fs/promises'
import { paquete, sql } from './lib/ckan.mjs'
import { PAQUETE_PRODUCCION } from '../src/lib/esquema.js'
import { candidatosDelPaquete } from './lib/recursos.mjs'

const p = await paquete(PAQUETE_PRODUCCION)
const candidatos = candidatosDelPaquete(p, 2018, new Date().getFullYear())
const conFilas = []
for (const c of candidatos) {
  try {
    const [{ n }] = await sql(`SELECT count(*) AS n FROM "${c.id}"`, { reintentos: 1 })
    conFilas.push({ ...c, filas: Number(n) })
    console.log(c.anio, c.nombre, n)
  } catch {
    console.log(c.anio, c.nombre, 'TABLA INEXISTENTE')
  }
}
await writeFile(
  new URL('../tests/fixtures/recursos-candidatos.json', import.meta.url),
  JSON.stringify(conFilas, null, 2)
)
