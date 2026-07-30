import { expect, test } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test('wellness page shows the crisis-resource card', async ({ page }) => {
  const timestamp = Date.now()
  const email = `wellness-crisis-${timestamp}@example.com`
  const password = 'TestPass1!'

  await page.goto(`${BASE_URL}/register`)
  await page.getByRole('button', { name: /I'm a Student/ }).click()
  await page.getByLabel('First name').fill('Crisis')
  await page.getByLabel('Last name').fill('Test')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByLabel('Confirm').fill(password)
  await page.locator('button[role="combobox"]').click()
  await page.getByRole('option', { name: 'Grade 9', exact: true }).click()
  await page.getByRole('button', { name: 'Create Account' }).click()
  await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })

  await page.goto(`${BASE_URL}/wellness`)
  await expect(page.getByText('If you need to talk to someone')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText(/not even your teacher sees them/)).toBeVisible()
})
