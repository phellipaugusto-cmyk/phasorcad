import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Caminhos relativos: o build funciona em qualquer pasta ou subpasta
  // (GitHub Pages, servidor local, etc.), não só na raiz do domínio.
  base: './',
})
