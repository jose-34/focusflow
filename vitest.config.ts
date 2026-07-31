import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

// Deliberately minimal and separate from vite.config.ts — that config's
// TanStack Start plugin and dev-only WebSocket server side effect have no
// place in a unit-test run, which only needs the `@/` path alias resolved.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['app/**/*.test.ts'],
  },
})
