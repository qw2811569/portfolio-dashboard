import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.js',
    include: ['tests/**/*.test.{js,jsx}'],
    exclude: ['tests/old/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**/*.{js,jsx}', 'src/stores/**/*.{js,jsx}', 'src/hooks/**/*.{js,jsx}'],
    },
  },
})
