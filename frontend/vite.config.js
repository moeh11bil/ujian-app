import { defineConfig, loadEnv } from 'vite'
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || 'http://localhost:3000'
  
  // Extract hostname from API URL for proxy
  const apiHostname = new URL(apiUrl).hostname
  const apiPort = new URL(apiUrl).port || '3000'

  return {
    plugins: [svelte({
      preprocess: vitePreprocess()
    })],
    resolve: {
      alias: {
        '$lib': path.resolve(__dirname, './src/lib'),
        '$components': path.resolve(__dirname, './src/components'),
        '$stores': path.resolve(__dirname, './src/stores'),
        '$utils': path.resolve(__dirname, './src/utils'),
      }
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: `http://${apiHostname}:${apiPort}`,
          changeOrigin: true
        }
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test-setup.js'],
      include: ['src/**/*.{test,spec}.{js,ts}']
    }
  }
})