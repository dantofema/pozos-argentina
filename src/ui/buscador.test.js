// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { crearBuscador } from './buscador.js'

const facetas = [
  { tipo: 'yacimiento', valor: 'EL TORDILLO', cuenca: 'AUSTRAL', indice: 0, cantidad: 1, buscable: 'el tordillo' },
  { tipo: 'yacimiento', valor: 'EL TORDILLO', cuenca: 'GOLFO SAN JORGE', indice: 0, cantidad: 1620, buscable: 'el tordillo' },
  { tipo: 'empresa', valor: 'YPF S.A.', cuenca: null, indice: 0, cantidad: 12093, buscable: 'ypf s.a.' },
]

let contenedor

beforeEach(() => {
  contenedor = document.createElement('div')
  document.body.appendChild(contenedor)
})

function escribir(texto) {
  const entrada = contenedor.querySelector('.buscador__entrada')
  entrada.value = texto
  entrada.dispatchEvent(new Event('input'))
  return [...contenedor.querySelectorAll('.buscador__opcion')]
}

describe('crearBuscador', () => {
  it('muestra la cuenca de cada homónimo, para que se distingan', () => {
    crearBuscador(contenedor, facetas, () => {})
    const cuencas = escribir('tordillo').map((b) => b.querySelector('.buscador__cuenca').textContent)
    expect(cuencas.sort()).toEqual(['AUSTRAL', 'GOLFO SAN JORGE'])
  })

  it('ofrece los dos homónimos por separado, no uno solo', () => {
    crearBuscador(contenedor, facetas, () => {})
    expect(escribir('tordillo')).toHaveLength(2)
  })

  it('deja la cuenca vacía en una operadora, que no se desambigua', () => {
    crearBuscador(contenedor, facetas, () => {})
    const [boton] = escribir('ypf')
    expect(boton.querySelector('.buscador__cuenca').textContent).toBe('')
  })

  it('entrega al callback la faceta elegida, con su cuenca', () => {
    let elegida = null
    crearBuscador(contenedor, facetas, (f) => { elegida = f })
    escribir('tordillo').find((b) => b.textContent.includes('AUSTRAL')).click()
    expect(elegida.valor).toBe('EL TORDILLO')
    expect(elegida.cuenca).toBe('AUSTRAL')
  })

  it('escapa el valor en vez de interpolarlo como HTML', () => {
    const malicioso = [{ tipo: 'yacimiento', valor: '<img src=x onerror=alert(1)>', cuenca: 'AUSTRAL', indice: 0, cantidad: 1, buscable: 'img' }]
    crearBuscador(contenedor, malicioso, () => {})
    const [boton] = escribir('img')
    expect(boton.querySelector('img')).toBeNull()
    expect(boton.querySelector('.buscador__valor').textContent).toBe('<img src=x onerror=alert(1)>')
  })

  it('escapa también la cuenca, que viene del mismo dato', () => {
    const malicioso = [{ tipo: 'yacimiento', valor: 'EL TORDILLO', cuenca: '<img src=x onerror=alert(1)>', indice: 0, cantidad: 1, buscable: 'el tordillo' }]
    crearBuscador(contenedor, malicioso, () => {})
    const [boton] = escribir('tordillo')
    expect(boton.querySelector('img')).toBeNull()
    expect(boton.querySelector('.buscador__cuenca').textContent).toBe('<img src=x onerror=alert(1)>')
  })
})
