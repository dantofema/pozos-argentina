// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { crearBuscador, campoDeshabilitado } from './buscador.js'

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

describe('reflejar el ámbito vigente', () => {
  it('muestra la faceta aplicada aunque no se haya elegido desde el buscador', () => {
    const b = crearBuscador(contenedor, facetas, () => {})
    b.reflejar({ modo: 'faceta', tipo: 'yacimiento', valor: 'EL TORDILLO', cuenca: 'AUSTRAL' })
    expect(contenedor.querySelector('.buscador__entrada').value).toBe('EL TORDILLO (AUSTRAL)')
    expect(contenedor.querySelector('.buscador__limpiar').hidden).toBe(false)
  })

  it('pisa una selección anterior: es el caso del botón Atrás', () => {
    const b = crearBuscador(contenedor, facetas, () => {})
    escribir('ypf')[0].click()
    expect(contenedor.querySelector('.buscador__entrada').value).toBe('YPF S.A.')

    b.reflejar({ modo: 'faceta', tipo: 'yacimiento', valor: 'EL TORDILLO', cuenca: 'AUSTRAL' })
    expect(contenedor.querySelector('.buscador__entrada').value).toBe('EL TORDILLO (AUSTRAL)')
  })

  it('un ámbito de zona dibujada limpia el campo: no hay faceta que mostrar', () => {
    const b = crearBuscador(contenedor, facetas, () => {})
    escribir('ypf')[0].click()
    b.reflejar({ modo: 'poligono', poligono: [[-69, -39], [-68, -39], [-68, -38]] })
    expect(contenedor.querySelector('.buscador__entrada').value).toBe('')
    expect(contenedor.querySelector('.buscador__limpiar').hidden).toBe(true)
  })

  it('el estado vacío limpia', () => {
    const b = crearBuscador(contenedor, facetas, () => {})
    escribir('ypf')[0].click()
    b.reflejar({ modo: 'vacio' })
    expect(contenedor.querySelector('.buscador__entrada').value).toBe('')
  })

  it('cierra la lista de opciones si estaba abierta', () => {
    const b = crearBuscador(contenedor, facetas, () => {})
    expect(escribir('ypf').length).toBeGreaterThan(0)
    b.reflejar({ modo: 'faceta', tipo: 'empresa', valor: 'YPF S.A.', cuenca: null })
    expect(contenedor.querySelectorAll('.buscador__opcion')).toHaveLength(0)
  })
})

describe('la lista de sugerencias', () => {
  const lista = () => contenedor.querySelector('.buscador__resultados')

  it('se esconde cuando no hay resultados, en vez de dejar un recuadro vacío', () => {
    crearBuscador(contenedor, facetas, () => {})

    expect(escribir('tordillo')).toHaveLength(2)
    expect(lista().hidden).toBe(false)

    expect(escribir('no existe ningun pozo asi')).toHaveLength(0)
    expect(lista().hidden).toBe(true)
  })

  it('deja el foco en el campo al elegir, no en el body', () => {
    crearBuscador(contenedor, facetas, () => {})
    const entrada = contenedor.querySelector('.buscador__entrada')

    const opcion = escribir('ypf')[0]
    opcion.focus()
    opcion.click()

    // cerrarLista saca del DOM el botón que tenía el foco.
    expect(document.activeElement).toBe(entrada)
  })

  it('se cierra con Escape', () => {
    crearBuscador(contenedor, facetas, () => {})
    escribir('tordillo')

    contenedor.querySelector('.buscador__entrada')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

    expect(lista().hidden).toBe(true)
  })

  it('se cierra al hacer click afuera', () => {
    crearBuscador(contenedor, facetas, () => {})
    escribir('tordillo')

    const afuera = document.createElement('button')
    document.body.appendChild(afuera)
    afuera.click()

    expect(lista().hidden).toBe(true)
    afuera.remove()
  })

  it('no se cierra al hacer click adentro del propio buscador', () => {
    crearBuscador(contenedor, facetas, () => {})
    escribir('tordillo')

    contenedor.querySelector('.buscador__entrada').click()

    expect(lista().hidden).toBe(false)
  })

  // El click afuera se resuelve con una escucha en `document`, no en
  // `contenedor`: sobrevive aunque el contenedor se destruya, y queda
  // apuntando a un nodo ya desmontado en cada click futuro de la página. En
  // `main.js` nunca importó -este buscador vive mientras vive la página-,
  // pero el del hero se destruye en `relevar()` (Tarea 7, revisión Important
  // 1). `desconectar()` la saca.
  it('desconectar() saca la escucha de click en document, sin romper a quien no la usa', () => {
    const buscador = crearBuscador(contenedor, facetas, () => {})
    escribir('tordillo')
    buscador.desconectar()

    const afuera = document.createElement('button')
    document.body.appendChild(afuera)
    afuera.click()

    // Sin la escucha, un click afuera ya no cierra la lista.
    expect(lista().hidden).toBe(false)
    afuera.remove()
  })
})

// Revisión de la Tarea 8 (hallazgo 3): antes de esta función, el campo
// deshabilitado que dice "está cargando" vivía escrito a mano en dos
// lugares -el arranque del hero (Tarea 7) y, con este arreglo, el arranque
// de la herramienta cuando llega sin hero (un enlace directo)-. Un único
// lugar para ese texto: si el motivo cambia, cambia una vez.
describe('campoDeshabilitado', () => {
  it('arma un campo deshabilitado que dice cuántos pozos está cargando (E5)', () => {
    contenedor.innerHTML = campoDeshabilitado(85609)
    const entrada = contenedor.querySelector('.buscador__entrada')
    expect(entrada.disabled).toBe(true)
    expect(entrada.placeholder).toContain('85.609')
    expect(entrada.placeholder).toMatch(/cargando/i)
  })

  it('no anuncia un error: no hay ningún rol ni texto de alerta', () => {
    contenedor.innerHTML = campoDeshabilitado(85609)
    expect(contenedor.textContent).not.toMatch(/error|falló|no se pudo/i)
  })
})
