import { createFileRoute, redirect } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { Award, BookOpen, Flame, GraduationCap, ListChecks, Lock, Moon, Sparkles, Sunrise, Trophy, Zap, type LucideIcon } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useAchievements } from '@/features/achievements/hooks/useAchievements'
import { Card, CardContent } from '@/components/ui/card'
import { OrganicBlob } from '@/components/decor/OrganicBlob'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/achievements')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: AchievementsPage,
})

const ICONS: Record<string, LucideIcon> = {
  first_focus: Sparkles,
  streak_starter: Flame,
  week_warrior: Trophy,
  century_club: Award,
  task_master: ListChecks,
  early_bird: Sunrise,
  night_owl: Moon,
  marathon: Zap,
  practice_progress: BookOpen,
  quiz_scholar: GraduationCap,
  quiz_ace: Award,
}

function AchievementsPage() {
  const { data: achievements, isLoading } = useAchievements()

  if (isLoading || !achievements) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
      </div>
    )
  }

  const unlockedCount = achievements.filter((a) => a.unlockedAt).length

  return (
    <div className="relative mx-auto max-w-4xl overflow-hidden px-4 py-10">
      <OrganicBlob colorClassName="bg-primary/25" className="-top-16 -left-32" />
      <h1 className="relative mb-1 font-heading text-2xl font-semibold text-foreground">Achievements</h1>
      <p className="relative mb-6 text-sm text-muted-foreground">
        {unlockedCount} of {achievements.length} unlocked
      </p>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {achievements.map((achievement, index) => {
          const Icon = ICONS[achievement.key] ?? Trophy
          const isUnlocked = !!achievement.unlockedAt
          return (
            <motion.div
              key={achievement.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.04 }}
            >
              <Card className={cn('h-full text-center', !isUnlocked && 'opacity-60')}>
                <CardContent className="flex flex-col items-center gap-2 pt-6">
                  <div
                    className={cn(
                      'flex size-14 items-center justify-center rounded-full',
                      isUnlocked ? 'bg-accent/20' : 'bg-secondary',
                    )}
                  >
                    {isUnlocked ? (
                      <Icon className="size-7 text-accent" />
                    ) : (
                      <Lock className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <p className="font-heading text-sm font-semibold text-foreground">{achievement.title}</p>
                  <p className="text-xs text-muted-foreground">{achievement.description}</p>
                  {isUnlocked && achievement.unlockedAt && (
                    <p className="text-[10px] text-accent">
                      Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
