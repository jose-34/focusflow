import bcrypt from 'bcryptjs'
import { eq, and } from 'drizzle-orm'
import { adminDb } from './admin'
import {
  classes,
  enrollments,
  focusSessions,
  institutions,
  loginEvents,
  quizAttempts,
  quizChoices,
  quizQuestions,
  quizzes,
  subjects,
  tasks,
  users,
  wellnessLogs,
  xpLedger,
  curricula,
} from './schema'
import { checkAndUnlockAchievements } from '../features/achievements/services/achievement.service'
import type { Tx } from './index'

// Seeds a real, connected demo dataset for the Kitengela International
// Schools pilot (Athi River Campus) presentation: one institution, two
// teachers, fifteen Grade 7/8 students, four classes, three real
// assignments, and a 14-day window of focus sessions / tasks / quiz
// attempts / wellness check-ins / XP consistent with those actions —
// generated with realistic randomness, not hand-typed to hit the exact
// pilot report figures (588 sessions / 412 tasks / etc.) since those are
// the report's own aggregate, not something this script mechanically
// reproduces. Idempotent: re-running clears prior pilot-demo rows by email
// prefix first, rather than duplicating. Callable both from the CLI script
// (npm run db:seed-pilot-demo) and from the admin console's "Reset Demo
// Data" action — kept as one shared function so the two never drift.
const SALT_ROUNDS = 12
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const DAY_MS = 24 * 60 * 60 * 1000
const PILOT_DAYS = 14

function classCode(): string {
  let code = ''
  for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return code
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: Array<T>): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const STUDENT_NAMES: Array<[string, string, number]> = [
  ['Amani', 'Wanjiru', 7],
  ['Brian', 'Otieno', 7],
  ['Cynthia', 'Achieng', 7],
  ['Dennis', 'Kiptoo', 7],
  ['Esther', 'Nyambura', 7],
  ['Felix', 'Mutua', 7],
  ['Grace', 'Chebet', 7],
  ['Hassan', 'Mohamed', 8],
  ['Irene', 'Wambui', 8],
  ['James', 'Kamau', 8],
  ['Kevin', 'Odhiambo', 8],
  ['Linet', 'Auma', 8],
  ['Moses', 'Kariuki', 8],
  ['Naomi', 'Cherono', 8],
  ['Oscar', 'Njoroge', 8],
]

const TASK_TITLES = [
  'Review fractions notes',
  'Practice multiplication tables',
  'Read chapter on ecosystems',
  'Complete worksheet 3',
  'Revise Pre-Tech vocabulary',
  'Draft science project outline',
  'Practice past paper questions',
  'Organize notes for revision',
]

export interface SeedPilotDemoResult {
  institutionName: string
  campus: string | null
  teacherCount: number
  studentCount: number
  classCount: number
  activityCount: number
  totalSessions: number
  totalTasks: number
  totalCompletedTasks: number
  totalAttempts: number
  removedStaleUsers: number
}

export async function seedPilotDemo(): Promise<SeedPilotDemoResult> {
  const staleUsers = await adminDb.query.users.findMany({ where: (u, { like }) => like(u.email, 'pilot-%@kitengela.demo') })
  for (const u of staleUsers) await adminDb.delete(users).where(eq(users.id, u.id))
  await adminDb.delete(institutions).where(eq(institutions.name, 'Kitengela International Schools'))

  const cbc = await adminDb.query.curricula.findFirst({ where: eq(curricula.code, 'cbc') })
  if (!cbc) throw new Error('Run `npm run db:seed-curricula` first — no CBC curriculum found.')
  const mathSubject = await adminDb.query.subjects.findFirst({ where: and(eq(subjects.curriculumId, cbc.id), eq(subjects.name, 'Mathematics')) })
  const preTechSubject = await adminDb.query.subjects.findFirst({ where: and(eq(subjects.curriculumId, cbc.id), eq(subjects.name, 'Pre-Technical Studies')) })
  if (!mathSubject || !preTechSubject) throw new Error('Expected Mathematics and Pre-Technical Studies subjects — run db:seed-curricula.')

  const [institution] = await adminDb.insert(institutions).values({ name: 'Kitengela International Schools', campus: 'Athi River Campus' }).returning()

  const teacherPasswordHash = await bcrypt.hash('PilotDemo2026!', SALT_ROUNDS)
  const [teacherMath] = await adminDb
    .insert(users)
    .values({ email: 'pilot-grace.mwangi@kitengela.demo', passwordHash: teacherPasswordHash, firstName: 'Grace', lastName: 'Mwangi', role: 'teacher', institutionId: institution.id })
    .returning()
  const [teacherTech] = await adminDb
    .insert(users)
    .values({ email: 'pilot-peter.otieno@kitengela.demo', passwordHash: teacherPasswordHash, firstName: 'Peter', lastName: 'Otieno', role: 'teacher', institutionId: institution.id })
    .returning()

  const studentPasswordHash = await bcrypt.hash('PilotDemo2026!', SALT_ROUNDS)
  const students: Array<typeof users.$inferSelect> = []
  for (const [first, last, grade] of STUDENT_NAMES) {
    const [student] = await adminDb
      .insert(users)
      .values({
        email: `pilot-${first.toLowerCase()}.${last.toLowerCase()}@kitengela.demo`,
        passwordHash: studentPasswordHash,
        firstName: first,
        lastName: last,
        role: 'student',
        gradeLevel: grade,
        institutionId: institution.id,
      })
      .returning()
    students.push(student)
  }
  const grade7Students = students.filter((_, i) => STUDENT_NAMES[i][2] === 7)
  const grade8Students = students.filter((_, i) => STUDENT_NAMES[i][2] === 8)

  const [g7Math] = await adminDb.insert(classes).values({ teacherId: teacherMath.id, curriculumId: cbc.id, subjectId: mathSubject.id, name: 'Grade 7 Mathematics', gradeLabel: 'Grade 7', code: classCode() }).returning()
  const [g8Math] = await adminDb.insert(classes).values({ teacherId: teacherMath.id, curriculumId: cbc.id, subjectId: mathSubject.id, name: 'Grade 8 Mathematics', gradeLabel: 'Grade 8', code: classCode() }).returning()
  const [g7Tech] = await adminDb.insert(classes).values({ teacherId: teacherTech.id, curriculumId: cbc.id, subjectId: preTechSubject.id, name: 'Grade 7 Pre-Technical Studies', gradeLabel: 'Grade 7', code: classCode() }).returning()
  const [g8Tech] = await adminDb.insert(classes).values({ teacherId: teacherTech.id, curriculumId: cbc.id, subjectId: preTechSubject.id, name: 'Grade 8 Pre-Technical Studies', gradeLabel: 'Grade 8', code: classCode() }).returning()

  for (const s of grade7Students) {
    await adminDb.insert(enrollments).values([{ classId: g7Math.id, studentId: s.id }, { classId: g7Tech.id, studentId: s.id }])
  }
  for (const s of grade8Students) {
    await adminDb.insert(enrollments).values([{ classId: g8Math.id, studentId: s.id }, { classId: g8Tech.id, studentId: s.id }])
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - PILOT_DAYS * DAY_MS)

  async function createQuiz(opts: { classId: string; authorId: string; title: string; questions: Array<[string, Array<string>, number]>; dueDaysAgo: number; timeLimitMinutes?: number }) {
    const [quiz] = await adminDb
      .insert(quizzes)
      .values({
        classId: opts.classId,
        authorId: opts.authorId,
        title: opts.title,
        isPublished: true,
        timeLimitMinutes: opts.timeLimitMinutes ?? null,
        dueDate: new Date(now.getTime() - opts.dueDaysAgo * DAY_MS),
        createdAt: new Date(windowStart.getTime() + DAY_MS),
      })
      .returning()
    for (let i = 0; i < opts.questions.length; i++) {
      const [text, choices, correctIdx] = opts.questions[i]
      const [question] = await adminDb.insert(quizQuestions).values({ quizId: quiz.id, questionText: text, position: i, points: 1 }).returning()
      await adminDb.insert(quizChoices).values(choices.map((c, idx) => ({ questionId: question.id, choiceText: c, isCorrect: idx === correctIdx, position: idx })))
    }
    return quiz
  }

  const fractionsQuiz = await createQuiz({
    classId: g7Math.id,
    authorId: teacherMath.id,
    title: 'Fractions Expedition',
    dueDaysAgo: 10,
    questions: [
      ['1/2 + 1/4 = ?', ['3/4', '2/6', '1/6', '5/8'], 0],
      ['3/4 - 1/4 = ?', ['1/4', '1/2', '2/4', '1'], 1],
      ['Which fraction is largest?', ['1/3', '1/5', '1/2', '1/8'], 2],
      ['2/3 of 12 = ?', ['6', '8', '9', '4'], 1],
    ],
  })
  const pythonQuiz = await createQuiz({
    classId: g7Tech.id,
    authorId: teacherTech.id,
    title: 'Python Operators Challenge',
    dueDaysAgo: 6,
    questions: [
      ['Which operator adds two numbers in Python?', ['+', '&', '=', '%'], 0],
      ['What does // do in Python?', ['Comment', 'Floor division', 'String join', 'Exponent'], 1],
      ['5 % 2 evaluates to?', ['2', '0', '1', '2.5'], 2],
      ['Which operator checks equality?', ['=', '==', '!=', '<>'], 1],
    ],
  })
  const assessmentQuiz = await createQuiz({
    classId: g8Math.id,
    authorId: teacherMath.id,
    title: 'Fractions Mastery Assessment',
    dueDaysAgo: 2,
    timeLimitMinutes: 15,
    questions: [
      ['4/5 + 1/5 = ?', ['1', '5/10', '3/5', '4/10'], 0],
      ['Simplify 6/8', ['3/4', '2/3', '6/8', '1/2'], 0],
      ['1/2 x 1/2 = ?', ['1/4', '1/2', '1', '2/4'], 0],
      ['Which is equivalent to 0.5?', ['1/4', '1/2', '1/5', '2/5'], 1],
    ],
  })

  const enrolledQuizzesFor = (grade: number) => (grade === 7 ? [fractionsQuiz, pythonQuiz] : [assessmentQuiz])

  let totalSessions = 0
  let totalTasks = 0
  let totalCompletedTasks = 0
  let totalAttempts = 0

  for (let idx = 0; idx < students.length; idx++) {
    const student = students[idx]
    const grade = STUDENT_NAMES[idx][2]
    const isStar = idx < 2

    await adminDb.transaction(async (tx) => {
      const sessionRows: Array<typeof focusSessions.$inferInsert> = []
      const xpRows: Array<typeof xpLedger.$inferInsert> = []
      const loginRows: Array<typeof loginEvents.$inferInsert> = []
      const taskRows: Array<typeof tasks.$inferInsert> = []
      const wellnessRows: Array<typeof wellnessLogs.$inferInsert> = []

      for (let day = 0; day < PILOT_DAYS; day++) {
        const dayStart = new Date(windowStart.getTime() + day * DAY_MS)
        const progress = day / (PILOT_DAYS - 1)
        const activeChance = isStar ? 0.95 : 0.35 + progress * 0.45
        const active = Math.random() < activeChance

        if (active) {
          const sessionsToday = isStar ? randInt(2, 3) : randInt(1, 2)
          for (let s = 0; s < sessionsToday; s++) {
            const durationMinutes = Math.round(15 + progress * 30 + randInt(-5, 10))
            const startedAt = new Date(dayStart.getTime() + randInt(7, 19) * 60 * 60 * 1000 + s * 45 * 60 * 1000)
            const completedAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000)
            sessionRows.push({
              userId: student.id,
              durationMinutes,
              startedAt,
              completedAt,
              wasSuccessful: true,
              verified: true,
              commitment: pick(TASK_TITLES),
              commitmentMet: Math.random() < 0.75,
            })
            const xp = Math.floor(durationMinutes / 10) * 2
            if (xp > 0) xpRows.push({ userId: student.id, amount: xp, source: 'focus_session', metadata: { seeded: true } })
            totalSessions++
          }
          loginRows.push({ userId: student.id, loginAt: dayStart })
        }

        if (Math.random() < 0.55) {
          const completed = Math.random() < 0.68
          const createdAt = new Date(dayStart.getTime() + randInt(8, 20) * 60 * 60 * 1000)
          taskRows.push({
            userId: student.id,
            title: pick(TASK_TITLES),
            priority: pick(['high', 'medium', 'low'] as const),
            completed,
            createdAt,
            completedAt: completed ? new Date(createdAt.getTime() + randInt(1, 6) * 60 * 60 * 1000) : null,
            taskType: 'personal',
          })
          totalTasks++
          if (completed) totalCompletedTasks++
        }

        if (day % 4 === 2 && Math.random() < 0.6) {
          const moodBase = 2 + Math.round(progress * 2)
          wellnessRows.push({ userId: student.id, mood: Math.min(5, Math.max(1, moodBase + randInt(-1, 1))), createdAt: new Date(dayStart.getTime() + 16 * 60 * 60 * 1000) })
        }
      }

      if (sessionRows.length > 0) await tx.insert(focusSessions).values(sessionRows)
      if (xpRows.length > 0) await tx.insert(xpLedger).values(xpRows)
      if (loginRows.length > 0) await tx.insert(loginEvents).values(loginRows)
      if (taskRows.length > 0) await tx.insert(tasks).values(taskRows)
      if (wellnessRows.length > 0) await tx.insert(wellnessLogs).values(wellnessRows)

      for (const quiz of enrolledQuizzesFor(grade)) {
        if (Math.random() < 0.8) {
          const maxScore = 4
          const score = randInt(2, 4)
          const submittedAt = new Date((quiz.dueDate?.getTime() ?? now.getTime()) - randInt(0, 2) * DAY_MS)
          await tx.insert(quizAttempts).values({
            quizId: quiz.id,
            studentId: student.id,
            startedAt: new Date(submittedAt.getTime() - 10 * 60 * 1000),
            submittedAt,
            score,
            maxScore,
          })
          await tx.insert(xpLedger).values({ userId: student.id, amount: score, source: 'quiz_attempt', metadata: { seeded: true, quizId: quiz.id } })
          totalAttempts++
        }
      }

      await checkAndUnlockAchievements(tx as unknown as Tx, student.id)
    })
  }

  return {
    institutionName: institution.name,
    campus: institution.campus,
    teacherCount: 2,
    studentCount: students.length,
    classCount: 4,
    activityCount: 3,
    totalSessions,
    totalTasks,
    totalCompletedTasks,
    totalAttempts,
    removedStaleUsers: staleUsers.length,
  }
}
