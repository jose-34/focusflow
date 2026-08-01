import { expect, test } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test.describe.serial('Pomodoro sessions now earn XP (Sprint 4 unification)', () => {
  const timestamp = Date.now()
  const email = `pomodoro-xp-${timestamp}@example.com`
  const password = 'TestPass1!'

  test('registers a student', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)
    await page.getByRole('button', { name: /I'm a Student/ }).click()
    await page.getByLabel('First name').fill('PomodoroXp')
    await page.getByLabel('Last name').fill('Test')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm').fill(password)
    await page.locator('button[role="combobox"]').click()
    await page.getByRole('option', { name: 'Grade 9', exact: true }).click()
    await page.getByRole('button', { name: 'Create Account' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })
  })

  test('completing a focus session awards XP — previously always zero for this path', async ({ page }) => {
    await page.clock.install()
    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })

    await page.goto(`${BASE_URL}/focus`)
    await page.getByRole('button', { name: '15 min' }).click()
    await page.getByPlaceholder('e.g. Finish the first five algebra problems').fill('Earn some XP')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByRole('button', { name: 'Pause' }).first()).toBeVisible()

    await page.clock.runFor('15:05')

    await expect(page.getByText('Session complete')).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Met', exact: true }).click()

    // The toast is transient (sonner default ~4s) — asserted immediately
    // after the click that triggers it, nothing slower in between. 15 min
    // -> floor(15/10)*2 = 2 XP, per completeFocusSession's shared formula
    // (the same one focusMode.ts's quiz path already used).
    await expect(page.getByText(/\+2 XP/)).toBeVisible({ timeout: 10000 })
  })
})
