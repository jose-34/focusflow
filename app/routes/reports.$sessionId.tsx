import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useGameReport } from '@/features/games/hooks/useGames'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/reports/$sessionId')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'teacher' && user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: GameReportPage,
})

function GameReportPage() {
  const { sessionId } = Route.useParams()
  const { data: report, isLoading } = useGameReport(sessionId)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
      </div>
    )
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">Report not found.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Button variant="ghost" className="mb-4 gap-2 pl-0" asChild>
        <Link to="/reports">
          <ArrowLeft className="size-4" />
          Back to Reports
        </Link>
      </Button>

      <div className="mb-6">
        <h1 className="font-heading text-2xl font-semibold text-foreground">{report.quizTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {report.endedAt && new Date(report.endedAt).toLocaleString()} · {report.participantCount} player
          {report.participantCount === 1 ? '' : 's'}
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">Final Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {report.leaderboard.map((entry) => (
            <div
              key={entry.participantId}
              className={cn(
                'flex items-center justify-between rounded-md border px-3 py-2',
                entry.rank <= 3 ? 'border-accent/30 bg-accent/5' : 'border-border bg-background',
              )}
            >
              <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">
                  {entry.rank}
                </span>
                {entry.nickname}
              </span>
              <span className="text-sm font-semibold text-foreground">{entry.score} pts</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">Question Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {report.questions.map((question, index) => (
            <div key={question.questionId}>
              <p className="mb-2 text-sm font-medium text-foreground">
                {index + 1}. {question.questionText}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {question.correctCount}/{question.totalAnswered} correct
                </span>
              </p>
              <div className="space-y-1.5">
                {question.choices.map((choice) => {
                  const pct = question.totalAnswered === 0 ? 0 : Math.round((choice.count / question.totalAnswered) * 100)
                  return (
                    <div key={choice.choiceId} className="relative overflow-hidden rounded-md border border-border">
                      <div
                        className={cn('absolute inset-y-0 left-0', choice.isCorrect ? 'bg-primary/15' : 'bg-secondary')}
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center justify-between px-3 py-1.5 text-xs">
                        <span className="flex items-center gap-1.5 text-foreground">
                          {choice.isCorrect && <CheckCircle2 className="size-3.5 text-primary" />}
                          {choice.choiceText}
                        </span>
                        <span className="text-muted-foreground">
                          {choice.count} ({pct}%)
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
