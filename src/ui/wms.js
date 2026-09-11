/** Endpoint del WMS de la Secretaría de Energía. Sólo teselas de contexto, nunca se consulta. */
export const WMS = 'https://sig.energia.gob.ar/wmsenergia'

/**
 * Capas del WMS que se pintan de fondo. Son sólo teselas: no se consultan.
 * El WMS no tiene datos que CKAN no tenga, y su cadena TLS está incompleta.
 */
export const CAPAS_CONTEXTO = {
  'Concesiones de explotación': 'planosbase_concesiones_explotacion',
  'Ductos de hidrocarburos': 'planosbase_ductos',
  'Yacimientos': 'planosbase_yacimientos',
}

/** MapServer 8 rechaza todo GetMap sin STYLES, aunque vaya vacío. */
export function urlTeselasWms() {
  return `${WMS}?service=WMS&version=1.3.0&request=GetMap&styles=&format=image%2Fpng&transparent=true`
}
