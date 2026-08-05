import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { CalendarClock, CheckCircle2, ClipboardList, ListChecks, Trophy, Users } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { usePastGameSessions } from '@/features/games/hooks/useGames'
import { useTeacherQuizAssignments } from '@/features/quizzes/hooks/useQuizzes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/reports/')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'teacher' && user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: ReportsPage,
})

function ReportsPage() {
  const { data: sessions, isLoading: sessionsLoading } = usePastGameSessions()
  const { data: assignments, isLoading: assignmentsLoading } = useTeacherQuizAssignments()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-10">
      <div>
        <h1 className="mb-1 font-heading text-2xl font-semibold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Results from your assigned quizzes and finished live games.</p>
      </div>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Quiz Assignments</h2>
        {assignmentsLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-secondary" />
        ) : !assignments || assignments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <ListChecks className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No due-dated assignments yet. Set a due date on a quiz to see it here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {assignments.map((a) => (
              <Link key={a.id} to="/classes/$classId/quizzes/$quizId" params={{ classId: a.classId, quizId: a.id }}>
                <Card className="h-full transition-colors hover:bg-secondary/50">
                  <CardHeader>
                    <div className="mb-1 flex items-center gap-2">
                      <Badge variant={a.isPublished ? 'default' : 'outline'} className="text-[10px]">
                        {a.isPublished ? 'Live' : 'Draft'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{a.className}</span>
                    </div>
                    <CardTitle className="font-heading text-foreground">{a.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" />
                      Due {new Date(a.dueDate).toLocaleString()}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="size-3.5" />
                        {a.assignedCount} assigned
                      </span>
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <CheckCircle2 className="size-3.5 text-primary" />
                        {a.completedCount} completed
                      </span>
                      {a.inProgressCount > 0 && <span className="text-muted-foreground">{a.inProgressCount} in progress</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-heading text-lg font-semibold text-foreground">Live Games</h2>
        {sessionsLoading ? (
          <div className="h-24 animate-pulse rounded-lg bg-secondary" />
        ) : !sessions || sessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <ClipboardList className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No finished live games yet. Host one from a quiz to see its report here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <Link key={session.id} to="/reports/$sessionId" params={{ sessionId: session.id }}>
                <Card className="h-full transition-colors hover:bg-secondary/50">
                  <CardHeader>
                    <CardTitle className="font-heading text-foreground">{session.quizTitle}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-muted-foreground">{new Date(session.endedAt).toLocaleString()}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="size-3.5" />
                        {session.participantCount} player{session.participantCount === 1 ? '' : 's'}
                      </span>
                      <span className="flex items-center gap-1 font-medium text-foreground">
                        <Trophy className="size-3.5 text-accent" />
                        {session.topScore}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
