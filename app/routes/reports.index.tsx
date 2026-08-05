import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ClipboardList, Trophy, Users } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { usePastGameSessions } from '@/features/games/hooks/useGames'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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
  const { data: sessions, isLoading } = usePastGameSessions()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-1 font-heading text-2xl font-semibold text-foreground">Reports</h1>
      <p className="mb-6 text-sm text-muted-foreground">Session summaries from your finished live games.</p>

      {isLoading ? (
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
    </div>
  )
}
