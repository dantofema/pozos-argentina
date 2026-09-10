# pozos-argentina

Buscá pozos de hidrocarburos de Argentina por área de concesión, yacimiento, operadora o
dibujando sobre el mapa, y bajate un CSV con una fila por pozo: su ficha completa más el
resumen de producción acumulada.

Sitio estático: no hay backend. Los datos salen del portal de datos abiertos de la Secretaría
de Energía (`datos.energia.gob.ar`), cuyo DataStore acepta SQL y expone CORS abierto. El cruce
entre la ficha del pozo y su producción mensual lo resuelve una sola consulta, del lado del
servidor.

Este sitio no es oficial ni representa a la Secretaría de Energía.

- Diseño: [`docs/superpowers/specs/2026-09-10-pozos-argentina-design.md`](docs/superpowers/specs/2026-09-10-pozos-argentina-design.md)

## Estado

Diseño aprobado. Sin implementar todavía.
