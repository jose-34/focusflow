import { createServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { desc, eq, isNotNull, ne, sql } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import {
  classes,
  enrollments,
  focusSessions,
  gameSessions,
  institutions,
  quizAttempts,
  quizzes,
  userAchievements,
  users,
} from '@/db/schema'
import { requireAdmin } from '@/features/auth/utils'

// Platform-wide aggregate reads for the admin console. Deliberately uses
// adminDb (RLS bypass) rather than withRlsContext — every existing RLS
// policy scopes to "your own rows" (self, your class, your students), and
// none grants a blanket "admin sees everything" carve-out, so a genuine
// cross-user platform view has no RLS path to read through. requireAdmin()
// is the gate that makes this safe: only an authenticated admin reaches
// the adminDb calls below.
export interface PlatformOverview {
  totalStudents: number
  totalTeachers: number
  totalInstitutions: number
  totalClasses: number
  totalActivities: number
  publishedActivities: number
  totalFocusSessions: number
  activeLiveSessions: number
  totalAttempts: number
  completedAttempts: number
  completionRate: number
}

export const getPlatformOverviewFn = createServerFn({ method: 'GET' }).handler(async (): Promise<PlatformOverview> => {
  await requireAdmin()

  const [
    [{ count: totalStudents }],
    [{ count: totalTeachers }],
    [{ count: totalInstitutions }],
    [{ count: totalClasses }],
    [{ count: totalActivities }],
    [{ count: publishedActivities }],
    [{ count: totalFocusSessions }],
    [{ count: activeLiveSessions }],
    [{ count: totalAttempts }],
    [{ count: completedAttempts }],
  ] = await Promise.all([
    adminDb.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.role, 'student')),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.role, 'teacher')),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(institutions),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(classes),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(quizzes),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(quizzes).where(eq(quizzes.isPublished, true)),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(focusSessions),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(gameSessions).where(ne(gameSessions.status, 'finished')),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(quizAttempts),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(quizAttempts).where(isNotNull(quizAttempts.submittedAt)),
  ])

  return {
    totalStudents,
    totalTeachers,
    totalInstitutions,
    totalClasses,
    totalActivities,
    publishedActivities,
    totalFocusSessions,
    activeLiveSessions,
    totalAttempts,
    completedAttempts,
    completionRate: totalAttempts > 0 ? Math.round((completedAttempts / totalAttempts) * 100) : 0,
  }
})

export interface ActivityFeedEntry {
  id: string
  timestamp: string
  summary: string
}

// Derived entirely from real, already-existing event data (no new writes,
// no fake log lines) — merges the most recent rows across the tables that
// already carry a meaningful timestamp, tags each with a human-readable
// summary, and sorts the union by time.
export const getSystemActivityFeedFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<ActivityFeedEntry>> => {
  await requireAdmin()

  const [recentQuizzes, recentClasses, recentEnrollments, recentAttempts, recentGames, recentAchievements] = await Promise.all([
    adminDb.query.quizzes.findMany({
      orderBy: desc(quizzes.createdAt),
      limit: 8,
      with: { author: true },
    }),
    adminDb.query.classes.findMany({
      orderBy: desc(classes.createdAt),
      limit: 8,
      with: { teacher: true },
    }),
    adminDb.query.enrollments.findMany({
      orderBy: desc(enrollments.enrolledAt),
      limit: 8,
      with: { student: true, class: true },
    }),
    adminDb.query.quizAttempts.findMany({
      where: isNotNull(quizAttempts.submittedAt),
      orderBy: desc(quizAttempts.submittedAt),
      limit: 8,
      with: { student: true, quiz: true },
    }),
    adminDb.query.gameSessions.findMany({
      where: eq(gameSessions.status, 'finished'),
      orderBy: desc(gameSessions.endedAt),
      limit: 8,
      with: { host: true, quiz: true },
    }),
    adminDb.query.userAchievements.findMany({
      orderBy: desc(userAchievements.unlockedAt),
      limit: 8,
      with: { user: true },
    }),
  ])

  const entries: Array<ActivityFeedEntry> = [
    ...recentQuizzes.map((q) => ({
      id: `quiz-${q.id}`,
      timestamp: q.createdAt.toISOString(),
      summary: `${q.author ? `${q.author.firstName} ${q.author.lastName}` : 'Someone'} created "${q.title}"${q.isPublished ? ' (published)' : ''}`,
    })),
    ...recentClasses.map((c) => ({
      id: `class-${c.id}`,
      timestamp: c.createdAt.toISOString(),
      summary: `${c.teacher.firstName} ${c.teacher.lastName} created class "${c.name}"`,
    })),
    ...recentEnrollments.map((e) => ({
      id: `enrollment-${e.id}`,
      timestamp: e.enrolledAt.toISOString(),
      summary: `${e.student.firstName} ${e.student.lastName} joined "${e.class.name}"`,
    })),
    ...recentAttempts.map((a) => ({
      id: `attempt-${a.id}`,
      timestamp: a.submittedAt!.toISOString(),
      summary: `${a.student.firstName} ${a.student.lastName} completed "${a.quiz.title}" — ${a.score}/${a.maxScore}`,
    })),
    ...recentGames.map((g) => ({
      id: `game-${g.id}`,
      timestamp: (g.endedAt ?? g.createdAt).toISOString(),
      summary: `${g.host.firstName} ${g.host.lastName} finished a live game for "${g.quiz.title}"`,
    })),
    ...recentAchievements.map((a) => ({
      id: `achievement-${a.userId}-${a.achievementKey}`,
      timestamp: a.unlockedAt.toISOString(),
      summary: `${a.user.firstName} ${a.user.lastName} unlocked an achievement`,
    })),
  ]

  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 25)
})

export interface InstitutionSummary {
  id: string
  name: string
  campus: string | null
  teacherCount: number
  studentCount: number
}

export const getInstitutionsFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<InstitutionSummary>> => {
  await requireAdmin()

  const rows = await adminDb.query.institutions.findMany({
    orderBy: (i, { asc }) => asc(i.name),
    with: { users: true },
  })

  return rows.map((inst) => ({
    id: inst.id,
    name: inst.name,
    campus: inst.campus,
    teacherCount: inst.users.filter((u) => u.role === 'teacher').length,
    studentCount: inst.users.filter((u) => u.role === 'student').length,
  }))
})

export interface AdminUserSummary {
  id: string
  firstName: string
  lastName: string
  email: string
  role: 'student' | 'teacher' | 'admin'
  status: 'active' | 'inactive' | 'suspended'
  institutionName: string | null
  createdAt: string
}

export const getAdminUsersFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<AdminUserSummary>> => {
  await requireAdmin()

  const rows = await adminDb.query.users.findMany({
    orderBy: (u, { desc: descOp }) => descOp(u.createdAt),
    with: { institution: true },
  })

  return rows.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    role: u.role,
    status: u.status,
    institutionName: u.institution?.name ?? null,
    createdAt: u.createdAt.toISOString(),
  }))
})

export type SessionStatus = 'scheduled' | 'running' | 'completed' | 'paused'

export interface SessionRow {
  id: string
  kind: 'quiz' | 'game'
  title: string
  status: SessionStatus
  className: string | null
  teacherName: string
  date: string
  participantCount: number
  accuracyPct: number | null
}

// Unified view across both session-shaped things this platform has: async
// quiz assignments (class-linked, due-dated) and live PIN-join games.
// Status here isn't a stored column for quizzes — it's derived, since the
// spec's status axis doesn't map 1:1 onto what's actually stored:
//   scheduled: published, due in the future, nobody's attempted it yet
//   running:   published and currently attemptable (no due date passed,
//              or a live game still in lobby/question/reveal)
//   completed: due date passed, or every attempt-eligible student has
//              submitted, or a live game finished
//   paused:    previously published, now unpublished (see unpublishedAt)
export const getAdminSessionsFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<SessionRow>> => {
  await requireAdmin()

  const [assignedQuizzes, liveGames] = await Promise.all([
    adminDb.query.quizzes.findMany({
      where: (q, { and: andOp, isNotNull }) => andOp(isNotNull(q.classId), isNotNull(q.dueDate)),
      with: { class: { with: { teacher: true, enrollments: true } }, attempts: true },
      orderBy: desc(quizzes.updatedAt),
    }),
    adminDb.query.gameSessions.findMany({
      with: { host: true, quiz: true, participants: true },
      orderBy: desc(gameSessions.createdAt),
      limit: 50,
    }),
  ])

  const now = Date.now()
  const quizRows: Array<SessionRow> = assignedQuizzes.map((q) => {
    const submittedCount = q.attempts.filter((a) => a.submittedAt !== null).length
    const enrolledCount = q.class?.enrollments.length ?? 0
    const dueDatePassed = q.dueDate ? q.dueDate.getTime() < now : false
    let status: SessionStatus
    if (q.unpublishedAt) status = 'paused'
    else if (dueDatePassed || (enrolledCount > 0 && submittedCount >= enrolledCount)) status = 'completed'
    else if (q.isPublished && submittedCount === 0 && q.dueDate && q.dueDate.getTime() > now) status = 'scheduled'
    else status = 'running'

    const scored = q.attempts.filter((a) => a.submittedAt !== null && a.maxScore > 0)
    const accuracyPct = scored.length > 0 ? Math.round((scored.reduce((sum, a) => sum + (a.score ?? 0) / a.maxScore, 0) / scored.length) * 100) : null

    return {
      id: q.id,
      kind: 'quiz',
      title: q.title,
      status,
      className: q.class?.name ?? null,
      teacherName: q.class ? `${q.class.teacher.firstName} ${q.class.teacher.lastName}` : 'Unknown',
      date: (q.dueDate ?? q.updatedAt).toISOString(),
      participantCount: submittedCount,
      accuracyPct,
    }
  })

  const gameRows: Array<SessionRow> = liveGames.map((g) => {
    const scored = g.participants.filter((p) => p.score > 0)
    return {
      id: g.id,
      kind: 'game',
      title: g.quiz.title,
      status: g.status === 'finished' ? 'completed' : 'running',
      className: null,
      teacherName: `${g.host.firstName} ${g.host.lastName}`,
      date: (g.endedAt ?? g.createdAt).toISOString(),
      participantCount: g.participants.length,
      accuracyPct: scored.length > 0 ? Math.round((scored.length / Math.max(g.participants.length, 1)) * 100) : null,
    }
  })

  return [...quizRows, ...gameRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
})

export function useAdminSessions() {
  return useQuery({ queryKey: ['admin', 'sessions'], queryFn: () => getAdminSessionsFn() })
}

export interface DailyAnalyticsPoint {
  date: string
  activeLearners: number
  focusMinutes: number
  tasksCompleted: number
  quizAttempts: number
}

const ANALYTICS_WINDOW_DAYS = 14

export const getPlatformAnalyticsFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<DailyAnalyticsPoint>> => {
  await requireAdmin()

  const windowStart = new Date(Date.now() - ANALYTICS_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [sessions, completedTasks, attempts] = await Promise.all([
    adminDb.query.focusSessions.findMany({
      where: (fs, { gte, and: andOp, eq: eqOp }) => andOp(gte(fs.startedAt, windowStart), eqOp(fs.wasSuccessful, true)),
      columns: { userId: true, startedAt: true, durationMinutes: true },
    }),
    adminDb.query.tasks.findMany({
      where: (t, { gte, isNotNull, and: andOp }) => andOp(isNotNull(t.completedAt), gte(t.completedAt, windowStart)),
      columns: { completedAt: true },
    }),
    adminDb.query.quizAttempts.findMany({
      where: (a, { gte, isNotNull, and: andOp }) => andOp(isNotNull(a.submittedAt), gte(a.submittedAt, windowStart)),
      columns: { studentId: true, submittedAt: true },
    }),
  ])

  const points: Array<DailyAnalyticsPoint> = []
  for (let i = ANALYTICS_WINDOW_DAYS - 1; i >= 0; i--) {
    const dayStart = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)
    const dateKey = dayStart.toISOString().slice(0, 10)

    const daySessions = sessions.filter((s) => s.startedAt >= dayStart && s.startedAt < dayEnd)
    const dayAttempts = attempts.filter((a) => a.submittedAt && a.submittedAt >= dayStart && a.submittedAt < dayEnd)
    const activeLearnerIds = new Set([...daySessions.map((s) => s.userId), ...dayAttempts.map((a) => a.studentId)])

    points.push({
      date: dateKey,
      activeLearners: activeLearnerIds.size,
      focusMinutes: daySessions.reduce((sum, s) => sum + s.durationMinutes, 0),
      tasksCompleted: completedTasks.filter((t) => t.completedAt && t.completedAt >= dayStart && t.completedAt < dayEnd).length,
      quizAttempts: dayAttempts.length,
    })
  }

  return points
})

export function usePlatformAnalytics() {
  return useQuery({ queryKey: ['admin', 'analytics'], queryFn: () => getPlatformAnalyticsFn() })
}

export function usePlatformOverview() {
  return useQuery({ queryKey: ['admin', 'platform-overview'], queryFn: () => getPlatformOverviewFn() })
}

export function useSystemActivityFeed() {
  return useQuery({ queryKey: ['admin', 'activity-feed'], queryFn: () => getSystemActivityFeedFn(), refetchInterval: 15000 })
}

export function useInstitutions() {
  return useQuery({ queryKey: ['admin', 'institutions'], queryFn: () => getInstitutionsFn() })
}

export function useAdminUsers() {
  return useQuery({ queryKey: ['admin', 'users'], queryFn: () => getAdminUsersFn() })
}
