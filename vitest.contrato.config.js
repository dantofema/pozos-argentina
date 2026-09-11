import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    include: ['tests/contrato/**/*.test.mjs'],
    testTimeout: 180000,
  },
})
