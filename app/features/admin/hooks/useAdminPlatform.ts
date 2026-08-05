import { createServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { desc, sql } from 'drizzle-orm'
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
    adminDb.select({ count: sql<number>`count(*)::int` }).from(users).where(sql`${users.role} = 'student'`),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(users).where(sql`${users.role} = 'teacher'`),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(institutions),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(classes),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(quizzes),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(quizzes).where(sql`${quizzes.isPublished} = true`),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(focusSessions),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(gameSessions).where(sql`${gameSessions.status} <> 'finished'`),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(quizAttempts),
    adminDb.select({ count: sql<number>`count(*)::int` }).from(quizAttempts).where(sql`${quizAttempts.submittedAt} is not null`),
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
      where: sql`${quizAttempts.submittedAt} is not null`,
      orderBy: desc(quizAttempts.submittedAt),
      limit: 8,
      with: { student: true, quiz: true },
    }),
    adminDb.query.gameSessions.findMany({
      where: sql`${gameSessions.status} = 'finished'`,
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
