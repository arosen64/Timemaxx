import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Production builds are served from GitHub Pages at /Timemaxx/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Timemaxx/' : '/',
  plugins: [react()],
  envDir: resolve(__dirname, '..'),
  server: {
    fs: {
      allow: [resolve(__dirname, '..')],
    },
  },
}))