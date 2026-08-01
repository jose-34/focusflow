import { BookOpen, CheckCircle2, GraduationCap, Target } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMissions } from '@/features/missions/hooks/useMissions'
import { cn } from '@/lib/utils'

function formatDueDate(dueAt: string): string {
  const due = new Date(dueAt)
  const days = Math.round((due.setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000)
  if (days <= 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `Due in ${days} days`
}

export function MissionsWidget() {
  const { data: missions, isLoading } = useMissions()

  if (isLoading) {
    return <Card className="h-48 animate-pulse bg-secondary/40" />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-base text-foreground">
          <Target className="size-4 text-accent" />
          This Week's Missions
        </CardTitle>
        <CardDescription>Short goals pointing at your real assigned work — never busywork</CardDescription>
      </CardHeader>
      <CardContent>
        {!missions || missions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No missions right now — assigned work with a due date will show up here.
          </p>
        ) : (
          <div className="space-y-2">
            {missions.map((mission) => {
              const Icon = mission.kind === 'quiz' ? GraduationCap : BookOpen
              return (
                <div
                  key={mission.id}
                  className={cn(
                    'flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5',
                    mission.completed && 'border-role-teacher/30 bg-role-teacher/5',
                  )}
                >
                  {mission.completed ? (
                    <CheckCircle2 className="size-4 shrink-0 text-role-teacher" />
                  ) : (
                    <Icon className="size-4 shrink-0 text-accent" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm font-medium', mission.completed ? 'text-muted-foreground line-through' : 'text-foreground')}>
                      {mission.title}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDueDate(mission.dueAt)}</span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
