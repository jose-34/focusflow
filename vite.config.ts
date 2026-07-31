import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig(({ mode }) => {
  // Force process.env.NODE_ENV to match Vite's own build/dev mode,
  // unconditionally. Two independent ways this drifted before this line
  // existed, both confirmed by hand: (1) .env hardcodes NODE_ENV=development
  // for local dev convenience, and the loadEnv() spread below would
  // otherwise stomp the real value with it during `vite build` too; (2) an
  // ambient shell NODE_ENV of '' (present, but falsy) also survives
  // Vite's own "set NODE_ENV if absent" default, since '' still counts as
  // present. Either way, @vitejs/plugin-react then picks the dev JSX
  // transform (jsxDEV) even in a production build — confirmed the hard way:
  // the resulting server.js throws "jsxDEV is not a function" the moment it
  // tries to render, since react-dom's production SSR entry has no such
  // export. Setting this explicitly, before anything reads it, removes the
  // ambiguity regardless of what the calling shell/host happened to set.
  process.env.NODE_ENV = mode === 'production' ? 'production' : 'development'

  const loadedEnv = loadEnv(mode, process.cwd(), '')
  delete loadedEnv.NODE_ENV
  Object.assign(process.env, loadedEnv)

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
