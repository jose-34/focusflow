import { useEffect, useRef } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ListTodo, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { FOCUS_DURATION_OPTIONS, usePomodoro } from '@/features/timer/TimerContext'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { TimerRing } from '@/features/timer/components/TimerRing'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/focus')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: FocusPage,
})

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

const modeLabels: Record<string, string> = {
  focus: 'Focus',
  short_break: 'Short Break',
  long_break: 'Long Break',
}

function FocusPage() {
  const {
    mode,
    timeLeft,
    isRunning,
    focusMinutes,
    setFocusMinutes,
    selectedTaskId,
    setTaskId,
    currentSessionNumber,
    sessionsUntilLongBreak,
    totalDurationSeconds,
    start,
    pause,
    reset,
    skipBreak,
    recordDistraction,
  } = usePomodoro()

  const { tasks } = useTasks()
  const openTasks = tasks.filter((t) => !t.completed)

  const hiddenAtRef = useRef<number | null>(null)

  // Focus Mode: detect tab-switching away during an active focus session and
  // log it as a real, measurable distraction event — this is FocusFlow's
  // honest, buildable alternative to "blocking" other sites (which no web
  // page can actually do).
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        if (mode === 'focus' && isRunning) {
          hiddenAtRef.current = Date.now()
        }
        return
      }

      if (hiddenAtRef.current !== null) {
        const awaySeconds = Math.round((Date.now() - hiddenAtRef.current) / 1000)
        hiddenAtRef.current = null
        if (awaySeconds >= 2) {
          recordDistraction(awaySeconds)
          toast.warning(`Welcome back — you were away for ${awaySeconds}s during your focus session.`)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [mode, isRunning, recordDistraction])

  const progress = 1 - timeLeft / totalDurationSeconds
  const isBreak = mode !== 'focus'

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-10">
      <h1 className="mb-2 font-heading text-2xl font-semibold text-foreground">Focus Timer</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Session {currentSessionNumber} of {sessionsUntilLongBreak}
      </p>

      <TimerRing
        progress={progress}
        label={formatTime(timeLeft)}
        sublabel={modeLabels[mode]}
        colorClassName={isBreak ? 'stroke-accent' : 'stroke-primary'}
        size={280}
      />

      <div className="mt-8 flex items-center gap-3">
        {isRunning ? (
          <Button size="lg" onClick={pause} className="gap-2">
            <Pause className="size-4" />
            Pause
          </Button>
        ) : (
          <Button size="lg" onClick={start} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <Play className="size-4" />
            Start
          </Button>
        )}
        <Button size="lg" variant="outline" onClick={reset} className="gap-2">
          <RotateCcw className="size-4" />
          Reset
        </Button>
        {isBreak && (
          <Button size="lg" variant="ghost" onClick={skipBreak} className="gap-2">
            <SkipForward className="size-4" />
            Skip Break
          </Button>
        )}
      </div>

      <Card className="mt-10 w-full">
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">Focus Duration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {FOCUS_DURATION_OPTIONS.map((minutes: number) => (
              <button
                key={minutes}
                type="button"
                disabled={isRunning}
                onClick={() => setFocusMinutes(minutes)}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  focusMinutes === minutes
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-secondary',
                )}
              >
                {minutes} min
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {!isBreak && openTasks.length > 0 && (
        <Card className="mt-4 w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-base text-foreground">
              <ListTodo className="size-4" />
              What are you working on? (optional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedTaskId ?? 'none'}
              onValueChange={(value) => setTaskId(value === 'none' ? null : value)}
              disabled={isRunning}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="No task selected" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No task selected</SelectItem>
                {openTasks.map((task) => (
                  <SelectItem key={task.id} value={task.id}>
                    <span className="flex items-center gap-2">
                      {task.title}
                      {task.quizId && (
                        <Badge variant="outline" className="text-[10px]">
                          Assignment
                        </Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-2 text-xs text-muted-foreground">
              Linking a task logs this focus time against it — assignment tasks show your teacher when you actually
              worked on it.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
