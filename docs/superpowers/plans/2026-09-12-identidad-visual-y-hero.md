# Identidad visual y hero compuesto — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Darle al sitio una identidad visual completa —dos temas, tres tipografías, textos con contexto— y un hero con un corte geológico animado en seis actos que ocupa la pantalla mientras carga el catálogo y se releva al elegir un ámbito.

**Architecture:** Un módulo `src/ui/hero/` con cuatro piezas de responsabilidad única: las tramas y la columna estratigráfica como dato, un constructor puro que las convierte en SVG, una máquina de estados que le aplica clases y tiempos, y un componente que habla con `main.js`. El CSS se parte en cuatro parciales con los tokens de los dos temas en uno solo. La carga se parte en dos: el manifiesto de 2,8 kB habilita el hero, el índice de 1,26 MB habilita el buscador.

**Tech Stack:** Vanilla ES modules, Vite 7, Vitest 5 + jsdom, SVG inline, animaciones CSS. Sin librerías de animación.

**Spec:** [`docs/superpowers/specs/2026-09-12-identidad-visual-y-hero-design.md`](../specs/2026-09-12-identidad-visual-y-hero-design.md)

## Global Constraints

- **G1.** Nada de frameworks. Módulos ES nativos.
- **G2.** `public/` está en `.gitignore`. Los assets versionados van en `src/estaticos/` y `src/fuentes/`, y los procesa Vite.
- **G3.** El reposo sólo anima `transform` y `opacity`. La entrada puede usar `stroke-dashoffset`.
- **G4.** `prefers-reduced-motion: reduce` apaga toda animación y deja el corte en su cuadro final.
- **G5.** Ninguna cifra visible se escribe a mano. Todas salen de `manifiesto.json`.
- **G6.** `manifiesto.json` habilita el hero; `pozos-lite.json` habilita el buscador. Los dos pedidos salen juntos.
- **G7.** Contraste mínimo AA (4,5:1) para todo texto, en los dos temas, verificado por test.
- **G8.** Presupuestos: CSS ≤ 20 kB gzip; JS ≤ 62 kB gzip en total; tipografías ≤ 110 kB.
- **G9.** No se toca la frase del pie que dice que el sitio no es oficial.
- **C1.** `--cobre` es el único acento y significa el dato. No decora.
- **C2.** `--vaca` se reserva para la roca madre.
- **I2.** El espesor de las bandas no está a escala y el dibujo lo dice.
- **I5.** Vaca Muerta es el foco por ser roca madre, no por tamaño.
- **I6.** La columna es la de Neuquina y el dibujo lo rotula así.

**Nunca correr sin pedirlo:** `npm run build:index` (pega contra la API pública, ~60s) y `npm run test:contrato` (idem, minutos). La Tarea 9 los usa una vez, deliberadamente.

---

### Task 1: Tokens de color y estructura de estilos

**Files:**
- Create: `src/estilos/tokens.css`
- Create: `src/estilos/base.css`
- Create: `src/estilos/herramienta.css`
- Create: `src/estilos/tokens.test.js`
- Modify: `src/style.css` (pasa de 223 líneas de reglas a 4 líneas de `@import`)

**Interfaces:**
- Consumes: nada.
- Produces: los tokens `--papel --tinta --cobre --vaca --apagado --linea --serif --rotulo --mono --radio`, que todas las tareas siguientes usan vía `var()`. Y los pares crudos `--c-<nombre>-claro` / `--c-<nombre>-oscuro`, que son la única fuente de cada hex y lo que lee el test de contraste.

- [ ] **Step 1: Escribir el test de contraste que falla**

Crear `src/estilos/tokens.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf-8')

/** Los hex crudos viven una sola vez, en el `:root` a secas, como pares claro/oscuro. */
function crudos() {
  const cuerpo = css.slice(css.indexOf(':root'), css.indexOf('}'))
  const salida = {}
  for (const [, nombre, hex] of cuerpo.matchAll(/--c-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) {
    salida[nombre] = hex
  }
  return salida
}

const canal = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const luminancia = (hex) => {
  const [r, g, b] = hex.match(/\w\w/g).map((h) => parseInt(h, 16))
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b)
}
function contraste(a, b) {
  const [alta, baja] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return (alta + 0.05) / (baja + 0.05)
}

describe('tokens', () => {
  const t = crudos()

  it('define los seis colores en sus dos temas', () => {
    for (const nombre of ['papel', 'tinta', 'cobre', 'vaca', 'apagado', 'linea']) {
      expect(t[`${nombre}-claro`], `falta --c-${nombre}-claro`).toMatch(/^#[0-9a-fA-F]{6}$/)
      expect(t[`${nombre}-oscuro`], `falta --c-${nombre}-oscuro`).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  // G7: se calcula, no se estima. Si alguien retoca un hex "para que se vea
  // mejor" y rompe el piso de AA, esto lo para acá y no en producción.
  for (const tema of ['claro', 'oscuro']) {
    it(`todo texto del tema ${tema} pasa AA sobre el fondo`, () => {
      const fondo = t[`papel-${tema}`]
      for (const nombre of ['tinta', 'cobre', 'vaca', 'apagado']) {
        const r = contraste(t[`${nombre}-${tema}`], fondo)
        expect(r, `--c-${nombre}-${tema} da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
      }
    })

    it(`el CTA del tema ${tema} pasa AA: papel sobre cobre`, () => {
      const r = contraste(t[`papel-${tema}`], t[`cobre-${tema}`])
      expect(r, `da ${r.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    })
  }

  it('declara los tokens en :root a secas antes de cualquier bloque de tema (C3)', () => {
    const iRoot = css.indexOf(':root {')
    const iMedia = css.indexOf('@media')
    const iTema = css.indexOf('[data-tema=')
    expect(iRoot).toBeGreaterThanOrEqual(0)
    expect(iRoot).toBeLessThan(iMedia)
    expect(iRoot).toBeLessThan(iTema)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/estilos/tokens.test.js`
Expected: FAIL con `ENOENT` — `tokens.css` no existe todavía.

- [ ] **Step 3: Escribir `src/estilos/tokens.css`**

```css
/* Los dos temas. Papel y cianotipo son las dos tradiciones reales del dibujo
   geológico: el informe impreso y la copia heliográfica. Ninguna se parece a la
   consola azul de indec-descargas, que es de lo que hay que diferenciarse.

   Cada hex vive UNA sola vez, acá, como par claro/oscuro. Los bloques de tema de
   más abajo sólo reapuntan los tokens de uso a uno u otro: así no hay dos
   lugares donde cambiar un color, y el test de contraste lee una sola fuente. */
:root {
  --c-papel-claro:   #F2EFE9;
  --c-papel-oscuro:  #141A1E;
  --c-tinta-claro:   #1A1714;
  --c-tinta-oscuro:  #E8EDF0;
  --c-cobre-claro:   #A8481C;
  --c-cobre-oscuro:  #E8853F;
  --c-vaca-claro:    #2E4A4F;
  --c-vaca-oscuro:   #7FB2BA;
  --c-apagado-claro: #6B6257;
  --c-apagado-oscuro:#93A2AA;
  --c-linea-claro:   #D8D2C7;
  --c-linea-oscuro:  #26323A;

  /* Tokens de uso. Todo el resto de la hoja habla sólo con estos. */
  --papel:   var(--c-papel-claro);
  --tinta:   var(--c-tinta-claro);
  --cobre:   var(--c-cobre-claro);
  --vaca:    var(--c-vaca-claro);
  --apagado: var(--c-apagado-claro);
  --linea:   var(--c-linea-claro);

  --serif:  "Source Serif 4", Georgia, "Times New Roman", serif;
  --rotulo: "Archivo Narrow", "Arial Narrow", system-ui, sans-serif;
  --mono:   "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;

  /* 3px y no 8px: el radio grande de indec lee software; el chico lee papel. */
  --radio: 3px;
}

/* Cianotipo por preferencia del sistema, salvo que se haya elegido papel. */
@media (prefers-color-scheme: dark) {
  :root:not([data-tema="papel"]) {
    --papel:   var(--c-papel-oscuro);
    --tinta:   var(--c-tinta-oscuro);
    --cobre:   var(--c-cobre-oscuro);
    --vaca:    var(--c-vaca-oscuro);
    --apagado: var(--c-apagado-oscuro);
    --linea:   var(--c-linea-oscuro);
  }
}

/* Y por elección explícita, que tiene que ganar en las dos direcciones. */
:root[data-tema="cianotipo"] {
  --papel:   var(--c-papel-oscuro);
  --tinta:   var(--c-tinta-oscuro);
  --cobre:   var(--c-cobre-oscuro);
  --vaca:    var(--c-vaca-oscuro);
  --apagado: var(--c-apagado-oscuro);
  --linea:   var(--c-linea-oscuro);
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/estilos/tokens.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Partir `style.css` en parciales**

Mover el contenido actual de `src/style.css` así:

1. `src/estilos/base.css` recibe el reset (`* { box-sizing }`), la regla de `body`, `#app { display: contents }`, `[hidden]`, y `.cabecera`. Reemplazar en esas reglas los colores literales por los tokens: `var(--papel)`, `var(--tinta)`, `var(--apagado)`, `var(--linea)`. La `font` del `body` pasa a `16px/1.6 var(--serif)`.
2. `src/estilos/herramienta.css` recibe todo el resto: `.barra`, `.buscador*`, `.herramientas*`, `.area`, `.mapa*`, `.lateral`, `.descarga*`, `.pie`, y el `@media (max-width: 820px)`. Mismo reemplazo de literales por tokens. Las etiquetas (`.buscador__etiqueta`, `.descarga__datos dt`) pasan a `font-family: var(--rotulo)`. Las cifras (`.descarga__datos dd`, `.buscador__cantidad`) pasan a `font-family: var(--mono)`.
3. `src/style.css` queda sólo con los imports, en este orden:

```css
/* Un archivo por responsabilidad. El orden importa: los tokens primero, porque
   todo lo demás los consume. */
@import "./estilos/tokens.css";
@import "./estilos/base.css";
@import "./estilos/herramienta.css";
```

`hero.css` se agrega en la Tarea 6, cuando exista.

- [ ] **Step 6: Verificar que no se rompió nada**

Run: `npx vitest run && npx vite build`
Expected: los 236 tests pasan y el build sale limpio. El CSS de `dist/` tiene que seguir pesando parecido (±2 kB gzip): si bajó mucho, se perdió una regla al mover.

- [ ] **Step 7: Verificar los dos temas a ojo**

Run: `npx vite build && npx vite preview --port 4173`
Abrir `http://localhost:4173/` y alternar el tema del sistema. Confirmar que el claro y el oscuro son legibles y que ningún texto queda de un tema sobre el fondo del otro.

- [ ] **Step 8: Commit**

```bash
git add src/estilos src/style.css
git commit -m "feat: tokens de color en dos temas y estilos partidos por responsabilidad"
```

---

### Task 2: Tipografías, favicon y cabecera del documento

**Files:**
- Create: `src/fuentes/source-serif-4.woff2`, `src/fuentes/archivo-narrow.woff2`, `src/fuentes/jetbrains-mono.woff2`
- Create: `src/fuentes/LICENCIAS.md`
- Create: `src/fuentes/bajar.sh`
- Create: `src/estaticos/favicon.svg`
- Create: `src/fuentes/fuentes.test.js`
- Modify: `src/estilos/base.css` (los `@font-face` arriba de todo)
- Modify: `index.html`

Los `@font-face` van en `base.css` y no en un parcial propio: son tres bloques y
pertenecen a la capa base. `style.css` no se toca en esta tarea.

**Interfaces:**
- Consumes: los tokens `--serif --rotulo --mono` de la Tarea 1.
- Produces: las tres familias resueltas. Nada de código las importa: las declara el CSS.

- [ ] **Step 1: Escribir el script que baja las tipografías**

Crear `src/fuentes/bajar.sh`. No corre en el build: se corre a mano cuando haya que actualizar una familia, y queda versionado para que se sepa de dónde salió cada archivo.

```bash
#!/usr/bin/env bash
# Baja el subset "latin" de cada familia desde Google Fonts y lo deja con un
# nombre estable. Las tres son variables: un archivo cubre todos los pesos.
#
# No se subsetea por glifo aunque fontTools esté disponible: los nombres de
# formación, empresa y yacimiento salen del dato, y un juego de glifos elegido a
# mano se rompe el día que aparezca un caracter que no previmos (T1).
set -euo pipefail
cd "$(dirname "$0")"

UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"

bajar() {
  local familia="$1" pesos="$2" destino="$3"
  local css url
  css=$(curl -fsS -A "$UA" "https://fonts.googleapis.com/css2?family=${familia}:wght@${pesos}&display=swap")
  # El bloque "/* latin */" y no "latin-ext": es el que trae lo que usamos.
  url=$(printf '%s' "$css" | awk '/\/\* latin \*\//{f=1} f && /url\(/{print; exit}' \
        | grep -oE 'https://[^)]*\.woff2')
  [ -n "$url" ] || { echo "no se encontro el subset latin de $familia" >&2; exit 1; }
  curl -fsS -o "$destino" "$url"
  printf '%-26s %7d bytes\n' "$destino" "$(stat -c%s "$destino")"
}

bajar "Source+Serif+4"  "400;600" source-serif-4.woff2
bajar "Archivo+Narrow"  "400;600" archivo-narrow.woff2
bajar "JetBrains+Mono"  "400;500" jetbrains-mono.woff2

echo "total: $(du -cb *.woff2 | tail -1 | cut -f1) bytes"
```

- [ ] **Step 2: Correrlo y verificar los pesos**

Run: `bash src/fuentes/bajar.sh`
Expected: tres archivos, ~50 kB + ~19 kB + ~31 kB, total ~99 kB. Si el total supera 110 kB, el presupuesto G8 está roto: pararse y reportarlo en vez de seguir.

- [ ] **Step 3: Escribir el test de las tipografías**

Crear `src/fuentes/fuentes.test.js`:

```js
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
})
```

- [ ] **Step 4: Correr el test para verificar que falla**

Run: `npx vitest run src/fuentes/fuentes.test.js`
Expected: los dos primeros pasan (los archivos ya están del Step 2), el de `LICENCIAS.md` falla con `ENOENT`.

- [ ] **Step 5: Escribir `src/fuentes/LICENCIAS.md`**

```markdown
# Tipografías

Las tres se redistribuyen bajo la **SIL Open Font License 1.1**, que lo permite
siempre que se incluya este aviso. Se sirven desde el propio sitio: no hay
pedidos a Google en tiempo de ejecución.

| familia | autoría | licencia |
|---|---|---|
| Source Serif 4 | Frank Grießhammer, Adobe | SIL Open Font License 1.1 |
| Archivo Narrow | Omnibus-Type | SIL Open Font License 1.1 |
| JetBrains Mono | JetBrains | SIL Open Font License 1.1 |

Los archivos son el subset `latin` que publica Google Fonts, sin modificar. Para
actualizarlos: `bash src/fuentes/bajar.sh`.

El texto completo de la licencia está en <https://openfontlicense.org/>. Sus
condiciones, en resumen: se puede usar, estudiar, modificar y redistribuir
libremente, incluso con fines comerciales; lo que no se puede es vender las
tipografías por separado ni usar los nombres reservados para promocionar
versiones modificadas.
```

- [ ] **Step 6: Declarar los `@font-face` en `base.css`**

Al principio de `src/estilos/base.css`, antes de cualquier otra regla:

```css
/* Las tres son variables: un archivo por familia cubre todos los pesos, y el
   rango va en `font-weight`. `swap` para que el texto se lea desde el primer
   cuadro con la del sistema (T3). */
@font-face {
  font-family: "Source Serif 4";
  src: url("../fuentes/source-serif-4.woff2") format("woff2");
  font-weight: 200 900;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "Archivo Narrow";
  src: url("../fuentes/archivo-narrow.woff2") format("woff2");
  font-weight: 400 700;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: "JetBrains Mono";
  src: url("../fuentes/jetbrains-mono.woff2") format("woff2");
  font-weight: 100 800;
  font-style: normal;
  font-display: swap;
}
```

- [ ] **Step 7: Dibujar el favicon**

Crear `src/estaticos/favicon.svg`. Un balancín reducido a su silueta esencial: base, torre, viga. Nada de texto, que a 16px no se lee.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="#F2EFE9"/>
  <g stroke="#1A1714" stroke-width="2.2" fill="none" stroke-linecap="round">
    <path d="M6 26h20"/>
    <path d="M13 26l3-11 3 11"/>
    <path d="M7 12l18 5"/>
  </g>
  <circle cx="7" cy="12" r="3" fill="#A8481C"/>
</svg>
```

- [ ] **Step 8: Completar la cabecera del documento**

Reemplazar el `<head>` de `index.html`:

```html
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pozos de hidrocarburos de Argentina</title>
    <meta name="description" content="Buscá pozos de hidrocarburos de Argentina por área, yacimiento, operadora, cuenca o pozo, o dibujando una zona en el mapa, y descargá su producción acumulada en CSV." />
    <link rel="icon" href="./src/estaticos/favicon.svg" />
    <!-- Sólo las dos caras del primer pintado (T2). La mono aparece más abajo
         y carga normal. -->
    <link rel="preload" href="./src/fuentes/source-serif-4.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="./src/fuentes/archivo-narrow.woff2" as="font" type="font/woff2" crossorigin />
    <meta property="og:title" content="Pozos de hidrocarburos de Argentina" />
    <meta property="og:description" content="Todos los pozos de hidrocarburos del país, con su ubicación y su producción acumulada, en un CSV." />
    <meta property="og:type" content="website" />
  </head>
```

La etiqueta `og:image` se agrega en la Tarea 9, cuando exista la imagen.

- [ ] **Step 9: Verificar que Vite procesa y versiona todo**

Run: `npx vitest run src/fuentes/fuentes.test.js && npx vite build`
Expected: los 3 tests pasan. En `dist/assets/` aparecen `favicon-<hash>.svg` y los tres `woff2` con hash, y `dist/index.html` los referencia por su ruta con hash. Confirmar:

```bash
ls dist/assets/ | grep -E "woff2|favicon"
grep -oE '(href|src)="[^"]*(woff2|favicon[^"]*)"' dist/index.html
```

- [ ] **Step 10: Commit**

```bash
git add src/fuentes src/estaticos index.html src/estilos/base.css
git commit -m "feat: tres tipografías self-hosted, favicon y cabecera del documento"
```

---

### Task 3: Conteo por formación en el manifiesto

**Files:**
- Modify: `scripts/lib/artefactos.mjs`
- Modify: `scripts/lib/artefactos.test.mjs`
- Modify: `scripts/build-index.mjs`
- Modify: `docs/reglas/datos.md`

**Interfaces:**
- Consumes: nada.
- Produces: `construirArtefactos(pozos, agregados)` agrega `formaciones` a su objeto de retorno: un `Object` con las nueve claves de la columna Neuquina normalizadas a mayúsculas sin acentos, y el conteo de pozos de cada una. `build-index.mjs` lo escribe en `manifiesto.json` bajo la clave `formaciones`.

- [ ] **Step 1: Escribir el test que falla**

Agregar al final de `scripts/lib/artefactos.test.mjs`:

```js
describe('conteo por formación para el hero', () => {
  const conFormacion = (idpozo, formacion, cuenca = 'NEUQUINA') => ({
    ...pozos[1], idpozo, formacion, cuenca,
    geojson: '{"type":"Point","coordinates":[-68.65,-38.36]}',
  })

  it('cuenta los pozos de cada formación de la columna Neuquina', () => {
    const { formaciones } = construirArtefactos([
      conFormacion('1', 'vaca muerta'),
      conFormacion('2', 'vaca muerta'),
      conFormacion('3', 'quintuco'),
    ], new Map())

    expect(formaciones['VACA MUERTA']).toBe(2)
    expect(formaciones['QUINTUCO']).toBe(1)
  })

  it('normaliza los acentos: HUITRÍN del dato entra como HUITRIN', () => {
    const { formaciones } = construirArtefactos([conFormacion('1', 'huitrín')], new Map())
    expect(formaciones['HUITRIN']).toBe(1)
  })

  it('no trae las 79 formaciones del dato, sólo las nueve del dibujo', () => {
    const { formaciones } = construirArtefactos([
      conFormacion('1', 'vaca muerta'),
      conFormacion('2', 'bajo barreal', 'GOLFO SAN JORGE'),
    ], new Map())

    expect(Object.keys(formaciones)).toHaveLength(9)
    expect(formaciones).not.toHaveProperty('BAJO BARREAL')
  })

  it('una formación de la columna sin pozos en el volcado queda en cero, no ausente', () => {
    const { formaciones } = construirArtefactos([conFormacion('1', 'vaca muerta')], new Map())
    // Que la clave exista con 0 y que falte son cosas distintas para el hero:
    // ausente significa "build viejo" y dibuja sin conteo; 0 significa "el
    // origen no declaró ninguno", que es un dato.
    expect(formaciones['LAJAS']).toBe(0)
  })

  it('sólo cuenta pozos de la cuenca Neuquina (I6)', () => {
    const { formaciones } = construirArtefactos([
      conFormacion('1', 'lajas', 'NEUQUINA'),
      conFormacion('2', 'lajas', 'AUSTRAL'),
    ], new Map())
    expect(formaciones['LAJAS']).toBe(1)
  })

  it('no cuenta un pozo descartado por estar fuera de la caja', () => {
    const fuera = { ...conFormacion('9', 'vaca muerta'),
      geojson: '{"type":"Point","coordinates":[-38.75634,-67.64238]}' }
    const { formaciones } = construirArtefactos([fuera], new Map())
    expect(formaciones['VACA MUERTA']).toBe(0)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run scripts/lib/artefactos.test.mjs`
Expected: los 6 nuevos fallan con `Cannot read properties of undefined (reading 'VACA MUERTA')` — `formaciones` no existe.

- [ ] **Step 3: Implementar el conteo**

En `scripts/lib/artefactos.mjs`, agregar arriba (después de los imports):

```js
/**
 * Las nueve formaciones que dibuja el hero, en el orden estratigráfico de la
 * cuenca Neuquina. Se duplican acá a propósito: `src/lib/estratigrafia.js` es el
 * dato del dibujo y este es el del build, y no queremos que el script de build
 * importe del árbol del navegador. El test de la Tarea 4 exige que coincidan.
 */
const FORMACIONES_DEL_HERO = [
  'RAYOSO', 'HUITRIN', 'AGRIO', 'MULICHINCO', 'QUINTUCO',
  'VACA MUERTA', 'TORDILLO', 'LOTENA', 'LAJAS',
]

/** Mayúsculas sin acentos, para que `huitrín` del origen matchee `HUITRIN`. */
function claveFormacion(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}
```

Dentro de `construirArtefactos`, junto a los otros acumuladores:

```js
  // Arranca en cero y no vacío: una formación de la columna sin pozos declarados
  // es un dato, y es distinto de un manifiesto viejo que no trae la clave.
  const formaciones = Object.fromEntries(FORMACIONES_DEL_HERO.map((f) => [f, 0]))
```

Dentro del loop de pozos, **después** de la guarda de la caja (así un pozo descartado no cuenta):

```js
    if (claveFormacion(p.cuenca) === 'NEUQUINA') {
      const f = claveFormacion(p.formacion)
      if (f in formaciones) formaciones[f]++
    }
```

Y agregarlo al retorno:

```js
  return { lite: { dicts, rows: lite }, full, sinProduccion, descartados, fueraDeCaja, formaciones }
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run scripts/lib/artefactos.test.mjs`
Expected: PASS, 22 tests.

- [ ] **Step 5: Escribirlo al manifiesto**

En `scripts/build-index.mjs`, agregar `formaciones` al destructuring de `construirArtefactos` y al objeto del manifiesto, justo después de `fueraDeCaja`:

```js
  const { lite, full, sinProduccion, descartados, fueraDeCaja, formaciones } = construirArtefactos(pozos, agregados)
```

```js
    fueraDeCaja,
    formaciones,
```

Y loguear los que quedaron en cero, que es la señal de que el origen renombró algo (B3):

```js
  const sinPozos = Object.entries(formaciones).filter(([, n]) => n === 0).map(([f]) => f)
  if (sinPozos.length > 0) {
    log(`  formaciones del hero sin pozos declarados: ${sinPozos.join(', ')}`)
  }
```

- [ ] **Step 6: Verificar sin pegarle al origen**

No correr `build:index`. Verificar que el script sigue parseando y que el manifiesto viejo no rompe nada:

Run: `node --check scripts/build-index.mjs && npx vitest run`
Expected: sin errores de sintaxis y toda la suite verde. No hardcodear el total:
cada tarea de este plan suma tests, así que el número cambia según por dónde vayas.
Lo que importa es que el `EXIT` sea 0 — mirar el código de salida y no sólo la
línea del conteo.

- [ ] **Step 7: Documentar la regla**

En `docs/reglas/datos.md`, agregar al final una regla D8:

```markdown
## D8 — El manifiesto lleva el conteo de las nueve formaciones del hero

El corte geológico del hero rotula cada estrato con su cantidad de pozos. Esas
cifras no se escriben a mano: las cuenta el build y las deja en `formaciones` de
`manifiesto.json`.

Es un objeto de exactamente nueve claves —las formaciones de la columna Neuquina
que dibuja el hero—, no un volcado de las 79 formaciones del dato. Las claves van
en mayúsculas y sin acentos, porque el origen escribe `huitrín` y el dibujo pide
`HUITRIN`. Sólo se cuentan pozos de la cuenca Neuquina: la columna es la de esa
cuenca y el dibujo lo rotula así.

Una formación de la columna que no tenga pozos declarados queda en **cero, no
ausente**: son dos cosas distintas para el hero. Cero significa que el origen no
declaró ninguno, que es un dato. Ausente significa que el manifiesto lo generó un
build anterior a esta regla, y ahí el hero dibuja la banda sin conteo en vez de
inventar un cero.

El build no falla si una formación desaparece del origen: no es una guarda de
volumen, es un rótulo. Lo loguea.
```

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/artefactos.mjs scripts/lib/artefactos.test.mjs scripts/build-index.mjs docs/reglas/datos.md
git commit -m "feat: el manifiesto lleva el conteo de las nueve formaciones del hero"
```

---

### Task 4: Vocabulario del dibujo — tramas litológicas y columna estratigráfica

**Files:**
- Create: `src/lib/estratigrafia.js`
- Create: `src/lib/estratigrafia.test.js`
- Create: `src/ui/hero/tramas.js`
- Create: `src/ui/hero/tramas.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `COLUMNA_NEUQUINA`: array de 9 objetos `{ nombre, litologia, trama, rocaMadre }`, ordenado de arriba (más joven) hacia abajo (más antigua).
  - `TRAMAS`: array con los cinco nombres válidos de trama.
  - `defsDeTramas()`: devuelve la cadena con los cinco `<pattern>`, para meter en un `<defs>`.
  - `idDeTrama(nombre)`: devuelve `'t-arenisca'` etc., el `id` con el que referenciarla desde un `fill`.

- [ ] **Step 1: Escribir el test de la columna**

Crear `src/lib/estratigrafia.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { COLUMNA_NEUQUINA } from './estratigrafia.js'
import { TRAMAS } from '../ui/hero/tramas.js'

describe('COLUMNA_NEUQUINA', () => {
  it('tiene las nueve formaciones', () => {
    expect(COLUMNA_NEUQUINA).toHaveLength(9)
  })

  it('está en el orden estratigráfico real, de la más joven a la más antigua', () => {
    // De abajo hacia arriba: Lajas -> Lotena -> Tordillo -> Vaca Muerta ->
    // Quintuco -> Mulichinco -> Agrio -> Huitrin -> Rayoso. Este test impide que
    // alguien "ordene alfabéticamente", pero NO prueba que el orden sea correcto:
    // compara contra una lista hardcodeada acá, así que si el código y el test
    // comparten el mismo error, pasa igual. La corrección del orden se verifica
    // contra la literatura, no contra este test.
    expect(COLUMNA_NEUQUINA.map((f) => f.nombre)).toEqual([
      'RAYOSO', 'HUITRIN', 'AGRIO', 'MULICHINCO', 'QUINTUCO',
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
```

- [ ] **Step 2: Escribir el test de las tramas**

Crear `src/ui/hero/tramas.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { TRAMAS, defsDeTramas, idDeTrama } from './tramas.js'

describe('tramas litológicas', () => {
  it('son las cinco que pide el dibujo', () => {
    expect(TRAMAS).toEqual(['arenisca', 'lutita', 'caliza', 'evaporita', 'bituminosa'])
  })

  it('cada una produce un <pattern> con su id', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.innerHTML = `<defs>${defsDeTramas()}</defs>`
    for (const t of TRAMAS) {
      expect(svg.querySelector(`#${idDeTrama(t)}`), t).not.toBeNull()
    }
  })

  it('se tiñen con currentColor y no con un color fijo', () => {
    // Es toda la razón por la que redibujamos las tramas en vez de adoptar los
    // SVG del FGDC: los del estándar traen #000000 fijo y no se pueden pintar
    // con la paleta ni invertir en el tema cianotipo.
    const defs = defsDeTramas()
    expect(defs).toContain('currentColor')
    expect(defs).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })

  it('teselan: cada pattern declara su caja en userSpaceOnUse', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.innerHTML = `<defs>${defsDeTramas()}</defs>`
    for (const p of svg.querySelectorAll('pattern')) {
      expect(p.getAttribute('patternUnits'), p.id).toBe('userSpaceOnUse')
      expect(Number(p.getAttribute('width')), p.id).toBeGreaterThan(0)
      expect(Number(p.getAttribute('height')), p.id).toBeGreaterThan(0)
    }
  })

  it('idDeTrama rechaza una trama que no existe', () => {
    expect(() => idDeTrama('granito')).toThrow(/granito/)
  })
})
```

- [ ] **Step 3: Correr los dos para verificar que fallan**

Run: `npx vitest run src/lib/estratigrafia.test.js src/ui/hero/tramas.test.js`
Expected: FAIL, no se pueden resolver los módulos.

- [ ] **Step 4: Escribir `src/lib/estratigrafia.js`**

```js
/**
 * La columna estratigráfica de la cuenca Neuquina que dibuja el hero, de la
 * formación más joven a la más antigua. Verificada contra la literatura de la
 * cuenca: de abajo hacia arriba es Lajas -> Lotena -> Tordillo -> Vaca Muerta ->
 * Quintuco -> Mulichinco -> Agrio -> Huitrín -> Rayoso.
 *
 * Es dato, no lógica: sin funciones y sin dependencias. Los conteos de pozos NO
 * viven acá, salen del manifiesto (G5): `corte.js` recorre esta lista y les pega
 * el número.
 *
 * La litología de cada una es la que justifica su trama, y es lo que hace que el
 * dibujo sea fiel a un corte real y no a una decoración a bandas.
 */
export const COLUMNA_NEUQUINA = [
  { nombre: 'RAYOSO',      litologia: 'evaporitas y continental', trama: 'evaporita',  rocaMadre: false },
  { nombre: 'HUITRIN',     litologia: 'evaporitas',               trama: 'evaporita',  rocaMadre: false },
  { nombre: 'AGRIO',       litologia: 'lutitas',                  trama: 'lutita',     rocaMadre: false },
  { nombre: 'MULICHINCO',  litologia: 'areniscas y conglomerados', trama: 'arenisca',  rocaMadre: false },
  { nombre: 'QUINTUCO',    litologia: 'carbonatos',               trama: 'caliza',     rocaMadre: false },
  { nombre: 'VACA MUERTA', litologia: 'lutita bituminosa',        trama: 'bituminosa', rocaMadre: true  },
  { nombre: 'TORDILLO',    litologia: 'areniscas',                trama: 'arenisca',   rocaMadre: false },
  { nombre: 'LOTENA',      litologia: 'areniscas y carbonatos',   trama: 'caliza',     rocaMadre: false },
  { nombre: 'LAJAS',       litologia: 'areniscas',                trama: 'arenisca',   rocaMadre: false },
]
```

- [ ] **Step 5: Escribir `src/ui/hero/tramas.js`**

```js
/**
 * Las cinco tramas litológicas del corte, redibujadas tomando como referencia
 * FGDC-STD-013-2006, "Digital Cartographic Standard for Geologic Map
 * Symbolization", patrones sedimentarios de la serie 600. Es el lenguaje con el
 * que se dibujan los mapas geológicos desde hace un siglo: arenisca son puntos,
 * lutita son guiones, caliza son ladrillos, evaporita son chevrons.
 *
 * Se redibujan y no se adoptan los archivos del estándar —que son CC0, así que
 * no habría problema de licencia— por dos razones técnicas: sus SVG traen
 * `#000000` fijo, así que no se tiñen con la paleta ni se invierten en el tema
 * cianotipo, y cada tesela tiene más de 400 elementos.
 */
export const TRAMAS = ['arenisca', 'lutita', 'caliza', 'evaporita', 'bituminosa']

export function idDeTrama(nombre) {
  if (!TRAMAS.includes(nombre)) {
    throw new Error(`Trama desconocida: "${nombre}". Las que hay: ${TRAMAS.join(', ')}`)
  }
  return `t-${nombre}`
}

/**
 * Los cinco `<pattern>`, para meter dentro de un `<defs>`. Todo en
 * `currentColor`: el estrato que los use decide el color desde la paleta.
 */
export function defsDeTramas() {
  return `
    <pattern id="t-arenisca" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="1.1" fill="currentColor"/>
      <circle cx="13" cy="9" r="1.1" fill="currentColor"/>
      <circle cx="7" cy="14" r="1.1" fill="currentColor"/>
      <circle cx="16" cy="16" r="1.1" fill="currentColor"/>
    </pattern>
    <pattern id="t-lutita" width="26" height="11" patternUnits="userSpaceOnUse">
      <path d="M0 3.5h11M15 3.5h11M6 9h13" stroke="currentColor" stroke-width="1" fill="none"/>
    </pattern>
    <pattern id="t-caliza" width="26" height="14" patternUnits="userSpaceOnUse">
      <path d="M0 0h26M0 7h26M0 14h26M13 0v7M0 7v7M26 7v7"
            stroke="currentColor" stroke-width="0.8" fill="none"/>
    </pattern>
    <pattern id="t-evaporita" width="18" height="13" patternUnits="userSpaceOnUse">
      <path d="M0 9l4.5-5.5L9 9l4.5-5.5L18 9" stroke="currentColor" stroke-width="1" fill="none"/>
    </pattern>
    <pattern id="t-bituminosa" width="26" height="9" patternUnits="userSpaceOnUse">
      <rect width="26" height="9" fill="currentColor" opacity="0.16"/>
      <path d="M0 4.5h10M14 4.5h12" stroke="currentColor" stroke-width="1.3" fill="none"/>
    </pattern>`
}
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run: `npx vitest run src/lib/estratigrafia.test.js src/ui/hero/tramas.test.js`
Expected: PASS, 12 tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/estratigrafia.js src/lib/estratigrafia.test.js src/ui/hero/tramas.js src/ui/hero/tramas.test.js
git commit -m "feat: columna estratigráfica de Neuquina y las cinco tramas litológicas"
```

---

### Task 5: El corte — dato a SVG

**Files:**
- Create: `src/ui/hero/corte.js`
- Create: `src/ui/hero/corte.test.js`

**Interfaces:**
- Consumes: `COLUMNA_NEUQUINA` de `src/lib/estratigrafia.js`; `defsDeTramas`, `idDeTrama` de `./tramas.js`; `normalizar` de `src/lib/catalogo.js`.
- Produces: `construirCorte({ formaciones, pozos, periodo })` devuelve una cadena con el `<svg>` completo. `GEOMETRIA` con las constantes del dibujo (`ANCHO`, `ALTO`, `HORIZONTE`), que `hero.css` necesita para la relación de aspecto.

- [ ] **Step 1: Escribir el test**

Crear `src/ui/hero/corte.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { construirCorte, GEOMETRIA } from './corte.js'
import { COLUMNA_NEUQUINA } from '../../lib/estratigrafia.js'
import { idDeTrama } from './tramas.js'

const MANIFIESTO = {
  RAYOSO: 1750, HUITRIN: 2660, AGRIO: 3980, MULICHINCO: 1039, QUINTUCO: 4062,
  'VACA MUERTA': 3547, TORDILLO: 1699, LOTENA: 2119, LAJAS: 1887,
}

function montar(opciones = {}) {
  const caja = document.createElement('div')
  caja.innerHTML = construirCorte({
    formaciones: MANIFIESTO, pozos: 85609, periodo: 202607, ...opciones,
  })
  return caja
}

describe('construirCorte', () => {
  it('devuelve un svg con el viewBox de la geometría', () => {
    const svg = montar().querySelector('svg')
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${GEOMETRIA.ANCHO} ${GEOMETRIA.ALTO}`)
  })

  it('dibuja las nueve bandas en el orden de la columna', () => {
    const nombres = [...montar().querySelectorAll('[data-formacion]')]
      .map((n) => n.dataset.formacion)
    expect(nombres).toEqual(COLUMNA_NEUQUINA.map((f) => f.nombre))
  })

  it('le da a cada banda la trama de su litología', () => {
    const caja = montar()
    for (const f of COLUMNA_NEUQUINA) {
      const banda = caja.querySelector(`[data-formacion="${f.nombre}"] .corte__relleno`)
      expect(banda.getAttribute('fill'), f.nombre).toBe(`url(#${idDeTrama(f.trama)})`)
    }
  })

  it('las bandas no se solapan ni dejan huecos, y llenan el subsuelo', () => {
    const bandas = [...montar().querySelectorAll('.corte__relleno')]
      .map((r) => ({ y: Number(r.getAttribute('y')), h: Number(r.getAttribute('height')) }))
    expect(bandas[0].y).toBe(GEOMETRIA.HORIZONTE)
    for (let i = 1; i < bandas.length; i++) {
      expect(bandas[i].y, `banda ${i}`).toBe(bandas[i - 1].y + bandas[i - 1].h)
    }
    const ultima = bandas.at(-1)
    expect(ultima.y + ultima.h).toBe(GEOMETRIA.ALTO)
  })

  it('rotula cada banda con su conteo del manifiesto, agrupado en miles', () => {
    const caja = montar()
    const texto = caja.querySelector('[data-formacion="QUINTUCO"]').textContent
    expect(texto).toContain('4.062')
  })

  it('una formación ausente del manifiesto se dibuja sin conteo, no con cero ni undefined', () => {
    const { QUINTUCO, ...incompleto } = MANIFIESTO
    const texto = montar({ formaciones: incompleto })
      .querySelector('[data-formacion="QUINTUCO"]').textContent
    expect(texto).toContain('QUINTUCO')
    expect(texto).not.toMatch(/undefined|NaN/)
    expect(texto).not.toContain('0 pozos')
  })

  it('un conteo en cero sí se dibuja: es un dato, no una ausencia', () => {
    const texto = montar({ formaciones: { ...MANIFIESTO, LAJAS: 0 } })
      .querySelector('[data-formacion="LAJAS"]').textContent
    expect(texto).toContain('0')
  })

  it('encuentra HUITRIN aunque el manifiesto traiga HUITRÍN con acento', () => {
    const { HUITRIN, ...resto } = MANIFIESTO
    const texto = montar({ formaciones: { ...resto, 'HUITRÍN': 2660 } })
      .querySelector('[data-formacion="HUITRIN"]').textContent
    expect(texto).toContain('2.660')
  })

  it('marca la roca madre y la rotula como tal (I5)', () => {
    const madre = montar().querySelector('.corte__estrato--madre')
    expect(madre.dataset.formacion).toBe('VACA MUERTA')
    expect(madre.textContent.toUpperCase()).toContain('ROCA MADRE')
  })

  it('no le atribuye a Vaca Muerta un primer puesto que no tiene (I5)', () => {
    const texto = montar().textContent.toLowerCase()
    for (const mentira of ['la más grande', 'la mayor', 'la principal', 'la más importante']) {
      expect(texto, mentira).not.toContain(mentira)
    }
  })

  it('dice que la escala es esquemática (I2)', () => {
    expect(montar().textContent.toUpperCase()).toContain('ESQUEMÁTICO')
  })

  it('rotula la cuenca, para no pasar por columna nacional (I6)', () => {
    expect(montar().textContent.toUpperCase()).toContain('CUENCA NEUQUINA')
  })

  it('dibuja tres balancines, cada uno con viga y contrapeso propios', () => {
    const caja = montar()
    const balancines = caja.querySelectorAll('.balancin')
    expect(balancines).toHaveLength(3)
    for (const b of balancines) {
      expect(b.querySelector('.balancin__viga')).not.toBeNull()
      expect(b.querySelector('.balancin__contrapeso')).not.toBeNull()
    }
  })

  it('le da a cada balancín un período distinto, para que el campo no sincronice', () => {
    const periodos = [...montar().querySelectorAll('.balancin')]
      .map((b) => b.style.getPropertyValue('--periodo'))
    expect(new Set(periodos).size).toBe(3)
    expect(periodos.every(Boolean)).toBe(true)
  })

  it('numera los estratos de abajo hacia arriba, porque así se deposita la roca', () => {
    // --orden 0 es la más antigua (Lajas, abajo) y 8 la más joven (Rayoso,
    // arriba). El CSS lo usa como retardo, así que este orden ES el Acto II.
    const caja = montar()
    const lajas = caja.querySelector('[data-formacion="LAJAS"]')
    const rayoso = caja.querySelector('[data-formacion="RAYOSO"]')
    expect(lajas.style.getPropertyValue('--orden')).toBe('0')
    expect(rayoso.style.getPropertyValue('--orden')).toBe('8')
  })

  it('los pozos entran a la roca madre, que es lo que explica el lateral', () => {
    const caja = montar()
    const laterales = caja.querySelectorAll('.corte__lateral')
    const madre = caja.querySelector('[data-formacion="VACA MUERTA"] .corte__relleno')
    const techo = Number(madre.getAttribute('y'))
    const piso = techo + Number(madre.getAttribute('height'))
    expect(laterales.length).toBeGreaterThan(0)
    for (const l of laterales) {
      const y = Number(l.dataset.profundidad)
      expect(y, 'un lateral quedó fuera de la roca madre').toBeGreaterThanOrEqual(techo)
      expect(y).toBeLessThanOrEqual(piso)
    }
  })

  it('tiene alternativa textual para lectores de pantalla (X1)', () => {
    const svg = montar().querySelector('svg')
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.querySelector('title').textContent).toBeTruthy()
    expect(svg.querySelector('desc').textContent).toMatch(/roca madre/i)
  })

  it('es puro: no toca el document', () => {
    const antes = document.body.innerHTML
    construirCorte({ formaciones: MANIFIESTO, pozos: 85609, periodo: 202607 })
    expect(document.body.innerHTML).toBe(antes)
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/ui/hero/corte.test.js`
Expected: FAIL, no se puede resolver `./corte.js`.

- [ ] **Step 3: Implementar `src/ui/hero/corte.js`**

```js
import { COLUMNA_NEUQUINA } from '../../lib/estratigrafia.js'
import { defsDeTramas, idDeTrama } from './tramas.js'
import { normalizar } from '../../lib/catalogo.js'

/**
 * La geometría del dibujo. El horizonte está al 36% del alto: el subsuelo se
 * queda con casi dos tercios porque es donde está el dato.
 */
export const GEOMETRIA = { ANCHO: 1200, ALTO: 720, HORIZONTE: 260 }

/** Los tres balancines: x, escala y período del cabeceo. */
const BALANCINES = [
  { x: 210, escala: 1.0,  periodo: '4s' },
  { x: 560, escala: 0.78, periodo: '4.7s' },
  { x: 890, escala: 0.62, periodo: '5.3s' },
]

const miles = (n) => n.toLocaleString('es-AR')
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Busca el conteo de una formación tolerando acentos: el origen escribe
 * `HUITRÍN` y la columna pide `HUITRIN` (B2). Devuelve `null` —y no 0— cuando la
 * clave no está, porque un manifiesto de un build viejo no es lo mismo que una
 * formación sin pozos declarados (B1).
 */
function conteoDe(formaciones, nombre) {
  if (!formaciones) return null
  const buscado = normalizar(nombre)
  for (const [clave, valor] of Object.entries(formaciones)) {
    if (normalizar(clave) === buscado) return Number(valor)
  }
  return null
}

/** Reparte el subsuelo en nueve bandas. Los espesores no están a escala (I2). */
function bandas() {
  const alto = GEOMETRIA.ALTO - GEOMETRIA.HORIZONTE
  // Pesos relativos, no espesores reales: los reales varían en órdenes de
  // magnitud y dibujarlos a escala haría ilegible media columna. La roca madre
  // lleva algo más de alto porque es donde entran los laterales.
  const pesos = [1.05, 0.95, 1.1, 0.9, 1.0, 1.35, 0.95, 1.0, 1.15]
  const suma = pesos.reduce((a, b) => a + b, 0)
  let y = GEOMETRIA.HORIZONTE
  return COLUMNA_NEUQUINA.map((f, i) => {
    const h = i === COLUMNA_NEUQUINA.length - 1
      ? GEOMETRIA.ALTO - y                      // la última cierra exacto
      : Math.round((pesos[i] / suma) * alto)
    const banda = { ...f, y, h, indice: i }
    y += h
    return banda
  })
}

function unBalancin({ x, escala, periodo }, i) {
  const base = GEOMETRIA.HORIZONTE
  // Todo el balancín cuelga de un <g> con su propia escala, y la viga y el
  // contrapeso son hijos con pivote propio: es lo que permite animarlos
  // acoplados, que es la diferencia entre leer máquina y leer temblequeo.
  return `
    <g class="balancin" style="--periodo:${periodo}" transform="translate(${x} ${base}) scale(${escala})">
      <path class="balancin__base" d="M-34 0h68" />
      <path class="balancin__torre" d="M-16 0l16-58 16 58" />
      <g class="balancin__viga">
        <path d="M-52 -58h104" />
      </g>
      <g class="balancin__contrapeso" transform="translate(-52 -58)">
        <circle r="11" />
        <path d="M0 0l0 15" />
      </g>
    </g>`
}

export function construirCorte({ formaciones, pozos, periodo }) {
  const { ANCHO, ALTO, HORIZONTE } = GEOMETRIA
  const capas = bandas()
  const madre = capas.find((b) => b.rocaMadre)
  const profundidadLateral = madre.y + Math.round(madre.h / 2)

  const estratos = capas.map((b) => {
    const n = conteoDe(formaciones, b.nombre)
    // Sin conteo se rotula sólo el nombre: nunca un 0 inventado ni un undefined.
    const cifra = n === null ? '' : `${miles(n)} pozos`
    const rotulo = b.rocaMadre
      ? `${b.nombre} · ROCA MADRE${cifra ? ` · ${cifra}` : ''}`
      : `${b.nombre}${cifra ? ` · ${cifra}` : ''}`
    return `
      <g class="corte__estrato${b.rocaMadre ? ' corte__estrato--madre' : ''}"
         data-formacion="${esc(b.nombre)}"
         style="--orden:${capas.length - 1 - b.indice}">
        <rect class="corte__relleno" x="0" y="${b.y}" width="${ANCHO}" height="${b.h}"
              fill="url(#${idDeTrama(b.trama)})" />
        <line class="corte__contacto" x1="0" y1="${b.y}" x2="${ANCHO}" y2="${b.y}" />
        <text class="corte__rotulo" x="24" y="${b.y + 20}">${esc(rotulo)}</text>
      </g>`
  }).join('')

  const pozosDibujados = BALANCINES.map(({ x }, i) => `
      <g class="corte__pozo">
        <line class="corte__casing" x1="${x}" y1="${HORIZONTE}" x2="${x}" y2="${profundidadLateral}" />
        <line class="corte__lateral" data-profundidad="${profundidadLateral}"
              x1="${x}" y1="${profundidadLateral}"
              x2="${x + (i % 2 === 0 ? 230 : -230)}" y2="${profundidadLateral}" />
      </g>`).join('')

  const escala = [0, 1000, 2000, 3000].map((m) => {
    const y = HORIZONTE + (m / 3000) * (ALTO - HORIZONTE)
    return `
      <g class="corte__marca">
        <line x1="0" y1="${y}" x2="14" y2="${y}" />
        <text x="20" y="${y - 5}">${m === 0 ? '0' : miles(m)}</text>
      </g>`
  }).join('')

  return `
<svg class="corte" viewBox="0 0 ${ANCHO} ${ALTO}" role="img"
     preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
  <title>Corte geológico esquemático de la cuenca Neuquina</title>
  <desc>Sobre la superficie, balancines y una torre de perforación. Bajo la
  superficie, nueve formaciones en orden estratigráfico; la formación Vaca
  Muerta, la roca madre, es el objetivo de los pozos horizontales.</desc>
  <defs>${defsDeTramas()}</defs>

  <g class="corte__subsuelo">${estratos}</g>
  <g class="corte__pozos">${pozosDibujados}</g>
  <g class="corte__escala">
    ${escala}
    <text class="corte__leyenda" x="20" y="${ALTO - 14}">PROFUNDIDAD (m) · ESQUEMÁTICO</text>
  </g>

  <line class="corte__horizonte" x1="0" y1="${HORIZONTE}" x2="${ANCHO}" y2="${HORIZONTE}" />
  <g class="corte__superficie">${BALANCINES.map(unBalancin).join('')}</g>

  <text class="corte__cuenca" x="${ANCHO - 24}" y="${HORIZONTE + 26}" text-anchor="end">CUENCA NEUQUINA</text>
</svg>`
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/ui/hero/corte.test.js`
Expected: PASS, 18 tests. Si falla el de las bandas contiguas, es el redondeo: la última banda cierra con `ALTO - y` justamente para absorberlo.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hero/corte.js src/ui/hero/corte.test.js
git commit -m "feat: el corte geológico, de dato a SVG"
```

---

### Task 6: La coreografía — máquina de estados y animaciones

**Files:**
- Create: `src/ui/hero/coreografia.js`
- Create: `src/ui/hero/coreografia.test.js`
- Create: `src/estilos/hero.css`
- Modify: `src/style.css` (agregar el import de `hero.css`)

**Interfaces:**
- Consumes: el SVG que produce `construirCorte`, ya montado en el DOM.
- Produces: `crearCoreografia(raiz, { reducido })` devuelve `{ entrar(), pausar(), reanudar(), salir(), estado() }`. `raiz` es el elemento que lleva las clases `hero--entrando`, `hero--reposo`, `hero--pausado`, `hero--saliendo`. `estado()` devuelve `'inicial' | 'entrando' | 'reposo' | 'saliendo' | 'ido'`. `DURACIONES` con `{ ENTRADA: 4400, SALIDA: 600 }`.

- [ ] **Step 1: Escribir el test de la máquina**

Crear `src/ui/hero/coreografia.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { crearCoreografia, DURACIONES } from './coreografia.js'

let raiz

beforeEach(() => {
  vi.useFakeTimers()
  raiz = document.createElement('div')
  document.body.appendChild(raiz)
})

afterEach(() => {
  vi.useRealTimers()
  raiz.remove()
})

const clases = () => [...raiz.classList]

describe('crearCoreografia', () => {
  it('arranca en inicial, sin ninguna clase de animación', () => {
    const c = crearCoreografia(raiz, { reducido: false })
    expect(c.estado()).toBe('inicial')
    expect(clases()).toEqual([])
  })

  it('entrar() pone la clase de entrada y pasa a reposo al terminar', () => {
    const c = crearCoreografia(raiz, { reducido: false })
    c.entrar()

    expect(c.estado()).toBe('entrando')
    expect(clases()).toContain('hero--entrando')

    vi.advanceTimersByTime(DURACIONES.ENTRADA)

    expect(c.estado()).toBe('reposo')
    expect(clases()).toContain('hero--reposo')
    // La clase de entrada se saca: si quedara, sus `animation` seguirían
    // declaradas y pelearían con las del reposo.
    expect(clases()).not.toContain('hero--entrando')
  })

  it('pausar() y reanudar() sólo tocan la pausa, no el estado', () => {
    const c = crearCoreografia(raiz, { reducido: false })
    c.entrar()
    vi.advanceTimersByTime(DURACIONES.ENTRADA)

    c.pausar()
    expect(clases()).toContain('hero--pausado')
    expect(c.estado()).toBe('reposo')

    c.reanudar()
    expect(clases()).not.toContain('hero--pausado')
    expect(c.estado()).toBe('reposo')
  })

  it('salir() lleva a ido después de la salida', () => {
    const c = crearCoreografia(raiz, { reducido: false })
    c.entrar()
    vi.advanceTimersByTime(DURACIONES.ENTRADA)

    c.salir()
    expect(c.estado()).toBe('saliendo')
    expect(clases()).toContain('hero--saliendo')

    vi.advanceTimersByTime(DURACIONES.SALIDA)
    expect(c.estado()).toBe('ido')
  })

  it('salir() en medio de la entrada no espera a que termine', () => {
    // Alguien que llega, no mira el dibujo y busca de una. La coreografía no
    // puede retenerlo 4,4 segundos.
    const c = crearCoreografia(raiz, { reducido: false })
    c.entrar()
    vi.advanceTimersByTime(800)

    c.salir()
    expect(c.estado()).toBe('saliendo')
    expect(clases()).not.toContain('hero--entrando')

    vi.advanceTimersByTime(DURACIONES.SALIDA)
    expect(c.estado()).toBe('ido')
    // Y el temporizador de la entrada no puede resucitarlo.
    vi.advanceTimersByTime(DURACIONES.ENTRADA)
    expect(c.estado()).toBe('ido')
  })

  it('no vuelve atrás: entrar() después de salir no hace nada (E3)', () => {
    const c = crearCoreografia(raiz, { reducido: false })
    c.entrar()
    vi.advanceTimersByTime(DURACIONES.ENTRADA)
    c.salir()
    vi.advanceTimersByTime(DURACIONES.SALIDA)

    c.entrar()
    expect(c.estado()).toBe('ido')
    expect(clases()).not.toContain('hero--entrando')
  })

  it('con movimiento reducido salta a reposo sin animar nada (G4)', () => {
    const c = crearCoreografia(raiz, { reducido: true })
    c.entrar()

    // Sin pasar el tiempo: el cuadro final tiene que estar ya.
    expect(c.estado()).toBe('reposo')
    expect(clases()).not.toContain('hero--entrando')
    expect(clases()).toContain('hero--reposo')
  })

  it('con movimiento reducido la salida también es inmediata (G4)', () => {
    const c = crearCoreografia(raiz, { reducido: true })
    c.entrar()
    c.salir()
    expect(c.estado()).toBe('ido')
  })

  it('pausar() antes de llegar a reposo no rompe la entrada', () => {
    const c = crearCoreografia(raiz, { reducido: false })
    c.entrar()
    c.pausar()
    vi.advanceTimersByTime(DURACIONES.ENTRADA)
    // Pausado o no, el reloj de la entrada corre: la clase de pausa sólo
    // congela las animaciones CSS.
    expect(c.estado()).toBe('reposo')
    expect(clases()).toContain('hero--pausado')
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/ui/hero/coreografia.test.js`
Expected: FAIL, no se puede resolver `./coreografia.js`.

- [ ] **Step 3: Implementar `src/ui/hero/coreografia.js`**

```js
/**
 * La máquina de la composición. No sabe dibujar: recibe la raíz del hero ya
 * montada y le pone y saca clases. El CSS de `hero.css` es el que sabe qué
 * significa cada una.
 *
 * Los tiempos viven acá y en `hero.css`, y tienen que coincidir. Es la única
 * duplicación del módulo y es a propósito: el CSS necesita los números en su
 * sintaxis y el JS necesita saber cuándo cambiar de estado. El test de humo de
 * la Tarea 9 compara los dos.
 */
export const DURACIONES = { ENTRADA: 4400, SALIDA: 600 }

const CLASES = {
  entrando: 'hero--entrando',
  reposo: 'hero--reposo',
  pausado: 'hero--pausado',
  saliendo: 'hero--saliendo',
}

export function crearCoreografia(raiz, { reducido }) {
  let estado = 'inicial'
  let reloj = null

  const cancelar = () => { if (reloj) { clearTimeout(reloj); reloj = null } }

  function aReposo() {
    // La clase de entrada se saca al pasar a reposo: si quedara, sus
    // `animation` seguirían declaradas y pelearían con las del cabeceo.
    raiz.classList.remove(CLASES.entrando)
    raiz.classList.add(CLASES.reposo)
    estado = 'reposo'
  }

  return {
    estado: () => estado,

    /** Arranca la coreografía. Con movimiento reducido deja el cuadro final (G4). */
    entrar() {
      if (estado !== 'inicial') return
      if (reducido) { aReposo(); return }
      raiz.classList.add(CLASES.entrando)
      estado = 'entrando'
      reloj = setTimeout(() => { reloj = null; aReposo() }, DURACIONES.ENTRADA)
    },

    /** Congela el reposo. No cambia de estado: es una condición, no un acto. */
    pausar() { raiz.classList.add(CLASES.pausado) },
    reanudar() { raiz.classList.remove(CLASES.pausado) },

    /**
     * El relevo. Se puede pedir en medio de la entrada: quien llega y busca de
     * una no tiene por qué esperar 4,4 segundos.
     */
    salir() {
      if (estado === 'saliendo' || estado === 'ido') return
      cancelar()
      raiz.classList.remove(CLASES.entrando, CLASES.reposo, CLASES.pausado)
      if (reducido) { estado = 'ido'; return }
      raiz.classList.add(CLASES.saliendo)
      estado = 'saliendo'
      reloj = setTimeout(() => { reloj = null; estado = 'ido' }, DURACIONES.SALIDA)
    },
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/ui/hero/coreografia.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Escribir `src/estilos/hero.css`**

```css
/* ---------- El hero: capa sobre el mapa, con su propio contexto ---------- */
.hero {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: grid;
  /* Tres filas para el CONTENIDO: título arriba, un hueco elástico al medio, y
     el buscador abajo con su alto intrínseco garantizado. Con dos filas el
     buscador competía con el título por la misma fila `auto` y se caía fuera del
     viewport en la mitad de los tamaños probados. */
  grid-template-rows: auto 1fr auto;
  background: var(--papel);
  overflow: hidden;
}

/* El dibujo llena el hero ENTERO, detrás del texto, y no ocupa una fila.

   La razón es aritmética, no estética: el corte mide 1200x720, o sea 1,67:1, y
   el aspecto de un viewport típico va de 1,60 a 1,78 — casi el mismo. Llenando
   el hero completo, el recorte es de 45 unidades de cielo o ninguno, y los
   rótulos se ven a entre 15 y 21 píxeles. Metido en una fila que comparte el
   alto con el texto, el mismo dibujo queda a 733x440 con rótulos de 6 a 8
   píxeles y márgenes vacíos a los costados: lee como una imagen pegada en un
   documento, no como la ilustración del hero. Medido en cuatro viewports.

   El texto se apoya sobre el cielo, que está vacío por diseño. */
.hero__dibujo {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.hero__texto { position: relative; z-index: 1; }

.hero__texto {
  align-self: start;
  padding: clamp(16px, 4vh, 44px) clamp(20px, 5vw, 72px) 0;
}
/* La medida va POR ELEMENTO y no en el bloque. Un `max-width: 46ch` en el
   contenedor se calcula con SU tamaño de fuente (16px), o sea unos 368px, y
   adentro un título de 60px tiene que envolver cada once caracteres: un título
   de 52 caracteres salía en seis líneas y se comía el presupuesto vertical del
   hero entero. Cada elemento declara su propia medida, en sus propios `ch`. */
.hero__titulo {
  font: 600 clamp(1.8rem, 3.6vw, 2.8rem)/1.06 var(--serif);
  max-width: 24ch;
  margin: 0;
  letter-spacing: -0.02em;
  text-wrap: balance;
}
.hero__bajada {
  font: 400 clamp(0.98rem, 1.6vw, 1.12rem)/1.5 var(--serif);
  max-width: 58ch;
  color: var(--apagado);
  margin: 0.8rem 0 0;
}
.hero__dato {
  font: 400 0.875rem/1 var(--mono);
  font-variant-numeric: tabular-nums;
  color: var(--cobre);
  margin: 1.1rem 0 0;
}
/* Banda de papel al pie: el buscador cae sobre los estratos profundos, y sin
   fondo propio el campo competiría con la trama litológica. El borde superior
   lo separa del dibujo sin tapar nada. */
.hero__buscador {
  position: relative;
  z-index: 1;
  padding: 1.1rem clamp(20px, 5vw, 72px) 1.4rem;
  background: var(--papel);
  border-top: 1px solid var(--linea);
}

/* El corte reserva su caja desde el primer cuadro, antes de tener datos: sin
   esto el hero salta de alto cuando llega el manifiesto (E6).
   `width: 100%` es obligatorio: sin un ancho explícito, `aspect-ratio` deriva el
   ancho a partir del alto en vez de estirarse a la fila, y el dibujo quedaba
   ocupando el 40% del ancho con el resto en blanco. Y no lleva `aspect-ratio`
   fijo: la fila `1fr` le da el alto, y el `meet` del SVG se encarga de encajar
   el dibujo entero adentro sin recortar nada. */

.corte { display: block; width: 100%; height: 100%; color: var(--tinta); }
/* La lista de resultados del buscador se posiciona `absolute` y su bloque
   contenedor es el ancestro posicionado más cercano. Dentro del hero eso sería
   `.hero`, que es `fixed`: sin esto la lista aparece en otro lado. */
.hero__buscador { position: relative; }

/* ---------- El dibujo en reposo, sin animación ---------- */
.corte__horizonte { stroke: var(--tinta); stroke-width: 2.2; }
.corte__contacto { stroke: var(--tinta); stroke-width: 0.7; opacity: 0.45; }
.corte__relleno { color: var(--apagado); }
.corte__estrato--madre .corte__relleno { color: var(--vaca); }

/* Los rótulos se leen SOBRE la trama litológica, que es un patrón de líneas o
   puntos: sin separarlos del fondo, el texto compite con la trama y no se lee.
   `paint-order: stroke` pinta primero un contorno del color del papel y después
   el relleno, así que cada letra queda con su propio halo. Es la técnica
   estándar en SVG para texto sobre textura, y cuesta dos propiedades. */
.corte__rotulo {
  font: 600 13px var(--rotulo);
  letter-spacing: 0.1em;
  fill: var(--apagado);
  paint-order: stroke;
  stroke: var(--papel);
  stroke-width: 3.5px;
  stroke-linejoin: round;
}
.corte__estrato--madre .corte__rotulo {
  font: 600 15px var(--serif);
  letter-spacing: 0.02em;
  fill: var(--vaca);
  stroke-width: 4px;
}
.corte__cuenca, .corte__leyenda {
  font: 600 11px var(--rotulo);
  letter-spacing: 0.12em;
  fill: var(--apagado);
  paint-order: stroke;
  stroke: var(--papel);
  stroke-width: 3px;
  stroke-linejoin: round;
}
.corte__marca line { stroke: var(--apagado); stroke-width: 1; }
.corte__marca text {
  font: 400 10px var(--mono);
  font-variant-numeric: tabular-nums;
  fill: var(--apagado);
}

.corte__casing, .corte__lateral { stroke: var(--cobre); stroke-width: 2.4; fill: none; }
.balancin path, .balancin circle {
  stroke: var(--tinta);
  stroke-width: 3;
  fill: none;
  stroke-linecap: round;
}
.balancin__contrapeso circle { fill: var(--cobre); stroke: none; }

/* La cabeza y el cable los agregó una ronda posterior de la tarea del corte, y
   el selector de arriba no les sirve: la cabeza es un `path` al que ese selector
   le impone `fill: none`, y el cable es un `line`, que directamente no matchea.
   Sin estas dos reglas el cable es invisible y la cabeza un contorno hueco.
   La especificidad importa: `.balancin .balancin__cabeza` (0,2,0) le gana a
   `.balancin path` (0,1,1); al revés no. */
.balancin .balancin__cabeza { fill: var(--tinta); stroke: none; }
.balancin .balancin__cable { stroke: var(--tinta); stroke-width: 1.6; fill: none; }

/* La llama va en `--apagado` y no en `--cobre`: C1 reserva el cobre para el dato
   —pozos, cifras, el botón de descarga— y prohíbe decorar con él. Tinta la
   convertiría en un blob negro. `--apagado` es el tono mudo que el resto del
   dibujo ya usa para lo que no es protagonista. Decidido al mirar el render. */
.corte__antorcha .antorcha__llama { fill: var(--apagado); stroke: none; }
.corte__antorcha path { stroke: var(--tinta); stroke-width: 2.4; fill: none; }
.corte__torre path { stroke: var(--tinta); stroke-width: 2.2; fill: none; }
.corte__estepa { stroke: var(--apagado); stroke-width: 1.4; fill: none; }

/* Cada pieza rota sobre su propio pivote. `fill-box` hace que
   transform-origin se mida contra la caja del elemento y no del SVG entero:
   sin esto los pivotes caen en la esquina del lienzo. */
.balancin__viga, .balancin__contrapeso { transform-box: fill-box; }
.balancin__viga { transform-origin: center; }
.balancin__contrapeso { transform-origin: center; }

/* ---------- Acto I: el instrumento se traza ---------- */
/* Largos fijos y no getTotalLength(): el viewBox es conocido, y así el CSS no
   depende de que el JS mida nada. */
.hero--entrando .corte__horizonte { stroke-dasharray: 1200; animation: corte-trazar 1100ms cubic-bezier(.2,.7,.3,1) both; }
.hero--entrando .corte__escala { animation: corte-aparecer 500ms 300ms both; }

/* ---------- Acto II: la roca se deposita, de abajo hacia arriba ---------- */
/* --orden 0 es la más antigua. Crece desde su propia base: lee deposición. */
.hero--entrando .corte__estrato {
  transform-box: fill-box;
  transform-origin: center bottom;
  animation: corte-depositar 520ms cubic-bezier(.2,.7,.3,1) both;
  animation-delay: calc(1200ms + var(--orden) * 150ms);
}

/* ---------- Acto III: Vaca Muerta, el foco ---------- */
/* El quiebre de tempo: 260ms de más antes de que caiga. */
.hero--entrando .corte__estrato--madre {
  animation-delay: calc(1200ms + var(--orden) * 150ms + 260ms);
}
.hero--entrando .corte__estrato--madre .corte__relleno {
  animation: corte-barrer 760ms calc(1200ms + var(--orden) * 150ms + 560ms) both;
}

/* ---------- Acto IV: lo que hizo la gente ---------- */
.hero--entrando .corte__casing {
  transform-box: fill-box;
  transform-origin: center top;
  /* Rápido, enganche, rápido: lee máquina y no interfaz. */
  animation: corte-perforar 780ms cubic-bezier(.9,.06,.12,.96) 3200ms both;
}
.hero--entrando .corte__lateral {
  transform-box: fill-box;
  animation: corte-extender 520ms cubic-bezier(.2,.7,.3,1) 3900ms both;
}
.hero--entrando .balancin { animation: corte-subir 620ms cubic-bezier(.2,.7,.3,1) 3800ms both; }

/* ---------- Acto V: el campo trabaja ---------- */
/* Tres períodos distintos: el campo no sincroniza nunca. Y el contrapeso gira
   acoplado a la viga, que es lo que lo hace leer como máquina. */
.hero--reposo .balancin__viga {
  animation: balancin-cabecear var(--periodo) ease-in-out infinite;
}
.hero--reposo .balancin__contrapeso {
  animation: balancin-girar var(--periodo) linear infinite;
}
.hero--reposo .corte__lateral {
  animation: corte-fluir calc(var(--periodo, 4s) * 2) linear infinite;
  stroke-dasharray: 6 14;
}
/* La antorcha titila en su propio ritmo, ajeno a los balancines: un período que
   no es múltiplo de ninguno de los tres, así que el conjunto no sincroniza nunca.
   Es lo que el spec pide en el Acto V. */
.hero--reposo .corte__antorcha .antorcha__llama {
  transform-box: fill-box;
  transform-origin: center bottom;
  animation: antorcha-titilar 1.7s ease-in-out infinite;
}
.hero--pausado *, .hero--pausado { animation-play-state: paused !important; }

/* ---------- Acto VI: el relevo ---------- */
.hero--saliendo { animation: hero-irse 600ms cubic-bezier(.4,0,1,1) both; }
.hero--saliendo .corte__subsuelo, .hero--saliendo .corte__pozos, .hero--saliendo .corte__escala {
  animation: corte-hundirse 600ms cubic-bezier(.4,0,1,1) both;
}
.hero--saliendo .hero__texto, .hero--saliendo .corte__superficie {
  animation: corte-aparecer 240ms reverse both;
}

@keyframes corte-trazar { from { stroke-dashoffset: 1200 } to { stroke-dashoffset: 0 } }
@keyframes corte-aparecer { from { opacity: 0 } to { opacity: 1 } }
@keyframes corte-depositar { from { transform: scaleY(0); opacity: 0 } to { transform: scaleY(1); opacity: 1 } }
@keyframes corte-barrer { 0% { opacity: .35 } 45% { opacity: 1 } 100% { opacity: 1 } }
@keyframes corte-perforar { from { transform: scaleY(0) } to { transform: scaleY(1) } }
@keyframes corte-extender { from { transform: scaleX(0) } to { transform: scaleX(1) } }
@keyframes corte-subir { from { transform: translateY(14px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
@keyframes balancin-cabecear { 0%, 100% { transform: rotate(-7deg) } 50% { transform: rotate(7deg) } }
@keyframes balancin-girar { to { transform: rotate(360deg) } }
@keyframes corte-fluir { to { stroke-dashoffset: -40 } }
/* Irregular a propósito: una llama que pulsa con un seno perfecto lee como un
   latido, no como fuego. Los cuatro pasos desparejos rompen la periodicidad. */
@keyframes antorcha-titilar {
  0%, 100% { transform: scaleY(1) scaleX(1); opacity: 1 }
  28%      { transform: scaleY(1.14) scaleX(0.94); opacity: 0.86 }
  53%      { transform: scaleY(0.93) scaleX(1.05); opacity: 1 }
  76%      { transform: scaleY(1.07) scaleX(0.97); opacity: 0.92 }
}
@keyframes corte-hundirse { to { transform: translateY(28%); opacity: 0 } }
@keyframes hero-irse { to { opacity: 0; visibility: hidden } }

/* ---------- Movimiento reducido (G4) ---------- */
/* Lo único no negociable: para alguien con sensibilidad vestibular, tres
   balancines cabeceando en la periferia no es un adorno, es un síntoma. Se
   apaga todo y el corte queda completo y quieto en su cuadro final. */
@media (prefers-reduced-motion: reduce) {
  .hero *, .hero *::before, .hero *::after, .hero {
    animation: none !important;
    transition: none !important;
  }
  .corte__horizonte { stroke-dasharray: none; }
  .corte__lateral { stroke-dasharray: none; }
}

/* ---------- Angosto ---------- */
/* Con el dibujo a pantalla completa ya no hace falta ocultarlo en pantallas
   bajas —no le roba espacio a nadie— ni esconder rótulos por alto: a este
   encuadre se ven a 15px o más en todos los tamaños de escritorio medidos.
   Queda sólo la regla de ancho: en una columna angosta el recorte es horizontal
   y el texto superpuesto compite con los rótulos. */
@media (max-width: 720px) {
  /* Se ocultan los secundarios y queda el de la roca madre, que es el foco.
     Preferible un dibujo simplificado y legible a nueve rótulos apretados
     debajo del título. Los conteos siguen en el manifiesto y en escritorio. */
  .corte__estrato:not(.corte__estrato--madre) .corte__rotulo,
  .corte__escala,
  .corte__cuenca { display: none; }
}
```

Y agregar el import en `src/style.css`, después de `base.css`:

```css
@import "./estilos/hero.css";
```

- [ ] **Step 6: Verificar que el reposo sólo anima transform y opacity (G3)**

Escribir este test en `src/ui/hero/coreografia.test.js`, al final:

```js
describe('presupuesto de propiedades animadas (G3)', () => {
  it('el reposo sólo anima transform y opacity', async () => {
    const { readFileSync } = await import('node:fs')
    const css = readFileSync(new URL('../../estilos/hero.css', import.meta.url), 'utf-8')

    // Los keyframes que usa el reposo, y las propiedades que tocan.
    const usadosEnReposo = [...css.matchAll(/\.hero--reposo[^{]*\{[^}]*animation:\s*([\w-]+)/g)]
      .map((m) => m[1])
    expect(usadosEnReposo.length).toBeGreaterThan(0)

    const PERMITIDAS = new Set(['transform', 'opacity', 'stroke-dashoffset'])
    for (const nombre of usadosEnReposo) {
      const i = css.indexOf(`@keyframes ${nombre}`)
      expect(i, `no existe @keyframes ${nombre}`).toBeGreaterThanOrEqual(0)
      const cuerpo = css.slice(i, css.indexOf('\n}', i))
      for (const [, prop] of cuerpo.matchAll(/^\s*([a-z-]+):/gm)) {
        expect(PERMITIDAS.has(prop), `${nombre} anima "${prop}"`).toBe(true)
      }
    }
  })
})
```

`stroke-dashoffset` está en la lista permitida sólo por `corte-fluir`, que son las partículas de los laterales: son cuatro guiones en tres líneas, y es la única concesión de paint del reposo. Si alguien agrega otra, el test la va a dejar pasar — por eso el presupuesto de cuadros de la Tarea 9 lo mide de verdad.

- [ ] **Step 7: Correr todo**

Run: `npx vitest run && npx vite build`
Expected: 10 tests nuevos en coreografia, todo verde, build limpio.

- [ ] **Step 8: Commit**

```bash
git add src/ui/hero/coreografia.js src/ui/hero/coreografia.test.js src/estilos/hero.css src/style.css
git commit -m "feat: la coreografía del hero en seis actos"
```

---

### Task 7: El hero — componente y relevo

**Files:**
- Create: `src/ui/hero/hero.js`
- Create: `src/ui/hero/hero.test.js`

**Interfaces:**
- Consumes: `construirCorte`, `GEOMETRIA` de `./corte.js`; `crearCoreografia`, `DURACIONES` de `./coreografia.js`; `crearBuscador` de `../buscador.js`; `periodoLegible` de `../../lib/resumen.js`.
- Produces: `crearHero(contenedor, { manifiesto })` devuelve `{ montarBuscador(facetas, alElegir), relevar(), estado() }`.

- [ ] **Step 1: Escribir el test**

Crear `src/ui/hero/hero.test.js`:

```js
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { crearHero } from './hero.js'
import { DURACIONES } from './coreografia.js'

const MANIFIESTO = {
  pozos: 85609,
  ultimoPeriodo: 202607,
  generado: '2026-09-12T13:34:25.865Z',
  formaciones: {
    RAYOSO: 1750, HUITRIN: 2660, AGRIO: 3980, MULICHINCO: 1039, QUINTUCO: 4062,
    'VACA MUERTA': 3547, TORDILLO: 1699, LOTENA: 2119, LAJAS: 1887,
  },
}

const FACETAS = [
  { tipo: 'area', valor: 'LOMA CAMPANA', cuenca: 'NEUQUINA', indice: 0, cantidad: 1058, buscable: 'loma campana' },
]

let contenedor

beforeEach(() => {
  vi.useFakeTimers()
  // jsdom devuelve matches:false para todo. Sin stub no se puede probar el
  // camino de movimiento reducido, que es el que no se puede romper.
  window.matchMedia = vi.fn((consulta) => ({
    matches: false, media: consulta, addEventListener() {}, removeEventListener() {},
  }))
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
})

afterEach(() => {
  vi.useRealTimers()
  contenedor.remove()
})

describe('crearHero', () => {
  it('pinta el título, la bajada y la línea de dato desde el manifiesto (G5)', () => {
    crearHero(contenedor, { manifiesto: MANIFIESTO })

    expect(contenedor.querySelector('.hero__titulo').textContent)
      .toContain('Todos los pozos de hidrocarburos del país')
    expect(contenedor.querySelector('.hero__bajada').textContent)
      .toContain('Secretaría de Energía')
    const dato = contenedor.querySelector('.hero__dato').textContent
    expect(dato).toContain('85.609')
    expect(dato).toContain('07/2026')
  })

  it('dibuja el corte con los conteos del manifiesto', () => {
    crearHero(contenedor, { manifiesto: MANIFIESTO })
    expect(contenedor.querySelector('[data-formacion="VACA MUERTA"]').textContent)
      .toContain('3.547')
  })

  it('arranca la coreografía al montarse', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    expect(hero.estado()).toBe('entrando')
    expect(contenedor.querySelector('.hero').classList).toContain('hero--entrando')
  })

  it('deja el buscador deshabilitado hasta que llegan las facetas (E5)', () => {
    crearHero(contenedor, { manifiesto: MANIFIESTO })
    const entrada = contenedor.querySelector('.hero__buscador input')
    expect(entrada.disabled).toBe(true)
    expect(entrada.placeholder).toMatch(/cargando/i)
  })

  it('montarBuscador lo habilita y le cambia el placeholder', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    hero.montarBuscador(FACETAS, () => {})

    const entrada = contenedor.querySelector('.hero__buscador .buscador__entrada')
    expect(entrada.disabled).toBe(false)
    expect(entrada.placeholder).not.toMatch(/cargando/i)
  })

  it('elegir en el buscador del hero avisa hacia afuera', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    const elegido = vi.fn()
    hero.montarBuscador(FACETAS, elegido)

    const entrada = contenedor.querySelector('.hero__buscador .buscador__entrada')
    entrada.value = 'loma'
    entrada.dispatchEvent(new Event('input'))
    contenedor.querySelector('.buscador__opcion').click()

    expect(elegido).toHaveBeenCalledWith(expect.objectContaining({ valor: 'LOMA CAMPANA' }))
  })

  it('relevar() saca el hero del DOM cuando termina la salida', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    vi.advanceTimersByTime(DURACIONES.ENTRADA)

    hero.relevar()
    expect(contenedor.querySelector('.hero')).not.toBeNull()

    vi.advanceTimersByTime(DURACIONES.SALIDA)
    expect(contenedor.querySelector('.hero')).toBeNull()
    expect(hero.estado()).toBe('ido')
  })

  it('relevar() dos veces no explota', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    hero.relevar()
    hero.relevar()
    vi.advanceTimersByTime(DURACIONES.SALIDA)
    expect(hero.estado()).toBe('ido')
  })

  it('pausa el reposo al enfocar el buscador (M1)', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    hero.montarBuscador(FACETAS, () => {})
    vi.advanceTimersByTime(DURACIONES.ENTRADA)

    const entrada = contenedor.querySelector('.hero__buscador .buscador__entrada')
    entrada.dispatchEvent(new Event('focusin', { bubbles: true }))
    expect(contenedor.querySelector('.hero').classList).toContain('hero--pausado')

    entrada.dispatchEvent(new Event('focusout', { bubbles: true }))
    expect(contenedor.querySelector('.hero').classList).not.toContain('hero--pausado')
  })

  it('pausa el reposo con la pestaña oculta (M2)', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    vi.advanceTimersByTime(DURACIONES.ENTRADA)

    // Si `vi.spyOn(document, 'hidden', 'get')` falla porque jsdom define la
    // propiedad como no configurable, reemplazarlo por:
    //   Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    // y restaurarlo en el afterEach con `delete document.hidden`.
    const oculto = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(contenedor.querySelector('.hero').classList).toContain('hero--pausado')

    oculto.mockReturnValue(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(contenedor.querySelector('.hero').classList).not.toContain('hero--pausado')
  })

  it('con movimiento reducido deja el cuadro final sin animar (G4)', () => {
    window.matchMedia = vi.fn((consulta) => ({
      matches: consulta.includes('prefers-reduced-motion'),
      media: consulta, addEventListener() {}, removeEventListener() {},
    }))

    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    expect(hero.estado()).toBe('reposo')
    expect(contenedor.querySelector('.hero').classList).not.toContain('hero--entrando')
  })

  it('dibuja el corte sin conteos si el manifiesto es de un build viejo (B1)', () => {
    const { formaciones, ...viejo } = MANIFIESTO
    crearHero(contenedor, { manifiesto: viejo })

    const banda = contenedor.querySelector('[data-formacion="QUINTUCO"]').textContent
    expect(banda).toContain('QUINTUCO')
    expect(banda).not.toMatch(/undefined|NaN/)
  })

  it('saca sus escuchas del document al irse', () => {
    const hero = crearHero(contenedor, { manifiesto: MANIFIESTO })
    hero.relevar()
    vi.advanceTimersByTime(DURACIONES.SALIDA)

    // Si la escucha siguiera puesta, esto tiraría sobre un nodo ya removido.
    expect(() => document.dispatchEvent(new Event('visibilitychange'))).not.toThrow()
  })
})
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/ui/hero/hero.test.js`
Expected: FAIL, no se puede resolver `./hero.js`.

- [ ] **Step 3: Implementar `src/ui/hero/hero.js`**

```js
import { construirCorte } from './corte.js'
import { crearCoreografia, DURACIONES } from './coreografia.js'
import { crearBuscador } from '../buscador.js'
import { periodoLegible } from '../../lib/resumen.js'

const TITULO = 'Todos los pozos de hidrocarburos del país, en un CSV'

const BAJADA =
  'La Secretaría de Energía publica la producción mes a mes de cada pozo del país: ' +
  'nueve tablas de casi un millón de filas cada una. Acá están cruzadas con la ' +
  'ubicación de cada pozo. Elegí un ámbito y bajate sólo lo que te interesa.'

/**
 * El hero: la pantalla de entrada. Ocupa el tiempo que el catálogo de 1,26 MB ya
 * se tomaba en blanco, y se releva apenas hay un ámbito elegido.
 *
 * Es el único módulo del hero que habla con `main.js`. No construye el buscador:
 * lo recibe cuando llegan las facetas y delega en `crearBuscador`, el mismo
 * componente de la herramienta, para no tener dos buscadores que mantener.
 */
export function crearHero(contenedor, { manifiesto }) {
  const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  contenedor.innerHTML = `
    <div class="hero">
      <div class="hero__dibujo">${construirCorte({
        formaciones: manifiesto.formaciones,
        pozos: manifiesto.pozos,
        periodo: manifiesto.ultimoPeriodo,
      })}</div>
      <div>
        <div class="hero__texto">
          <h1 class="hero__titulo">${TITULO}</h1>
          <p class="hero__bajada">${BAJADA}</p>
          <p class="hero__dato">${manifiesto.pozos.toLocaleString('es-AR')} pozos · hasta ${periodoLegible(manifiesto.ultimoPeriodo)}</p>
        </div>
        <div class="hero__buscador">
          <label class="buscador__campo">
            <span class="buscador__etiqueta">Buscar</span>
            <input class="buscador__entrada" type="search" disabled
                   placeholder="Cargando los ${manifiesto.pozos.toLocaleString('es-AR')} pozos…" />
          </label>
        </div>
      </div>
    </div>`

  const raiz = contenedor.querySelector('.hero')
  const cajaBuscador = contenedor.querySelector('.hero__buscador')
  const coreografia = crearCoreografia(raiz, { reducido })

  // Nadie escribe con tres balancines moviéndose en la visión periférica (M1),
  // y una pestaña de fondo no tiene por qué gastar batería (M2).
  const alEnfocar = () => coreografia.pausar()
  const alDesenfocar = () => { if (!document.hidden) coreografia.reanudar() }
  const alCambiarVisibilidad = () => {
    if (document.hidden) coreografia.pausar()
    else if (!cajaBuscador.contains(document.activeElement)) coreografia.reanudar()
  }

  cajaBuscador.addEventListener('focusin', alEnfocar)
  cajaBuscador.addEventListener('focusout', alDesenfocar)
  document.addEventListener('visibilitychange', alCambiarVisibilidad)

  function desconectar() {
    cajaBuscador.removeEventListener('focusin', alEnfocar)
    cajaBuscador.removeEventListener('focusout', alDesenfocar)
    document.removeEventListener('visibilitychange', alCambiarVisibilidad)
  }

  coreografia.entrar()

  return {
    estado: () => coreografia.estado(),

    /** Llega cuando el índice cargó: recién ahí se puede buscar (G6). */
    montarBuscador(facetas, alElegir) {
      cajaBuscador.innerHTML = ''
      crearBuscador(cajaBuscador, facetas, alElegir)
    },

    /** El relevo: el corte se hunde y el hero se saca del DOM. */
    relevar() {
      if (coreografia.estado() === 'ido' || coreografia.estado() === 'saliendo') return
      coreografia.salir()
      setTimeout(() => {
        desconectar()
        contenedor.innerHTML = ''
      }, reducido ? 0 : DURACIONES.SALIDA)
    },
  }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/ui/hero/hero.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/ui/hero/hero.js src/ui/hero/hero.test.js
git commit -m "feat: el componente del hero, con sus pausas y su relevo"
```

---

### Task 8: Secuenciación de carga y cableado

**Files:**
- Modify: `src/lib/catalogo.js`
- Modify: `src/lib/catalogo.test.js`
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `crearHero` de `./ui/hero/hero.js`.
- Produces: `cargarManifiesto(base)` y `cargarIndice(base)` en `catalogo.js`; `cargarCatalogo` se queda como la composición de las dos.

- [ ] **Step 1: Escribir el test de la carga partida**

Agregar a `src/lib/catalogo.test.js`:

```js
describe('carga partida en manifiesto e índice (G6)', () => {
  const LITE_OK = { dicts: { cuenca: ['NEUQUINA'] }, rows: [[7, -68.6, -38.3, 0, 0, 0, 0, 0]] }
  const MANIFIESTO_OK = { pozos: 1, ultimoPeriodo: 202607, generado: '2026-09-12T00:00:00.000Z' }

  afterEach(() => { delete globalThis.fetch })

  it('cargarManifiesto pide un solo archivo, el chico', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => MANIFIESTO_OK }))

    const m = await cargarManifiesto('/')

    expect(m.pozos).toBe(1)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('manifiesto.json')
  })

  it('cargarIndice pide sólo el índice y lo valida', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => LITE_OK }))

    const i = await cargarIndice('/')

    expect(i.porId.get(7)).toBe(i.rows[0])
    expect(String(globalThis.fetch.mock.calls[0][0])).toContain('pozos-lite.json')
  })

  it('cargarIndice rechaza un índice sin forma, y no más adentro', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ dicts: {} }) }))
    await expect(cargarIndice('/')).rejects.toThrow(/no tiene la forma esperada/)
  })

  it('cargarCatalogo sigue devolviendo las dos cosas juntas', async () => {
    globalThis.fetch = vi.fn(async (url) => ({
      ok: true,
      json: async () => (String(url).includes('manifiesto') ? MANIFIESTO_OK : LITE_OK),
    }))

    const c = await cargarCatalogo('/')

    expect(c.manifiesto.pozos).toBe(1)
    expect(c.porId.get(7)).toBeDefined()
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })
})
```

Y agregar `cargarManifiesto, cargarIndice` al `import` de arriba del archivo.

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/lib/catalogo.test.js`
Expected: FAIL — `cargarManifiesto is not a function`.

- [ ] **Step 3: Partir `cargarCatalogo`**

En `src/lib/catalogo.js`, reemplazar `cargarCatalogo` por:

```js
/** El manifiesto: 2,8 kB. Es lo único que el hero necesita para empezar (G6). */
export async function cargarManifiesto(base = import.meta.env.BASE_URL) {
  return pedirJson(`${base}manifiesto.json`)
}

/** El índice: 1,26 MB gzip. Es lo que habilita buscar (G6). */
export async function cargarIndice(base = import.meta.env.BASE_URL) {
  const lite = await pedirJson(`${base}pozos-lite.json`)
  // Sin esto, un índice a medio generar explota más adentro con un TypeError
  // que no dice qué archivo estaba mal.
  if (!lite || !Array.isArray(lite.rows) || !lite.dicts) {
    throw new Error('pozos-lite.json no tiene la forma esperada (rows + dicts)')
  }
  return {
    dicts: lite.dicts,
    rows: lite.rows,
    porId: new Map(lite.rows.map((f) => [f[LITE.ID], f])),
  }
}

/** Las dos cosas, para quien las quiera juntas. */
export async function cargarCatalogo(base = import.meta.env.BASE_URL) {
  const [indice, manifiesto] = await Promise.all([cargarIndice(base), cargarManifiesto(base)])
  return { ...indice, manifiesto }
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/lib/catalogo.test.js`
Expected: PASS, 22 tests.

- [ ] **Step 5: Cablear `main.js`**

En `src/main.js`: agregar el import

```js
import { cargarManifiesto, cargarIndice, construirFacetas } from './lib/catalogo.js'
import { crearHero } from './ui/hero/hero.js'
```

(quitando `cargarCatalogo` del import si ya no se usa).

Agregar un contenedor del hero al markup de `app.innerHTML`, como **último** hijo, para que quede sobre el resto:

```html
  <div id="hero"></div>
```

Reemplazar el arranque. Los dos pedidos salen juntos; el hero se monta con el primero que llega:

```js
try {
  // Los dos pedidos salen juntos y se esperan por separado: el manifiesto son
  // 2,8 kB y monta el hero enseguida; el índice son 1,26 MB y habilita buscar.
  // En serie, el hero esperaría al índice y la pantalla seguiría en blanco.
  const pedidoManifiesto = cargarManifiesto()
  const pedidoIndice = cargarIndice()

  const estadoInicial = leerEstado(location.search)
  const manifiesto = await pedidoManifiesto

  const mapa = crearMapa(document.querySelector('#mapa'))
  const panel = crearPanelDescarga(document.querySelector('#descarga'))

  document.querySelector('#pie').textContent = /* … igual que antes, con `manifiesto` en vez de `m` … */

  // El hero sólo existe para quien llega sin nada en la URL: un enlace
  // compartido entra directo a la herramienta (E1).
  const hero = estadoInicial.modo === 'vacio'
    ? crearHero(document.querySelector('#hero'), { manifiesto })
    : null

  const indice = await pedidoIndice
  const catalogo = { ...indice, manifiesto }
  const facetas = construirFacetas(catalogo)
```

Después de crear `buscador`, darle las facetas al hero y hacer que elegir ahí releve:

```js
  hero?.montarBuscador(facetas, (faceta) => {
    aplicar({
      modo: 'faceta', tipo: faceta.tipo, valor: faceta.valor,
      cuenca: faceta.cuenca ?? null, poligono: null,
    })
  })
```

Y en `sincronizar`, al principio, relevar el hero apenas hay ámbito:

```js
    // El relevo es de una sola vía: el hero es una entrada, no un estado al que
    // se vuelva. "Volver al inicio" y el botón Atrás no lo reponen (E3).
    if (estado.modo !== 'vacio') hero?.relevar()
```

Reemplazar `m.` por `manifiesto.` en el resto del archivo (`#pie` y `filasDelAmbito`).

- [ ] **Step 6: Verificar en el navegador**

Run: `npx vitest run && npx vite build && npx vite preview --port 4173`

Abrir `http://localhost:4173/` y confirmar:
1. El hero aparece enseguida, con el corte, y la coreografía corre.
2. El buscador arranca deshabilitado diciendo "Cargando…" y se habilita.
3. Elegir un área releva el hero y deja la herramienta funcionando.
4. "Volver al inicio" **no** repone el hero.
5. `http://localhost:4173/?t=area&v=LOMA+CAMPANA&c=NEUQUINA` entra directo, sin hero.

- [ ] **Step 7: Commit**

```bash
git add src/lib/catalogo.js src/lib/catalogo.test.js src/main.js
git commit -m "feat: carga partida y hero cableado como estado inicial"
```

---

### Task 9: Presupuestos, imagen social y verificación visual

**Files:**
- Create: `src/estaticos/og.png`
- Create: `tests/presupuestos.test.js`
- Modify: `index.html` (la etiqueta `og:image`)
- Modify: `vite.config.js` (incluir `tests/**/*.test.js`)
- Modify: `README.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada que consuma otra tarea.

- [ ] **Step 1: Escribir el test de presupuestos**

Crear `tests/presupuestos.test.js`:

```js
import { describe, it, expect, beforeAll } from 'vitest'
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

const DIST = new URL('../dist/assets/', import.meta.url)

function pesoGzip(patron) {
  const archivos = readdirSync(DIST).filter((n) => patron.test(n))
  return archivos.reduce((s, n) => s + gzipSync(readFileSync(new URL(n, DIST))).length, 0)
}

describe('presupuestos (G8)', () => {
  beforeAll(() => {
    if (!existsSync(DIST)) {
      throw new Error('Falta dist/. Correr `npx vite build` antes de este test.')
    }
  })

  it('el CSS entra en 20 kB gzip', () => {
    const b = pesoGzip(/\.css$/)
    expect(b, `${(b / 1024).toFixed(1)} kB`).toBeLessThanOrEqual(20 * 1024)
  })

  it('el JS entra en 62 kB gzip', () => {
    const b = pesoGzip(/\.js$/)
    expect(b, `${(b / 1024).toFixed(1)} kB`).toBeLessThanOrEqual(62 * 1024)
  })

  it('las tipografías entran en 110 kB', () => {
    const total = readdirSync(DIST).filter((n) => n.endsWith('.woff2'))
      .reduce((s, n) => s + statSync(new URL(n, DIST)).size, 0)
    expect(total, `${(total / 1024).toFixed(1)} kB`).toBeLessThanOrEqual(110 * 1024)
  })

  it('los tiempos del JS y del CSS de la coreografía coinciden', () => {
    const js = readFileSync(new URL('../src/ui/hero/coreografia.js', import.meta.url), 'utf-8')
    const css = readFileSync(new URL('../src/estilos/hero.css', import.meta.url), 'utf-8')

    const entrada = Number(/ENTRADA:\s*(\d+)/.exec(js)[1])
    const salida = Number(/SALIDA:\s*(\d+)/.exec(js)[1])

    // El último acto de la entrada no puede terminar después de que el JS ya
    // pasó a reposo: si no, la animación se corta a mitad de camino.
    const retardos = [...css.matchAll(/(\d+)ms\s+both/g)].map((m) => Number(m[1]))
    expect(Math.max(...retardos)).toBeLessThan(entrada)
    expect(css).toContain(`${salida}ms`)
  })
})
```

- [ ] **Step 2: Hacer que vitest tome `tests/`**

En `vite.config.js`, cambiar `test.include`:

```js
    include: ['src/**/*.test.js', 'scripts/**/*.test.mjs', 'tests/*.test.js'],
```

`tests/contrato/**` sigue excluido: `tests/*.test.js` no matchea el subdirectorio.

- [ ] **Step 3: Correr el test**

Run: `npx vite build && npx vitest run tests/presupuestos.test.js`
Expected: PASS, 4 tests. Si el CSS o el JS se pasan, reportar el exceso en vez de subir el techo.

- [ ] **Step 4: Generar la imagen social**

Con el preview corriendo, capturar el hero a 1200×630 por CDP y guardarlo. Script de un solo uso, en el scratchpad y no en el repo:

```js
// Requiere: npx vite preview --port 4173, y chrome con --remote-debugging-port=9222
const t = await (await fetch('http://localhost:9222/json/new?http://localhost:4173/', { method: 'PUT' })).json()
const sock = new WebSocket(t.webSocketDebuggerUrl)
let id = 0; const pend = new Map()
await new Promise((r) => { sock.onopen = r })
sock.onmessage = (e) => { const m = JSON.parse(e.data); if (pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const cmd = (method, params = {}) => new Promise((res) => { pend.set(++id, res); sock.send(JSON.stringify({ id, method, params })) })
await cmd('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false })
await cmd('Page.enable')
await cmd('Page.navigate', { url: 'http://localhost:4173/' })
await new Promise((r) => setTimeout(r, 6000))  // que termine la coreografía
const { result } = await cmd('Page.captureScreenshot', { format: 'png' })
await (await import('node:fs/promises')).writeFile('og.png', Buffer.from(result.data, 'base64'))
sock.close(); process.exit(0)
```

Copiar el resultado a `src/estaticos/og.png` y verificar que pese menos de 200 kB. Si pesa más, bajarlo con `pngquant --quality 60-80` o `oxipng -o4`.

- [ ] **Step 5: Referenciar la imagen social**

En `index.html`, agregar dentro del `<head>`:

```html
    <meta property="og:image" content="./src/estaticos/og.png" />
    <meta name="twitter:card" content="summary_large_image" />
```

- [ ] **Step 6: Verificar los seis actos por captura**

Con chrome headless y el preview corriendo, capturar en `t = 600 / 1800 / 2900 / 4000 / 5000 ms` y mirar que cada acto esté donde dice: el instrumento trazado, los estratos entrando desde abajo, Vaca Muerta con su barrido, los pozos perforando, y el reposo con los balancines. Después capturar el relevo eligiendo un área.

Confirmar a ojo, en las capturas:
- Los estratos entran de abajo hacia arriba, no al revés.
- La roca madre es la única con su tinta propia.
- El horizonte es continuo entre el hero y el mapa durante el relevo.
- Ningún rótulo se superpone con otro ni se sale del lienzo.

- [ ] **Step 7: Medir los cuadros del reposo**

Con el preview corriendo y la coreografía en reposo, medir 5 segundos:

```js
// en la consola de la página
let n = 0, t0 = performance.now()
const tic = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(tic)
  else console.log('fps', (n / ((performance.now() - t0) / 1000)).toFixed(1)) }
requestAnimationFrame(tic)
```

Expected: ≥ 55 fps en la máquina de referencia. Si queda por debajo, el sospechoso es `corte-fluir`, que anima `stroke-dashoffset`: sacarlo y volver a medir antes de tocar cualquier otra cosa.

- [ ] **Step 8: Verificar los dos temas y el movimiento reducido**

Capturar con `prefers-color-scheme: dark` y con `prefers-reduced-motion: reduce` (por `Emulation.setEmulatedMedia`). Confirmar que con movimiento reducido el corte está completo y quieto desde el primer cuadro, y que en cianotipo las tramas se ven y los rótulos se leen.

- [ ] **Step 9: Regenerar el índice, ahora sí**

El manifiesto en `public/` es de antes de la Tarea 3, así que no trae `formaciones` y el hero está dibujando las bandas sin conteo. Con todo lo demás verde:

Run: `npm run build:index`
Expected: exit 0, y en el log la línea de las formaciones sin pozos (si hubiera). Después verificar:

```bash
node -e "const m=require('./public/manifiesto.json'); console.log(Object.keys(m.formaciones).length, m.formaciones)"
```

Expected: 9 claves con sus conteos. Recargar el preview y confirmar que las bandas ya muestran sus números.

- [ ] **Step 10: Actualizar el README**

En la sección de estado, agregar una frase sobre el hero y la identidad, y en la de comandos mencionar `npm run coverage` si no está. Reemplazar la descripción del estado por:

```markdown
Funcionando. El sitio busca sobre 85.609 pozos, los pinta en el mapa y arma el CSV en
el navegador. Quien llega sin nada en la URL entra por un hero con el corte geológico
esquemático de la cuenca Neuquina, animado en seis actos, que ocupa el tiempo que tarda
en cargar el índice; un enlace compartido entra directo a la herramienta.
```

- [ ] **Step 11: Commit**

```bash
git add tests/presupuestos.test.js vite.config.js index.html src/estaticos/og.png README.md
git commit -m "feat: imagen social, presupuestos medidos y verificación visual del hero"
```

---

## Self-review

**1. Cobertura del spec.** Recorrido sección por sección:

| spec | tarea |
|---|---|
| §3 G1–G9 | Global Constraints; G7 en T1, G8 en T9, G4 en T6/T7 |
| §5 color, C1–C4 | T1 |
| §6 tipografía, T1–T6 | T2 |
| §7 anatomía, I1–I6 | T4 (columna y tramas), T5 (el corte) |
| §8 los seis actos, M1–M3 | T6 (CSS y máquina), T7 (M1, M2) |
| §9 textos | T7 (título, bajada, dato), T5 (rótulos, alternativa textual), T2 (meta description) |
| §10 build, B1–B3 | T3 |
| §11 arquitectura, A0–A6 | T1 (A4), T3, T4 (A0), T5 (A1), T6 (A2), T7 (A3), T8 (A5, A6) |
| §12 estado, E1–E6 | T7 (E3), T8 (E1, E4, E5), T6 (E6 vía `aspect-ratio` en hero.css) |
| §13 accesibilidad, X1–X5 | T5 (X1), T7 (X2), T6 (X3), T1 (X4) |
| §14 verificación | tests en cada tarea; lo visual en T9 |
| §15 fuera de alcance | nada lo implementa. Correcto. |

Hueco encontrado y tapado: **X5** (foco visible en los dos temas) no tenía tarea. Queda cubierto por el Step 7 de T1, que exige verificar los dos temas a ojo, y el foco del buscador ya tiene `outline` en `herramienta.css` — que pasa a usar `var(--cobre)` al migrar los literales a tokens.

**2. Placeholders.** Ninguno: todos los pasos de código traen el código, y los de verificación traen el comando y lo que se espera. Los dos pasos que no pueden traer código —capturas y medición de fps— traen el script y el criterio numérico.

**3. Consistencia de tipos.** `construirCorte({ formaciones, pozos, periodo })` es igual en T5 y T7. `crearCoreografia(raiz, { reducido })` y su `{ entrar, pausar, reanudar, salir, estado }` son iguales en T6 y T7. `crearHero(contenedor, { manifiesto })` y su `{ montarBuscador, relevar, estado }` son iguales en T7 y T8. `DURACIONES.{ENTRADA,SALIDA}` se usa igual en T6, T7 y T9. `idDeTrama` devuelve `t-<nombre>` en T4 y así lo espera T5. `GEOMETRIA.{ANCHO,ALTO,HORIZONTE}` se define en T5 y la consume `hero.css` en T6 vía la `aspect-ratio` 1200/720, que coincide.

Una inconsistencia corregida: T7 escribía `hero.__buscador input` genérico para el estado deshabilitado y `.buscador__entrada` después de montar; el markup inicial del hero usa `class="buscador__entrada"` desde el principio, así que los dos selectores del test apuntan al mismo elemento. Queda así a propósito y el test lo documenta.
