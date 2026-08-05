import { createFileRoute, redirect } from '@tanstack/react-router'
import { Clock, Flame, ListChecks, Trophy } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useProgress } from '@/features/progress/hooks/useProgress'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/progress')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: ProgressPage,
})

function ProgressPage() {
  const { data, isLoading } = useProgress()

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
      </div>
    )
  }

  const maxMinutes = Math.max(...data.dailyMinutes.map((d) => d.minutes), 25)

  const stats = [
    { label: 'Current Streak', value: `${data.currentStreak}d`, icon: Flame },
    { label: 'Longest Streak', value: `${data.longestStreak}d`, icon: Trophy },
    { label: 'Focus Minutes Today', value: data.todayMinutes, icon: Clock },
    { label: 'Tasks Completed This Week', value: data.tasksCompletedThisWeek, icon: ListChecks },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 font-heading text-2xl font-semibold text-foreground">Progress</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardDescription>{stat.label}</CardDescription>
              <stat.icon className="size-4 text-accent" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">Focus Minutes, Last 14 Days</CardTitle>
          <CardDescription>This week: {data.weekMinutes} minutes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-2">
            {data.dailyMinutes.map((day) => {
              const heightPercent = Math.max(4, (day.minutes / maxMinutes) * 100)
              const dayLabel = new Date(day.date).toLocaleDateString(undefined, { weekday: 'narrow' })
              return (
                <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-32 w-full items-end">
                    <div
                      className={cn('w-full rounded-t-sm transition-all', day.minutes > 0 ? 'bg-primary' : 'bg-secondary')}
                      style={{ height: `${heightPercent}%` }}
                      title={`${day.minutes} min`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{dayLabel}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
