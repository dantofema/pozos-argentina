# pozos-argentina Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un sitio estático que permite elegir pozos de hidrocarburos por área, yacimiento, operadora o polígono y descargar un CSV con una fila por pozo: ficha completa más resumen de producción acumulada.

**Architecture:** Todo el acceso al origen ocurre en build time, desde Node. Un script arma tres tipos de artefacto JSON en `public/` y el sitio publicado no hace ninguna llamada al origen: carga sus propios archivos, resuelve el ámbito en memoria y arma el CSV en el navegador.

**Tech Stack:** Vite 6, JavaScript vanilla en módulos ES, Leaflet 1.9, Vitest 2. Sin framework, sin backend, sin dependencias de runtime más allá de Leaflet.

**Spec:** `docs/superpowers/specs/2026-09-10-pozos-argentina-design.md`

## Global Constraints

- **Idioma del código:** identificadores y nombres de archivo en español, siguiendo el spec. Los comentarios, en español.
- **Sin llamadas al origen en runtime.** Ningún módulo bajo `src/` puede hacer `fetch` a un host que no sea el propio sitio. `datos.energia.gob.ar` degrada HTTPS a HTTP con un 301 y el navegador lo bloquea por mixed content.
- **Endpoint del build:** `http://datos.energia.gob.ar/api/3/action` — HTTP plano, a propósito, porque corre en Node.
- **Recurso de pozos:** `cb5c0f04-7835-45cd-b982-3e25ca7d7751`.
- **Paquete de producción:** nombre CKAN `produccion-de-petroleo-y-gas-por-pozo`.
- **Rango de años:** 2018 hasta el año en curso.
- **Página del volcado:** 20.000 filas. Más que eso da 504 a los 60 s.
- **El build falla ruidoso.** Cualquier guarda que no pase aborta con código distinto de cero. Nunca publicar datos incompletos.
- **Node 20+.**

---

### Task 1: Andamiaje del proyecto

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `vitest.contrato.config.js`
- Create: `index.html`
- Create: `src/lib/esquema.js`
- Test: `src/lib/esquema.test.js`

**Interfaces:**
- Consumes: nada.
- Produces: `COLUMNAS_DICT: string[]`, `LITE: Record<string,number>`, `FULL: Record<string,number>`, `COLUMNAS_CSV: string[]`, `ANIO_DESDE: number`, `RECURSO_POZOS: string`, `PAQUETE_PRODUCCION: string`, `API: string`. Todo el resto del plan importa de acá.

- [ ] **Step 1: Crear `package.json`**

```json
{
  "name": "pozos-argentina",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:contrato": "vitest run --config vitest.contrato.config.js",
    "build:index": "node scripts/build-index.mjs"
  },
  "dependencies": {
    "leaflet": "^1.9.4"
  },
  "devDependencies": {
    "jsdom": "^29.1.1",
    "vite": "^6.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Crear `vite.config.js`**

`npm test` no debe tocar la red: los tests de contrato viven en `tests/contrato/` y se excluyen acá.

```js
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['src/**/*.test.js', 'scripts/**/*.test.mjs'],
    exclude: ['tests/contrato/**', 'node_modules/**'],
  },
})
```

- [ ] **Step 3: Crear `vitest.contrato.config.js`**

```js
import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['tests/contrato/**/*.test.mjs'],
    testTimeout: 180000,
  },
})
```

- [ ] **Step 4: Crear `index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pozos de hidrocarburos de Argentina</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 5: Escribir el test que falla**

Archivo `src/lib/esquema.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { COLUMNAS_DICT, LITE, FULL, COLUMNAS_CSV } from './esquema.js'

describe('esquema', () => {
  it('declara las ocho columnas que van a diccionario', () => {
    expect(COLUMNAS_DICT).toEqual([
      'empresa', 'area', 'yacimiento', 'cuenca',
      'provincia', 'tipo_recurso', 'tipoestado', 'formacion',
    ])
  })

  it('los índices de LITE son consecutivos y sin huecos', () => {
    expect(Object.values(LITE).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6])
  })

  it('los índices de FULL son consecutivos y sin huecos', () => {
    const esperado = Array.from({ length: 18 }, (_, i) => i)
    expect(Object.values(FULL).sort((a, b) => a - b)).toEqual(esperado)
  })

  it('el CSV declara una columna por campo, más lon y lat', () => {
    expect(COLUMNAS_CSV).toHaveLength(20)
    expect(COLUMNAS_CSV.slice(0, 4)).toEqual(['idpozo', 'sigla', 'lon', 'lat'])
  })
})
```

- [ ] **Step 6: Correr el test y verificar que falla**

Run: `npm install && npx vitest run src/lib/esquema.test.js`
Expected: FAIL — `Failed to resolve import "./esquema.js"`

- [ ] **Step 7: Escribir `src/lib/esquema.js`**

```js
/** Constantes compartidas entre el build (Node) y el sitio (navegador). */

export const API = 'http://datos.energia.gob.ar/api/3/action'
export const RECURSO_POZOS = 'cb5c0f04-7835-45cd-b982-3e25ca7d7751'
export const PAQUETE_PRODUCCION = 'produccion-de-petroleo-y-gas-por-pozo'
export const ANIO_DESDE = 2018
export const FILAS_POR_PAGINA = 20000

/** Columnas cuyos valores se reemplazan por un índice a un diccionario. */
export const COLUMNAS_DICT = [
  'empresa', 'area', 'yacimiento', 'cuenca',
  'provincia', 'tipo_recurso', 'tipoestado', 'formacion',
]

/** Posición de cada campo en una fila de `pozos-lite.json`. */
export const LITE = {
  ID: 0, LON: 1, LAT: 2, AREA: 3, YACIMIENTO: 4, EMPRESA: 5, CUENCA: 6,
}

/** Posición de cada campo en una fila de `pozos-full-<cuenca>.json`. */
export const FULL = {
  ID: 0, SIGLA: 1, EMPRESA: 2, AREA: 3, YACIMIENTO: 4, CUENCA: 5,
  PROVINCIA: 6, TIPO_RECURSO: 7, TIPO_ESTADO: 8, FORMACION: 9,
  PROFUNDIDAD: 10, MESES: 11, PRIMER_PERIODO: 12, ULTIMO_PERIODO: 13,
  PET: 14, GAS: 15, AGUA: 16, TEF: 17,
}

/** Encabezado del CSV, en orden. */
export const COLUMNAS_CSV = [
  'idpozo', 'sigla', 'lon', 'lat', 'empresa', 'area', 'yacimiento',
  'cuenca', 'provincia', 'tipo_recurso', 'tipo_estado', 'formacion',
  'profundidad', 'meses', 'primer_periodo', 'ultimo_periodo',
  'pet_acum', 'gas_acum', 'agua_acum', 'tef_total',
]
```

- [ ] **Step 8: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/esquema.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 9: Commit**

```bash
git add package.json vite.config.js vitest.contrato.config.js index.html src/lib/esquema.js src/lib/esquema.test.js package-lock.json
git commit -m "Andamiaje del proyecto y esquema compartido"
```

---

### Task 2: Cliente CKAN y guardas del build

**Files:**
- Create: `scripts/lib/ckan.mjs`
- Create: `scripts/lib/guardas.mjs`
- Test: `scripts/lib/guardas.test.mjs`

**Interfaces:**
- Consumes: `API` de `src/lib/esquema.js`.
- Produces:
  - `sql(consulta, opciones?): Promise<Array<Object>>` — ejecuta SQL y devuelve `records`. Lanza `Error` si CKAN responde `success: false`.
  - `paquete(nombre): Promise<Object>` — devuelve el paquete CKAN.
  - `existeRecurso(id): Promise<boolean>`
  - `assertMinFilas(nombre, cantidad, minimo): void` — lanza si `cantidad < minimo`.
  - `assertColumnas(nombre, fila, columnas): void` — lanza si falta alguna clave.

- [ ] **Step 1: Escribir el test que falla**

Archivo `scripts/lib/guardas.test.mjs`. Las guardas son puras: se testean solas, sin red.

```js
import { describe, it, expect } from 'vitest'
import { assertMinFilas, assertColumnas } from './guardas.mjs'

describe('assertMinFilas', () => {
  it('pasa cuando hay filas de sobra', () => {
    expect(() => assertMinFilas('pozos', 85611, 80000)).not.toThrow()
  })

  it('falla cuando el volcado vino corto', () => {
    expect(() => assertMinFilas('produccion 2025', 90000, 500000))
      .toThrow(/produccion 2025.*90000.*500000/)
  })

  it('falla con cero filas', () => {
    expect(() => assertMinFilas('pozos', 0, 1)).toThrow()
  })
})

describe('assertColumnas', () => {
  it('pasa cuando están todas', () => {
    const fila = { idpozo: 1, sigla: 'X', geojson: '{}' }
    expect(() => assertColumnas('pozos', fila, ['idpozo', 'sigla'])).not.toThrow()
  })

  it('nombra exactamente la columna que falta', () => {
    const fila = { idpozo: 1 }
    expect(() => assertColumnas('pozos', fila, ['idpozo', 'geojson']))
      .toThrow(/geojson/)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run scripts/lib/guardas.test.mjs`
Expected: FAIL — no resuelve `./guardas.mjs`

- [ ] **Step 3: Escribir `scripts/lib/guardas.mjs`**

```js
/** Guardas del build. Cualquiera que no pase aborta la corrida. */

export function assertMinFilas(nombre, cantidad, minimo) {
  if (cantidad < minimo) {
    throw new Error(
      `Volcado corto en "${nombre}": ${cantidad} filas, se esperaban al menos ${minimo}. ` +
      'El origen cambió o devolvió datos incompletos; no se publica nada.'
    )
  }
}

export function assertColumnas(nombre, fila, columnas) {
  const faltan = columnas.filter((c) => !(c in fila))
  if (faltan.length > 0) {
    throw new Error(
      `Faltan columnas en "${nombre}": ${faltan.join(', ')}. ` +
      `Llegaron: ${Object.keys(fila).join(', ')}`
    )
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run scripts/lib/guardas.test.mjs`
Expected: PASS, 5 tests.

- [ ] **Step 5: Escribir `scripts/lib/ckan.mjs`**

No lleva test unitario: es el borde de red. Se ejercita en el test de contrato de la Task 12.

```js
import { API } from '../../src/lib/esquema.js'

/** Espera `ms` milisegundos. */
const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Ejecuta SQL contra el DataStore y devuelve las filas.
 * Reintenta ante 5xx y timeouts: el gateway corta a los 60 s.
 */
export async function sql(consulta, { reintentos = 3, timeoutMs = 150000 } = {}) {
  let ultimoError
  for (let intento = 1; intento <= reintentos; intento++) {
    const control = new AbortController()
    const corte = setTimeout(() => control.abort(), timeoutMs)
    try {
      const respuesta = await fetch(`${API}/datastore_search_sql`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: consulta }),
        signal: control.signal,
      })
      const cuerpo = await respuesta.json()
      if (!cuerpo.success) {
        throw new Error(`CKAN rechazó la consulta: ${JSON.stringify(cuerpo.error).slice(0, 400)}`)
      }
      return cuerpo.result.records
    } catch (error) {
      ultimoError = error
      if (intento < reintentos) await esperar(2000 * intento)
    } finally {
      clearTimeout(corte)
    }
  }
  throw new Error(`Falló la consulta tras ${reintentos} intentos: ${ultimoError.message}`)
}

/** Devuelve un paquete CKAN por su nombre. */
export async function paquete(nombre) {
  const respuesta = await fetch(`${API}/package_show?id=${encodeURIComponent(nombre)}`)
  const cuerpo = await respuesta.json()
  if (!cuerpo.success) throw new Error(`No se encontró el paquete "${nombre}"`)
  return cuerpo.result
}

/**
 * Verifica que la tabla del recurso exista de verdad.
 * `datastore_active: true` miente: hay recursos marcados activos cuya
 * tabla responde "relation does not exist".
 */
export async function existeRecurso(id) {
  try {
    await sql(`SELECT 1 FROM "${id}" LIMIT 1`, { reintentos: 1, timeoutMs: 30000 })
    return true
  } catch {
    return false
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/ckan.mjs scripts/lib/guardas.mjs scripts/lib/guardas.test.mjs
git commit -m "Cliente CKAN y guardas del build"
```

---

### Task 3: Resolución de recursos anuales

Es el test de mayor valor del proyecto. El paquete publica 44 recursos de producción con duplicados: el llamado `Producción de Pozos de Gas y Petróleo - 2025` trae 90.000 filas y el llamado `Producción de Pozos de Gas y Petróleo – 2025` trae 991.844. Se distinguen por un guión. Elegir mal publica el 9% de los datos sin que nadie se entere.

**Files:**
- Create: `scripts/lib/recursos.mjs`
- Create: `tests/fixtures/recursos-candidatos.json`
- Test: `scripts/lib/recursos.test.mjs`

**Interfaces:**
- Consumes: `paquete`, `sql`, `existeRecurso` de `ckan.mjs`; `assertMinFilas` de `guardas.mjs`; `ANIO_DESDE`, `PAQUETE_PRODUCCION` de `esquema.js`.
- Produces:
  - `candidatosDelPaquete(paquete, anioDesde, anioHasta): Array<{anio:number, id:string, nombre:string}>` — pura.
  - `elegirPorAnio(candidatosConFilas): Map<number, {id:string, nombre:string, filas:number}>` — pura. `candidatosConFilas` son `{anio, id, nombre, filas}`.
  - `resolverRecursos({anioDesde, anioHasta}): Promise<Array<{anio, id, nombre, filas}>>` — ordenado por año descendente.

- [ ] **Step 1: Grabar el fixture desde el origen real**

Una sola vez, a mano. Crear `scripts/grabar-fixture-recursos.mjs`:

```js
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
```

Run: `mkdir -p tests/fixtures && node scripts/grabar-fixture-recursos.mjs`

El fixture debe contener las dos entradas de 2025 con sus conteos reales. Verificar a ojo que una ronde las 90.000 filas y la otra el millón antes de seguir.

- [ ] **Step 2: Escribir el test que falla**

Archivo `scripts/lib/recursos.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { candidatosDelPaquete, elegirPorAnio } from './recursos.mjs'

const candidatos = JSON.parse(
  await readFile(new URL('../../tests/fixtures/recursos-candidatos.json', import.meta.url))
)

describe('elegirPorAnio', () => {
  it('elige el recurso con más filas cuando hay duplicados del mismo año', () => {
    const elegidos = elegirPorAnio([
      { anio: 2025, id: 'chico', nombre: '- 2025', filas: 90000 },
      { anio: 2025, id: 'grande', nombre: '– 2025', filas: 991844 },
    ])
    expect(elegidos.get(2025).id).toBe('grande')
  })

  it('descarta el 2025 truncado del catálogo real', () => {
    const elegidos = elegirPorAnio(candidatos)
    const elegido2025 = elegidos.get(2025)
    const truncado = candidatos.find((c) => c.anio === 2025 && c.filas < 200000)
    expect(truncado).toBeDefined()
    expect(elegido2025.id).not.toBe(truncado.id)
    expect(elegido2025.filas).toBeGreaterThan(truncado.filas)
  })

  it('devuelve un único recurso por año', () => {
    const elegidos = elegirPorAnio(candidatos)
    const anios = candidatos.map((c) => c.anio)
    expect(elegidos.size).toBe(new Set(anios).size)
  })

  it('ignora los candidatos cuya tabla no existe', () => {
    const elegidos = elegirPorAnio([
      { anio: 2024, id: 'roto', nombre: 'roto', filas: 0 },
      { anio: 2024, id: 'sano', nombre: 'sano', filas: 500 },
    ])
    expect(elegidos.get(2024).id).toBe('sano')
  })
})

describe('candidatosDelPaquete', () => {
  const paqueteFalso = {
    resources: [
      { id: 'a', name: 'Producción de Pozos de Gas y Petróleo – 2026', datastore_active: true },
      { id: 'b', name: 'Producción de Pozos de Gas y Petróleo - 2017', datastore_active: true },
      { id: 'c', name: 'Capítulo IV - Pozos', datastore_active: true },
      { id: 'd', name: 'Producción de Pozos de Gas y Petróleo – 2026', datastore_active: false },
    ],
  }

  it('toma sólo recursos de producción con año dentro del rango', () => {
    const r = candidatosDelPaquete(paqueteFalso, 2018, 2026)
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe('a')
  })

  it('descarta los que no están en el datastore', () => {
    const r = candidatosDelPaquete(paqueteFalso, 2018, 2026)
    expect(r.map((x) => x.id)).not.toContain('d')
  })
})
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `npx vitest run scripts/lib/recursos.test.mjs`
Expected: FAIL — no resuelve `./recursos.mjs`

- [ ] **Step 4: Escribir `scripts/lib/recursos.mjs`**

```js
import { paquete, sql, existeRecurso } from './ckan.mjs'
import { assertMinFilas } from './guardas.mjs'
import { PAQUETE_PRODUCCION } from '../../src/lib/esquema.js'

/** Piso de filas para un año completo. El más flaco medido rondó las 500.000. */
const MIN_FILAS_ANIO = 200000

/**
 * Extrae del paquete los recursos de producción anual dentro del rango.
 * Deja afuera la tabla de pozos y cualquier recurso fuera del datastore.
 */
export function candidatosDelPaquete(p, anioDesde, anioHasta) {
  return (p.resources ?? [])
    .filter((r) => r.datastore_active)
    .filter((r) => /producc/i.test(r.name ?? ''))
    .map((r) => {
      const encontrado = /(20\d\d)/.exec(r.name ?? '')
      return encontrado
        ? { anio: Number(encontrado[1]), id: r.id, nombre: r.name }
        : null
    })
    .filter((c) => c && c.anio >= anioDesde && c.anio <= anioHasta)
}

/**
 * Entre varios candidatos del mismo año, se queda con el que más filas tiene.
 * Es una heurística, no una certeza: el catálogo publica duplicados que sólo
 * se distinguen por un guión, y uno de ellos está truncado.
 */
export function elegirPorAnio(candidatosConFilas) {
  const porAnio = new Map()
  for (const c of candidatosConFilas) {
    const actual = porAnio.get(c.anio)
    if (!actual || c.filas > actual.filas) porAnio.set(c.anio, c)
  }
  return porAnio
}

/** Resuelve contra el origen vivo. Devuelve un recurso por año, del más nuevo al más viejo. */
export async function resolverRecursos({ anioDesde, anioHasta }) {
  const p = await paquete(PAQUETE_PRODUCCION)
  const candidatos = candidatosDelPaquete(p, anioDesde, anioHasta)
  if (candidatos.length === 0) {
    throw new Error(`El paquete "${PAQUETE_PRODUCCION}" no trajo recursos de producción`)
  }

  const conFilas = []
  for (const c of candidatos) {
    if (!(await existeRecurso(c.id))) continue
    const [{ n }] = await sql(`SELECT count(*) AS n FROM "${c.id}"`)
    conFilas.push({ ...c, filas: Number(n) })
  }

  const elegidos = [...elegirPorAnio(conFilas).values()]
    .sort((a, b) => b.anio - a.anio)

  const aniosEsperados = anioHasta - anioDesde + 1
  if (elegidos.length !== aniosEsperados) {
    const faltan = []
    for (let a = anioDesde; a <= anioHasta; a++) {
      if (!elegidos.some((e) => e.anio === a)) faltan.push(a)
    }
    throw new Error(`Faltan recursos de producción para: ${faltan.join(', ')}`)
  }

  // El año en curso está incompleto por definición: no se le exige el piso.
  for (const e of elegidos) {
    if (e.anio < anioHasta) assertMinFilas(`producción ${e.anio}`, e.filas, MIN_FILAS_ANIO)
  }

  return elegidos
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run scripts/lib/recursos.test.mjs`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/recursos.mjs scripts/lib/recursos.test.mjs scripts/grabar-fixture-recursos.mjs tests/fixtures/recursos-candidatos.json
git commit -m "Resolución del recurso de producción autoritativo por año"
```

---

### Task 4: Construcción de artefactos

**Files:**
- Create: `scripts/lib/artefactos.mjs`
- Test: `scripts/lib/artefactos.test.mjs`

**Interfaces:**
- Consumes: `COLUMNAS_DICT`, `LITE`, `FULL` de `esquema.js`.
- Produces:
  - `construirDiccionarios(pozos): Record<string, string[]>`
  - `indiceDe(diccionario, valor): number`
  - `construirArtefactos(pozos, agregados): {lite: {dicts, rows}, full: Map<string, {rows}>, sinProduccion: number}` — `pozos` son las filas crudas de CKAN; `agregados` es un `Map<number, Object>` indexado por `idpozo`.
  - `nombreArchivoCuenca(cuenca): string` — normaliza a minúscula sin acentos ni espacios.

- [ ] **Step 1: Escribir el test que falla**

Archivo `scripts/lib/artefactos.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { construirArtefactos, construirDiccionarios, nombreArchivoCuenca } from './artefactos.mjs'
import { LITE, FULL } from '../../src/lib/esquema.js'

const pozos = [
  {
    idpozo: '212', sigla: 'CH.CH.EaLE.x-1', empresa: 'YPF S.A.', area: 'EL AREA',
    yacimiento: 'EL YAC', cuenca: 'GOLFO SAN JORGE', provincia: 'Chubut',
    tipo_recurso: 'CONVENCIONAL', tipoestado: 'Extracción Efectiva',
    formacion: 'comodoro rivadavia', profundidad: '1702',
    geojson: '{"type":"Point","coordinates":[-68.287852,-45.591132]}',
  },
  {
    idpozo: '999', sigla: 'SIN.PROD-1', empresa: 'YPF S.A.', area: 'EL AREA',
    yacimiento: 'OTRO YAC', cuenca: 'NEUQUINA', provincia: 'Neuquén',
    tipo_recurso: 'NO CONVENCIONAL', tipoestado: 'A Abandonar',
    formacion: 'vaca muerta', profundidad: '2585',
    geojson: '{"type":"Point","coordinates":[-68.65,-38.36]}',
  },
]

const agregados = new Map([
  [212, { meses: '103', prim: '201801', ult: '202607', pet: '8808.2', gas: '1417.4', agua: '106520.8', tef: '2943.5' }],
])

describe('construirDiccionarios', () => {
  it('deduplica los valores repetidos', () => {
    const d = construirDiccionarios(pozos)
    expect(d.empresa).toEqual(['YPF S.A.'])
    expect(d.cuenca).toEqual(['GOLFO SAN JORGE', 'NEUQUINA'])
  })

  it('mapea nulos y vacíos a la cadena vacía', () => {
    const d = construirDiccionarios([{ ...pozos[0], formacion: null }])
    expect(d.formacion).toEqual([''])
  })
})

describe('construirArtefactos', () => {
  it('desprende lon y lat del geojson', () => {
    const { lite } = construirArtefactos(pozos, agregados)
    expect(lite.rows[0][LITE.LON]).toBeCloseTo(-68.28785, 5)
    expect(lite.rows[0][LITE.LAT]).toBeCloseTo(-45.59113, 5)
  })

  it('deja el pozo sin producción con meses en cero y acumulados en cero', () => {
    const { full, sinProduccion } = construirArtefactos(pozos, agregados)
    const neuquina = full.get('NEUQUINA').rows
    expect(neuquina).toHaveLength(1)
    expect(neuquina[0][FULL.MESES]).toBe(0)
    expect(neuquina[0][FULL.PET]).toBe(0)
    expect(neuquina[0][FULL.PRIMER_PERIODO]).toBe(0)
    expect(sinProduccion).toBe(1)
  })

  it('conserva los acumulados del pozo con producción', () => {
    const { full } = construirArtefactos(pozos, agregados)
    const fila = full.get('GOLFO SAN JORGE').rows[0]
    expect(fila[FULL.MESES]).toBe(103)
    expect(fila[FULL.PET]).toBeCloseTo(8808.2, 1)
    expect(fila[FULL.ULTIMO_PERIODO]).toBe(202607)
  })

  it('particiona el detalle por cuenca', () => {
    const { full } = construirArtefactos(pozos, agregados)
    expect([...full.keys()].sort()).toEqual(['GOLFO SAN JORGE', 'NEUQUINA'])
  })

  it('el lite y el full comparten los mismos diccionarios', () => {
    const { lite, full } = construirArtefactos(pozos, agregados)
    const filaLite = lite.rows.find((r) => r[LITE.ID] === 212)
    const filaFull = full.get('GOLFO SAN JORGE').rows[0]
    expect(lite.dicts.empresa[filaLite[LITE.EMPRESA]]).toBe('YPF S.A.')
    expect(lite.dicts.empresa[filaFull[FULL.EMPRESA]]).toBe('YPF S.A.')
  })

  it('descarta el pozo cuyo geojson no se puede parsear', () => {
    const roto = [{ ...pozos[0], geojson: 'no es json' }]
    const { lite } = construirArtefactos(roto, new Map())
    expect(lite.rows).toHaveLength(0)
  })
})

describe('nombreArchivoCuenca', () => {
  it('normaliza a minúscula sin acentos ni espacios', () => {
    expect(nombreArchivoCuenca('GOLFO SAN JORGE')).toBe('golfo-san-jorge')
    expect(nombreArchivoCuenca('CAÑADON ASFALTO')).toBe('canadon-asfalto')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run scripts/lib/artefactos.test.mjs`
Expected: FAIL — no resuelve `./artefactos.mjs`

- [ ] **Step 3: Escribir `scripts/lib/artefactos.mjs`**

```js
import { COLUMNAS_DICT } from '../../src/lib/esquema.js'

/** Devuelve el índice del valor en el diccionario, agregándolo si no estaba. */
export function indiceDe(diccionario, valor) {
  const v = valor ?? ''
  let i = diccionario.indexOf(v)
  if (i === -1) {
    i = diccionario.length
    diccionario.push(v)
  }
  return i
}

export function construirDiccionarios(pozos) {
  const dicts = Object.fromEntries(COLUMNAS_DICT.map((c) => [c, []]))
  for (const p of pozos) {
    for (const c of COLUMNAS_DICT) indiceDe(dicts[c], p[c] ?? '')
  }
  return dicts
}

export function nombreArchivoCuenca(cuenca) {
  return cuenca
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Lee las coordenadas del geojson. Devuelve null si no se puede parsear. */
function coordenadas(geojson) {
  try {
    const g = JSON.parse(geojson)
    const [lon, lat] = g.coordinates
    if (typeof lon !== 'number' || typeof lat !== 'number') return null
    return [Number(lon.toFixed(5)), Number(lat.toFixed(5))]
  } catch {
    return null
  }
}

/**
 * Fusiona pozos y agregados de producción en los artefactos que publica el sitio.
 * La fusión es un LEFT JOIN: un pozo sin producción declarada queda con ceros,
 * no se oculta.
 */
export function construirArtefactos(pozos, agregados) {
  const dicts = construirDiccionarios(pozos)
  const idx = (columna, pozo) => indiceDe(dicts[columna], pozo[columna] ?? '')

  const lite = []
  const full = new Map()
  let sinProduccion = 0

  for (const p of pozos) {
    const c = coordenadas(p.geojson)
    if (!c) continue

    const id = Number(p.idpozo)
    const iEmpresa = idx('empresa', p)
    const iArea = idx('area', p)
    const iYacimiento = idx('yacimiento', p)
    const iCuenca = idx('cuenca', p)

    lite.push([id, c[0], c[1], iArea, iYacimiento, iEmpresa, iCuenca])

    const a = agregados.get(id)
    if (!a) sinProduccion++

    const fila = [
      id, p.sigla ?? '', iEmpresa, iArea, iYacimiento, iCuenca,
      idx('provincia', p), idx('tipo_recurso', p),
      idx('tipoestado', p), idx('formacion', p),
      Number(p.profundidad ?? 0) || 0,
      a ? Number(a.meses) : 0,
      a ? Number(a.prim) : 0,
      a ? Number(a.ult) : 0,
      a ? Number(a.pet) : 0,
      a ? Number(a.gas) : 0,
      a ? Number(a.agua) : 0,
      a ? Number(a.tef) : 0,
    ]

    const cuenca = p.cuenca ?? ''
    if (!full.has(cuenca)) full.set(cuenca, { rows: [] })
    full.get(cuenca).rows.push(fila)
  }

  return { lite: { dicts, rows: lite }, full, sinProduccion }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run scripts/lib/artefactos.test.mjs`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/artefactos.mjs scripts/lib/artefactos.test.mjs
git commit -m "Fusión de pozos y producción en artefactos con diccionario"
```

---

### Task 5: Orquestador del build

Produce los archivos reales en `public/`. Al terminar esta tarea hay datos con los que trabajar.

**Files:**
- Create: `scripts/build-index.mjs`
- Create: `scripts/lib/consultas.mjs`
- Test: `scripts/lib/consultas.test.mjs`
- Modify: `.gitignore` — agregar `public/`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - `sqlPozos(limite, desplazamiento): string`
  - `sqlAgregado(recursos): string` — `recursos` es `[{anio, id}]`.
  - Archivos `public/pozos-lite.json`, `public/pozos-full-<cuenca>.json`, `public/manifiesto.json`.

- [ ] **Step 1: Escribir el test que falla**

Archivo `scripts/lib/consultas.test.mjs`:

```js
import { describe, it, expect } from 'vitest'
import { sqlPozos, sqlAgregado } from './consultas.mjs'
import { RECURSO_POZOS } from '../../src/lib/esquema.js'

describe('sqlPozos', () => {
  it('pide el recurso de pozos con orden estable y paginado', () => {
    const q = sqlPozos(20000, 40000)
    expect(q).toContain(`FROM "${RECURSO_POZOS}"`)
    expect(q).toContain('ORDER BY idpozo')
    expect(q).toContain('LIMIT 20000')
    expect(q).toContain('OFFSET 40000')
  })

  it('trae geojson, que es la geometría válida', () => {
    expect(sqlPozos(1, 0)).toContain('geojson')
  })

  it('no toca coordenadax ni coordenaday, que están transpuestas', () => {
    const q = sqlPozos(1, 0)
    expect(q).not.toContain('coordenadax')
    expect(q).not.toContain('coordenaday')
  })
})

describe('sqlAgregado', () => {
  const recursos = [{ anio: 2026, id: 'aaa' }, { anio: 2025, id: 'bbb' }]

  it('une todos los años con UNION ALL', () => {
    const q = sqlAgregado(recursos)
    expect(q).toContain('FROM "aaa"')
    expect(q).toContain('FROM "bbb"')
    expect(q.match(/UNION ALL/g)).toHaveLength(1)
  })

  it('agrupa por pozo', () => {
    expect(sqlAgregado(recursos)).toContain('GROUP BY idpozo')
  })

  it('con un solo año no emite UNION ALL', () => {
    expect(sqlAgregado([{ anio: 2026, id: 'aaa' }])).not.toContain('UNION ALL')
  })

  it('falla si no le pasan recursos', () => {
    expect(() => sqlAgregado([])).toThrow(/sin recursos/i)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run scripts/lib/consultas.test.mjs`
Expected: FAIL — no resuelve `./consultas.mjs`

- [ ] **Step 3: Escribir `scripts/lib/consultas.mjs`**

```js
import { RECURSO_POZOS } from '../../src/lib/esquema.js'

/**
 * Una página del volcado de pozos.
 * `geojson` es la geometría válida: las columnas coordenadax/coordenaday de la
 * tabla de producción están transpuestas y no se usan.
 */
export function sqlPozos(limite, desplazamiento) {
  return `SELECT idpozo, sigla, empresa, area, yacimiento, cuenca, provincia,
       tipo_recurso, tipoestado, formacion, profundidad, geojson
FROM "${RECURSO_POZOS}"
ORDER BY idpozo
LIMIT ${Number(limite)} OFFSET ${Number(desplazamiento)}`
}

/** Resumen de producción por pozo, uniendo todos los años elegidos. */
export function sqlAgregado(recursos) {
  if (!recursos || recursos.length === 0) {
    throw new Error('No se puede agregar producción sin recursos')
  }
  const union = recursos
    .map((r) => `  SELECT idpozo, anio, mes, prod_pet, prod_gas, prod_agua, tef FROM "${r.id}"`)
    .join('\n  UNION ALL\n')

  return `WITH prod AS (
${union}
)
SELECT idpozo,
       count(*)                          AS meses,
       min(anio * 100 + mes)             AS prim,
       max(anio * 100 + mes)             AS ult,
       round(sum(prod_pet)::numeric,  1) AS pet,
       round(sum(prod_gas)::numeric,  1) AS gas,
       round(sum(prod_agua)::numeric, 1) AS agua,
       round(sum(tef)::numeric,       1) AS tef
FROM prod
GROUP BY idpozo
ORDER BY idpozo`
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run scripts/lib/consultas.test.mjs`
Expected: PASS, 7 tests.

- [ ] **Step 5: Escribir `scripts/build-index.mjs`**

```js
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
```

- [ ] **Step 6: Agregar `public/` a `.gitignore`**

Los artefactos se regeneran; no se versionan.

```bash
printf 'public/\n' >> .gitignore
```

- [ ] **Step 7: Correr el build de verdad**

Run: `npm run build:index`
Expected: termina sin error. Tarda varios minutos. Verificar a mano:

```bash
ls -la public/
node -e "const m=require('./public/manifiesto.json'); console.log(m.pozos, m.sinProduccion, m.ultimoPeriodo, m.cuencas.length)"
```

Se espera del orden de 85.000 pozos, unos 500 sin producción, `ultimoPeriodo` de seis dígitos tipo `202607`, y entre 5 y 10 cuencas. Si `sinProduccion` supera los 5.000, parar: algo se rompió en la fusión.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-index.mjs scripts/lib/consultas.mjs scripts/lib/consultas.test.mjs .gitignore
git commit -m "Orquestador del build: genera los artefactos en public/"
```

---

### Task 6: Catálogo en el navegador

**Files:**
- Create: `src/lib/catalogo.js`
- Test: `src/lib/catalogo.test.js`

**Interfaces:**
- Consumes: `LITE`, `COLUMNAS_DICT` de `esquema.js`.
- Produces:
  - `cargarCatalogo(base?): Promise<Catalogo>` donde `Catalogo = {dicts, rows, manifiesto, porId: Map<number, Array>}`.
  - `construirFacetas(catalogo): Array<{tipo, valor, indice, cantidad}>` — `tipo` ∈ `'area' | 'yacimiento' | 'empresa'`.
  - `buscar(facetas, texto, limite?): Array<{tipo, valor, indice, cantidad}>` — ordena por cantidad descendente; prioriza los que empiezan con el texto.
  - `normalizar(texto): string` — minúscula sin acentos.

- [ ] **Step 1: Escribir el test que falla**

Archivo `src/lib/catalogo.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { construirFacetas, buscar, normalizar } from './catalogo.js'
import { LITE } from './esquema.js'

const catalogo = {
  dicts: {
    area: ['LOMA CAMPANA', 'EL TREBOL'],
    yacimiento: ['LOMA CAMPANA-LLL', 'CAÑADON SECO'],
    empresa: ['YPF S.A.', 'VISTA ENERGY ARGENTINA SAU'],
    cuenca: ['NEUQUINA', 'GOLFO SAN JORGE'],
  },
  rows: [
    // id, lon, lat, area, yacimiento, empresa, cuenca
    [1, -68.6, -38.3, 0, 0, 0, 0],
    [2, -68.7, -38.4, 0, 0, 0, 0],
    [3, -67.5, -45.9, 1, 1, 1, 1],
  ],
}

describe('normalizar', () => {
  it('baja a minúscula y saca acentos', () => {
    expect(normalizar('CAÑADÓN Seco')).toBe('canadon seco')
  })
})

describe('construirFacetas', () => {
  it('cuenta pozos por cada valor de faceta', () => {
    const f = construirFacetas(catalogo)
    const loma = f.find((x) => x.tipo === 'area' && x.valor === 'LOMA CAMPANA')
    expect(loma.cantidad).toBe(2)
  })

  it('produce facetas de área, yacimiento y empresa', () => {
    const tipos = new Set(construirFacetas(catalogo).map((f) => f.tipo))
    expect([...tipos].sort()).toEqual(['area', 'empresa', 'yacimiento'])
  })

  it('no inventa facetas para valores sin pozos', () => {
    const f = construirFacetas(catalogo)
    expect(f.every((x) => x.cantidad > 0)).toBe(true)
  })
})

describe('buscar', () => {
  const facetas = construirFacetas(catalogo)

  it('encuentra sin distinguir acentos ni mayúsculas', () => {
    const r = buscar(facetas, 'canadon')
    expect(r.map((x) => x.valor)).toContain('CAÑADON SECO')
  })

  it('encuentra por coincidencia parcial', () => {
    const r = buscar(facetas, 'loma')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((x) => normalizar(x.valor).includes('loma'))).toBe(true)
  })

  it('prioriza los que empiezan con el texto', () => {
    const r = buscar(facetas, 'ypf')
    expect(r[0].valor).toBe('YPF S.A.')
  })

  it('respeta el límite', () => {
    expect(buscar(facetas, 'a', 2)).toHaveLength(2)
  })

  it('con texto vacío no devuelve nada', () => {
    expect(buscar(facetas, '')).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/catalogo.test.js`
Expected: FAIL — no resuelve `./catalogo.js`

- [ ] **Step 3: Escribir `src/lib/catalogo.js`**

```js
import { LITE } from './esquema.js'

/** Tipos de faceta buscables, y la posición de su índice en una fila lite. */
const FACETAS = [
  { tipo: 'area', columna: LITE.AREA },
  { tipo: 'yacimiento', columna: LITE.YACIMIENTO },
  { tipo: 'empresa', columna: LITE.EMPRESA },
]

export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Carga el índice y el manifiesto que dejó el build. */
export async function cargarCatalogo(base = '/') {
  const [lite, manifiesto] = await Promise.all([
    fetch(`${base}pozos-lite.json`).then((r) => r.json()),
    fetch(`${base}manifiesto.json`).then((r) => r.json()),
  ])
  const porId = new Map(lite.rows.map((f) => [f[LITE.ID], f]))
  return { dicts: lite.dicts, rows: lite.rows, manifiesto, porId }
}

/** Arma la lista buscable, con la cantidad de pozos de cada valor. */
export function construirFacetas(catalogo) {
  const salida = []
  for (const { tipo, columna } of FACETAS) {
    const cuenta = new Map()
    for (const fila of catalogo.rows) {
      const i = fila[columna]
      cuenta.set(i, (cuenta.get(i) ?? 0) + 1)
    }
    for (const [indice, cantidad] of cuenta) {
      const valor = catalogo.dicts[tipo][indice]
      if (!valor) continue
      salida.push({ tipo, valor, indice, cantidad, buscable: normalizar(valor) })
    }
  }
  return salida
}

/** Busca por coincidencia parcial. Primero los que empiezan con el texto. */
export function buscar(facetas, texto, limite = 20) {
  const t = normalizar(texto)
  if (t === '') return []
  return facetas
    .filter((f) => f.buscable.includes(t))
    .sort((a, b) => {
      const ea = a.buscable.startsWith(t) ? 0 : 1
      const eb = b.buscable.startsWith(t) ? 0 : 1
      if (ea !== eb) return ea - eb
      return b.cantidad - a.cantidad
    })
    .slice(0, limite)
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/catalogo.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/catalogo.js src/lib/catalogo.test.js
git commit -m "Catálogo en memoria con facetas y búsqueda"
```

---

### Task 7: Resolución de ámbito

**Files:**
- Create: `src/lib/ambito.js`
- Test: `src/lib/ambito.test.js`

**Interfaces:**
- Consumes: `LITE` de `esquema.js`.
- Produces:
  - `puntoEnPoligono(lon, lat, anillo): boolean` — `anillo` es `Array<[lon, lat]>`.
  - `porFaceta(catalogo, tipo, valor): number[]` — ids de pozo.
  - `porPoligono(catalogo, anillo): number[]`
  - `cuencasDe(catalogo, ids): string[]`

- [ ] **Step 1: Escribir el test que falla**

Archivo `src/lib/ambito.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { puntoEnPoligono, porFaceta, porPoligono, cuencasDe } from './ambito.js'

const catalogo = {
  dicts: {
    area: ['LOMA CAMPANA', 'EL TREBOL'],
    yacimiento: ['LOMA CAMPANA-LLL', 'CAÑADON SECO'],
    empresa: ['YPF S.A.', 'VISTA ENERGY ARGENTINA SAU'],
    cuenca: ['NEUQUINA', 'GOLFO SAN JORGE'],
  },
  rows: [
    [1, -68.6, -38.3, 0, 0, 0, 0],
    [2, -68.7, -38.4, 0, 0, 0, 0],
    [3, -67.5, -45.9, 1, 1, 1, 1],
  ],
}

const cuadrado = [[-69, -39], [-68, -39], [-68, -38], [-69, -38]]

describe('puntoEnPoligono', () => {
  it('reconoce un punto adentro', () => {
    expect(puntoEnPoligono(-68.5, -38.5, cuadrado)).toBe(true)
  })

  it('reconoce un punto afuera', () => {
    expect(puntoEnPoligono(-67, -38.5, cuadrado)).toBe(false)
  })

  it('es estable con un punto sobre el borde', () => {
    expect(typeof puntoEnPoligono(-69, -38.5, cuadrado)).toBe('boolean')
  })

  it('devuelve falso para un anillo degenerado', () => {
    expect(puntoEnPoligono(0, 0, [[0, 0], [1, 1]])).toBe(false)
  })
})

describe('porFaceta', () => {
  it('devuelve los pozos del área', () => {
    expect(porFaceta(catalogo, 'area', 'LOMA CAMPANA').sort()).toEqual([1, 2])
  })

  it('devuelve los pozos de la operadora', () => {
    expect(porFaceta(catalogo, 'empresa', 'VISTA ENERGY ARGENTINA SAU')).toEqual([3])
  })

  it('devuelve vacío para un valor inexistente', () => {
    expect(porFaceta(catalogo, 'area', 'NO EXISTE')).toEqual([])
  })
})

describe('porPoligono', () => {
  it('devuelve sólo los pozos de adentro', () => {
    expect(porPoligono(catalogo, cuadrado).sort()).toEqual([1, 2])
  })

  it('devuelve vacío si no cae ninguno', () => {
    expect(porPoligono(catalogo, [[0, 0], [1, 0], [1, 1], [0, 1]])).toEqual([])
  })
})

describe('cuencasDe', () => {
  it('lista las cuencas involucradas sin repetir', () => {
    expect(cuencasDe(catalogo, [1, 2]).sort()).toEqual(['NEUQUINA'])
    expect(cuencasDe(catalogo, [1, 3]).sort()).toEqual(['GOLFO SAN JORGE', 'NEUQUINA'])
  })

  it('ignora ids que no están en el catálogo', () => {
    expect(cuencasDe(catalogo, [999])).toEqual([])
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/ambito.test.js`
Expected: FAIL — no resuelve `./ambito.js`

- [ ] **Step 3: Escribir `src/lib/ambito.js`**

```js
import { LITE } from './esquema.js'

const COLUMNA_POR_TIPO = {
  area: LITE.AREA,
  yacimiento: LITE.YACIMIENTO,
  empresa: LITE.EMPRESA,
  cuenca: LITE.CUENCA,
}

/** Ray casting. El caso del punto exactamente sobre el borde no está definido. */
export function puntoEnPoligono(lon, lat, anillo) {
  if (!anillo || anillo.length < 3) return false
  let dentro = false
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i]
    const [xj, yj] = anillo[j]
    const cruza = (yi > lat) !== (yj > lat) &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (cruza) dentro = !dentro
  }
  return dentro
}

/** Ids de los pozos cuyo valor de faceta coincide. */
export function porFaceta(catalogo, tipo, valor) {
  const columna = COLUMNA_POR_TIPO[tipo]
  if (columna === undefined) throw new Error(`Tipo de faceta desconocido: ${tipo}`)
  const indice = catalogo.dicts[tipo].indexOf(valor)
  if (indice === -1) return []
  return catalogo.rows.filter((f) => f[columna] === indice).map((f) => f[LITE.ID])
}

/** Ids de los pozos que caen dentro del anillo dibujado. */
export function porPoligono(catalogo, anillo) {
  return catalogo.rows
    .filter((f) => puntoEnPoligono(f[LITE.LON], f[LITE.LAT], anillo))
    .map((f) => f[LITE.ID])
}

/** Cuencas involucradas por un conjunto de pozos. Determina qué particiones cargar. */
export function cuencasDe(catalogo, ids) {
  const cuencas = new Set()
  for (const id of ids) {
    const fila = catalogo.porId?.get(id) ?? catalogo.rows.find((f) => f[LITE.ID] === id)
    if (!fila) continue
    cuencas.add(catalogo.dicts.cuenca[fila[LITE.CUENCA]])
  }
  return [...cuencas]
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/ambito.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ambito.js src/lib/ambito.test.js
git commit -m "Resolución de ámbito por faceta y por polígono"
```

---

### Task 8: Detalle bajo demanda y armado del CSV

**Files:**
- Create: `src/lib/detalle.js`
- Create: `src/lib/csv.js`
- Test: `src/lib/csv.test.js`

**Interfaces:**
- Consumes: `FULL`, `LITE`, `COLUMNAS_CSV` de `esquema.js`; `nombreArchivoCuenca` replicado.
- Produces:
  - `nombreArchivoCuenca(cuenca): string` — misma regla que el build.
  - `cargarDetalle(cuencas, base?): Promise<Map<number, Array>>`
  - `escaparCampo(valor): string`
  - `construirCsv({filas, dicts, catalogo}): string`

- [ ] **Step 1: Escribir el test que falla**

Archivo `src/lib/csv.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { escaparCampo, construirCsv } from './csv.js'
import { COLUMNAS_CSV } from './esquema.js'

const dicts = {
  empresa: ['PETROLERA, S.A.'],
  area: ['EL AREA'],
  yacimiento: ['EL YAC'],
  cuenca: ['NEUQUINA'],
  provincia: ['Neuquén'],
  tipo_recurso: ['NO CONVENCIONAL'],
  tipoestado: ['Extracción Efectiva'],
  formacion: ['vaca muerta'],
}

const catalogo = {
  porId: new Map([[1, [1, -68.65028, -38.36952, 0, 0, 0, 0]]]),
}

// id, sigla, empresa, area, yac, cuenca, prov, tipoRec, tipoEst, form,
// prof, meses, prim, ult, pet, gas, agua, tef
const filas = [
  [1, 'YPF.Nq.LLL-1577(h)', 0, 0, 0, 0, 0, 0, 0, 0, 2585, 86, 201901, 202607, 244920.3, 39406.3, 1200, 2500],
  [2, 'SIN.PROD-1', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]

describe('escaparCampo', () => {
  it('deja pasar un valor simple', () => {
    expect(escaparCampo('YPF S.A.')).toBe('YPF S.A.')
  })

  it('entrecomilla cuando hay coma', () => {
    expect(escaparCampo('PETROLERA, S.A.')).toBe('"PETROLERA, S.A."')
  })

  it('duplica las comillas internas', () => {
    expect(escaparCampo('EL "POZO"')).toBe('"EL ""POZO"""')
  })

  it('entrecomilla cuando hay salto de línea', () => {
    expect(escaparCampo('una\notra')).toBe('"una\notra"')
  })

  it('convierte null y undefined en vacío', () => {
    expect(escaparCampo(null)).toBe('')
    expect(escaparCampo(undefined)).toBe('')
  })

  it('conserva el cero', () => {
    expect(escaparCampo(0)).toBe('0')
  })
})

describe('construirCsv', () => {
  it('arranca con el encabezado declarado', () => {
    const csv = construirCsv({ filas, dicts, catalogo })
    expect(csv.split('\r\n')[0]).toBe(COLUMNAS_CSV.join(','))
  })

  it('emite una fila por pozo', () => {
    const csv = construirCsv({ filas, dicts, catalogo })
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  it('resuelve los índices de diccionario a texto', () => {
    const csv = construirCsv({ filas, dicts, catalogo })
    expect(csv).toContain('vaca muerta')
    expect(csv).toContain('"PETROLERA, S.A."')
  })

  it('pone lon y lat del catálogo', () => {
    const linea = construirCsv({ filas, dicts, catalogo }).split('\r\n')[1]
    expect(linea).toContain('-68.65028')
    expect(linea).toContain('-38.36952')
  })

  it('deja lon y lat vacíos si el pozo no está en el catálogo', () => {
    const linea = construirCsv({ filas, dicts, catalogo }).split('\r\n')[2]
    const campos = linea.split(',')
    expect(campos[2]).toBe('')
    expect(campos[3]).toBe('')
  })

  it('el pozo sin producción sale con ceros, no se omite', () => {
    const csv = construirCsv({ filas, dicts, catalogo })
    expect(csv).toContain('SIN.PROD-1')
  })

  it('usa CRLF, que es lo que espera Excel', () => {
    expect(construirCsv({ filas, dicts, catalogo })).toContain('\r\n')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/csv.test.js`
Expected: FAIL — no resuelve `./csv.js`

- [ ] **Step 3: Escribir `src/lib/csv.js`**

```js
import { FULL, LITE, COLUMNAS_CSV } from './esquema.js'

export function escaparCampo(valor) {
  const s = valor === null || valor === undefined ? '' : String(valor)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Un CSV con una fila por pozo. `filas` son filas FULL. */
export function construirCsv({ filas, dicts, catalogo }) {
  const lineas = [COLUMNAS_CSV.join(',')]

  for (const f of filas) {
    const lite = catalogo.porId?.get(f[FULL.ID])
    const lon = lite ? lite[LITE.LON] : ''
    const lat = lite ? lite[LITE.LAT] : ''

    lineas.push([
      f[FULL.ID],
      f[FULL.SIGLA],
      lon,
      lat,
      dicts.empresa[f[FULL.EMPRESA]],
      dicts.area[f[FULL.AREA]],
      dicts.yacimiento[f[FULL.YACIMIENTO]],
      dicts.cuenca[f[FULL.CUENCA]],
      dicts.provincia[f[FULL.PROVINCIA]],
      dicts.tipo_recurso[f[FULL.TIPO_RECURSO]],
      dicts.tipoestado[f[FULL.TIPO_ESTADO]],
      dicts.formacion[f[FULL.FORMACION]],
      f[FULL.PROFUNDIDAD],
      f[FULL.MESES],
      f[FULL.PRIMER_PERIODO] || '',
      f[FULL.ULTIMO_PERIODO] || '',
      f[FULL.PET],
      f[FULL.GAS],
      f[FULL.AGUA],
      f[FULL.TEF],
    ].map(escaparCampo).join(','))
  }

  return lineas.join('\r\n')
}
```

- [ ] **Step 4: Escribir `src/lib/detalle.js`**

```js
import { FULL } from './esquema.js'

/** Misma regla que `scripts/lib/artefactos.mjs`: los nombres deben coincidir. */
export function nombreArchivoCuenca(cuenca) {
  return cuenca
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const cache = new Map()

/** Carga las particiones de las cuencas pedidas y devuelve las filas por id de pozo. */
export async function cargarDetalle(cuencas, base = '/') {
  const porId = new Map()
  for (const cuenca of cuencas) {
    const archivo = `pozos-full-${nombreArchivoCuenca(cuenca)}.json`
    if (!cache.has(archivo)) {
      cache.set(archivo, fetch(`${base}${archivo}`).then((r) => r.json()))
    }
    const datos = await cache.get(archivo)
    for (const fila of datos.rows) porId.set(fila[FULL.ID], fila)
  }
  return porId
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/csv.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/csv.js src/lib/csv.test.js src/lib/detalle.js
git commit -m "Armado del CSV y carga de detalle por cuenca"
```

---

### Task 9: Estado en la URL

**Files:**
- Create: `src/lib/url.js`
- Test: `src/lib/url.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `leerEstado(busqueda): {modo, tipo, valor, poligono}` — `modo` ∈ `'faceta' | 'poligono' | 'vacio'`.
  - `escribirEstado(estado): string` — devuelve la querystring con `?` adelante, o `''`.

- [ ] **Step 1: Escribir el test que falla**

Archivo `src/lib/url.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { leerEstado, escribirEstado } from './url.js'

describe('leerEstado', () => {
  it('lee un ámbito por faceta', () => {
    expect(leerEstado('?t=area&v=LOMA%20CAMPANA')).toEqual({
      modo: 'faceta', tipo: 'area', valor: 'LOMA CAMPANA', poligono: null,
    })
  })

  it('lee un polígono', () => {
    const e = leerEstado('?p=-69,-39;-68,-39;-68,-38')
    expect(e.modo).toBe('poligono')
    expect(e.poligono).toEqual([[-69, -39], [-68, -39], [-68, -38]])
  })

  it('sin parámetros devuelve vacío', () => {
    expect(leerEstado('')).toEqual({ modo: 'vacio', tipo: null, valor: null, poligono: null })
  })

  it('descarta un tipo de faceta desconocido', () => {
    expect(leerEstado('?t=chirimbolo&v=X').modo).toBe('vacio')
  })

  it('descarta un polígono con menos de tres vértices', () => {
    expect(leerEstado('?p=-69,-39;-68,-39').modo).toBe('vacio')
  })

  it('descarta un polígono con coordenadas no numéricas', () => {
    expect(leerEstado('?p=a,b;c,d;e,f').modo).toBe('vacio')
  })
})

describe('escribirEstado', () => {
  it('escribe una faceta', () => {
    expect(escribirEstado({ modo: 'faceta', tipo: 'empresa', valor: 'YPF S.A.' }))
      .toBe('?t=empresa&v=YPF+S.A.')
  })

  it('escribe un polígono', () => {
    expect(escribirEstado({ modo: 'poligono', poligono: [[-69, -39], [-68, -39], [-68, -38]] }))
      .toBe('?p=-69,-39;-68,-39;-68,-38')
  })

  it('el estado vacío no deja querystring', () => {
    expect(escribirEstado({ modo: 'vacio' })).toBe('')
  })

  it('sobrevive la ida y vuelta de una faceta con acentos', () => {
    const original = { modo: 'faceta', tipo: 'yacimiento', valor: 'CAÑADON SECO' }
    const vuelta = leerEstado(escribirEstado(original))
    expect(vuelta.tipo).toBe(original.tipo)
    expect(vuelta.valor).toBe(original.valor)
  })

  it('sobrevive la ida y vuelta de un polígono', () => {
    const original = { modo: 'poligono', poligono: [[-69.5, -39.25], [-68, -39], [-68, -38]] }
    expect(leerEstado(escribirEstado(original)).poligono).toEqual(original.poligono)
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/lib/url.test.js`
Expected: FAIL — no resuelve `./url.js`

- [ ] **Step 3: Escribir `src/lib/url.js`**

```js
const TIPOS = ['area', 'yacimiento', 'empresa']
const VACIO = { modo: 'vacio', tipo: null, valor: null, poligono: null }

function parsearPoligono(texto) {
  const vertices = texto.split(';').map((par) => {
    const [lon, lat] = par.split(',').map(Number)
    return [lon, lat]
  })
  const valido = vertices.length >= 3 &&
    vertices.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))
  return valido ? vertices : null
}

/** La URL es la única fuente de verdad del ámbito elegido. */
export function leerEstado(busqueda) {
  const p = new URLSearchParams(busqueda)

  const tipo = p.get('t')
  const valor = p.get('v')
  if (tipo && valor && TIPOS.includes(tipo)) {
    return { modo: 'faceta', tipo, valor, poligono: null }
  }

  const crudo = p.get('p')
  if (crudo) {
    const poligono = parsearPoligono(crudo)
    if (poligono) return { modo: 'poligono', tipo: null, valor: null, poligono }
  }

  return { ...VACIO }
}

export function escribirEstado(estado) {
  if (estado.modo === 'faceta') {
    const p = new URLSearchParams({ t: estado.tipo, v: estado.valor })
    return `?${p.toString()}`
  }
  if (estado.modo === 'poligono') {
    const texto = estado.poligono.map(([lon, lat]) => `${lon},${lat}`).join(';')
    return `?p=${texto}`
  }
  return ''
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/lib/url.test.js`
Expected: PASS, 11 tests.

Nota: `escribirEstado` usa `URLSearchParams`, que codifica el espacio como `+`. El test lo refleja. Para el polígono se escribe a mano porque `,` y `;` son seguros y así el enlace queda legible.

- [ ] **Step 5: Commit**

```bash
git add src/lib/url.js src/lib/url.test.js
git commit -m "Estado del ámbito en la URL"
```

---

### Task 10: Mapa

**Files:**
- Create: `src/ui/mapa.js`
- Test: `src/ui/mapa.test.js`

**Interfaces:**
- Consumes: `LITE` de `esquema.js`; Leaflet.
- Produces:
  - `crearMapa(contenedor): {mapa, mostrarPozos(filas), limpiarPozos(), alDibujar(callback), encuadrar(filas)}`
  - `capasDeContexto(): Record<string, L.TileLayer>` — teselas WMS de la Secretaría, sólo visuales.

- [ ] **Step 1: Escribir el test que falla**

Archivo `src/ui/mapa.test.js`. Se prueba la construcción de la URL de teselas, que es lógica propia; no se prueba que Leaflet dibuje.

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { urlTeselasWms, CAPAS_CONTEXTO } from './mapa.js'

describe('urlTeselasWms', () => {
  it('apunta al WMS de la Secretaría', () => {
    expect(urlTeselasWms()).toContain('sig.energia.gob.ar/wmsenergia')
  })

  it('incluye STYLES vacío, que MapServer 8 exige', () => {
    expect(urlTeselasWms()).toMatch(/[?&]styles=(&|$)/i)
  })

  it('pide PNG transparente', () => {
    const u = urlTeselasWms()
    expect(u).toContain('format=image%2Fpng')
    expect(u).toContain('transparent=true')
  })
})

describe('CAPAS_CONTEXTO', () => {
  it('declara sólo capas de contexto, ninguna de pozos', () => {
    const nombres = Object.values(CAPAS_CONTEXTO).join(' ')
    expect(nombres).not.toContain('pozos')
  })

  it('incluye concesiones y ductos', () => {
    const capas = Object.values(CAPAS_CONTEXTO).join(' ')
    expect(capas).toContain('concesiones')
    expect(capas).toContain('ductos')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/ui/mapa.test.js`
Expected: FAIL — no resuelve `./mapa.js`

- [ ] **Step 3: Escribir `src/ui/mapa.js`**

```js
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LITE } from '../lib/esquema.js'

const WMS = 'https://sig.energia.gob.ar/wmsenergia'

/**
 * Capas del WMS que se pintan de fondo. Son sólo teselas: no se consultan.
 * El WMS no tiene datos que CKAN no tenga, y su cadena TLS está incompleta.
 */
export const CAPAS_CONTEXTO = {
  'Concesiones de explotación': 'planosbase_concesiones_explotacion',
  'Ductos de hidrocarburos': 'planosbase_ductos',
  'Yacimientos': 'planosbase_yacimientos',
}

/** MapServer 8 rechaza todo GetMap sin STYLES, aunque vaya vacío. */
export function urlTeselasWms() {
  return `${WMS}?service=WMS&version=1.3.0&request=GetMap&styles=&format=image%2Fpng&transparent=true`
}

function capaWms(capa) {
  return L.tileLayer.wms(WMS, {
    layers: capa,
    styles: '',
    format: 'image/png',
    transparent: true,
    version: '1.3.0',
  })
}

export function crearMapa(contenedor) {
  const mapa = L.map(contenedor).setView([-38.5, -68.5], 6)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18,
  }).addTo(mapa)

  const contexto = Object.fromEntries(
    Object.entries(CAPAS_CONTEXTO).map(([etiqueta, capa]) => [etiqueta, capaWms(capa)])
  )
  L.control.layers(null, contexto, { collapsed: true }).addTo(mapa)

  const grupoPozos = L.layerGroup().addTo(mapa)
  let alDibujarCallback = null

  return {
    mapa,

    mostrarPozos(filas) {
      grupoPozos.clearLayers()
      for (const f of filas) {
        L.circleMarker([f[LITE.LAT], f[LITE.LON]], {
          radius: 3, weight: 1, color: '#AD5520', fillOpacity: 0.7,
        }).addTo(grupoPozos)
      }
    },

    limpiarPozos() {
      grupoPozos.clearLayers()
    },

    encuadrar(filas) {
      if (filas.length === 0) return
      const limites = L.latLngBounds(filas.map((f) => [f[LITE.LAT], f[LITE.LON]]))
      mapa.fitBounds(limites, { padding: [24, 24] })
    },

    alDibujar(callback) {
      alDibujarCallback = callback
    },

    /** Dibujo de rectángulo: shift + arrastrar. Leaflet ya lo trae para zoom; acá se reusa. */
    habilitarDibujo() {
      mapa.on('boxzoom', () => {})
      mapa.boxZoom.disable()
      let inicio = null
      let rectangulo = null

      mapa.on('mousedown', (e) => {
        if (!e.originalEvent.shiftKey) return
        inicio = e.latlng
        mapa.dragging.disable()
      })

      mapa.on('mousemove', (e) => {
        if (!inicio) return
        if (rectangulo) rectangulo.remove()
        rectangulo = L.rectangle(L.latLngBounds(inicio, e.latlng), {
          color: '#0369A1', weight: 1, fillOpacity: 0.08,
        }).addTo(mapa)
      })

      mapa.on('mouseup', (e) => {
        if (!inicio) return
        const limites = L.latLngBounds(inicio, e.latlng)
        inicio = null
        mapa.dragging.enable()
        if (rectangulo) { rectangulo.remove(); rectangulo = null }
        const o = limites.getWest(), es = limites.getEast()
        const s = limites.getSouth(), n = limites.getNorth()
        const anillo = [[o, s], [es, s], [es, n], [o, n]]
        if (alDibujarCallback) alDibujarCallback(anillo)
      })
    },
  }
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `npx vitest run src/ui/mapa.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/mapa.js src/ui/mapa.test.js
git commit -m "Mapa con pozos del ámbito y teselas WMS de contexto"
```

---

### Task 11: Buscador, descarga y cableado

**Files:**
- Create: `src/ui/buscador.js`
- Create: `src/ui/descarga.js`
- Create: `src/main.js`
- Create: `src/style.css`
- Test: `src/ui/descarga.test.js`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces:
  - `crearBuscador(contenedor, facetas, alElegir): {limpiar()}`
  - `nombreArchivo(estado): string`
  - `descargarCsv(texto, nombre): void`
  - `crearPanelDescarga(contenedor): {mostrar(resumen), ocultar()}`

- [ ] **Step 1: Escribir el test que falla**

Archivo `src/ui/descarga.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { nombreArchivo } from './descarga.js'

describe('nombreArchivo', () => {
  it('usa el valor de la faceta, normalizado', () => {
    expect(nombreArchivo({ modo: 'faceta', tipo: 'area', valor: 'LOMA CAMPANA' }))
      .toBe('pozos-area-loma-campana.csv')
  })

  it('saca acentos del nombre', () => {
    expect(nombreArchivo({ modo: 'faceta', tipo: 'yacimiento', valor: 'CAÑADON SECO' }))
      .toBe('pozos-yacimiento-canadon-seco.csv')
  })

  it('nombra el recorte dibujado', () => {
    expect(nombreArchivo({ modo: 'poligono' })).toBe('pozos-recorte.csv')
  })

  it('tiene un nombre por defecto', () => {
    expect(nombreArchivo({ modo: 'vacio' })).toBe('pozos.csv')
  })
})
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `npx vitest run src/ui/descarga.test.js`
Expected: FAIL — no resuelve `./descarga.js`

- [ ] **Step 3: Escribir `src/ui/descarga.js`**

```js
import { normalizar } from '../lib/catalogo.js'

function aRanura(texto) {
  return normalizar(texto).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function nombreArchivo(estado) {
  if (estado.modo === 'faceta') return `pozos-${estado.tipo}-${aRanura(estado.valor)}.csv`
  if (estado.modo === 'poligono') return 'pozos-recorte.csv'
  return 'pozos.csv'
}

/** El BOM hace que Excel abra el archivo como UTF-8 en vez de romper los acentos. */
export function descargarCsv(texto, nombre) {
  const blob = new Blob(['﻿' + texto], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function crearPanelDescarga(contenedor) {
  contenedor.innerHTML = `
    <div class="descarga" hidden>
      <p class="descarga__resumen"></p>
      <button type="button" class="descarga__boton">Descargar CSV</button>
    </div>`
  const panel = contenedor.querySelector('.descarga')
  const resumen = contenedor.querySelector('.descarga__resumen')
  const boton = contenedor.querySelector('.descarga__boton')

  return {
    mostrar({ texto, alDescargar }) {
      resumen.textContent = texto
      boton.onclick = alDescargar
      panel.hidden = false
    },
    ocultar() {
      panel.hidden = true
    },
  }
}
```

- [ ] **Step 4: Escribir `src/ui/buscador.js`**

```js
import { buscar } from '../lib/catalogo.js'

const ETIQUETA = { area: 'Área', yacimiento: 'Yacimiento', empresa: 'Operadora' }

export function crearBuscador(contenedor, facetas, alElegir) {
  contenedor.innerHTML = `
    <label class="buscador">
      <span class="buscador__etiqueta">Buscar área, yacimiento u operadora</span>
      <input type="search" class="buscador__entrada" autocomplete="off"
             placeholder="Loma Campana, YPF, Cañadón Seco…" />
    </label>
    <ul class="buscador__resultados"></ul>`

  const entrada = contenedor.querySelector('.buscador__entrada')
  const lista = contenedor.querySelector('.buscador__resultados')

  function pintar(resultados) {
    lista.innerHTML = ''
    for (const r of resultados) {
      const li = document.createElement('li')
      const boton = document.createElement('button')
      boton.type = 'button'
      boton.className = 'buscador__opcion'
      boton.innerHTML =
        `<span class="buscador__tipo">${ETIQUETA[r.tipo]}</span>` +
        `<span class="buscador__valor"></span>` +
        `<span class="buscador__cantidad">${r.cantidad.toLocaleString('es-AR')} pozos</span>`
      boton.querySelector('.buscador__valor').textContent = r.valor
      boton.onclick = () => alElegir(r)
      li.appendChild(boton)
      lista.appendChild(li)
    }
  }

  entrada.addEventListener('input', () => pintar(buscar(facetas, entrada.value)))

  return {
    limpiar() {
      entrada.value = ''
      lista.innerHTML = ''
    },
  }
}
```

- [ ] **Step 5: Escribir `src/main.js`**

```js
import './style.css'
import { cargarCatalogo, construirFacetas } from './lib/catalogo.js'
import { porFaceta, porPoligono, cuencasDe } from './lib/ambito.js'
import { cargarDetalle } from './lib/detalle.js'
import { construirCsv } from './lib/csv.js'
import { leerEstado, escribirEstado } from './lib/url.js'
import { LITE } from './lib/esquema.js'
import { crearMapa } from './ui/mapa.js'
import { crearBuscador } from './ui/buscador.js'
import { crearPanelDescarga, nombreArchivo, descargarCsv } from './ui/descarga.js'

const app = document.querySelector('#app')
app.innerHTML = `
  <header class="cabecera">
    <h1>Pozos de hidrocarburos de Argentina</h1>
    <p class="cabecera__bajada">
      Elegí un área, un yacimiento, una operadora o dibujá un recorte con Shift + arrastrar,
      y bajate el CSV con la producción acumulada de cada pozo.
    </p>
  </header>
  <div class="panel">
    <div id="buscador"></div>
    <div id="descarga"></div>
    <p class="pie" id="pie"></p>
  </div>
  <div id="mapa" class="mapa"></div>`

const catalogo = await cargarCatalogo()
const facetas = construirFacetas(catalogo)

const mapa = crearMapa(document.querySelector('#mapa'))
mapa.habilitarDibujo()
const panel = crearPanelDescarga(document.querySelector('#descarga'))

const m = catalogo.manifiesto
document.querySelector('#pie').textContent =
  `${m.pozos.toLocaleString('es-AR')} pozos · producción hasta ${String(m.ultimoPeriodo).slice(4)}/` +
  `${String(m.ultimoPeriodo).slice(0, 4)} · datos generados el ${m.generado.slice(0, 10)}. ` +
  'Sitio no oficial: no representa a la Secretaría de Energía.'

async function aplicar(estado, { empujarHistorial = true } = {}) {
  const ids = estado.modo === 'faceta'
    ? porFaceta(catalogo, estado.tipo, estado.valor)
    : estado.modo === 'poligono'
      ? porPoligono(catalogo, estado.poligono)
      : []

  if (ids.length === 0) {
    mapa.limpiarPozos()
    panel.ocultar()
    return
  }

  const filasLite = ids.map((id) => catalogo.porId.get(id)).filter(Boolean)
  mapa.mostrarPozos(filasLite)
  mapa.encuadrar(filasLite)

  if (empujarHistorial) {
    history.pushState(estado, '', escribirEstado(estado) || location.pathname)
  }

  const etiqueta = estado.modo === 'faceta' ? estado.valor : 'el recorte dibujado'
  panel.mostrar({
    texto: `${ids.length.toLocaleString('es-AR')} pozos en ${etiqueta}.`,
    alDescargar: async () => {
      const detalle = await cargarDetalle(cuencasDe(catalogo, ids))
      const filas = ids.map((id) => detalle.get(id)).filter(Boolean)
      const csv = construirCsv({ filas, dicts: catalogo.dicts, catalogo })
      descargarCsv(csv, nombreArchivo(estado))
    },
  })
}

crearBuscador(document.querySelector('#buscador'), facetas, (faceta) => {
  aplicar({ modo: 'faceta', tipo: faceta.tipo, valor: faceta.valor, poligono: null })
})

mapa.alDibujar((anillo) => {
  aplicar({ modo: 'poligono', tipo: null, valor: null, poligono: anillo })
})

window.addEventListener('popstate', () => {
  aplicar(leerEstado(location.search), { empujarHistorial: false })
})

await aplicar(leerEstado(location.search), { empujarHistorial: false })
```

- [ ] **Step 6: Escribir `src/style.css`**

```css
:root {
  --tinta: #131a20;
  --papel: #eef0f1;
  --superficie: #ffffff;
  --cobre: #ad5520;
  --petroleo: #0369a1;
  --apagado: #5b6872;
  --linea: #d5dade;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  display: grid;
  grid-template-rows: auto 1fr;
  min-height: 100vh;
  background: var(--papel);
  color: var(--tinta);
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}

#app { display: contents; }

.cabecera { padding: 20px 24px 8px; }
.cabecera h1 { margin: 0; font-size: 22px; letter-spacing: -0.01em; }
.cabecera__bajada { margin: 6px 0 0; color: var(--apagado); max-width: 62ch; font-size: 14.5px; }

.panel {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
  padding: 12px 24px 16px;
}

.buscador { display: block; }
.buscador__etiqueta {
  display: block;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--apagado);
  margin-bottom: 5px;
}
.buscador__entrada {
  width: min(420px, 90vw);
  padding: 9px 12px;
  border: 1px solid var(--linea);
  border-radius: 3px;
  background: var(--superficie);
  color: inherit;
  font: inherit;
}
.buscador__entrada:focus-visible { outline: 2px solid var(--cobre); outline-offset: 1px; }

.buscador__resultados {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
  width: min(420px, 90vw);
}
.buscador__opcion {
  display: grid;
  grid-template-columns: 78px 1fr auto;
  gap: 10px;
  align-items: baseline;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-bottom: 1px solid var(--linea);
  background: var(--superficie);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.buscador__opcion:hover { background: #f5f7f8; }
.buscador__tipo { font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--cobre); }
.buscador__cantidad { font-size: 12px; color: var(--apagado); font-variant-numeric: tabular-nums; }

.descarga {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--superficie);
  border: 1px solid var(--linea);
  border-radius: 3px;
}
.descarga__resumen { margin: 0; font-size: 14px; }
.descarga__boton {
  padding: 8px 16px;
  border: 0;
  border-radius: 3px;
  background: var(--cobre);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.descarga__boton:focus-visible { outline: 2px solid var(--tinta); outline-offset: 2px; }

.pie { flex-basis: 100%; margin: 0; font-size: 12px; color: var(--apagado); }

.mapa { width: 100%; height: 100%; min-height: 420px; }

[hidden] { display: none !important; }
```

- [ ] **Step 7: Correr todos los tests**

Run: `npm test`
Expected: PASS en todos los archivos.

- [ ] **Step 8: Levantar el sitio y probarlo a mano**

Run: `npm run dev`

Verificar, en este orden:
1. El pie muestra la cantidad de pozos y la fecha del build.
2. Escribir "loma" ofrece resultados con su conteo.
3. Elegir uno pinta los pozos en el mapa y encuadra.
4. La URL cambió y recargar reproduce lo mismo.
5. El botón baja un CSV que abre bien en una planilla, con acentos correctos.
6. Shift + arrastrar sobre el mapa selecciona los pozos de adentro.
7. La consola no muestra ningún pedido a `datos.energia.gob.ar`.

- [ ] **Step 9: Commit**

```bash
git add src/ui/buscador.js src/ui/descarga.js src/ui/descarga.test.js src/main.js src/style.css
git commit -m "Buscador, panel de descarga y cableado de la aplicación"
```

---

### Task 12: Reglas de producto, README y test de contrato

**Files:**
- Create: `docs/reglas/README.md`
- Create: `docs/reglas/datos.md`
- Create: `tests/contrato/origen.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: `sql` de `ckan.mjs`; `resolverRecursos`; `sqlAgregado`, `sqlPozos`.
- Produces: nada que consuma otro código.

- [ ] **Step 1: Escribir `docs/reglas/datos.md`**

```markdown
# Reglas de datos

## D1 — La geometría válida es `geojson`

La geometría de un pozo se lee de la columna `geojson` de la tabla de pozos.

Las columnas `coordenadax` y `coordenaday` de la tabla de producción **están
transpuestas**: guardan la latitud en `coordenadax` y la longitud en `coordenaday`.
Se verificó sobre 5.089 pozos: 5.088 están invertidos. No se usan nunca.

## D2 — Un pozo sin producción no se oculta

La fusión entre pozos y producción es un `LEFT JOIN`. Un pozo sin ninguna fila de
producción declarada aparece con `meses = 0` y acumulados en cero.

Son unos 520 pozos. Con `INNER JOIN` desaparecían sin que nadie se entere.

## D3 — El sitio no consulta el origen en runtime

Todo dato mostrado o descargado proviene de un artefacto generado por
`npm run build:index`. Ningún módulo bajo `src/` puede pedirle nada a
`datos.energia.gob.ar`.

`https://datos.energia.gob.ar` responde 301 hacia `http://`, y el navegador bloquea
ese descenso por mixed content. La fecha del build es visible en el pie del sitio.

## D4 — El build falla antes que publicar datos incompletos

El paquete de producción tiene 44 recursos con duplicados. Dos se llaman casi igual y
se distinguen por un guión: uno trae 90.000 filas y el otro 991.844.

Ante cualquier duda —un año faltante, un volcado por debajo del piso, una tabla que no
existe— el build aborta con código distinto de cero.
```

- [ ] **Step 2: Escribir `docs/reglas/README.md`**

```markdown
# Reglas de producto

Decisiones numeradas del dueño del producto. Cada una explica qué se decidió y por qué.

- [Reglas de datos](datos.md) — D1 a D4: geometría, pozos sin producción, origen en
  runtime y comportamiento del build ante datos dudosos.
```

- [ ] **Step 3: Escribir `tests/contrato/origen.test.mjs`**

```js
import { describe, it, expect } from 'vitest'
import { sql, existeRecurso } from '../../scripts/lib/ckan.mjs'
import { resolverRecursos } from '../../scripts/lib/recursos.mjs'
import { sqlPozos, sqlAgregado } from '../../scripts/lib/consultas.mjs'
import { RECURSO_POZOS, ANIO_DESDE } from '../../src/lib/esquema.js'

/**
 * Estos tests pegan contra el origen vivo. No corren en `npm test`.
 * Son la alarma de que la Secretaría de Energía cambió algo.
 */
describe('contrato con el origen', () => {
  it('la tabla de pozos sigue existiendo', async () => {
    expect(await existeRecurso(RECURSO_POZOS)).toBe(true)
  })

  it('la tabla de pozos conserva las columnas que usamos', async () => {
    const [fila] = await sql(sqlPozos(1, 0))
    for (const c of ['idpozo', 'sigla', 'empresa', 'area', 'yacimiento',
                     'cuenca', 'provincia', 'tipo_recurso', 'tipoestado',
                     'formacion', 'profundidad', 'geojson']) {
      expect(fila, `falta la columna ${c}`).toHaveProperty(c)
    }
  })

  it('el geojson sigue siendo un punto parseable', async () => {
    const [fila] = await sql(sqlPozos(1, 0))
    const g = JSON.parse(fila.geojson)
    expect(g.type).toBe('Point')
    expect(g.coordinates).toHaveLength(2)
  })

  it('sigue habiendo un recurso de producción por año', async () => {
    const anioHasta = new Date().getFullYear()
    const recursos = await resolverRecursos({ anioDesde: ANIO_DESDE, anioHasta })
    expect(recursos).toHaveLength(anioHasta - ANIO_DESDE + 1)
  })

  it('el agregado devuelve las columnas esperadas', async () => {
    const anioHasta = new Date().getFullYear()
    const recursos = await resolverRecursos({ anioDesde: anioHasta, anioHasta })
    const consulta = `${sqlAgregado(recursos)}\nLIMIT 1`
    const [fila] = await sql(consulta)
    for (const c of ['idpozo', 'meses', 'prim', 'ult', 'pet', 'gas', 'agua', 'tef']) {
      expect(fila, `falta la columna ${c}`).toHaveProperty(c)
    }
  })

  it('el recurso del año en curso no encogió', async () => {
    const anioHasta = new Date().getFullYear()
    const [recurso] = await resolverRecursos({ anioDesde: anioHasta, anioHasta })
    expect(recurso.filas).toBeGreaterThan(50000)
  })
})
```

- [ ] **Step 4: Correr el test de contrato**

Run: `npm run test:contrato`
Expected: PASS, 6 tests. Tarda un par de minutos. Si falla, el origen cambió y hay que mirar qué.

- [ ] **Step 5: Actualizar `README.md`**

Reemplazar la sección "Estado" por:

```markdown
## Estado

Funcionando. El sitio busca sobre 85.611 pozos, los pinta en el mapa y arma el CSV en
el navegador. No hace ninguna llamada al origen: todo sale de artefactos generados por
`npm run build:index`.

## Cómo se usa

```bash
npm install
npm run build:index   # baja del origen y arma public/ — tarda varios minutos
npm run dev
```

`npm test` corre los tests unitarios, sin red. `npm run test:contrato` pega contra el
origen vivo para verificar que nada cambió del otro lado.

Las reglas de datos están en [`docs/reglas/datos.md`](docs/reglas/datos.md).
```

- [ ] **Step 6: Commit**

```bash
git add docs/reglas README.md tests/contrato
git commit -m "Reglas de datos, test de contrato y documentación de uso"
```

---

## Self-Review

**Cobertura del spec:**

| Requisito del spec | Tarea |
|---|---|
| Resolver el recurso autoritativo por año | 3 |
| Volcado paginado de pozos | 5 |
| Agregado de producción en una consulta | 5 |
| Fusión con `LEFT JOIN` y diccionarios | 4 |
| Partición por cuenca | 4, 5 |
| `manifiesto.json` con fecha y conteos | 5 |
| Búsqueda por área, yacimiento y operadora | 6, 11 |
| Selección por polígono | 7, 10, 11 |
| Carga de detalle bajo demanda | 8 |
| CSV con `lon`/`lat` y escapado | 8 |
| Estado en la URL | 9 |
| Teselas WMS de contexto | 10 |
| Guardas del build | 2, 3, 5 |
| Reglas de producto | 12 |
| Test de contrato | 12 |
| Fecha del build visible | 11 |

Sin huecos.

**Consistencia de tipos:** `LITE` y `FULL` se definen una sola vez en `src/lib/esquema.js` y los importan tanto el build como el sitio. `nombreArchivoCuenca` está duplicado a propósito entre `scripts/lib/artefactos.mjs` y `src/lib/detalle.js` —el build no debe importar del bundle del navegador ni al revés— y la Task 8 lo dice explícitamente; si una cambia, la otra rompe y el sitio no encuentra las particiones. Vale un test de equivalencia si alguna vez se toca.

**Riesgo conocido:** `indiceDe` usa `Array.indexOf`, que es O(n) sobre el diccionario. Con 1.184 yacimientos y 85.611 pozos son del orden de 10⁸ comparaciones en el peor caso. Si `npm run build:index` tarda de más en el paso de construcción de artefactos, reemplazar los arrays por `Map` de valor a índice y volcar a array al final. No se optimiza antes de medir.
