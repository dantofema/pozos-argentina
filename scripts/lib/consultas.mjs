import { RECURSO_POZOS } from '../../src/lib/esquema.js'

/**
 * Una página del volcado de pozos.
 * `geojson` es la geometría válida: las columnas coordenadax/coordenaday de la
 * tabla de producción están transpuestas y no se usan.
 */
export function sqlPozos(limite, desplazamiento) {
  return `SELECT idpozo, sigla, empresa, area, yacimiento, cuenca, provincia,
       tipo_recurso, tipoestado, formacion, profundidad, geojson
FROM "${RECURSO_POZOS}"
ORDER BY idpozo
LIMIT ${Number(limite)} OFFSET ${Number(desplazamiento)}`
}

/** Resumen de producción por pozo, uniendo todos los años elegidos. */
export function sqlAgregado(recursos) {
  if (!recursos || recursos.length === 0) {
    throw new Error('No se puede agregar producción sin recursos')
  }
  const union = recursos
    .map((r) => `  SELECT idpozo, anio, mes, prod_pet, prod_gas, prod_agua, tef FROM "${r.id}"`)
    .join('\n  UNION ALL\n')

  return `WITH prod AS (
${union}
)
SELECT idpozo,
       count(*)                          AS meses,
       min(anio * 100 + mes)             AS prim,
       max(anio * 100 + mes)             AS ult,
       round(sum(prod_pet)::numeric,  1) AS pet,
       round(sum(prod_gas)::numeric,  1) AS gas,
       round(sum(prod_agua)::numeric, 1) AS agua,
       round(sum(tef)::numeric,       1) AS tef
FROM prod
GROUP BY idpozo
ORDER BY idpozo`
}
