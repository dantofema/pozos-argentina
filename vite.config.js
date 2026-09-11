import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['src/**/*.test.js', 'scripts/**/*.test.mjs'],
    exclude: ['tests/contrato/**', 'node_modules/**'],
  },
})
