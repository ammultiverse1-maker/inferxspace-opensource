import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

// Check if SSL certificates exist
const keyPath = path.resolve(__dirname, 'backend/key.pem')
const certPath = path.resolve(__dirname, 'backend/cert.pem')
const hasSSLCerts = fs.existsSync(keyPath) && fs.existsSync(certPath)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Only use HTTPS if certificates exist
    ...(hasSSLCerts ? {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    } : {}),
    // Proxy API requests to backend to avoid cross-origin cookie issues during local dev
    proxy: {
      '/api': {
        target: 'https://api.inferx.space',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      '/v1': {
        target: 'https://api.inferx.space',
        changeOrigin: true,
        secure: false,
      }
    },
    watch: {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        path.resolve(__dirname, 'backend/**'),
        path.resolve(__dirname, 'backend')
      ]
    }
  }
})
