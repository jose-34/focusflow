import { motion } from 'framer-motion'
import { GraduationCap, ListChecks, Timer, Trophy, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PreviewRole = 'student' | 'teacher'

interface MockStat {
  label: string
  value: string
  icon: typeof Timer
}

const STUDENT_STATS: Array<MockStat> = [
  { label: 'Focus Sessions Today', value: '2', icon: Timer },
  { label: 'Enrolled Classes', value: '4', icon: GraduationCap },
  { label: 'Achievements', value: '12', icon: Trophy },
]

const TEACHER_STATS: Array<MockStat> = [
  { label: 'Active Classes', value: '3', icon: GraduationCap },
  { label: 'Total Students', value: '86', icon: Users },
  { label: 'Quizzes Created', value: '14', icon: ListChecks },
]

const STUDENT_ROWS = [
  { title: 'Form 3 Chemistry', meta: 'CBC · Grade 9' },
  { title: 'Mathematics: Algebra II', meta: 'Cambridge · Year 9' },
]

const TEACHER_ROWS = [
  { title: 'Grade 9 Mathematics', meta: '32 students' },
  { title: 'Grade 8 Integrated Science', meta: '28 students' },
]

/**
 * A static, illustrative mini-dashboard for the marketing hero — not wired
 * to real data (this renders for logged-out visitors). Mirrors the real
 * dashboard's StatCard visual language on purpose, so the promise made here
 * matches the actual product a visitor lands in after signing up.
 */
export function DashboardPreviewMockup({ role }: { role: PreviewRole }) {
  const stats = role === 'student' ? STUDENT_STATS : TEACHER_STATS
  const rows = role === 'student' ? STUDENT_ROWS : TEACHER_ROWS
  const greetingName = role === 'student' ? 'Amani' : 'Ms. Wanjiru'
  const tone = role === 'student' ? 'text-accent' : 'text-role-teacher'

  return (
    <motion.div
      key={role}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="bg-background p-5 sm:p-6"
    >
      <p className="font-heading text-sm font-semibold text-foreground sm:text-base">Welcome back, {greetingName}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {role === 'student' ? "Here's your focus today." : "Here's what's happening across your classes."}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border/70 bg-card p-2.5 sm:p-3">
            <stat.icon className={cn('size-3.5', tone)} />
            <p className="mt-2 text-lg font-bold text-foreground sm:text-xl">{stat.value}</p>
            <p className="mt-0.5 truncate text-[10px] leading-tight text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        {rows.map((row) => (
          <div
            key={row.title}
            className="flex items-center justify-between rounded-md border border-border/70 bg-card px-3 py-2"
          >
            <span className="text-xs font-medium text-foreground">{row.title}</span>
            <span className="text-[10px] text-muted-foreground">{row.meta}</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}
