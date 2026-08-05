import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'
import { useQuery } from '@tanstack/react-query'
import { and, count, countDistinct, desc, eq, gte, inArray, sql } from 'drizzle-orm'
import { Compass, GraduationCap, ListChecks, Radio, Timer, Trophy, Users } from 'lucide-react'
import { withRlsContext } from '@/db'
import { enrollments, focusSessions, quizAttempts, quizzes, userAchievements, users } from '@/db/schema'
import { authService } from '@/features/auth/services/auth.service'
import { getCurrentUserFn, useAuth } from '@/features/auth/hooks/useAuth'
import { usePublicQuizzes } from '@/features/quizzes/hooks/usePublicQuizzes'
import { useMyEquippedSprites } from '@/features/economy/hooks/useEconomy'
import { AvatarDisplay } from '@/features/economy/components/AvatarDisplay'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DashboardShell, StatGrid } from '@/components/dashboard/DashboardShell'
import { StatCard } from '@/components/dashboard/StatCard'
import { ConsistencyStreakCard, StartDelayTrendCard } from '@/components/dashboard/ProcrastinationWidgets'
import { MissionsWidget } from '@/components/dashboard/MissionsWidget'

interface ClassRef {
  id: string
  name: string
  code: string
  curriculumName: string
  subjectName: string
  gradeLabel: string | null
}

interface TeacherDashboardData {
  role: 'teacher'
  classes: Array<ClassRef & { studentCount: number }>
  totalStudentCount: number
  totalQuizCount: number
  recentAttempts: Array<{
    id: string
    studentName: string
    quizTitle: string
    score: number | null
    maxScore: number
  }>
  activeSessions: Array<{
    id: string
    quizTitle: string
    status: 'lobby' | 'question' | 'reveal'
    participantCount: number
  }>
  todaysActivities: Array<{
    id: string
    title: string
    className: string
    assignedCount: number
    completedCount: number
    inProgressCount: number
  }>
}

interface StudentDashboardData {
  role: 'student'
  enrolledClasses: Array<ClassRef>
  achievementCount: number
  focusSessionsToday: number
}

type DashboardData = TeacherDashboardData | StudentDashboardData

const getDashboardDataFn = createServerFn({ method: 'GET' }).handler(async (): Promise<DashboardData> => {
  const token = getCookie('session_token')
  const validated = await authService.validateSession(token ?? '')
  if (!validated) {
    throw new Error('Not authenticated')
  }
  const { user } = validated

  return withRlsContext(user.id, async (tx) => {
    if (user.role === 'teacher') {
      const teacherClasses = await tx.query.classes.findMany({
        where: (c, { eq: eqOp }) => eqOp(c.teacherId, user.id),
        with: { enrollments: true, curriculum: true, subject: true },
        orderBy: (c, { desc: descOp }) => descOp(c.createdAt),
      })
      const classIds = teacherClasses.map((c) => c.id)

      const [{ value: totalStudentCount }] =
        classIds.length === 0
          ? [{ value: 0 }]
          : await tx
              .select({ value: countDistinct(enrollments.studentId) })
              .from(enrollments)
              .where(inArray(enrollments.classId, classIds))

      const [{ value: totalQuizCount }] =
        classIds.length === 0 ? [{ value: 0 }] : await tx.select({ value: count() }).from(quizzes).where(inArray(quizzes.classId, classIds))

      const recentAttemptRows =
        classIds.length === 0
          ? []
          : await tx
              .select({
                id: quizAttempts.id,
                score: quizAttempts.score,
                maxScore: quizAttempts.maxScore,
                quizTitle: quizzes.title,
                firstName: users.firstName,
                lastName: users.lastName,
              })
              .from(quizAttempts)
              .innerJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
              .innerJoin(users, eq(users.id, quizAttempts.studentId))
              .where(inArray(quizzes.classId, classIds))
              .orderBy(desc(quizAttempts.startedAt))
              .limit(10)

      const activeSessionRows = await tx.query.gameSessions.findMany({
        where: (gs, { eq: eqOp, and: andOp, ne: neOp }) => andOp(eqOp(gs.hostId, user.id), neOp(gs.status, 'finished')),
        with: { quiz: true, participants: true },
        orderBy: (gs, { desc: descOp }) => descOp(gs.createdAt),
      })

      const dueDatedQuizzes =
        classIds.length === 0
          ? []
          : await tx.query.quizzes.findMany({
              where: (q, { inArray: inArrayOp, isNotNull, and: andOp }) => andOp(inArrayOp(q.classId, classIds), isNotNull(q.dueDate)),
              with: { class: { with: { enrollments: true } }, attempts: true },
              orderBy: (q, { desc: descOp }) => descOp(q.dueDate),
              limit: 5,
            })

      return {
        role: 'teacher',
        classes: teacherClasses.map((cls) => ({
          id: cls.id,
          name: cls.name,
          code: cls.code,
          curriculumName: cls.curriculum.name,
          subjectName: cls.subject.name,
          gradeLabel: cls.gradeLabel,
          studentCount: cls.enrollments.filter((e) => e.status === 'active').length,
        })),
        totalStudentCount,
        totalQuizCount,
        recentAttempts: recentAttemptRows.map((row) => ({
          id: row.id,
          studentName: `${row.firstName} ${row.lastName}`,
          quizTitle: row.quizTitle,
          score: row.score,
          maxScore: row.maxScore,
        })),
        activeSessions: activeSessionRows.map((s) => ({
          id: s.id,
          quizTitle: s.quiz.title,
          status: s.status as 'lobby' | 'question' | 'reveal',
          participantCount: s.participants.length,
        })),
        todaysActivities: dueDatedQuizzes.map((q) => {
          const assignedCount = q.class?.enrollments.filter((e) => e.status === 'active').length ?? 0
          const completedCount = q.attempts.filter((a) => a.submittedAt !== null).length
          const inProgressCount = q.attempts.filter((a) => a.submittedAt === null).length
          return { id: q.id, title: q.title, className: q.class?.name ?? '', assignedCount, completedCount, inProgressCount }
        }),
      } satisfies TeacherDashboardData
    }

    const myEnrollments = await tx.query.enrollments.findMany({
      where: (e, { eq: eqOp }) => eqOp(e.studentId, user.id),
      with: { class: { with: { curriculum: true, subject: true } } },
    })

    const [{ value: achievementCount }] = await tx
      .select({ value: count() })
      .from(userAchievements)
      .where(eq(userAchievements.userId, user.id))

    const [{ value: focusSessionsToday }] = await tx
      .select({ value: count() })
      .from(focusSessions)
      .where(and(eq(focusSessions.userId, user.id), gte(focusSessions.startedAt, sql`current_date`)))

    return {
      role: 'student',
      enrolledClasses: myEnrollments.map((e) => ({
        id: e.class.id,
        name: e.class.name,
        code: e.class.code,
        curriculumName: e.class.curriculum.name,
        subjectName: e.class.subject.name,
        gradeLabel: e.class.gradeLabel,
      })),
      achievementCount,
      focusSessionsToday,
    } satisfies StudentDashboardData
  })
})

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role === 'admin') {
      throw redirect({ to: '/admin' })
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', user?.id],
    queryFn: () => getDashboardDataFn(),
    enabled: !!user,
  })
  const { data: equippedSprites } = useMyEquippedSprites()

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
      </div>
    )
  }

  return (
    <DashboardShell
      title={
        data.role === 'student' ? (
          <span className="flex items-center gap-3">
            <AvatarDisplay sprites={equippedSprites ?? {}} size="sm" />
            Welcome back, {user?.firstName}
          </span>
        ) : (
          `Welcome back, ${user?.firstName}`
        )
      }
    >
      {data.role === 'teacher' ? <TeacherDashboard data={data} /> : <StudentDashboard data={data} />}
    </DashboardShell>
  )
}

function ClassBadges({ cls }: { cls: ClassRef }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="secondary" className="text-[10px]">
        {cls.curriculumName}
      </Badge>
      <Badge variant="secondary" className="text-[10px]">
        {cls.subjectName}
      </Badge>
      {cls.gradeLabel && (
        <Badge variant="outline" className="text-[10px]">
          {cls.gradeLabel}
        </Badge>
      )}
    </div>
  )
}

function TeacherDashboard({ data }: { data: TeacherDashboardData }) {
  return (
    <>
      <StatGrid>
        <StatCard label="Active Classes" value={data.classes.length} icon={GraduationCap} delay={0} />
        <StatCard label="Total Students" value={data.totalStudentCount} icon={Users} delay={0.05} />
        <StatCard label="Quizzes Created" value={data.totalQuizCount} icon={ListChecks} delay={0.1} />
      </StatGrid>

      {data.activeSessions.length > 0 && (
        <Card className="border-primary/40 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-foreground">
              <Radio className="size-4 text-primary" />
              Active Sessions
            </CardTitle>
            <CardDescription>Live games you're currently hosting</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.activeSessions.map((s) => (
              <Link
                key={s.id}
                to="/game/host/$sessionId"
                params={{ sessionId: s.id }}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/30 bg-background px-3 py-2 transition-colors hover:bg-secondary/50"
              >
                <span className="text-sm font-medium text-foreground">{s.quizTitle}</span>
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge className="text-[10px] capitalize">{s.status}</Badge>
                  {s.participantCount} joined
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      {data.todaysActivities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-foreground">Today&apos;s Activities</CardTitle>
            <CardDescription>Assigned work across your classes and how it&apos;s going</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.todaysActivities.map((a) => {
              const notStarted = Math.max(0, a.assignedCount - a.completedCount - a.inProgressCount)
              return (
                <div key={a.id} className="rounded-md border border-border bg-background px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <p className="text-sm font-medium text-foreground">{a.title}</p>
                    <span className="text-xs text-muted-foreground">{a.className}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{a.assignedCount} assigned</span>
                    <span className="text-primary">{a.completedCount} completed</span>
                    <span>{a.inProgressCount} in progress</span>
                    <span>{notStarted} not started</span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-foreground">My Classes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.classes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">You haven&apos;t created any classes yet.</p>
          ) : (
            data.classes.map((cls) => (
              <Link
                key={cls.id}
                to="/classes/$classId"
                params={{ classId: cls.id }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 transition-colors hover:bg-secondary/50"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{cls.name}</p>
                  <div className="mt-1">
                    <ClassBadges cls={cls} />
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3.5" />
                  {cls.studentCount} students
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-foreground">Recent Quiz Attempts</CardTitle>
          <CardDescription>The latest attempts across your classes</CardDescription>
        </CardHeader>
        <CardContent>
          {data.recentAttempts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No quiz attempts yet.</p>
          ) : (
            <div className="space-y-2">
              {data.recentAttempts.map((attempt) => (
                <div
                  key={attempt.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{attempt.studentName}</p>
                    <p className="text-xs text-muted-foreground">{attempt.quizTitle}</p>
                  </div>
                  <span className="text-sm text-foreground">
                    {attempt.score ?? '—'} / {attempt.maxScore}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

// Public content — admin-authored, or a teacher's quiz explicitly
// published to public — reaches any logged-in student regardless of
// class enrollment, so this deliberately isn't scoped to the student's
// own classes the way "My Classes" below is.
function DiscoverSection() {
  const { data: publicQuizzes, isLoading } = usePublicQuizzes()

  if (isLoading || !publicQuizzes || publicQuizzes.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 font-heading text-foreground">
            <Compass className="size-4 text-accent" />
            Discover
          </CardTitle>
          <CardDescription>Public quizzes from FocusFlow and teachers, open to everyone.</CardDescription>
        </div>
        <Link to="/library" className="text-xs font-medium text-accent hover:underline">
          View Library
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {publicQuizzes.slice(0, 6).map((quiz) => (
          <Link
            key={quiz.id}
            to="/quizzes/$quizId"
            params={{ quizId: quiz.id }}
            className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 transition-colors hover:bg-secondary/50"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{quiz.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {quiz.subjectName}
                </Badge>
                {quiz.gradeLabel && (
                  <Badge variant="outline" className="text-[10px]">
                    {quiz.gradeLabel}
                  </Badge>
                )}
                <span className="text-[11px] text-muted-foreground">by {quiz.authorName}</span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

function StudentDashboard({ data }: { data: StudentDashboardData }) {
  return (
    <>
      <StatGrid>
        <StatCard label="Focus Sessions Today" value={data.focusSessionsToday} icon={Timer} delay={0} />
        <StatCard label="Enrolled Classes" value={data.enrolledClasses.length} icon={GraduationCap} delay={0.05} />
        <StatCard label="Achievements" value={data.achievementCount} icon={Trophy} delay={0.1} />
      </StatGrid>

      <MissionsWidget />

      <DiscoverSection />

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-foreground">My Classes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.enrolledClasses.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              You&apos;re not enrolled in any classes yet.
            </p>
          ) : (
            data.enrolledClasses.map((cls) => (
              <Link
                key={cls.id}
                to="/classes/$classId"
                params={{ classId: cls.id }}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 transition-colors hover:bg-secondary/50"
              >
                <div>
                  <span className="text-sm font-medium text-foreground">{cls.name}</span>
                  <div className="mt-1">
                    <ClassBadges cls={cls} />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{cls.code}</span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StartDelayTrendCard />
        <ConsistencyStreakCard />
      </div>
    </>
  )
}
