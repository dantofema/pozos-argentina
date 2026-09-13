# pozos-argentina

Buscá pozos de hidrocarburos de Argentina por área de concesión, yacimiento, operadora o
dibujando sobre el mapa, y bajate un CSV con una fila por pozo: su ficha completa más el
resumen de producción acumulada.

Sitio estático: no hay backend en producción. Los datos salen del portal de datos abiertos de
la Secretaría de Energía (`datos.energia.gob.ar`), cuyo DataStore acepta SQL. Un build en Node
baja la ficha de cada pozo y agrega su producción mensual con consultas separadas contra ese
DataStore, y arma el cruce entre ambas (ver [reglas de datos](docs/reglas/datos.md)) antes de
dejar el resultado en `public/` para que el sitio lo sirva sin volver a tocar el origen.

Este sitio no es oficial ni representa a la Secretaría de Energía.

- Diseño: [`docs/superpowers/specs/2026-09-10-pozos-argentina-design.md`](docs/superpowers/specs/2026-09-10-pozos-argentina-design.md)

## Estado

Funcionando. El sitio busca sobre 85.609 pozos, los pinta en el mapa y arma el CSV en
el navegador. Quien llega sin nada en la URL entra por un hero con el corte geológico
esquemático de la cuenca Neuquina, animado en seis actos, que ocupa el tiempo que tarda
en cargar el índice; un enlace compartido entra directo a la herramienta.

## Cómo se usa

```bash
npm install
npm run build:index   # baja del origen y arma public/ — tarda varios minutos
npm run dev
```

`npm test` corre los tests unitarios, sin red. `npm run coverage` los corre midiendo
cobertura. `npm run test:contrato` pega contra el origen vivo para verificar que nada
cambió del otro lado; tarda minutos y no corre en `npm test`.

Las reglas de datos están en [`docs/reglas/datos.md`](docs/reglas/datos.md).
