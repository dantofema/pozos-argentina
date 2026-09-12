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

  it('un índice del full resuelve al valor correcto contra el diccionario del lite', () => {
    // Dos pozos con empresas distintas, cada uno en una cuenca distinta. Si el
    // full armara diccionarios por partición, el de NEUQUINA numeraría desde
    // cero y su índice de empresa resolvería al valor de la otra cuenca.
    const dos = [
      { ...pozos[0], idpozo: '212', empresa: 'PRIMERA S.A.', cuenca: 'GOLFO SAN JORGE' },
      { ...pozos[1], idpozo: '999', empresa: 'SEGUNDA S.A.', cuenca: 'NEUQUINA' },
    ]
    const { lite, full } = construirArtefactos(dos, new Map())

    const enNeuquina = full.get('NEUQUINA').rows[0]
    expect(lite.dicts.empresa[enNeuquina[FULL.EMPRESA]]).toBe('SEGUNDA S.A.')

    const enGolfo = full.get('GOLFO SAN JORGE').rows[0]
    expect(lite.dicts.empresa[enGolfo[FULL.EMPRESA]]).toBe('PRIMERA S.A.')
  })

  it('un agregado con campo faltante produce cero, no NaN', () => {
    const incompleto = new Map([
      [212, { meses: '103', prim: '201801', ult: '202607', pet: '8808.2', gas: '1417.4', agua: '106520.8' }],
      // tef falta
    ])
    const { full } = construirArtefactos(pozos, incompleto)
    const fila = full.get('GOLFO SAN JORGE').rows[0]
    expect(fila[FULL.TEF]).toBe(0)
    expect(Number.isNaN(fila[FULL.TEF])).toBe(false)
  })

  it('descarta el pozo cuyo geojson no se puede parsear', () => {
    const roto = [{ ...pozos[0], geojson: 'no es json' }]
    const { lite } = construirArtefactos(roto, new Map())
    expect(lite.rows).toHaveLength(0)
  })

  it('cuenta en descartados el pozo cuyo geojson no se puede parsear', () => {
    const mezcla = [pozos[0], { ...pozos[1], geojson: 'no es json' }]
    const { lite, descartados } = construirArtefactos(mezcla, new Map())
    expect(descartados).toBe(1)
    expect(lite.rows).toHaveLength(1)
  })

  it('no descarta nada cuando todos los geojson parsean', () => {
    const { descartados } = construirArtefactos(pozos, agregados)
    expect(descartados).toBe(0)
  })
})

describe('nombreArchivoCuenca', () => {
  it('normaliza a minúscula sin acentos ni espacios', () => {
    expect(nombreArchivoCuenca('GOLFO SAN JORGE')).toBe('golfo-san-jorge')
    expect(nombreArchivoCuenca('CAÑADON ASFALTO')).toBe('canadon-asfalto')
  })
})

describe('caja de plausibilidad', () => {
  // El caso real: id 10143, SJ.RN.LN-7, declarado NEUQUINA, publicado con
  // lon -38,75 y lat -67,64. Invertido cae en Neuquén; tal como viene, en el
  // océano Índico.
  const transpuesto = {
    ...pozos[0],
    idpozo: '10143', sigla: 'SJ.RN.LN-7', cuenca: 'NEUQUINA',
    geojson: '{"type":"Point","coordinates":[-38.75634,-67.64238]}',
  }

  it('deja fuera del índice al pozo con lon/lat invertidos', () => {
    const { lite, full } = construirArtefactos([...pozos, transpuesto], agregados)

    expect(lite.rows).toHaveLength(2)
    expect(lite.rows.map((f) => f[LITE.ID])).not.toContain(10143)
    expect(full.get('NEUQUINA').rows.map((f) => f[FULL.ID])).not.toContain(10143)
  })

  it('lo devuelve nombrado, no sólo contado', () => {
    const { fueraDeCaja } = construirArtefactos([...pozos, transpuesto], agregados)

    expect(fueraDeCaja).toEqual([
      { idpozo: 10143, sigla: 'SJ.RN.LN-7', lon: -38.75634, lat: -67.64238 },
    ])
  })

  it('no lo cuenta como geometría rota: son dos problemas distintos', () => {
    const { descartados, fueraDeCaja } = construirArtefactos(
      [...pozos, transpuesto, { ...pozos[0], idpozo: '7', geojson: 'no es json' }],
      agregados
    )

    expect(descartados).toBe(1)
    expect(fueraDeCaja).toHaveLength(1)
  })

  it('acepta los extremos reales del país: Austral offshore y el norte salteño', () => {
    const extremos = [
      { ...pozos[0], idpozo: '1', geojson: '{"type":"Point","coordinates":[-72.11,-54.02]}' },
      { ...pozos[0], idpozo: '2', geojson: '{"type":"Point","coordinates":[-57.76,-22.00]}' },
    ]
    const { lite, fueraDeCaja } = construirArtefactos(extremos, new Map())

    expect(lite.rows).toHaveLength(2)
    expect(fueraDeCaja).toEqual([])
  })
})

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
