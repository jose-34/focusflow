import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  if (mode === 'development') {
    try {
      const { getWss } = require('./app/lib/ws-server')
      getWss()
      console.log('Game WebSocket server running on ws://localhost:3001')
    } catch {
      console.warn('Game WebSocket server not started (ws module missing?)')
    }
  }

  return {
    plugins: [
      tailwindcss(),
      tanstackStart({
        srcDirectory: 'app',
      }),
      react(),
      tsconfigPaths(),
    ],
  }
})
