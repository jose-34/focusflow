import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BrowserFrameProps {
  address?: string
  children: ReactNode
  className?: string
}

/**
 * Wraps marketing-page product mockups in a browser-chrome frame — makes a
 * plain screenshot/illustration read as "here's the real product," not a
 * generic decorative graphic.
 */
export function BrowserFrame({ address = 'focusflow.app/dashboard', children, className }: BrowserFrameProps) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/70 bg-card shadow-2xl shadow-black/10 dark:shadow-black/40',
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border/70 bg-secondary/60 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive/70" />
          <span className="size-2.5 rounded-full bg-accent/70" />
          <span className="size-2.5 rounded-full bg-primary/50" />
        </div>
        <div className="flex-1 rounded-md bg-background/80 px-3 py-1 text-center text-[11px] text-muted-foreground">
          {address}
        </div>
      </div>
      {children}
    </div>
  )
}
