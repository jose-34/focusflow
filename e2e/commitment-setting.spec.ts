import { expect, test } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test.describe.serial('Commitment Setting', () => {
  const timestamp = Date.now()
  const email = `commitment-${timestamp}@example.com`
  const password = 'TestPass1!'

  test('registers a student', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)
    await page.getByRole('button', { name: /I'm a Student/ }).click()
    await page.getByLabel('First name').fill('Commit')
    await page.getByLabel('Last name').fill('Test')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm').fill(password)
    await page.locator('button[role="combobox"]').click()
    await page.getByRole('option', { name: 'Grade 9', exact: true }).click()
    await page.getByRole('button', { name: 'Create Account' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })
  })

  test('a focus session cannot start without a commitment', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })

    await page.goto(`${BASE_URL}/focus`)
    await expect(page.getByRole('button', { name: 'Start' })).toBeDisabled()
  })

  test('setting a commitment, completing the session, shows it back with a Met/Not Met check', async ({ page }) => {
    // Install before navigating, per Playwright's own guidance — lets login
    // and page load run at normal (fake, but progressing) speed, then we
    // fast-forward through the 15-minute focus duration in one go rather
    // than actually waiting 15 real minutes for the countdown to reach zero.
    await page.clock.install()
    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })

    await page.goto(`${BASE_URL}/focus`)
    await page.getByRole('button', { name: '15 min' }).click()
    await page.getByPlaceholder('e.g. Finish the first five algebra problems').fill('Finish 5 practice problems')
    await expect(page.getByRole('button', { name: 'Start' })).toBeEnabled()
    await page.getByRole('button', { name: 'Start' }).click()
    // Once running, a MiniTimer widget (with its own Pause/Reset icon
    // buttons, aria-labeled the same) also mounts in the app layout — scope
    // to .first(), the main /focus page's own control, which sits earlier
    // in document order than the layout-level MiniTimer.
    await expect(page.getByRole('button', { name: 'Pause' }).first()).toBeVisible()

    // runFor (not fastForward) fires every intermediate setInterval tick —
    // needed since the countdown decrements one second at a time, not just
    // a single check against the new clock time.
    await page.clock.runFor('15:05')

    await expect(page.getByText('Session complete')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Finish 5 practice problems')).toBeVisible()
    await page.getByRole('button', { name: 'Met', exact: true }).click()
    await expect(page.getByText('Session complete')).toHaveCount(0)
    // The completion toast is transient (sonner auto-dismisses); check the
    // persistent state instead — the session counter advancing confirms the
    // session was actually marked complete server-side, not just that the
    // dialog closed client-side.
    await expect(page.getByText('Session 2 of 4')).toBeVisible({ timeout: 15000 })
  })

  test('an abandoned session never shows a reflection prompt', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })

    await page.goto(`${BASE_URL}/focus`)
    await page.getByPlaceholder('e.g. Finish the first five algebra problems').fill('Abandon this one')
    await page.getByRole('button', { name: 'Start' }).click()
    await expect(page.getByRole('button', { name: 'Pause' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Reset' }).first().click()
    await expect(page.getByText('Session complete')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Start' }).first()).toBeVisible()
  })
})
