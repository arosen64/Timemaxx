import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: '/team-04/', // GitHub Pages repo path (change if repo name differs)
  plugins: [react()],
  envDir: resolve(__dirname, '..'),
  server: {
    fs: {
      allow: [resolve(__dirname, '..')],
    },
  },
})
