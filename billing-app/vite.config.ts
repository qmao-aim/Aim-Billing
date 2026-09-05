import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// fileURLToPath, not URL.pathname: the repo path contains spaces, which
// pathname percent-encodes into a directory that does not exist.
import { fileURLToPath } from 'node:url'

// Relative base so dist/ can be served from any folder on the internal server.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
