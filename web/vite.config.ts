import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    host: true,
    // Same-origin dev: API, packs and tiles are proxied to production, so the
    // SameSite=Lax refresh cookie and CORS behave exactly like the live site.
    proxy: {
      '/maps/api': { target: 'https://maps.aiity.de', changeOrigin: true },
      '/maps/packs': { target: 'https://maps.aiity.de', changeOrigin: true },
      '/maps/region.pmtiles': { target: 'https://maps.aiity.de', changeOrigin: true },
    },
  },
})
