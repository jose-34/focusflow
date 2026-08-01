import { TrendingDown } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useProcrastinationMetrics } from '@/features/procrastination/hooks/useProcrastination'
import { cn } from '@/lib/utils'

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return '—'
  if (minutes < 60) return `${Math.round(minutes)}m`
  return `${(minutes / 60).toFixed(1)}h`
}

export function StartDelayTrendCard() {
  const { data, isLoading } = useProcrastinationMetrics()

  if (isLoading || !data) {
    return <Card className="h-56 animate-pulse bg-secondary/40" />
  }

  const maxDelay = Math.max(...data.dailyStartDelay.map((d) => d.delayMinutes ?? 0), 30)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="font-heading text-base text-foreground">Start Delay — Last 30 Days</CardTitle>
          <CardDescription>Time between logging in and starting your first focus session that day</CardDescription>
        </div>
        {data.procrastinationReduced && (
          <Badge variant="outline" className="gap-1 border-role-teacher/30 bg-role-teacher/15 text-role-teacher">
            <TrendingDown className="size-3" />
            Procrastination Reduced
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-2xl font-bold text-foreground">
          {formatMinutes(data.averageStartDelayMinutes)}
          <span className="ml-1 text-sm font-normal text-muted-foreground">avg delay</span>
        </p>
        <div className="flex h-24 items-end gap-0.75" role="img" aria-label="Daily start delay over the last 30 days">
          {data.dailyStartDelay.map((day) => {
            const heightPercent = day.delayMinutes === null ? 0 : Math.max(6, (day.delayMinutes / maxDelay) * 100)
            return (
              <div key={day.date} className="flex h-full flex-1 items-end" title={`${day.date}: ${formatMinutes(day.delayMinutes)}`}>
                <div
                  className={cn('w-full rounded-t-sm transition-all', day.delayMinutes === null ? 'bg-secondary/50' : 'bg-accent')}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export function ConsistencyStreakCard() {
  const { data, isLoading } = useProcrastinationMetrics()

  if (isLoading || !data) {
    return <Card className="h-40 animate-pulse bg-secondary/40" />
  }

  const skippedDays = data.consistency.days.filter((d) => !d.hasSession).length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base text-foreground">Consistency — Last 30 Days</CardTitle>
        <CardDescription>
          {data.consistency.current}-day current streak · {skippedDays} day{skippedDays === 1 ? '' : 's'} skipped
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1" role="img" aria-label="Which of the last 30 days had a focus session">
          {data.consistency.days.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${day.hasSession ? 'studied' : 'skipped'}`}
              className={cn('size-3.5 rounded-sm', day.hasSession ? 'bg-accent' : 'bg-secondary')}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
