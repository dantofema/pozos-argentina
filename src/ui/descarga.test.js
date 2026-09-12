// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { nombreArchivo, crearPanelDescarga } from './descarga.js'

describe('nombreArchivo', () => {
  it('usa el valor de la faceta, normalizado', () => {
    expect(nombreArchivo({ modo: 'faceta', tipo: 'area', valor: 'LOMA CAMPANA' }))
      .toBe('pozos-area-loma-campana.csv')
  })

  it('saca acentos del nombre', () => {
    expect(nombreArchivo({ modo: 'faceta', tipo: 'yacimiento', valor: 'CAÑADON SECO' }))
      .toBe('pozos-yacimiento-canadon-seco.csv')
  })

  it('nombra la zona dibujada', () => {
    expect(nombreArchivo({ modo: 'poligono' })).toBe('pozos-zona.csv')
  })

  it('tiene un nombre por defecto', () => {
    expect(nombreArchivo({ modo: 'vacio' })).toBe('pozos.csv')
  })
})

const FILAS = [
  { etiqueta: 'Pozos', valor: '10' },
  { etiqueta: 'Tipo', valor: 'Operadora' },
]
/** Las etiquetas y los valores que el panel está mostrando. */
const etiquetas = (c) => [...c.querySelectorAll('.descarga__datos dt')].map((e) => e.textContent)
const valores = (c) => [...c.querySelectorAll('.descarga__datos dd')].map((e) => e.textContent)

/** Promesa controlable desde afuera, para inspeccionar el estado del panel a mitad de una descarga. */
function diferido() {
  let resolver, rechazador
  const promesa = new Promise((resolve, reject) => { resolver = resolve; rechazador = reject })
  return { promesa, resolver, rechazador }
}

describe('crearPanelDescarga', () => {
  it('deshabilita el botón mientras descarga y lo reactiva al terminar', async () => {
    const contenedor = document.createElement('div')
    const panel = crearPanelDescarga(contenedor)
    const { promesa, resolver } = diferido()
    const alDescargar = vi.fn(() => promesa)

    panel.mostrar({ filas: FILAS, alDescargar })
    const boton = contenedor.querySelector('.descarga__boton')
    const aviso = contenedor.querySelector('.descarga__aviso')

    boton.click()
    await Promise.resolve()

    expect(boton.disabled).toBe(true)
    expect(aviso.textContent).toBe('Preparando el CSV…')
    expect(alDescargar).toHaveBeenCalledTimes(1)

    resolver()
    await promesa
    await Promise.resolve()

    expect(boton.disabled).toBe(false)
    expect(aviso.hidden).toBe(true)
    expect(valores(contenedor)).toEqual(['10', 'Operadora'])
  })

  it('un segundo click mientras la descarga sigue en curso no dispara una segunda carga', async () => {
    const contenedor = document.createElement('div')
    const panel = crearPanelDescarga(contenedor)
    const { promesa, resolver } = diferido()
    const alDescargar = vi.fn(() => promesa)

    panel.mostrar({ filas: FILAS, alDescargar })
    const boton = contenedor.querySelector('.descarga__boton')

    boton.click()
    await Promise.resolve()
    boton.click()
    await Promise.resolve()

    expect(alDescargar).toHaveBeenCalledTimes(1)

    resolver()
    await promesa
  })

  it('si la descarga falla, lo dice en el aviso y reactiva el botón', async () => {
    const contenedor = document.createElement('div')
    const panel = crearPanelDescarga(contenedor)
    const alDescargar = vi.fn(() => Promise.reject(new Error('la red se cayó')))

    panel.mostrar({ filas: FILAS, alDescargar })
    const boton = contenedor.querySelector('.descarga__boton')
    const aviso = contenedor.querySelector('.descarga__aviso')

    boton.click()
    // Dos vueltas de microtask: una para que el catch corra, otra para el finally.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(boton.disabled).toBe(false)
    expect(aviso.textContent).toBe('No se pudo generar el CSV. Probá de nuevo en unos minutos.')
    // Los datos del ámbito siguen ahí: el fallo es de la descarga, no del ámbito.
    expect(valores(contenedor)).toEqual(['10', 'Operadora'])
  })

  it('mostrarVacio esconde el botón y los datos, y sólo deja el aviso', () => {
    const contenedor = document.createElement('div')
    const panel = crearPanelDescarga(contenedor)

    panel.mostrarVacio('Ese ámbito no tiene pozos.')

    const raiz = contenedor.querySelector('.descarga')
    const boton = contenedor.querySelector('.descarga__boton')
    const aviso = contenedor.querySelector('.descarga__aviso')

    expect(raiz.hidden).toBe(false)
    expect(boton.hidden).toBe(true)
    expect(aviso.textContent).toBe('Ese ámbito no tiene pozos.')
    expect(etiquetas(contenedor)).toEqual([])
  })
})

describe('nombreArchivo con cuenca', () => {
  it('incluye la cuenca cuando la faceta la tiene', () => {
    expect(nombreArchivo({ modo: 'faceta', tipo: 'yacimiento', valor: 'EL TORDILLO', cuenca: 'AUSTRAL' }))
      .toBe('pozos-yacimiento-el-tordillo-austral.csv')
  })

  it('sin cuenca mantiene el nombre de antes', () => {
    expect(nombreArchivo({ modo: 'faceta', tipo: 'empresa', valor: 'YPF S.A.' }))
      .toBe('pozos-empresa-ypf-s-a.csv')
  })

  it('dos yacimientos homónimos dan archivos distintos', () => {
    const a = nombreArchivo({ modo: 'faceta', tipo: 'yacimiento', valor: 'EL TORDILLO', cuenca: 'AUSTRAL' })
    const b = nombreArchivo({ modo: 'faceta', tipo: 'yacimiento', valor: 'EL TORDILLO', cuenca: 'GOLFO SAN JORGE' })
    expect(a).not.toBe(b)
  })
})

describe('nombreArchivo y la operadora', () => {
  it('no etiqueta con cuenca una descarga de empresa venida de una URL a mano', async () => {
    const { leerEstado } = await import('../lib/url.js')
    const estado = leerEstado('?t=empresa&v=YPF+S.A.&c=AUSTRAL')
    // Si el nombre dijera "austral" mentiría: la descarga trae toda la empresa.
    expect(nombreArchivo(estado)).toBe('pozos-empresa-ypf-s-a.csv')
  })
})

describe('panel con datos etiquetados', () => {
  it('muestra una fila por dato, con su etiqueta y su valor', () => {
    const contenedor = document.createElement('div')
    const panel = crearPanelDescarga(contenedor)
    panel.mostrar({
      filas: [
        { etiqueta: 'Pozos', valor: '3' },
        { etiqueta: 'Tipo', valor: 'Pozo' },
        { etiqueta: 'Nombre', valor: 'YPF.Nq.LoAm.x-1' },
        { etiqueta: 'Cuenca', valor: 'NEUQUINA' },
      ],
      alDescargar: async () => {},
    })
    expect(etiquetas(contenedor)).toEqual(['Pozos', 'Tipo', 'Nombre', 'Cuenca'])
    expect(valores(contenedor)).toEqual(['3', 'Pozo', 'YPF.Nq.LoAm.x-1', 'NEUQUINA'])
  })

  it('reemplaza los datos entre un ámbito y el siguiente, no los acumula', () => {
    const contenedor = document.createElement('div')
    const panel = crearPanelDescarga(contenedor)
    panel.mostrar({ filas: [{ etiqueta: 'Pozos', valor: '3' }], alDescargar: async () => {} })
    panel.mostrar({ filas: [{ etiqueta: 'Pozos', valor: '9' }], alDescargar: async () => {} })
    expect(valores(contenedor)).toEqual(['9'])
  })

  it('escapa el valor en vez de interpolarlo como HTML', () => {
    const contenedor = document.createElement('div')
    const panel = crearPanelDescarga(contenedor)
    panel.mostrar({
      filas: [{ etiqueta: 'Nombre', valor: '<img src=x onerror=alert(1)>' }],
      alDescargar: async () => {},
    })
    expect(contenedor.querySelector('img')).toBeNull()
    expect(valores(contenedor)).toEqual(['<img src=x onerror=alert(1)>'])
  })
})
