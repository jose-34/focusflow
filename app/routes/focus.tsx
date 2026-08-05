import { useEffect, useRef, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ListTodo, Pause, Play, RotateCcw, SkipForward, Target, Wind } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { FOCUS_DURATION_OPTIONS, usePomodoro } from '@/features/timer/TimerContext'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { TimerRing } from '@/features/timer/components/TimerRing'
import { BreathingExercise } from '@/features/wellness/components/BreathingExercise'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
    commitment,
    setCommitment,
    pendingReflection,
    resolveReflection,
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

  const isPreset = (FOCUS_DURATION_OPTIONS as readonly number[]).includes(focusMinutes)
  const [showCustom, setShowCustom] = useState(false)
  const [customInput, setCustomInput] = useState(String(focusMinutes))

  function applyCustomMinutes() {
    const parsed = Math.round(Number(customInput))
    if (Number.isFinite(parsed) && parsed >= 5 && parsed <= 180) {
      setFocusMinutes(parsed)
    } else {
      setCustomInput(String(focusMinutes))
    }
  }

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
          toast.warning(`Welcome back. You were away for ${awaySeconds}s during your focus session.`)
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
          <Button
            size="lg"
            onClick={start}
            disabled={!isBreak && commitment.trim().length === 0}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
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

      {isBreak && (
        <Card className="mt-10 w-full border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-base text-foreground">
              <Wind className="size-4 text-primary" />
              Make your break count
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BreathingExercise />
          </CardContent>
        </Card>
      )}

      {!isBreak && (
        <Card className="mt-10 w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-base text-foreground">
              <Target className="size-4" />
              Commitment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Label htmlFor="commitment" className="sr-only">
              What will you accomplish this session?
            </Label>
            <Input
              id="commitment"
              value={commitment}
              onChange={(e) => setCommitment(e.target.value)}
              disabled={isRunning}
              maxLength={280}
              placeholder="e.g. Finish the first five algebra problems"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Say exactly what you'll get done. Required before starting, and you'll see this again when the session ends.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4 w-full">
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
                onClick={() => {
                  setFocusMinutes(minutes)
                  setShowCustom(false)
                }}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  !showCustom && focusMinutes === minutes
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:bg-secondary',
                )}
              >
                {minutes} min
              </button>
            ))}
            <button
              type="button"
              disabled={isRunning}
              onClick={() => {
                setCustomInput(String(focusMinutes))
                setShowCustom(true)
              }}
              className={cn(
                'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                showCustom || !isPreset
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-secondary',
              )}
            >
              Custom
            </button>
          </div>
          {(showCustom || !isPreset) && (
            <div className="mt-3 flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={180}
                value={customInput}
                disabled={isRunning}
                onChange={(e) => setCustomInput(e.target.value)}
                onBlur={applyCustomMinutes}
                onKeyDown={(e) => e.key === 'Enter' && applyCustomMinutes()}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">minutes (5–180)</span>
            </div>
          )}
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
              Linking a task logs this focus time against it. Assignment tasks show your teacher when you actually
              worked on it.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={pendingReflection !== null}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Session complete</DialogTitle>
            <DialogDescription>Your commitment for this session:</DialogDescription>
          </DialogHeader>
          <p className="rounded-md border border-border bg-secondary/50 px-4 py-3 text-sm font-medium text-foreground">
            "{pendingReflection?.commitment}"
          </p>
          <p className="text-sm text-muted-foreground">Did you get it done?</p>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => resolveReflection(undefined)}>
              Skip
            </Button>
            <Button variant="outline" onClick={() => resolveReflection(false)}>
              Not met
            </Button>
            <Button onClick={() => resolveReflection(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              Met
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
