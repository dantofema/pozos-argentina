# Tipografías

Las tres se redistribuyen bajo la **SIL Open Font License 1.1**, que lo permite
siempre que se incluya este aviso. Se sirven desde el propio sitio: no hay
pedidos a Google en tiempo de ejecución.

| familia | autoría | licencia |
|---|---|---|
| Source Serif 4 | Frank Grießhammer, Adobe | SIL Open Font License 1.1 |
| Archivo Narrow | Omnibus-Type | SIL Open Font License 1.1 |
| JetBrains Mono | JetBrains | SIL Open Font License 1.1 |

## Avisos de copyright

Extraídos de la tabla `name` (nameID 0) de cada binario, no tipeados a mano —
`bajar.sh` los escribe a `src/fuentes/copyright.json` en cada descarga, y
`fuentes.test.js` compara este texto contra ese JSON para que no se
desincronice del archivo que el sitio realmente sirve.

- **Source Serif 4**: © 2014 - 2021 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name ‘Source’.
- **Archivo Narrow**: Copyright 2019 The Archivo Narrow Project Authors (https://github.com/Omnibus-Type/ArchivoNarrow)
- **JetBrains Mono**: Copyright 2020 The JetBrains Mono Project Authors (https://github.com/JetBrains/JetBrainsMono)

Los archivos son el subset `latin` que publica Google Fonts, sin modificar. Para
actualizarlos: `bash src/fuentes/bajar.sh`.

El texto completo de la licencia está en [`src/fuentes/OFL.txt`](./OFL.txt),
bajado verbatim de <https://openfontlicense.org/documents/OFL.txt>. Sus
condiciones, en resumen: se puede usar, estudiar, modificar y redistribuir
libremente, incluso con fines comerciales; lo que no se puede es vender las
tipografías por separado ni usar los nombres reservados para promocionar
versiones modificadas.
