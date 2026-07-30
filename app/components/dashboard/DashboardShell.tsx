import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface DashboardShellProps {
  title: string
  subtitle?: string
  children: ReactNode
}

export function DashboardShell({ title, subtitle, children }: DashboardShellProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </motion.div>

      <div className="space-y-8">{children}</div>
    </div>
  )
}

interface StatGridProps {
  children: ReactNode
}

export function StatGrid({ children }: StatGridProps) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{children}</div>
}
