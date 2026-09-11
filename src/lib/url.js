const TIPOS = ['area', 'yacimiento', 'empresa']
const VACIO = { modo: 'vacio', tipo: null, valor: null, cuenca: null, poligono: null }

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
    // `c` es opcional: un enlace anterior a la desambiguación por cuenca sigue
    // siendo válido y resuelve a la unión de todas las cuencas.
    return { modo: 'faceta', tipo, valor, cuenca: p.get('c') || null, poligono: null }
  }

  const crudo = p.get('p')
  if (crudo) {
    const poligono = parsearPoligono(crudo)
    if (poligono) return { modo: 'poligono', tipo: null, valor: null, cuenca: null, poligono }
  }

  return { ...VACIO }
}

export function escribirEstado(estado) {
  if (estado.modo === 'faceta') {
    if (!estado.tipo || !estado.valor) {
      return ''
    }
    const p = new URLSearchParams({ t: estado.tipo, v: estado.valor })
    if (estado.cuenca) p.set('c', estado.cuenca)
    return `?${p.toString()}`
  }
  if (estado.modo === 'poligono') {
    if (!Array.isArray(estado.poligono) || estado.poligono.length < 3) {
      return ''
    }
    const texto = estado.poligono.map(([lon, lat]) => `${lon},${lat}`).join(';')
    return `?p=${texto}`
  }
  return ''
}
