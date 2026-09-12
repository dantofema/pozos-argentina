#!/usr/bin/env bash
# Baja el subset "latin" de cada familia desde Google Fonts y lo deja con un
# nombre estable. Las tres son variables: un archivo cubre todos los pesos.
#
# No se subsetea por glifo aunque fontTools esté disponible: los nombres de
# formación, empresa y yacimiento salen del dato, y un juego de glifos elegido a
# mano se rompe el día que aparezca un caracter que no previmos (T1).
set -euo pipefail
cd "$(dirname "$0")"

UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36"

bajar() {
  local familia="$1" pesos="$2" destino="$3"
  local css url
  css=$(curl -fsS -A "$UA" "https://fonts.googleapis.com/css2?family=${familia}:wght@${pesos}&display=swap")
  # El bloque "/* latin */" y no "latin-ext": es el que trae lo que usamos.
  url=$(printf '%s' "$css" | awk '/\/\* latin \*\//{f=1} f && /url\(/{print; exit}' \
        | grep -oE 'https://[^)]*\.woff2')
  [ -n "$url" ] || { echo "no se encontro el subset latin de $familia" >&2; exit 1; }
  curl -fsS -o "$destino" "$url"
  printf '%-26s %7d bytes\n' "$destino" "$(stat -c%s "$destino")"
}

bajar "Source+Serif+4"  "400;600" source-serif-4.woff2
bajar "Archivo+Narrow"  "400;600" archivo-narrow.woff2
bajar "JetBrains+Mono"  "400;500" jetbrains-mono.woff2

echo "total: $(du -cb *.woff2 | tail -1 | cut -f1) bytes"

# El aviso de copyright de cada familia (tabla `name`, nameID 0) queda anclado
# al binario que se distribuye: LICENCIAS.md se compara contra este JSON en
# fuentes.test.js, no contra texto tipeado a mano. Se regenera con cada bajada.
python3 -c "
from fontTools.ttLib import TTFont
import glob, json
copyrights = {}
for f in sorted(glob.glob('*.woff2')):
    copyrights[f] = TTFont(f)['name'].getDebugName(0)
with open('copyright.json', 'w') as fh:
    json.dump(copyrights, fh, ensure_ascii=False, indent=2, sort_keys=True)
    fh.write('\n')
print('copyright.json actualizado:', copyrights)
"
