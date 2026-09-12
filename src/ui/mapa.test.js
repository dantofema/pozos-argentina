// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import L from 'leaflet'
import { crearMapa, VISTA_INICIAL } from './mapa.js'

/**
 * Leaflet lee dimensiones del contenedor, y en jsdom todo mide cero. Con la caja
 * fijada el mapa funciona de verdad: convierte coordenadas de pantalla a latlng
 * y dispara sus eventos. No se prueba que dibuje —eso es de Leaflet—, sino la
 * máquina de estados del modo dibujo, que es nuestra.
 */
function contenedorMedido() {
  const c = document.createElement('div')
  for (const [prop, valor] of [
    ['clientWidth', 800], ['clientHeight', 500],
    // offsetWidth/Height también: Leaflet calcula la escala como
    // rect.width / offsetWidth, y en jsdom eso da Infinity, con lo cual todas
    // las coordenadas colapsan al mismo punto y cualquier rectángulo sale
    // degenerado. Sin esto el test miente.
    ['offsetWidth', 800], ['offsetHeight', 500],
  ]) Object.defineProperty(c, prop, { value: valor })
  c.getBoundingClientRect = () => ({
    left: 0, top: 0, x: 0, y: 0, width: 800, height: 500, right: 800, bottom: 500,
  })
  document.body.appendChild(c)
  return c
}

const evento = (x, y) => ({ clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0, which: 1 })

let contenedor
let afuera
let m

beforeEach(() => {
  document.body.innerHTML = ''
  contenedor = contenedorMedido()
  // Un elemento fuera del mapa, para el gesto que termina afuera.
  afuera = document.createElement('div')
  document.body.appendChild(afuera)
  // SVG y no canvas: jsdom no tiene contexto 2D. La lógica de limpieza que se
  // prueba acá no depende del renderer.
  m = crearMapa(contenedor, { preferCanvas: false })
})

function apretar(x, y) {
  contenedor.dispatchEvent(new MouseEvent('mousedown', evento(x, y)))
}
/**
 * Los eventos van sobre un elemento real y burbujean hasta `document`, que es
 * donde escucha el gesto. Despacharlos sobre `document` directamente deja
 * `event.target` en el documento, y el Draggable interno de Leaflet —que
 * también escucha ahí— explota al intentar sacarle una clase.
 */
function mover(x, y, destino = contenedor) {
  destino.dispatchEvent(new MouseEvent('mousemove', evento(x, y)))
}
function soltar(x, y, destino = contenedor) {
  destino.dispatchEvent(new MouseEvent('mouseup', evento(x, y)))
}
function moverYsoltar(x, y, destino = contenedor) {
  mover(x, y, destino)
  soltar(x, y, destino)
}
// Se cuenta por tipo y no el total de capas: el renderer se agrega como capa en
// el primer vector y se queda ahí, así que el total nunca vuelve al valor
// inicial aunque no haya fuga.
const rectangulos = () => Object.values(m.mapa._layers).filter((c) => c instanceof L.Rectangle).length
const marcadores = () => Object.values(m.mapa._layers).filter((c) => c instanceof L.CircleMarker).length

describe('modo dibujo', () => {
  it('arranca desarmado y sin tocar el arrastre del mapa', () => {
    expect(m.estaDibujando()).toBe(false)
    expect(m.mapa.dragging.enabled()).toBe(true)
  })

  it('al armar deshabilita el arrastre y marca el contenedor', () => {
    m.alternarDibujo()
    expect(m.estaDibujando()).toBe(true)
    expect(m.mapa.dragging.enabled()).toBe(false)
    expect(contenedor.classList.contains('mapa--dibujando')).toBe(true)
  })

  it('cancelar con el mismo botón devuelve todo a su lugar', () => {
    m.alternarDibujo()
    m.alternarDibujo()
    expect(m.estaDibujando()).toBe(false)
    expect(m.mapa.dragging.enabled()).toBe(true)
    expect(contenedor.classList.contains('mapa--dibujando')).toBe(false)
  })

  it('un arrastre entrega el anillo y desarma el modo solo', () => {
    const alDibujar = vi.fn()
    m.alDibujar(alDibujar)
    m.alternarDibujo()
    apretar(100, 100)
    moverYsoltar(300, 300)

    expect(alDibujar).toHaveBeenCalledTimes(1)
    const anillo = alDibujar.mock.calls[0][0]
    expect(anillo).toHaveLength(4)
    expect(anillo.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat))).toBe(true)
    expect(m.estaDibujando()).toBe(false)
    expect(m.mapa.dragging.enabled()).toBe(true)
  })

  it('sin el modo armado, arrastrar no dibuja nada', () => {
    const alDibujar = vi.fn()
    m.alDibujar(alDibujar)
    apretar(100, 100)
    moverYsoltar(300, 300)
    expect(alDibujar).not.toHaveBeenCalled()
  })

  it('apretar y soltar sin mover no es una zona', () => {
    const alDibujar = vi.fn()
    m.alDibujar(alDibujar)
    m.alternarDibujo()
    apretar(150, 150)
    moverYsoltar(150, 150)
    expect(alDibujar).not.toHaveBeenCalled()
    expect(m.estaDibujando()).toBe(false)
    expect(m.mapa.dragging.enabled()).toBe(true)
  })

  it('no deja rectángulo fantasma después del gesto', () => {
    m.alternarDibujo()
    apretar(100, 100)
    mover(200, 200)
    expect(rectangulos()).toBe(1) // se va dibujando mientras arrastrás
    mover(300, 300)
    expect(rectangulos()).toBe(1) // y se reemplaza, no se acumula
    soltar(300, 300)
    expect(rectangulos()).toBe(0)
  })

  it('volver al inicio a mitad de un gesto limpia todo', () => {
    m.alternarDibujo()
    apretar(100, 100)
    mover(250, 250)

    expect(rectangulos()).toBe(1)

    m.volverAlInicio()

    expect(m.estaDibujando()).toBe(false)
    expect(m.mapa.dragging.enabled()).toBe(true)
    expect(rectangulos()).toBe(0)
  })

  it('cancelar a mitad del gesto lo aborta: soltar después no dibuja nada', () => {
    const alDibujar = vi.fn()
    m.alDibujar(alDibujar)
    m.alternarDibujo()
    apretar(100, 100)
    m.alternarDibujo() // cancelar a mitad del gesto
    moverYsoltar(300, 300)
    expect(alDibujar).not.toHaveBeenCalled()
  })

  it('el gesto termina aunque se suelte el botón fuera del mapa', () => {
    const alDibujar = vi.fn()
    m.alDibujar(alDibujar)
    m.alternarDibujo()
    apretar(100, 100)
    mover(300, 300)
    soltar(900, 700, afuera) // el mouseup ocurre fuera del contenedor del mapa

    expect(alDibujar).toHaveBeenCalledTimes(1)
    expect(m.estaDibujando()).toBe(false)
    expect(m.mapa.dragging.enabled()).toBe(true)
    expect(rectangulos()).toBe(0)
  })

  it('cada gesto dispara exactamente una vez', () => {
    const alDibujar = vi.fn()
    m.alDibujar(alDibujar)
    for (const desde of [100, 150]) {
      m.alternarDibujo()
      apretar(desde, desde)
      moverYsoltar(desde + 200, desde + 200)
    }
    expect(alDibujar).toHaveBeenCalledTimes(2)
  })

  // Nota: que `limpiarGesto` desenganche sus listeners de `document` no se
  // puede testear desde afuera. `L.DomEvent.on` es idempotente, así que sin el
  // `off` tampoco se acumulan, y `alMover`/`alSoltar` salen temprano cuando no
  // hay gesto en curso: el comportamiento observable es idéntico con y sin esa
  // limpieza. Se verificó por mutación. Los `off` se quedan por higiene —no
  // dejar listeners colgados de por vida—, no porque haya un test que los
  // cubra, y se prefiere decirlo a escribir un test que finja cubrirlos.

  it('avisa cada vez que el modo se arma o se desarma', () => {
    const cambios = []
    m.alCambiarModoDibujo((activo) => cambios.push(activo))
    m.alternarDibujo()
    m.alternarDibujo()
    expect(cambios).toEqual([true, false])
  })
})

describe('volverAlInicio', () => {
  it('devuelve el mapa a la vista de arranque', () => {
    m.mapa.setView([-45, -67], 9)
    m.volverAlInicio()
    expect(m.mapa.getZoom()).toBe(VISTA_INICIAL.zoom)
    expect(m.mapa.getCenter().lat).toBeCloseTo(VISTA_INICIAL.centro[0], 1)
    expect(m.mapa.getCenter().lng).toBeCloseTo(VISTA_INICIAL.centro[1], 1)
  })

  it('no borra los pozos mostrados: sólo mueve la vista', () => {
    m.mostrarPozos([[1, -68.6, -38.3, 0, 0, 0, 0, 0]])
    m.volverAlInicio()
    expect(marcadores()).toBe(1)
  })
})

describe('pozos en el mapa', () => {
  it('limpiarPozos deja el mapa como estaba', () => {
    m.mostrarPozos([
      [1, -68.6, -38.3, 0, 0, 0, 0, 0],
      [2, -68.7, -38.4, 0, 0, 0, 0, 1],
    ])
    expect(marcadores()).toBe(2)
    m.limpiarPozos()
    expect(marcadores()).toBe(0)
  })

  it('mostrarPozos reemplaza, no acumula', () => {
    m.mostrarPozos([[1, -68.6, -38.3, 0, 0, 0, 0, 0]])
    m.mostrarPozos([[2, -68.7, -38.4, 0, 0, 0, 0, 1]])
    expect(marcadores()).toBe(1)
  })
})

describe('la zona elegida', () => {
  const cuadrado = [[-69, -39], [-68, -39], [-68, -38], [-69, -38]]

  it('arranca sin zona', () => {
    expect(m.hayZona()).toBe(false)
  })

  it('mostrarZona la deja en el mapa', () => {
    m.mostrarZona(cuadrado)
    expect(m.hayZona()).toBe(true)
  })

  it('borrarZona la saca', () => {
    m.mostrarZona(cuadrado)
    m.borrarZona()
    expect(m.hayZona()).toBe(false)
  })

  it('mostrarZona reemplaza la anterior, no acumula', () => {
    m.mostrarZona(cuadrado)
    m.mostrarZona([[-70, -40], [-69, -40], [-69, -39], [-70, -39]])
    expect(m.hayZona()).toBe(true)
    // Una sola: el polígono de la zona es el único que queda.
    const poligonos = Object.values(m.mapa._layers).filter((c) => c instanceof L.Polygon)
    expect(poligonos).toHaveLength(1)
  })

  it('un anillo degenerado no deja zona', () => {
    m.mostrarZona([[-69, -39], [-68, -39]])
    expect(m.hayZona()).toBe(false)
  })

  it('la zona sobrevive a volver al inicio: sigue siendo el ámbito elegido', () => {
    m.mostrarZona(cuadrado)
    m.volverAlInicio()
    expect(m.hayZona()).toBe(true)
  })

  it('encuadrarZona lleva la vista a la zona, para que se vea entera', () => {
    m.mapa.setView([-20, -60], 10)
    m.mostrarZona(cuadrado)
    m.encuadrarZona()
    const vista = m.mapa.getBounds()
    expect(vista.contains(L.latLngBounds([[-39, -69], [-38, -68]]))).toBe(true)
  })
})
