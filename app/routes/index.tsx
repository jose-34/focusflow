import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { ChartColumn, GraduationCap, Heart, ListTodo, Timer, Trophy, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrowserFrame } from '@/components/marketing/BrowserFrame'
import { DashboardPreviewMockup, type PreviewRole } from '@/components/marketing/DashboardPreviewMockup'
import { ArcadeDemoGame } from '@/components/marketing/ArcadeDemoGame'
import { OrganicBlob } from '@/components/decor/OrganicBlob'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({
  component: Index,
})

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  detail: string
}

const features: Array<Feature> = [
  {
    icon: Timer,
    title: 'Pomodoro Focus Timer',
    description: 'Adjustable focus intervals with short and long breaks.',
    detail:
      'Set a specific commitment before every session starts, then work in focused Pomodoro intervals — 15, 25, 30, or 45 minutes — with automatic short and long breaks in between.',
  },
  {
    icon: ListTodo,
    title: 'Prioritised Tasks',
    description: 'Capture, prioritise, and complete your work.',
    detail:
      'Personal to-dos live alongside teacher-assigned practice tasks and quiz deadlines — grouped separately, so you always know what\'s yours and what\'s assigned.',
  },
  {
    icon: GraduationCap,
    title: 'Classes & Quizzes',
    description: 'Curriculum-aware classes with auto-graded quizzes.',
    detail:
      'Teachers create CBC or Cambridge classes and quizzes; students join with a code and get instantly graded results — plus a live, Kahoot-style game mode for whole-class review.',
  },
  {
    icon: ChartColumn,
    title: 'Progress & Streaks',
    description: 'Daily and weekly focus totals, and a streak to keep alive.',
    detail:
      'A 14-day focus chart, current and longest streaks, and weekly totals give you (and your teacher) a real picture of consistency — not just a single test score.',
  },
  {
    icon: Heart,
    title: 'Wellness Check-ins',
    description: 'Quick mood check-ins and guided breathing.',
    detail:
      'A short, private mood check-in and a guided breathing exercise are built right into the study flow — never visible to a teacher, by design.',
  },
  {
    icon: Trophy,
    title: 'Real Achievements',
    description: 'Badges for streaks, focus milestones, and quiz performance.',
    detail:
      'Achievements unlock for real behavior — a genuine focus streak, a milestone number of sessions, strong quiz performance — never for empty grinding.',
  },
]

const ROLE_COPY: Record<PreviewRole, { headline: string; sub: string }> = {
  student: {
    headline: 'Master Your Focus. Achieve Your Goals.',
    sub: 'FocusFlow is a free productivity and wellness companion for students — Pomodoro timer, tasks, classes, quizzes, and real gamification, all in one place.',
  },
  teacher: {
    headline: 'Master Your Classroom. Reach Every Student.',
    sub: 'FocusFlow gives teachers curriculum-aware classes, auto-graded quizzes, a live game mode, and an early, supportive signal for who needs a nudge — all in one place.',
  },
}

function Index() {
  const [role, setRole] = useState<PreviewRole>('student')
  const [activeFeature, setActiveFeature] = useState(0)
  const copy = ROLE_COPY[role]
  const feature = features[activeFeature]
  const isStudent = role === 'student'

  return (
    <div>
      <section className="relative mx-auto max-w-6xl overflow-hidden px-4 py-20 md:py-28">
        <OrganicBlob
          colorClassName={isStudent ? 'bg-accent/15' : 'bg-role-teacher/15'}
          className="-top-24 -left-32 transition-colors duration-500"
        />
        <OrganicBlob
          colorClassName={isStudent ? 'bg-role-teacher/15' : 'bg-accent/15'}
          className="-right-40 top-1/3 size-96 opacity-60"
        />

        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
              {(['student', 'teacher'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-300',
                    role === r
                      ? r === 'student'
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-role-teacher text-role-teacher-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {r === 'student' ? 'For Students' : 'For Teachers'}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={role}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <h1 className="mt-6 text-wrap-balance font-heading text-4xl font-bold text-foreground md:text-5xl">
                  {copy.headline.split('. ')[0]}.{' '}
                  <span className={isStudent ? 'text-accent' : 'text-role-teacher'}>
                    {copy.headline.split('. ')[1]}
                  </span>
                </h1>
                <p className="mt-5 max-w-xl text-lg text-muted-foreground">{copy.sub}</p>
              </motion.div>
            </AnimatePresence>

            <div className="mt-8 flex flex-wrap gap-4">
              <Button
                size="lg"
                asChild
                className={cn(
                  'px-8 transition-colors duration-300',
                  isStudent
                    ? 'bg-accent text-accent-foreground hover:bg-accent/90'
                    : 'bg-role-teacher text-role-teacher-foreground hover:bg-role-teacher/90',
                )}
              >
                <Link to="/register">Get Started Free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Log In</Link>
              </Button>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: [16, 0, -6, 0] }}
            transition={{ opacity: { duration: 0.5 }, y: { duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 } }}
            className="relative"
          >
            <div
              className={cn(
                'absolute inset-0 -z-10 rounded-3xl blur-2xl transition-colors duration-500',
                isStudent ? 'bg-accent/20' : 'bg-role-teacher/20',
              )}
            />
            <BrowserFrame address="focusflow.app/dashboard">
              <AnimatePresence mode="wait">
                <DashboardPreviewMockup key={role} role={role} />
              </AnimatePresence>
            </BrowserFrame>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-20">
        <div className="mb-8 text-center">
          <h2 className="font-heading text-3xl font-bold text-foreground">Try it right now — no sign-up needed</h2>
          <p className="mt-2 text-muted-foreground">A quick taste of how FocusFlow turns real learning into a game.</p>
        </div>
        <ArcadeDemoGame />
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="mb-10 text-center">
          <h2 className="font-heading text-3xl font-bold text-foreground">Everything in one place</h2>
          <p className="mt-2 text-muted-foreground">Pick a feature to see what it actually does.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-[minmax(0,280px)_1fr]">
          <div className="flex gap-2 overflow-x-auto md:flex-col md:overflow-visible">
            {features.map((f, index) => (
              <button
                key={f.title}
                type="button"
                onClick={() => setActiveFeature(index)}
                className={cn(
                  'flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors md:shrink',
                  activeFeature === index
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-card hover:bg-secondary/50',
                )}
              >
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg',
                    activeFeature === index ? 'bg-accent/20' : 'bg-secondary',
                  )}
                >
                  <f.icon className={cn('size-4.5', activeFeature === index ? 'text-accent' : 'text-muted-foreground')} />
                </div>
                <span
                  className={cn(
                    'whitespace-nowrap text-sm font-medium md:whitespace-normal',
                    activeFeature === index ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {f.title}
                </span>
              </button>
            ))}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 md:p-10">
            <OrganicBlob colorClassName="bg-accent/15" className="-top-20 -right-20 size-72 opacity-40" />
            <AnimatePresence mode="wait">
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
                className="relative"
              >
                <div className="flex size-14 items-center justify-center rounded-2xl bg-accent/15">
                  <feature.icon className="size-7 text-accent" />
                </div>
                <h3 className="mt-5 font-heading text-2xl font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-3 max-w-xl text-muted-foreground">{feature.detail}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>
    </div>
  )
}
