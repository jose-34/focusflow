import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // Multi-step flows (register → dashboard → logout → login) visit several
  // routes for the first time in a row; each first visit can carry its own
  // Vite dev-mode compile cost on top of normal step time, so the default 30s
  // per-test budget is too tight even though no individual step is slow.
  timeout: 60000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  // Vite's dev-mode on-demand compilation + first hydration is noticeably
  // slower and more variable than a production build — the default 5s expect
  // timeout flakes on a cold route even on a warm dev server. 15s covers the
  // observed worst case with headroom; keep in mind if targeting a built/
  // preview server (faster, more consistent) this could be tightened back.
  expect: { timeout: 15000 },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    navigationTimeout: 15000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
})
