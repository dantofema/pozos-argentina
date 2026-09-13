// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
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

  // --- Fix round: §7.1 completo y colisiones de rótulo, halladas al renderizar ---

  it('dibuja la línea de la estepa sobre el horizonte, distinta de la recta (§7.1)', () => {
    const caja = montar()
    const estepa = caja.querySelector('.corte__superficie .corte__estepa')
    expect(estepa).not.toBeNull()
    expect(estepa).not.toBe(caja.querySelector('.corte__horizonte'))
  })

  it('dibuja una torre de perforación quieta, sobre la superficie (§7.1)', () => {
    const torre = montar().querySelector('.corte__superficie .corte__torre')
    expect(torre).not.toBeNull()
  })

  it('dibuja una antorcha con su llama en un elemento propio, sobre un mástil (§7.1)', () => {
    const antorcha = montar().querySelector('.corte__superficie .corte__antorcha')
    expect(antorcha).not.toBeNull()
    expect(antorcha.querySelector('.antorcha__llama')).not.toBeNull()
  })

  it('el <desc> nombra la antorcha: el alt text no puede describir lo que no está dibujado', () => {
    const desc = montar().querySelector('svg desc').textContent.toLowerCase()
    expect(desc).toContain('antorcha')
    expect(desc).toMatch(/roca madre/i)
  })

  it('los rótulos de formación no arrancan en la misma banda de x que la escala de profundidad', () => {
    const caja = montar()
    const xEscala = Number(caja.querySelector('.corte__marca text').getAttribute('x'))
    const xRotulos = [...caja.querySelectorAll('.corte__rotulo')].map((t) => Number(t.getAttribute('x')))
    expect(xRotulos.length).toBeGreaterThan(0)
    for (const x of xRotulos) {
      expect(x, 'un rótulo de banda quedó en el canal de la escala').toBeGreaterThan(xEscala + 40)
    }
  })

  it('el balancín tiene cabeza de caballo en la viga, la seña que lo hace reconocible', () => {
    const caja = montar()
    for (const b of caja.querySelectorAll('.balancin')) {
      expect(b.querySelector('.balancin__viga .balancin__cabeza')).not.toBeNull()
    }
  })

  it('el contrapeso cuelga de una manivela cerca de la base, no de la punta de la viga', () => {
    const caja = montar()
    for (const b of caja.querySelectorAll('.balancin')) {
      expect(b.querySelector('.balancin__manivela')).not.toBeNull()
      const contrapeso = b.querySelector('.balancin__contrapeso')
      const [, , ty] = contrapeso.getAttribute('transform').match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/)
      // La punta de la viga está en y=-58; la base, en y=0. Cerca de la base
      // es "más cerca de 0 que del punto medio hacia la punta".
      expect(Math.abs(Number(ty)), 'el contrapeso quedó cerca de la punta de la viga').toBeLessThan(29)
    }
  })

  // --- Segunda ronda de arreglos: la cabeza leía como espiral, no como pieza ---

  it('la cabeza de caballo es una placa cerrada (sector circular), no un rizo abierto', () => {
    const caja = montar()
    for (const b of caja.querySelectorAll('.balancin')) {
      const cabeza = b.querySelector('.balancin__viga .balancin__cabeza')
      const d = cabeza.getAttribute('d')
      // Un sector circular usa un arco (comando A) y cierra (Z): un rizo
      // hecho de curvas Bézier (C) sin cerrar es exactamente lo que se sacó.
      expect(d, 'la cabeza no tiene un borde curvo en arco (A): no es un sector circular').toMatch(/A/)
      expect(/Z\s*$/i.test(d.trim()), 'la cabeza queda con un extremo suelto: no es una placa cerrada').toBe(true)
    }
  })

  it('cabeza y cable son hijos de la viga, para que la acompañen cuando cabecee', () => {
    const caja = montar()
    for (const b of caja.querySelectorAll('.balancin')) {
      const viga = b.querySelector('.balancin__viga')
      expect(viga.querySelector('.balancin__cabeza')).not.toBeNull()
      expect(viga.querySelector('.balancin__cable')).not.toBeNull()
    }
  })

  it('el cable cuelga vertical del borde de la cabeza y cae alineado con el pozo de su balancín', () => {
    const caja = montar()
    const balancines = [...caja.querySelectorAll('.balancin')]
    const casings = [...caja.querySelectorAll('.corte__casing')]
    expect(balancines).toHaveLength(casings.length)

    balancines.forEach((b, i) => {
      const cable = b.querySelector('.balancin__viga .balancin__cable')
      expect(cable).not.toBeNull()
      const x1 = Number(cable.getAttribute('x1'))
      const x2 = Number(cable.getAttribute('x2'))
      expect(x1, 'el cable no es vertical').toBe(x2)

      // El cable vive en coordenadas locales del balancín: lo llevo a
      // coordenadas absolutas con el mismo translate/scale que el SVG le
      // aplica al grupo, para compararlo con el casing del pozo (que ya está
      // en absolutas).
      const transform = b.getAttribute('transform')
      const [, tx, , escala] = transform.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/)
      const xAbsolutoCable = Number(tx) + x1 * Number(escala)
      const xAbsolutoCasing = Number(casings[i].getAttribute('x1'))
      expect(xAbsolutoCable, 'el cable no cae sobre el pozo de su balancín').toBeCloseTo(xAbsolutoCasing, 0)
    })
  })

  // --- Tercera ronda: dos colisiones tipográficas que la revisión encontró ---
  // jsdom no implementa getBBox() (no hay layout de texto real), así que
  // estos tests no pueden medir anchos de glifo como se hizo en la
  // verificación visual con Chrome headless (documentada en el reporte).
  // Son un piso conservador sobre las coordenadas fuente, para atajar el
  // tipo exacto de regresión que causó las dos colisiones: dos valores de
  // `x`/`y` puestos a mano en `corte.js` que se desalinean en silencio.

  it('la leyenda de la escala no se pisa con la última marca (3.000 m)', () => {
    const caja = montar()
    const marcas = [...caja.querySelectorAll('.corte__marca text')]
    const ultimaMarcaY = Number(marcas.at(-1).getAttribute('y'))
    const leyendaY = Number(caja.querySelector('.corte__leyenda').getAttribute('y'))
    expect(leyendaY - ultimaMarcaY, 'la leyenda quedó pegada a la última marca de profundidad').toBeGreaterThan(20)
  })

  it('el casing del primer pozo queda lejos del rótulo de la roca madre, el más largo de los nueve (I5)', () => {
    const caja = montar()
    const rotuloMadre = caja.querySelector('.corte__estrato--madre .corte__rotulo')
    const xRotulo = Number(rotuloMadre.getAttribute('x'))
    const xCasing0 = Number(caja.querySelectorAll('.corte__casing')[0].getAttribute('x1'))
    // Medido con getBBox() en Chrome headless con el manifiesto de
    // referencia: el rótulo completo ("VACA MUERTA · ROCA MADRE ·
    // 3.547 pozos") llega a ~360px de ancho. Dejo piso en 380 para nombres o
    // cifras algo más largos que los del manifiesto de referencia.
    expect(xCasing0 - xRotulo, 'el casing del primer pozo quedó demasiado cerca del rótulo de la roca madre').toBeGreaterThan(380)
  })

  it('los laterales de los pozos no se salen del lienzo', () => {
    const caja = montar()
    for (const l of caja.querySelectorAll('.corte__lateral')) {
      for (const atributo of ['x1', 'x2']) {
        const x = Number(l.getAttribute(atributo))
        expect(x, `${atributo} del lateral se sale del lienzo`).toBeGreaterThanOrEqual(0)
        expect(x, `${atributo} del lateral se sale del lienzo`).toBeLessThanOrEqual(GEOMETRIA.ANCHO)
      }
    }
  })

  // --- Ronda de la Tarea 7: a 390px sólo se ve hasta x=333 (xMinYMax slice),
  // y "VACA MUERTA · ROCA MADRE · 3.547 pozos" (arranca en x=74) se sale de
  // esa ventana. El rótulo de la roca madre es el único que la regla de
  // pantallas angostas deja visible a propósito (I5): partirlo en `tspan`
  // permite ocultar sólo el rol y el conteo en ese ancho, y que sobreviva
  // "VACA MUERTA" sola. jsdom no mide anchos (ver nota más arriba), así que
  // esto verifica la estructura, no el ancho -- el ancho está medido con
  // Chrome headless y documentado en el reporte.
  it('el rótulo de la roca madre separa nombre, rol y conteo en tspan propios (I5, angosto)', () => {
    const caja = montar()
    const rotuloMadre = caja.querySelector('.corte__estrato--madre .corte__rotulo')
    const nombre = rotuloMadre.querySelector('.corte__rotulo-nombre')
    const rol = rotuloMadre.querySelector('.corte__rotulo-rol')
    const cifra = rotuloMadre.querySelector('.corte__rotulo-cifra')
    expect(nombre.textContent).toBe('VACA MUERTA')
    expect(rol.textContent.toUpperCase()).toContain('ROCA MADRE')
    expect(cifra.textContent).toContain('3.547')
    // El nombre solo, sin el resto: es lo que tiene que sobrevivir a 390px.
    expect(nombre.textContent).not.toContain('ROCA MADRE')
    expect(nombre.textContent).not.toContain('3.547')
  })

  it('el tspan del conteo de la roca madre no aparece si el manifiesto no trae conteos (B1)', () => {
    const { 'VACA MUERTA': _omitida, ...incompleto } = MANIFIESTO
    const caja = montar({ formaciones: incompleto })
    const rotuloMadre = caja.querySelector('.corte__estrato--madre .corte__rotulo')
    expect(rotuloMadre.querySelector('.corte__rotulo-nombre').textContent).toBe('VACA MUERTA')
    expect(rotuloMadre.querySelector('.corte__rotulo-rol')).not.toBeNull()
    expect(rotuloMadre.querySelector('.corte__rotulo-cifra')).toBeNull()
    expect(rotuloMadre.textContent).not.toMatch(/undefined|NaN/)
  })

  // --- Revisión de la Tarea 8 (hallazgo 2): la Tarea 7 movía el rótulo de la
  // cuenca de coordenada en coordenada para librar el casing del tercer
  // balancín Y sobrevivir el recorte de `slice`, pero a 1280x900 las dos
  // condiciones son incompatibles -- no hay ningún x que las cumpla juntas
  // (medido: viewport visible hasta x=1024, y el casing exige x>1034). El
  // problema era el LUGAR, no la coordenada. Se lo bajó a la esquina inferior
  // izquierda, junto a la leyenda de profundidad: con `xMinYMax slice` el
  // borde izquierdo (x=0) y el borde inferior (y=720) nunca se recortan --
  // son justo los dos bordes que la proyección ancla-- así que esa esquina
  // no necesita, a diferencia de la posición vieja, verificar ventana por
  // viewport. Y ahí abajo no pasa ningún casing (los laterales de los pozos
  // viven a mitad de columna, no al fondo).
  it('el rótulo de la cuenca vive junto a la leyenda de profundidad, ancladas las dos a la izquierda (revisión, hallazgo 2)', () => {
    const caja = montar()
    const cuenca = caja.querySelector('.corte__cuenca')
    const leyenda = caja.querySelector('.corte__leyenda')
    // Sin text-anchor="end": el default de SVG es "start", ancla a la
    // izquierda -- el borde que `xMinYMax slice` nunca recorta.
    expect(cuenca.getAttribute('text-anchor')).toBeNull()
    expect(cuenca.getAttribute('x')).toBe(leyenda.getAttribute('x'))
    // Encima de la leyenda de profundidad y cerca, como un mismo bloque: "de
    // qué cuenca es" antes que "cómo leer la escala", no dos rótulos sueltos
    // a cualquier distancia entre sí. El piso (>=18) guarda contra la
    // regresión de la Ronda 4: 16 unidades locales de separación entre
    // baselines dieron, medido con getBoundingClientRect() real, apenas
    // 0,6 a 2,6px de aire en pantalla -- "tocándose, no leyendo como
    // bloque" (revisión). No hay forma de que jsdom mida eso -no renderiza-,
    // así que el piso de acá es deliberadamente más generoso que el mínimo
    // que en su momento resultó insuficiente.
    const yCuenca = Number(cuenca.getAttribute('y'))
    const yLeyenda = Number(leyenda.getAttribute('y'))
    expect(yCuenca, 'la cuenca tiene que ir arriba de la leyenda de profundidad').toBeLessThan(yLeyenda)
    const separacion = yLeyenda - yCuenca
    expect(separacion, 'las dos leyendas se separaron demasiado para leer como un bloque').toBeLessThanOrEqual(24)
    expect(separacion, 'las dos leyendas están tan cerca que van a tocarse en pantalla (Ronda 5)').toBeGreaterThanOrEqual(18)
  })

  // --- Revisión de la Tarea 8 (Ronda 5, Critical 2): el rincón se armó
  // contra una resta fija sobre ALTO (y=ALTO-30) sin mirar qué más vive
  // ahí -el rótulo de la última banda, Lajas, en y=b.y+20-. Cinco unidades
  // de diferencia entre las dos baselines, "LAJAS" y "CUENCA NEUQUINA"
  // pisándose en los cinco viewports. Y era invisible para los tests
  // existentes: el de arriba compara cuenca contra leyenda, nunca contra el
  // rótulo de banda que ya vivía en esa esquina. Este test cierra ese
  // agujero verificando la coordenada real de la última banda de
  // COLUMNA_NEUQUINA, no un número copiado de haberla medido una vez -si el
  // día de mañana cambian los pesos de `bandas()` y la última banda deja de
  // ser Lajas o cambia de alto, este test se sigue cumpliendo con la banda
  // que sea.
  it('el rótulo de la cuenca no se pisa con el de la última banda de la columna (revisión, Ronda 5, Critical 2)', () => {
    const caja = montar()
    const rotulos = [...caja.querySelectorAll('.corte__estrato .corte__rotulo')]
    const ultimoRotulo = rotulos[rotulos.length - 1]
    const cuenca = caja.querySelector('.corte__cuenca')
    // Mismo cálculo que arma CUALQUIER rótulo de banda (`b.y + 20`, en
    // construirCorte): la baseline del último rótulo cae ahí, no en `b.y`.
    const finUltimoRotulo = Number(ultimoRotulo.getAttribute('y'))
    const yCuenca = Number(cuenca.getAttribute('y'))
    expect(yCuenca, 'la cuenca tiene que ir abajo del rótulo de la última banda').toBeGreaterThan(finUltimoRotulo)
    const separacion = yCuenca - finUltimoRotulo
    // Piso subido de 8 a 20 en la Tarea 9: este test sólo ve coordenadas del
    // SVG (distancia entre baselines), no cajas renderizadas, así que su piso
    // tiene que superar lo que la fuente y los halos se comen antes de dejar
    // margen real -13px el alto del rótulo de banda, 11px la leyenda, más los
    // halos de `paint-order: stroke` (3,5px y 3px)-, unas 14 unidades en
    // total. Con el piso viejo (8), pasaba en verde con "LAJAS" y "CUENCA
    // NEUQUINA" superpuestos -5 a -8px en los cinco viewports (medido con
    // getBoundingClientRect() real): el test vigilaba menos de lo que la
    // realidad exige. El par vecino (cuenca↔leyenda, el test de arriba) ya
    // pedía 18; este no puede pedir menos que ese vecino sin volver a quedar
    // corto.
    expect(separacion, 'el rótulo de la cuenca se pisa con el de la última banda (Ronda 5, Critical 2)').toBeGreaterThanOrEqual(20)
  })

  // Revisión de la Tarea 9: subir el margen de arriba (Ronda 5 -> 24) sin
  // vigilar esto por poco introduce un bug nuevo, peor que el que arregla.
  // El `<svg>` recorta todo lo que cae en y > GEOMETRIA.ALTO (es el borde
  // inferior del viewBox, y su overflow no es `visible`): con el margen en
  // 24 y nada más, la leyenda de profundidad caía en y=729 -9 unidades
  // pasado ALTO=720- y el navegador la mostraba recortada casi por
  // completo, no superpuesta con nada, directamente invisible en su
  // mayor parte. Confirmado navegando de verdad (CDP): `escena.bottom -
  // leyenda.bottom` daba entre -12 y -19px en los cinco viewports. Este
  // test vigila esa cuenta en coordenadas de lienzo, con el mismo margen de
  // seguridad (unas 5 unidades) que dejaba el reparto de antes de esta
  // tarea entre el halo/descenso de la leyenda y el borde.
  it('la leyenda de profundidad no cae más allá de ALTO: el svg la recortaría (Tarea 9)', () => {
    const caja = montar()
    const leyenda = caja.querySelector('.corte__leyenda')
    const yLeyenda = Number(leyenda.getAttribute('y'))
    const margen = GEOMETRIA.ALTO - yLeyenda
    expect(margen, 'la leyenda cae después de ALTO: el svg la recorta').toBeGreaterThanOrEqual(5)
  })

  it('el rótulo de la cuenca vive dentro de .corte__escala: se esconde y se hunde con la leyenda sin reglas propias', () => {
    const caja = montar()
    expect(caja.querySelector('.corte__escala .corte__cuenca')).not.toBeNull()
  })

  // Revisión de la Tarea 8 (Ronda 5): "el rótulo de cada banda... no se
  // solapen" -pedido explícito del revisor-. Con nueve bandas de 44 a 66
  // unidades de alto y un rótulo de 13px, ninguna combinación de pesos
  // razonable las hace chocar hoy, pero es exactamente el tipo de cosa que
  // "hoy no pasa" y nadie vuelve a mirar: si el día de mañana `bandas()`
  // reparte pesos distintos (una banda mucho más fina, por ejemplo), este
  // test es el que se entera primero.
  it('los rótulos de bandas consecutivas no se pisan entre sí', () => {
    const rotulos = [...montar().querySelectorAll('.corte__estrato .corte__rotulo')]
      .map((r) => Number(r.getAttribute('y')))
    for (let i = 1; i < rotulos.length; i++) {
      expect(rotulos[i] - rotulos[i - 1], `rótulo ${i} se pisa con el rótulo ${i - 1}`)
        .toBeGreaterThanOrEqual(20)
    }
  })
})

// --- Revisión final, Critical 1: el texto se imprimía sobre el dibujo en
// cinco de los siete viewports REALES (viewport = pantalla menos el cromo del
// navegador, que es lo que las verificaciones anteriores no usaron). El
// mecanismo: con `xMinYMax slice` la escala es `max(ancho/ANCHO, alto/ALTO)`,
// y mientras mande el término del ancho el cielo -lo único sobre lo que el
// texto se puede apoyar- se achica a medida que el viewport se ensancha.
//
// Estos tres tests vigilan la reparación desde el lado que jsdom sí puede
// ver: la relación entre las constantes del dibujo y la hoja de estilos. Las
// cajas renderizadas se miden con CDP (ver el reporte de la ola final); acá
// se guarda que nadie deshaga las condiciones que hacen que esa medición dé
// positivo.
describe('el cielo no depende del ancho del viewport (revisión final, Critical 1)', () => {
  // `import.meta.url` va a una variable y no como literal inline en
  // `new URL()`: ese patrón exacto es el que Vite reconoce como sintaxis de
  // asset URL y, bajo jsdom, resuelve contra el `location` falso en vez del
  // archivo real -- `readFileSync` explota con "The URL must be of scheme
  // file". Mismo cuidado que en `coreografia.test.js`.
  const base = import.meta.url
  const hoja = readFileSync(new URL('../../estilos/hero.css', base), 'utf-8')

  it('.hero__dibujo lleva un techo de ancho con el MISMO aspecto que el lienzo', () => {
    // Sin este techo, un viewport más ancho que ANCHO/ALTO vuelve a hacer
    // mandar al término del ancho y el cielo se evapora de nuevo. Con él, la
    // caja del dibujo nunca supera ese aspecto, así que la escala vale
    // siempre `altoEscena/ALTO` y el cielo siempre `HORIZONTE/ALTO` del alto
    // de la escena.
    const techo = /width:\s*min\(100%,\s*calc\(100cqh\s*\*\s*(\d+)\s*\/\s*(\d+)\)\)/.exec(hoja)
    expect(techo, 'falta el techo de ancho de .hero__dibujo: C1 vuelve').not.toBeNull()
    expect(Number(techo[1]), 'el techo no usa el ANCHO del lienzo').toBe(GEOMETRIA.ANCHO)
    expect(Number(techo[2]), 'el techo no usa el ALTO del lienzo').toBe(GEOMETRIA.ALTO)
  })

  it('--escala es sólo el término del alto: con el techo puesto, el del ancho no puede ganar', () => {
    const escala = /--escala:\s*([^;]+);/.exec(hoja)
    expect(escala).not.toBeNull()
    expect(escala[1], 'volvió el término del ancho a --escala').not.toContain('cqw')
    expect(escala[1]).toContain(`/ ${GEOMETRIA.ALTO}`)
  })

  it('los objetos de superficie viven a la derecha de la columna de texto y dentro del recorte', () => {
    // Los dos límites están medidos con getBoundingClientRect() real por CDP
    // en los siete viewports de alturas reales:
    //  - 745: la unidad local más a la derecha que alcanza el bloque de texto
    //    (peor caso, 1366x641, el de escala más chica).
    //  - 1427: la unidad local más a la derecha que se ve en TODOS ellos
    //    (peor caso, 1728x981, el de escena más alta en proporción).
    // Un balancín asoma 58 unidades sobre el horizonte y la antorcha 126: a
    // la izquierda de 745 le cruzan las últimas líneas a la bajada por más
    // cielo que haya, y a la derecha de 1427 no se ven.
    const LIMITE_TEXTO = 745
    const LIMITE_RECORTE = 1427
    const caja = montar()
    // Semiancho de cada objeto en SUS unidades locales, leído del `d` que lo
    // dibuja en corte.js: el balancín va de -52 (punta trasera de la viga) a
    // +66 (borde de la cabeza de caballo); la torre, de -20 a +20; la
    // antorcha, de -9 a +10 (la llama).
    const CAJA = {
      balancin: [-52, 66],
      corte__torre: [-20, 20],
      corte__antorcha: [-9, 10],
    }
    const objetos = [...caja.querySelectorAll('.balancin, .corte__torre, .corte__antorcha')]
    expect(objetos.length).toBe(5)
    for (const o of objetos) {
      const t = o.getAttribute('transform')
      const x = Number(/translate\(([-\d.]+)/.exec(t)[1])
      const escala = Number(/scale\(([-\d.]+)\)/.exec(t)?.[1] ?? 1)
      const [a, b] = CAJA[o.getAttribute('class').split(' ')[0]]
      const izquierda = x + a * escala
      const derecha = x + b * escala
      expect(izquierda, `${o.getAttribute('class')} invade la columna de texto`).toBeGreaterThanOrEqual(LIMITE_TEXTO)
      expect(derecha, `${o.getAttribute('class')} cae fuera del recorte visible`).toBeLessThanOrEqual(LIMITE_RECORTE)
    }
  })
})

// --- Revisión final, Critical 2: `.hero__texto` es un bloque de ancho
// completo, así que cualquier fondo que declare se pinta de borde a borde del
// hero -1200 a 1920px- y no detrás del texto. El degradé que tenía tapaba de
// tres a cinco objetos de superficie en cada viewport y cortaba los
// balancines y la antorcha por la mitad. Si algún día vuelve a hacer falta un
// respaldo, tiene que ir acotado al ancho del texto.
describe('el texto no pinta sobre el dibujo (revisión final, Critical 2)', () => {
  const base = import.meta.url
  const hoja = readFileSync(new URL('../../estilos/hero.css', base), 'utf-8')

  function cuerpoDeRegla(css, selector) {
    // El bloque de una regla, saltando los comentarios que la preceden.
    const i = css.indexOf(`\n${selector} {`)
    if (i < 0) return null
    const apertura = css.indexOf('{', i)
    return css.slice(apertura + 1, css.indexOf('}', apertura))
  }

  it('.hero__texto no declara ningún fondo, o lo acota a fit-content', () => {
    const cuerpo = cuerpoDeRegla(hoja, '.hero__texto')
    expect(cuerpo, 'no se encontró la regla de .hero__texto').not.toBeNull()
    // Sólo declaraciones: los comentarios de adentro del bloque nombran el
    // degradé que se sacó, y nombrarlo no es declararlo.
    const sinComentarios = cuerpo.replace(/\/\*[\s\S]*?\*\//g, '')
    const pintaFondo = /(^|;)\s*background(-image|-color)?\s*:/.test(sinComentarios)
    if (pintaFondo) {
      expect(sinComentarios, 'un fondo en .hero__texto se pinta de borde a borde del hero: acotalo con width: fit-content')
        .toMatch(/width:\s*fit-content/)
    } else {
      expect(pintaFondo).toBe(false)
    }
  })
})
