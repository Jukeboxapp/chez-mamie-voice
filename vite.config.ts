import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base './' → fonctionne aussi sur GitHub Pages (https://user.github.io/repo/)
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { environment: 'node' },
})
