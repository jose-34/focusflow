import { expect, test } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test.describe.serial('Curriculum-aware onboarding', () => {
  const timestamp = Date.now()
  const teacherEmail = `curric-teacher-${timestamp}@example.com`
  const studentEmail = `curric-student-${timestamp}@example.com`
  const password = 'TestPass1!'
  let classCode = ''

  test('teacher registers via role wizard and creates a curriculum-aware class', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)

    await expect(page.getByText('How will you use FocusFlow?')).toBeVisible()
    await page.getByRole('button', { name: /I'm a Teacher/ }).click()

    // Grade field must NOT appear for teachers.
    await expect(page.getByLabel('Grade')).toHaveCount(0)

    await page.getByLabel('First name').fill('Curric')
    await page.getByLabel('Last name').fill('Teacher')
    await page.getByLabel('Email').fill(teacherEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm').fill(password)
    await page.getByRole('button', { name: 'Create Account' }).click()

    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })
    await expect(page.locator('h1')).toContainText('Welcome back')

    await page.goto(`${BASE_URL}/classes`)
    await page.getByRole('button', { name: 'Create Class' }).click()

    await expect(page.getByPlaceholder('e.g. Grade 9 Homeroom')).toBeVisible()
    await page.getByPlaceholder('e.g. Grade 9 Homeroom').fill('CBC Test Class')

    // Curriculum combobox must have at least 2 options (multi-curriculum from day one).
    const combos = page.locator('button[role="combobox"]')
    await combos.nth(0).click()
    await expect(page.getByRole('option')).toHaveCount(2)
    await page.getByRole('option', { name: 'Competency-Based Curriculum (CBC)', exact: true }).click()

    // Subject list must be scoped to CBC — Kiswahili should be present.
    await combos.nth(1).click()
    await expect(page.getByRole('option', { name: 'Kiswahili', exact: true })).toBeVisible()
    await page.getByRole('option', { name: 'Kiswahili', exact: true }).click()

    await page.getByPlaceholder(/Grade label/).fill('Grade 9')
    await page.getByRole('button', { name: 'Create' }).click()

    await expect(page.getByText('CBC Test Class')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Competency-Based Curriculum (CBC)')).toBeVisible()
    await expect(page.getByText('Kiswahili')).toBeVisible()

    // Grab the generated class code (font-mono uppercase badge) for the student to join with.
    const codeBadge = page.locator('span').filter({ hasText: /^[A-Z0-9]{6}$/ }).first()
    classCode = (await codeBadge.textContent())?.trim() ?? ''
    expect(classCode).toMatch(/^[A-Z0-9]{6}$/)

    // Now prove subjects are curriculum-scoped, not decorative: switch to Cambridge.
    await page.getByRole('button', { name: 'Create Class' }).click()
    await combos.nth(0).click()
    await page.getByRole('option', { name: 'Cambridge International', exact: true }).click()
    await combos.nth(1).click()
    await expect(page.getByRole('option', { name: 'Kiswahili', exact: true })).toHaveCount(0)
    await expect(page.getByRole('option', { name: 'Global Perspectives', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('student registers (grade field appears) and joins the class', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)

    await expect(page.getByText('How will you use FocusFlow?')).toBeVisible()
    await page.getByRole('button', { name: /I'm a Student/ }).click()

    await page.getByLabel('First name').fill('Curric')
    await page.getByLabel('Last name').fill('Student')
    await page.getByLabel('Email').fill(studentEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm').fill(password)

    // Grade field DOES appear for students.
    await page.locator('button[role="combobox"]').click()
    await page.getByRole('option', { name: 'Grade 9', exact: true }).click()

    await page.getByRole('button', { name: 'Create Account' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })

    await page.goto(`${BASE_URL}/classes`)
    await page.getByRole('button', { name: 'Join Class' }).click()
    await page.getByPlaceholder('ABC123').fill(classCode)
    await page.getByRole('button', { name: 'Join' }).click()

    await expect(page.getByText('CBC Test Class')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Competency-Based Curriculum (CBC)')).toBeVisible()
    await expect(page.getByText('Kiswahili')).toBeVisible()
  })
})
