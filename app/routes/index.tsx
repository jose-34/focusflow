import { createFileRoute, Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ChartColumn, GraduationCap, Heart, ListTodo, Timer, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({
  component: Index,
})

const features = [
  {
    icon: Timer,
    title: 'Pomodoro Focus Timer',
    description: 'Adjustable focus intervals with short and long breaks, so every study session stays on track.',
  },
  {
    icon: ListTodo,
    title: 'Prioritised Tasks',
    description: 'Capture, prioritise, and complete your work — nothing falls through the cracks.',
  },
  {
    icon: GraduationCap,
    title: 'Classes & Quizzes',
    description: 'Teachers create classes and quizzes; students join with a code and get auto-graded results instantly.',
  },
  {
    icon: ChartColumn,
    title: 'Progress & Streaks',
    description: 'See your daily and weekly focus totals, and keep your streak alive.',
  },
  {
    icon: Heart,
    title: 'Wellness Check-ins',
    description: 'Quick mood check-ins and guided breathing exercises built right into your study flow.',
  },
  {
    icon: Trophy,
    title: 'Real Achievements',
    description: 'Unlock badges for streaks, focus milestones, and quiz performance — gamification that means something.',
  },
]

function Index() {
  return (
    <div>
      <section className="flex flex-col items-center justify-center px-4 py-24 text-center md:py-32">
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="font-heading text-5xl font-bold text-foreground md:text-6xl"
        >
          Master Your Focus. <span className="text-primary">Achieve Your Goals.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          className="mt-6 max-w-2xl text-xl text-muted-foreground"
        >
          FocusFlow is a free productivity and wellness companion for students and teachers —
          Pomodoro timer, tasks, classes, quizzes, and real gamification, all in one place.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
          className="mt-10 flex gap-4"
        >
          <Button size="lg" className="bg-primary px-8 text-primary-foreground hover:bg-primary/90" asChild>
            <Link to="/register">Get Started Free</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">Log In</Link>
          </Button>
        </motion.div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08 * index, ease: 'easeOut' }}
            >
              <Card className="h-full">
                <CardHeader>
                  <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-accent/15">
                    <feature.icon className="size-5 text-accent" />
                  </div>
                  <CardTitle className="font-heading text-foreground">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
