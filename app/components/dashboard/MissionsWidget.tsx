import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, CheckCircle2, GraduationCap, PartyPopper, Target } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useMissions } from '@/features/missions/hooks/useMissions'
import { playMissionCompleteSound } from '@/lib/sound'
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
  // null until the first load finishes, so an already-completed Mission on
  // page load is never mistaken for one "just" completed — only a real
  // incomplete-to-complete transition observed while mounted counts.
  const previouslyCompleted = useRef<Set<string> | null>(null)
  const [justCompleted, setJustCompleted] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!missions) return
    const currentlyCompleted = new Set(missions.filter((m) => m.completed).map((m) => m.id))
    if (previouslyCompleted.current === null) {
      previouslyCompleted.current = currentlyCompleted
      return
    }
    const newlyCompleted = [...currentlyCompleted].filter((id) => !previouslyCompleted.current!.has(id))
    previouslyCompleted.current = currentlyCompleted
    if (newlyCompleted.length === 0) return

    playMissionCompleteSound()
    setJustCompleted(new Set(newlyCompleted))
    const timer = setTimeout(() => setJustCompleted(new Set()), 2500)
    return () => clearTimeout(timer)
  }, [missions])

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
              const celebrating = justCompleted.has(mission.id)
              return (
                <motion.div
                  key={mission.id}
                  animate={celebrating ? { scale: [1, 1.03, 1] } : {}}
                  transition={{ duration: 0.5 }}
                  className={cn(
                    'flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5',
                    mission.completed && 'border-role-teacher/30 bg-role-teacher/5',
                    celebrating && 'border-accent bg-accent/10',
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
                  {celebrating ? (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-accent">
                      <PartyPopper className="size-3.5" />
                      Mission complete!
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDueDate(mission.dueAt)}</span>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
