import { memo } from 'react'
import { cn } from '@/lib/utils'

interface TimerRingProps {
  progress: number
  label: string
  sublabel: string
  colorClassName?: string
  size?: number
}

export const TimerRing = memo(function TimerRing({
  progress,
  label,
  sublabel,
  colorClassName = 'stroke-primary',
  size = 280,
}: TimerRingProps) {
  const strokeWidth = 14
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clampedProgress = Math.min(1, Math.max(0, progress))
  const offset = circumference * (1 - clampedProgress)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="fill-none stroke-secondary" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn('fill-none transition-[stroke-dashoffset] duration-1000 ease-linear', colorClassName)}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-5xl font-bold tabular-nums text-foreground">{label}</span>
        <span className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">{sublabel}</span>
      </div>
    </div>
  )
})
