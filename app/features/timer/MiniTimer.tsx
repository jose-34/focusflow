import { motion } from 'framer-motion'
import { Play, Pause, RotateCcw } from 'lucide-react'
import { useTimer } from '@/features/timer/TimerContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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

export function MiniTimer() {
  const timer = useTimer()
  const isFocus = timer.mode === 'focus'
  const isBreak = timer.mode !== 'focus'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-4 right-4 z-50 w-72 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{modeLabels[timer.mode]}</p>
          <p className="font-heading text-2xl font-bold text-foreground">{formatTime(timer.timeLeft)}</p>
        </div>
        <div className="flex items-center gap-1">
          {timer.isRunning ? (
            <Button variant="ghost" size="icon" onClick={timer.pause} aria-label="Pause" className="size-8">
              <Pause className="size-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" onClick={timer.start} aria-label="Start" className="size-8">
              <Play className="size-4" />
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={timer.reset} aria-label="Reset" className="size-8">
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className={cn('h-full rounded-full transition-all', isFocus ? 'bg-primary' : 'bg-accent')}
            style={{ width: `${Math.max(4, (1 - timer.timeLeft / timer.totalDurationSeconds) * 100)}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground">
          {timer.currentSessionNumber}/{timer.sessionsUntilLongBreak}
        </span>
      </div>
      {isBreak && (
        <Button
          variant="ghost"
          size="sm"
          onClick={timer.skipBreak}
          className="mt-2 w-full text-xs text-muted-foreground hover:text-foreground"
        >
          Skip break
        </Button>
      )}
    </motion.div>
  )
}
