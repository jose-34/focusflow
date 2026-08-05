import { AnimatePresence, motion } from 'framer-motion'
import { Crown } from 'lucide-react'
import { AvatarDisplay } from '@/features/economy/components/AvatarDisplay'
import { cn } from '@/lib/utils'

interface LeaderboardEntry {
  id: string
  nickname: string
  score: number
  sprites?: Record<string, string>
}

export function LiveLeaderboard({
  entries,
  highlightId,
  limit,
}: {
  entries: Array<LeaderboardEntry>
  highlightId?: string
  limit?: number
}) {
  const ranked = [...entries].sort((a, b) => b.score - a.score).slice(0, limit ?? entries.length)

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {ranked.map((entry, index) => (
          <motion.div
            key={entry.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className={cn(
              'flex items-center justify-between rounded-lg border border-border bg-background px-4 py-2.5',
              entry.id === highlightId && 'border-accent bg-accent/10',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  index === 0 ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground',
                )}
              >
                {index === 0 ? <Crown className="size-3.5" /> : index + 1}
              </span>
              {entry.sprites && <AvatarDisplay sprites={entry.sprites} size="sm" />}
              <span className="truncate text-sm font-medium text-foreground">{entry.nickname}</span>
            </div>
            <span className="shrink-0 font-heading text-sm font-bold text-foreground">{entry.score.toLocaleString()}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
