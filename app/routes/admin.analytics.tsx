import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { usePlatformAnalytics, type DailyAnalyticsPoint } from '@/features/admin/hooks/useAdminPlatform'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/analytics')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: AdminAnalyticsPage,
})

function formatDay(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Same bar-chart language as app/components/dashboard/ProcrastinationWidgets.tsx
// (bg-accent bars, native title tooltips, role=img+aria-label) rather than a
// new chart style — one magnitude-over-time series per card, so a plain
// single-hue bar chart is the right form (see dataviz skill: color last,
// form first — this is change-over-time magnitude, not identity/polarity).
function TrendChart({ title, description, points, valueKey, formatValue }: {
  title: string
  description: string
  points: Array<DailyAnalyticsPoint>
  valueKey: keyof DailyAnalyticsPoint
  formatValue?: (n: number) => string
}) {
  const values = points.map((p) => Number(p[valueKey]))
  const max = Math.max(...values, 1)
  const total = values.reduce((sum, v) => sum + v, 0)
  const fmt = formatValue ?? ((n: number) => String(n))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base text-foreground">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-2xl font-bold text-foreground">
          {fmt(total)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">total, last 14 days</span>
        </p>
        <div className="flex h-24 items-end gap-1" role="img" aria-label={`${title} over the last 14 days`}>
          {points.map((p) => {
            const value = Number(p[valueKey])
            const heightPercent = value === 0 ? 4 : Math.max(6, (value / max) * 100)
            return (
              <div key={p.date} className="flex h-full flex-1 items-end" title={`${formatDay(p.date)}: ${fmt(value)}`}>
                <div className={cn('w-full rounded-t-sm transition-all', value === 0 ? 'bg-secondary/50' : 'bg-accent')} style={{ height: `${heightPercent}%` }} />
              </div>
            )
          })}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          <span>{formatDay(points[0]?.date ?? '')}</span>
          <span>{formatDay(points[points.length - 1]?.date ?? '')}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function AdminAnalyticsPage() {
  const { data: points, isLoading } = usePlatformAnalytics()

  return (
    <DashboardShell title="Platform Analytics" subtitle="14-day trend across every institution." decorated={false}>
      {isLoading || !points ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-56 animate-pulse rounded-md bg-secondary" />
          <div className="h-56 animate-pulse rounded-md bg-secondary" />
          <div className="h-56 animate-pulse rounded-md bg-secondary" />
          <div className="h-56 animate-pulse rounded-md bg-secondary" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <TrendChart title="Daily Active Learners" description="Distinct students with a focus session or quiz attempt" points={points} valueKey="activeLearners" />
          <TrendChart
            title="Focus Minutes"
            description="Total minutes focused across the platform"
            points={points}
            valueKey="focusMinutes"
            formatValue={(n) => (n >= 60 ? `${(n / 60).toFixed(1)}h` : `${n}m`)}
          />
          <TrendChart title="Tasks Completed" description="Personal, practice, and assignment tasks" points={points} valueKey="tasksCompleted" />
          <TrendChart title="Quiz Attempts" description="Submitted attempts across all activities" points={points} valueKey="quizAttempts" />
        </div>
      )}
    </DashboardShell>
  )
}
