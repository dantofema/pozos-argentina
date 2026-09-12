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

const conPozos = [
  { tipo: 'empresa', valor: 'YPF S.A.', cuenca: null, indice: 0, cantidad: 12093, buscable: 'ypf s.a.' },
  { tipo: 'area', valor: 'YPF NORTE', cuenca: 'NOROESTE', indice: 1, cantidad: 40, buscable: 'ypf norte' },
  ...Array.from({ length: 30 }, (_, i) => ({
    tipo: 'sigla', valor: `YPF.Nq.LC-${i}`, cuenca: 'NEUQUINA', indice: i, cantidad: 1,
    buscable: `ypf.nq.lc-${i}`,
  })),
]

function elegirTipo(valor) {
  const s = contenedor.querySelector('.buscador__tipo-sel')
  s.value = valor
  s.dispatchEvent(new Event('change'))
  return [...contenedor.querySelectorAll('.buscador__opcion')]
}

describe('selector de tipo', () => {
  it('arranca en Todos', () => {
    crearBuscador(contenedor, conPozos, () => {})
    expect(contenedor.querySelector('.buscador__tipo-sel').value).toBe('todos')
  })

  it('en Todos los pozos sueltos no inundan: entran con cupo y al final', () => {
    crearBuscador(contenedor, conPozos, () => {})
    const tipos = escribir('ypf').map((b) => b.querySelector('.buscador__tipo').textContent)
    // Hay 30 pozos que matchean; sólo deben entrar 5, después de las facetas.
    expect(tipos.filter((t) => t === 'Pozo')).toHaveLength(5)
    expect(tipos.indexOf('Pozo')).toBeGreaterThan(tipos.indexOf('Operadora'))
  })

  it('elegir un tipo deja sólo ese tipo', () => {
    crearBuscador(contenedor, conPozos, () => {})
    escribir('ypf')
    expect(new Set(elegirTipo('empresa').map((b) => b.querySelector('.buscador__tipo').textContent)))
      .toEqual(new Set(['Operadora']))
    expect(new Set(elegirTipo('sigla').map((b) => b.querySelector('.buscador__tipo').textContent)))
      .toEqual(new Set(['Pozo']))
  })

  it('un tipo sin coincidencias no devuelve nada', () => {
    crearBuscador(contenedor, conPozos, () => {})
    escribir('ypf')
    expect(elegirTipo('cuenca')).toHaveLength(0)
  })

  it('limpiar devuelve el selector a Todos', () => {
    const b = crearBuscador(contenedor, conPozos, () => {})
    escribir('ypf')
    elegirTipo('sigla')
    b.limpiar()
    expect(contenedor.querySelector('.buscador__tipo-sel').value).toBe('todos')
    expect(contenedor.querySelectorAll('.buscador__opcion')).toHaveLength(0)
  })

  it('rotula la sigla como Pozo, no como el nombre de la columna', () => {
    crearBuscador(contenedor, conPozos, () => {})
    escribir('ypf')
    const tipos = elegirTipo('sigla').map((b) => b.querySelector('.buscador__tipo').textContent)
    expect(tipos.every((t) => t === 'Pozo')).toBe(true)
  })
})

describe('al elegir un resultado', () => {
  it('cierra la lista y muestra lo elegido en el campo', () => {
    crearBuscador(contenedor, facetas, () => {})
    expect(escribir('tordillo')).toHaveLength(2)

    contenedor.querySelectorAll('.buscador__opcion')[0].click()

    expect(contenedor.querySelectorAll('.buscador__opcion')).toHaveLength(0)
    expect(contenedor.querySelector('.buscador__entrada').value).toContain('EL TORDILLO')
  })

  it('la selección incluye la cuenca, que es lo que la distingue del homónimo', () => {
    crearBuscador(contenedor, facetas, () => {})
    escribir('tordillo').find((b) => b.textContent.includes('AUSTRAL')).click()
    expect(contenedor.querySelector('.buscador__entrada').value).toBe('EL TORDILLO (AUSTRAL)')
  })

  it('una operadora, que no lleva cuenca, se muestra sola', () => {
    crearBuscador(contenedor, facetas, () => {})
    escribir('ypf')[0].click()
    expect(contenedor.querySelector('.buscador__entrada').value).toBe('YPF S.A.')
  })

  it('aparece el botón de borrar, y borra', () => {
    crearBuscador(contenedor, facetas, () => {})
    const limpiar = contenedor.querySelector('.buscador__limpiar')
    expect(limpiar.hidden).toBe(true)

    escribir('ypf')[0].click()
    expect(limpiar.hidden).toBe(false)

    limpiar.click()
    expect(contenedor.querySelector('.buscador__entrada').value).toBe('')
    expect(limpiar.hidden).toBe(true)
  })

  it('escribir encima de una selección vuelve a buscar', () => {
    crearBuscador(contenedor, facetas, () => {})
    escribir('ypf')[0].click()
    expect(contenedor.querySelectorAll('.buscador__opcion')).toHaveLength(0)

    const opciones = escribir('tordillo')
    expect(opciones.length).toBeGreaterThan(0)
    expect(contenedor.querySelector('.buscador__limpiar').hidden).toBe(true)
  })

  it('cambiar de tipo con algo elegido descarta la selección', () => {
    crearBuscador(contenedor, facetas, () => {})
    escribir('ypf')[0].click()
    const s = contenedor.querySelector('.buscador__tipo-sel')
    s.value = 'sigla'
    s.dispatchEvent(new Event('change'))
    expect(contenedor.querySelector('.buscador__entrada').value).toBe('')
  })

  it('entrega al callback la faceta completa', () => {
    let elegida = null
    crearBuscador(contenedor, facetas, (f) => { elegida = f })
    escribir('tordillo').find((b) => b.textContent.includes('AUSTRAL')).click()
    expect(elegida).toMatchObject({ tipo: 'yacimiento', valor: 'EL TORDILLO', cuenca: 'AUSTRAL' })
  })
})
