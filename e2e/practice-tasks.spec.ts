import { expect, test } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test.describe.serial('Practice Tasks + roster management', () => {
  const timestamp = Date.now()
  const teacherEmail = `sprint1-teacher-${timestamp}@example.com`
  const studentEmail = `sprint1-student-${timestamp}@example.com`
  const password = 'TestPass1!'
  let classCode = ''

  test('teacher creates a class', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)
    await page.getByRole('button', { name: /I'm a Teacher/ }).click()
    await page.getByLabel('First name').fill('Sprint1')
    await page.getByLabel('Last name').fill('Teacher')
    await page.getByLabel('Email').fill(teacherEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm').fill(password)
    await page.getByRole('button', { name: 'Create Account' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })

    await page.goto(`${BASE_URL}/classes`)
    await page.getByRole('button', { name: 'Create Class' }).click()
    await page.getByPlaceholder('e.g. Grade 9 Homeroom').fill('Sprint1 Class')
    const combos = page.locator('button[role="combobox"]')
    await combos.nth(0).click()
    await page.getByRole('option', { name: 'Competency-Based Curriculum (CBC)', exact: true }).click()
    await combos.nth(1).click()
    await page.getByRole('option', { name: 'Mathematics', exact: true }).click()
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('Sprint1 Class')).toBeVisible({ timeout: 15000 })

    const codeBadge = page.locator('span').filter({ hasText: /^[A-Z0-9]{6}$/ }).first()
    classCode = (await codeBadge.textContent())?.trim() ?? ''
    expect(classCode).toMatch(/^[A-Z0-9]{6}$/)
  })

  test('student joins the class before any practice task exists', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)
    await page.getByRole('button', { name: /I'm a Student/ }).click()
    await page.getByLabel('First name').fill('Sprint1')
    await page.getByLabel('Last name').fill('Student')
    await page.getByLabel('Email').fill(studentEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm').fill(password)
    await page.locator('button[role="combobox"]').click()
    await page.getByRole('option', { name: 'Grade 9', exact: true }).click()
    await page.getByRole('button', { name: 'Create Account' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })

    await page.goto(`${BASE_URL}/classes`)
    await page.getByRole('button', { name: 'Join Class' }).click()
    await page.getByPlaceholder('ABC123').fill(classCode)
    await page.getByRole('button', { name: 'Join' }).click()
    await expect(page.getByText('Sprint1 Class', { exact: true })).toBeVisible({ timeout: 15000 })
  })

  test('teacher assigns a practice task — fans out to the one actively-enrolled student', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel('Email').fill(teacherEmail)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })

    await page.goto(`${BASE_URL}/classes`)
    await page.getByText('Sprint1 Class').click()
    await expect(page.getByText('Practice Tasks', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Assign' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByPlaceholder('e.g. Practice: quadratic equations').fill('Practice: fractions')
    await dialog.getByRole('button', { name: 'Assign' }).click()
    await expect(page.getByText('Practice: fractions')).toBeVisible({ timeout: 15000 })
    // Exactly one actively-enrolled student at assignment time.
    await expect(page.getByText('0 of 1 done')).toBeVisible()
  })

  test('student sees it grouped separately from personal tasks, and completes it', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel('Email').fill(studentEmail)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })

    await page.goto(`${BASE_URL}/tasks`)
    await expect(page.getByText('Assigned — Practice')).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Practice: fractions')).toBeVisible()

    // Complete it, and confirm there's no delete button on an assigned task.
    // .first() picks the outermost matching row div (document order is
    // parent-before-child) — the checkbox lives there, as a sibling of the
    // inner text wrapper, not inside it, so .last() would resolve to a div
    // with no checkbox descendant at all.
    const taskRow = page.locator('div').filter({ hasText: 'Practice: fractions' }).first()
    await taskRow.getByRole('checkbox').click()
    await expect(page.getByLabel('Delete task')).toHaveCount(0)
  })

  test('teacher sees the completion count update and can remove the student', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel('Email').fill(teacherEmail)
    await page.getByLabel('Password').fill(password)
    await page.getByRole('button', { name: 'Log In' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })

    await page.goto(`${BASE_URL}/classes`)
    await page.getByText('Sprint1 Class').click()
    await expect(page.getByText('1 of 1 done')).toBeVisible({ timeout: 15000 })

    await expect(page.getByText('Sprint1 Student')).toBeVisible()
    await page.getByRole('button', { name: /Remove Sprint1 Student/ }).click()
    await expect(page.getByText('No students yet')).toBeVisible({ timeout: 15000 })
  })
})
