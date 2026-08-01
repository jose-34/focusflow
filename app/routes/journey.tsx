import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  Flame,
  Gift,
  ListChecks,
  Lock,
  Sparkles,
  Sunrise,
  Trophy,
  Crown,
  PartyPopper,
  Flag,
  BookOpen,
  GraduationCap,
  Award,
  type LucideIcon,
} from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useRoadmap } from '@/features/roadmap/hooks/useRoadmap'
import { JourneyMap } from '@/components/roadmap/JourneyMap'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/journey')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: JourneyPage,
})

const NODE_ICONS: Record<string, LucideIcon> = {
  start: Flag,
  first_focus: Sparkles,
  early_bird: Sunrise,
  streak_starter: Flame,
  week_warrior: Trophy,
  task_master: ListChecks,
  century_club: Crown,
  goal: PartyPopper,
  practice_progress: BookOpen,
  quiz_scholar: GraduationCap,
  quiz_ace: Award,
}

function iconFor(nodeId: string, kind: string) {
  if (NODE_ICONS[nodeId]) return NODE_ICONS[nodeId]
  if (kind === 'chest') return Gift
  return Sparkles
}

function JourneyPage() {
  const { isLoading, totalXp, currentStreak, longestStreak, roadmap } = useRoadmap()

  if (isLoading || !roadmap) {
    return (
      <DashboardShell title="Your Journey" subtitle="Loading your progress…">
        <div className="h-96 animate-pulse rounded-2xl bg-secondary" />
      </DashboardShell>
    )
  }

  const unlockedCount = roadmap.nodes.filter((n) => n.unlocked).length

  return (
    <DashboardShell
      title="Your Journey"
      subtitle={`${totalXp} XP · ${currentStreak}-day streak (best ${longestStreak}) · ${unlockedCount} of ${roadmap.nodes.length} checkpoints reached`}
    >
      <Card className="mx-auto max-w-3xl overflow-hidden p-0">
        <div className="aspect-707/498 w-full">
          <JourneyMap nodes={roadmap.nodes} avatarT={roadmap.avatarT} />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {roadmap.nodes.map((node) => {
          const Icon = iconFor(node.id, node.kind)
          return (
            <Card key={node.id} className={cn(!node.unlocked && 'opacity-60')}>
              <CardContent className="flex flex-col items-center gap-2 pt-6 text-center">
                <div
                  className={cn(
                    'flex size-12 items-center justify-center rounded-full',
                    node.unlocked ? 'bg-accent/20' : 'bg-secondary',
                  )}
                >
                  {node.unlocked ? <Icon className="size-6 text-accent" /> : <Lock className="size-5 text-muted-foreground" />}
                </div>
                <p className="font-heading text-sm font-semibold text-foreground">{node.label}</p>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{node.kind}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </DashboardShell>
  )
}
