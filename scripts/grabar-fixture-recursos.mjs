import { writeFile } from 'node:fs/promises'
import { paquete, sql } from './lib/ckan.mjs'
import { PAQUETE_PRODUCCION } from '../src/lib/esquema.js'
import { recursosDeProduccion } from './lib/recursos.mjs'

// Sin filtrar los DDJJ a propósito: el fixture es el retrato del catálogo, y es
// sobre él que los tests prueban que el filtro los deja afuera. Grabarlo ya
// filtrado vaciaría de contenido esos tests sin que ninguno se ponga en rojo.
const p = await paquete(PAQUETE_PRODUCCION)
const candidatos = recursosDeProduccion(p, 2018, new Date().getFullYear())
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
  // La fecha va adentro: las cifras del catálogo cambian —el recurso de 2025
  // pasó de 90.000 a 991.936 filas entre dos mediciones—, así que un fixture sin
  // fecha no se puede contrastar contra nada.
  JSON.stringify({ grabado: new Date().toISOString().slice(0, 10), candidatos: conFilas }, null, 2)
)
