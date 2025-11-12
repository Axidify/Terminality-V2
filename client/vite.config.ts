import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // No proxy required: demo audio files are now served locally under /audio
  },
  build: {
    outDir: 'dist'
  }
})
