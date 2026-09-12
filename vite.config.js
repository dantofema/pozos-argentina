import { defineConfig } from 'vite'

export default defineConfig({
  // El target por defecto de esbuild (chrome87/firefox78/safari14…) es previo al
  // soporte de top-level await, que usa src/main.js. Se sube a navegadores donde
  // top-level await ya existe (Chrome/Edge 89, Firefox 89, Safari 15).
  build: {
    target: ['chrome89', 'edge89', 'firefox89', 'safari15'],
  },
  test: {
    include: ['src/**/*.test.js', 'scripts/**/*.test.mjs'],
    exclude: ['tests/contrato/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.js', 'scripts/**/*.mjs'],
      // Fuera de la medición por elección, no por olvido:
      //   ckan.mjs habla con el origen vivo y sólo lo ejercita `test:contrato`;
      //   main.js es cableado -toda su lógica vive en lib/ y ui/, que sí se miden-;
      //   grabar-fixture-recursos.mjs es una herramienta manual de un solo uso.
      exclude: [
        '**/*.test.*',
        'scripts/lib/ckan.mjs',
        'scripts/grabar-fixture-recursos.mjs',
        'src/main.js',
      ],
    },
  },
})
