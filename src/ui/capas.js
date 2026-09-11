/** Endpoint del WMS de la Secretaría de Energía. Sólo teselas de contexto, nunca se consulta. */
export const WMS = 'https://sig.energia.gob.ar/wmsenergia'

/**
 * Capa base: argenmap del IGN, servida como TMS desde su GeoWebCache.
 *
 * Es la cartografía oficial argentina y reemplaza a OpenStreetMap: nombres,
 * rutas y límites en castellano y con el criterio del IGN, que es el que
 * corresponde para un sitio de datos argentinos.
 */
export const ARGENMAP = {
  url: 'https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG:3857@png/{z}/{x}/{y}.png',
  opciones: {
    tms: true,
    maxZoom: 18,
    attribution: 'Capa base © <a href="https://www.ign.gob.ar/">IGN</a> — argenmap',
  },
}

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
