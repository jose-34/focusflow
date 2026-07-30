import { motion } from 'framer-motion'
import { GraduationCap, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RoleStepProps {
  onSelect: (role: 'student' | 'teacher') => void
}

const roles = [
  {
    role: 'student' as const,
    icon: BookOpen,
    title: "I'm a Student",
    description: 'Track focus time, complete assignments, and earn achievements.',
  },
  {
    role: 'teacher' as const,
    icon: GraduationCap,
    title: "I'm a Teacher",
    description: 'Create classes, assign work, and see how your students are doing.',
  },
]

export function RoleStep({ onSelect }: RoleStepProps) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-heading text-xl font-semibold text-foreground">How will you use FocusFlow?</h2>
        <p className="mt-1 text-sm text-muted-foreground">You can&apos;t change this after signing up.</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {roles.map((option, index) => (
          <motion.button
            key={option.role}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.05 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(option.role)}
            className={cn(
              'flex flex-col items-start gap-3 rounded-lg border border-border bg-background p-5 text-left transition-colors',
              'hover:border-accent/40 hover:bg-accent/5',
            )}
          >
            <span className="flex size-10 items-center justify-center rounded-md bg-accent/15 text-accent">
              <option.icon className="size-5" />
            </span>
            <span>
              <span className="block font-heading text-base font-semibold text-foreground">{option.title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{option.description}</span>
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
