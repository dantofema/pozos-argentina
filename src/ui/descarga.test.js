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

  it('nombra el recorte dibujado', () => {
    expect(nombreArchivo({ modo: 'poligono' })).toBe('pozos-recorte.csv')
  })

  it('tiene un nombre por defecto', () => {
    expect(nombreArchivo({ modo: 'vacio' })).toBe('pozos.csv')
  })
})

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

    panel.mostrar({ texto: '10 pozos en X.', alDescargar })
    const boton = contenedor.querySelector('.descarga__boton')
    const resumen = contenedor.querySelector('.descarga__resumen')

    boton.click()
    await Promise.resolve()

    expect(boton.disabled).toBe(true)
    expect(resumen.textContent).toBe('Preparando el CSV…')
    expect(alDescargar).toHaveBeenCalledTimes(1)

    resolver()
    await promesa
    await Promise.resolve()

    expect(boton.disabled).toBe(false)
    expect(resumen.textContent).toBe('10 pozos en X.')
  })

  it('un segundo click mientras la descarga sigue en curso no dispara una segunda carga', async () => {
    const contenedor = document.createElement('div')
    const panel = crearPanelDescarga(contenedor)
    const { promesa, resolver } = diferido()
    const alDescargar = vi.fn(() => promesa)

    panel.mostrar({ texto: '10 pozos en X.', alDescargar })
    const boton = contenedor.querySelector('.descarga__boton')

    boton.click()
    await Promise.resolve()
    boton.click()
    await Promise.resolve()

    expect(alDescargar).toHaveBeenCalledTimes(1)

    resolver()
    await promesa
  })

  it('si la descarga falla, lo dice en el resumen y reactiva el botón', async () => {
    const contenedor = document.createElement('div')
    const panel = crearPanelDescarga(contenedor)
    const alDescargar = vi.fn(() => Promise.reject(new Error('la red se cayó')))

    panel.mostrar({ texto: '10 pozos en X.', alDescargar })
    const boton = contenedor.querySelector('.descarga__boton')
    const resumen = contenedor.querySelector('.descarga__resumen')

    boton.click()
    // Dos vueltas de microtask: una para que el catch corra, otra para el finally.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(boton.disabled).toBe(false)
    expect(resumen.textContent).toBe('No se pudo generar el CSV. Probá de nuevo en unos minutos.')
  })

  it('mostrarVacio esconde el botón y sólo deja el texto', () => {
    const contenedor = document.createElement('div')
    const panel = crearPanelDescarga(contenedor)

    panel.mostrarVacio('Ese ámbito no tiene pozos.')

    const raiz = contenedor.querySelector('.descarga')
    const boton = contenedor.querySelector('.descarga__boton')
    const resumen = contenedor.querySelector('.descarga__resumen')

    expect(raiz.hidden).toBe(false)
    expect(boton.hidden).toBe(true)
    expect(resumen.textContent).toBe('Ese ámbito no tiene pozos.')
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
