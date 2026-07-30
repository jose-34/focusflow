import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface CountdownTimerProps {
  phaseStartedAt: string
  durationSeconds: number
  className?: string
}

export function CountdownTimer({ phaseStartedAt, durationSeconds, className }: CountdownTimerProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(interval)
  }, [])

  const startedAtMs = new Date(phaseStartedAt).getTime()
  const elapsedSeconds = (now - startedAtMs) / 1000
  const remaining = Math.max(0, Math.ceil(durationSeconds - elapsedSeconds))
  const fraction = Math.max(0, Math.min(1, 1 - elapsedSeconds / durationSeconds))

  const radius = 26
  const circumference = 2 * Math.PI * radius

  return (
    <div className={cn('relative flex size-16 items-center justify-center', className)}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90">
        <circle cx="32" cy="32" r={radius} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={5} />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className={remaining <= 5 ? 'text-destructive' : 'text-accent'}
          style={{ transition: 'stroke-dashoffset 0.2s linear' }}
        />
      </svg>
      <span className={cn('font-heading text-xl font-bold tabular-nums', remaining <= 5 ? 'text-destructive' : 'text-foreground')}>
        {remaining}
      </span>
    </div>
  )
}
