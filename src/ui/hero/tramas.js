/**
 * Las cinco tramas litológicas del corte, redibujadas tomando como referencia
 * FGDC-STD-013-2006, "Digital Cartographic Standard for Geologic Map
 * Symbolization", patrones sedimentarios de la serie 600. Es el lenguaje con el
 * que se dibujan los mapas geológicos desde hace un siglo: arenisca son puntos,
 * lutita son guiones, caliza son ladrillos, evaporita son chevrons.
 *
 * Se redibujan y no se adoptan los archivos del estándar —que son CC0, así que
 * no habría problema de licencia— por dos razones técnicas: sus SVG traen
 * `#000000` fijo, así que no se tiñen con la paleta ni se invierten en el tema
 * cianotipo, y cada tesela tiene más de 400 elementos.
 */
export const TRAMAS = ['arenisca', 'lutita', 'caliza', 'evaporita', 'bituminosa']

export function idDeTrama(nombre) {
  if (!TRAMAS.includes(nombre)) {
    throw new Error(`Trama desconocida: "${nombre}". Las que hay: ${TRAMAS.join(', ')}`)
  }
  return `t-${nombre}`
}

/**
 * Los cinco `<pattern>`, para meter dentro de un `<defs>`. Todo en
 * `currentColor`: el estrato que los use decide el color desde la paleta.
 */
export function defsDeTramas() {
  return `
    <pattern id="t-arenisca" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="4" cy="4" r="1.1" fill="currentColor"/>
      <circle cx="13" cy="9" r="1.1" fill="currentColor"/>
      <circle cx="7" cy="14" r="1.1" fill="currentColor"/>
      <circle cx="16" cy="16" r="1.1" fill="currentColor"/>
    </pattern>
    <pattern id="t-lutita" width="26" height="11" patternUnits="userSpaceOnUse">
      <path d="M0 3.5h11M15 3.5h11M6 9h13" stroke="currentColor" stroke-width="1" fill="none"/>
    </pattern>
    <pattern id="t-caliza" width="26" height="14" patternUnits="userSpaceOnUse">
      <path d="M0 0h26M0 7h26M0 14h26M13 0v7M0 7v7M26 7v7"
            stroke="currentColor" stroke-width="0.8" fill="none"/>
    </pattern>
    <pattern id="t-evaporita" width="18" height="13" patternUnits="userSpaceOnUse">
      <path d="M0 9l4.5-5.5L9 9l4.5-5.5L18 9" stroke="currentColor" stroke-width="1" fill="none"/>
    </pattern>
    <pattern id="t-bituminosa" width="26" height="9" patternUnits="userSpaceOnUse">
      <rect width="26" height="9" fill="currentColor" opacity="0.16"/>
      <path d="M0 4.5h10M14 4.5h12" stroke="currentColor" stroke-width="1.3" fill="none"/>
    </pattern>`
}
