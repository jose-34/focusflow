import { expect, test } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

test.describe.serial('Quiz-linked focus session unlocks an achievement', () => {
  const timestamp = Date.now()
  const teacherEmail = `sprint3-teacher-${timestamp}@example.com`
  const studentEmail = `sprint3-student-${timestamp}@example.com`
  const password = 'TestPass1!'
  let classId = ''
  let classCode = ''

  test('teacher creates a class and a published quiz', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)
    await page.getByRole('button', { name: /I'm a Teacher/ }).click()
    await page.getByLabel('First name').fill('Sprint3')
    await page.getByLabel('Last name').fill('Teacher')
    await page.getByLabel('Email').fill(teacherEmail)
    await page.getByLabel('Password', { exact: true }).fill(password)
    await page.getByLabel('Confirm').fill(password)
    await page.getByRole('button', { name: 'Create Account' }).click()
    await expect(page).toHaveURL(`${BASE_URL}/dashboard`, { timeout: 20000 })

    await page.goto(`${BASE_URL}/classes`)
    await page.getByRole('button', { name: 'Create Class' }).click()
    await page.getByPlaceholder('e.g. Grade 9 Homeroom').fill('Sprint3 Class')
    const combos = page.locator('button[role="combobox"]')
    await combos.nth(0).click()
    await page.getByRole('option', { name: 'Competency-Based Curriculum (CBC)', exact: true }).click()
    await combos.nth(1).click()
    await page.getByRole('option', { name: 'Mathematics', exact: true }).click()
    await page.getByRole('button', { name: 'Create' }).click()
    await expect(page.getByText('Sprint3 Class', { exact: true })).toBeVisible({ timeout: 15000 })

    const codeBadge = page.locator('span').filter({ hasText: /^[A-Z0-9]{6}$/ }).first()
    classCode = (await codeBadge.textContent())?.trim() ?? ''
    expect(classCode).toMatch(/^[A-Z0-9]{6}$/)

    await page.getByText('Sprint3 Class', { exact: true }).click()
    await expect(page).toHaveURL(/\/classes\/[^/]+$/, { timeout: 15000 })
    classId = new URL(page.url()).pathname.split('/')[2]

    await page.goto(`${BASE_URL}/classes/${classId}/quizzes/new`)
    await page.getByLabel('Title').fill('Sprint3 Quiz')
    await page.getByRole('button', { name: 'Create Quiz & Add Questions' }).click()
    await expect(page).toHaveURL(new RegExp(`/classes/${classId}/quizzes/`), { timeout: 15000 })

    await page.getByRole('button', { name: 'Add Question' }).click()
    await page.getByPlaceholder('Question text').fill('What is 2 + 2?')
    await page.getByPlaceholder('Choice 1').fill('4')
    await page.getByPlaceholder('Choice 2').fill('5')
    await page.getByRole('button', { name: 'Save Question' }).click()
    await expect(page.getByText('What is 2 + 2?')).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Publish' }).click()
    await expect(page.getByText('Live', { exact: true })).toBeVisible({ timeout: 15000 })
  })

  test('student joins, takes the quiz, and unlocks First Focus', async ({ page }) => {
    await page.goto(`${BASE_URL}/register`)
    await page.getByRole('button', { name: /I'm a Student/ }).click()
    await page.getByLabel('First name').fill('Sprint3')
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
    await expect(page.getByText('Sprint3 Class', { exact: true })).toBeVisible({ timeout: 15000 })

    await page.goto(`${BASE_URL}/classes/${classId}`)
    await page.getByText('Sprint3 Quiz', { exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/classes/${classId}/quizzes/`), { timeout: 15000 })

    await page.getByRole('button', { name: 'Start Quiz' }).click()
    // Waits for the first heartbeat round trip to actually complete (it
    // fires immediately on start, not just on the 15s interval) — this is
    // what creates the underlying focus_sessions row that endFocusSessionFn
    // later marks wasSuccessful, which is what the achievement check reads.
    await expect(page.getByText(/min verified/)).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: '4' }).click()
    await page.getByRole('button', { name: 'Submit Quiz' }).click()
    await expect(page.getByText('Your score')).toBeVisible({ timeout: 15000 })

    await page.goto(`${BASE_URL}/achievements`)
    const firstFocusCard = page.locator('div').filter({ hasText: 'First Focus' }).first()
    await expect(firstFocusCard.getByText(/Unlocked/)).toBeVisible({ timeout: 15000 })
  })
})
