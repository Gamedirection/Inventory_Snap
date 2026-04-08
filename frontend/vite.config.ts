import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || process.env.VITE_API_BASE_URL || 'http://localhost:8000',
        changeOrigin: true
      },
      // MinIO bucket proxy — keeps requests same-origin with Vite dev server.
      // changeOrigin: false preserves Host: localhost:5173 so that presigned-URL
      // HMAC signatures (signed with PUBLIC_MINIO_URL=http://localhost:5173) verify on MinIO.
      '/photos': { target: 'http://minio:9000', changeOrigin: false },
      '/thumbnails': { target: 'http://minio:9000', changeOrigin: false },
      '/documents': { target: 'http://minio:9000', changeOrigin: false },
      '/exports': { target: 'http://minio:9000', changeOrigin: false },
      '/backups': { target: 'http://minio:9000', changeOrigin: false },
    }
  }
})
