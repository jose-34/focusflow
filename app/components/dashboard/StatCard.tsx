import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'

interface StatCardProps {
  label: string
  value: number | string
  icon: LucideIcon
  delay?: number
}

export function StatCard({ label, value, icon: Icon, delay = 0 }: StatCardProps) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay }}>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardDescription>{label}</CardDescription>
          <Icon className="size-4 text-accent" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-foreground">{value}</p>
        </CardContent>
      </Card>
    </motion.div>
  )
}
