/**
 * La columna estratigráfica de la cuenca Neuquina que dibuja el hero, de la
 * formación más joven a la más antigua. Verificada contra la literatura de la
 * cuenca: de abajo hacia arriba es Lajas -> Lotena -> Tordillo -> Vaca Muerta ->
 * Quintuco -> Mulichinco -> Agrio -> Huitrín -> Rayoso.
 *
 * Es dato, no lógica: sin funciones y sin dependencias. Los conteos de pozos NO
 * viven acá, salen del manifiesto (G5): `corte.js` recorre esta lista y les pega
 * el número.
 *
 * La litología de cada una es la que justifica su trama, y es lo que hace que el
 * dibujo sea fiel a un corte real y no a una decoración a bandas.
 */
export const COLUMNA_NEUQUINA = [
  { nombre: 'RAYOSO',      litologia: 'evaporitas y continental', trama: 'evaporita',  rocaMadre: false },
  { nombre: 'HUITRIN',     litologia: 'evaporitas',               trama: 'evaporita',  rocaMadre: false },
  { nombre: 'AGRIO',       litologia: 'lutitas',                  trama: 'lutita',     rocaMadre: false },
  { nombre: 'MULICHINCO',  litologia: 'areniscas y conglomerados', trama: 'arenisca',  rocaMadre: false },
  { nombre: 'QUINTUCO',    litologia: 'carbonatos',               trama: 'caliza',     rocaMadre: false },
  { nombre: 'VACA MUERTA', litologia: 'lutita bituminosa',        trama: 'bituminosa', rocaMadre: true  },
  { nombre: 'TORDILLO',    litologia: 'areniscas',                trama: 'arenisca',   rocaMadre: false },
  { nombre: 'LOTENA',      litologia: 'areniscas y carbonatos',   trama: 'caliza',     rocaMadre: false },
  { nombre: 'LAJAS',       litologia: 'areniscas',                trama: 'arenisca',   rocaMadre: false },
]
