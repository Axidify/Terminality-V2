import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Dev-only proxy to avoid CORS on remote demo audio files
      '/ext-audio': {
        target: 'https://www.soundhelix.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/ext-audio/, ''),
      },
    },
  },
  build: {
    outDir: 'dist'
  }
})
