import { expect, test } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test.describe('FocusFlow smoke tests', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto(BASE_URL)
    await expect(page.locator('h1')).toContainText('Master Your Focus')
    await expect(page.getByRole('link', { name: 'Get Started Free' })).toBeVisible()
    // "Log In" appears both in the top nav and the hero CTA — .first() is
    // enough to confirm the page rendered without being strict-mode ambiguous.
    await expect(page.getByRole('link', { name: 'Log In' }).first()).toBeVisible()
  })

  test('register and login flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)
    await expect(page.getByText('Create your account')).toBeVisible()

    const timestamp = Date.now()
    const email = `smoketest-${timestamp}@example.com`
    const password = 'TestPass1!'

    // Step 1: role selector (RoleStep cards), not a form field.
    await expect(page.getByText('How will you use FocusFlow?')).toBeVisible()
    await page.getByRole('button', { name: /I'm a Student/ }).click()

    // Step 2: the rest of the fields.
    await page.getByLabel('First name').fill('Smoke')
    await page.getByLabel('Last name').fill('Test')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm').fill(password)

    // Grade is a shadcn Select component (Radix combobox), not a native
    // <select> element — selectOption() would silently fail to find it.
    await page.locator('button[role="combobox"]').click()
    await page.getByRole('option', { name: 'Grade 9', exact: true }).click()

    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 15000 })
    await expect(page.locator('h1')).toContainText('Welcome back')

    // ---- Log out, then log back in with the same account, self-contained
    // (no dependency on a pre-existing seeded user, which won't exist on a
    // fresh database) ----
    await page.locator('button[aria-haspopup="menu"]').last().click()
    await page.getByText('Log out').click()
    await expect(page).toHaveURL(`${BASE_URL}/`, { timeout: 10000 })

    await page.goto(`${BASE_URL}/login`)
    await expect(page.getByText('Welcome back')).toBeVisible()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log In' }).click()

    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 15000 })
  })
})
