import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { findAvailablePort } from './utils/portFinder.js'
import { readPortConfig } from './utils/portConfig.js'

export default defineConfig(async ({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  // Force the correct port
  const serverPort = 3002;
  console.log(`🔧 Vite proxy configuration: Using fixed port ${serverPort}, proxying /api to http://localhost:${serverPort}`);
  
  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_PORT) || 3001,
      host: '0.0.0.0', // Allow external connections
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
          secure: false
        },
        '/ws': {
          target: `ws://localhost:${serverPort}`,
          ws: true,
          changeOrigin: true
        },
        '/shell': {
          target: `ws://localhost:${serverPort}`,
          ws: true,
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: 'dist'
    }
  }
})