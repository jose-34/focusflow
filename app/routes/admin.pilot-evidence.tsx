import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { Award, BarChart3, Calendar, CheckCircle2, Flame, ListChecks, TrendingUp, Trophy } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { DashboardShell, StatGrid } from '@/components/dashboard/DashboardShell'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/admin/pilot-evidence')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: PilotEvidencePage,
})

// Fixed historical figures from the Kitengela pilot study — not a live
// query. These describe what happened during a specific past study window
// and must never be conflated with current production numbers, which
// change every day and live at /admin/analytics instead.
const PILOT_STATS = [
  { label: 'Focus Sessions', value: 588, icon: Flame },
  { label: 'Tasks Created', value: 412, icon: ListChecks },
  { label: 'Tasks Completed', value: 287, icon: CheckCircle2 },
  { label: 'Completion Rate', value: '69.7%', icon: BarChart3 },
  { label: 'Median Streak', value: '5 Days', icon: Award },
  { label: 'Maximum Streak', value: '12 Days', icon: Trophy },
  { label: 'Daily Focused Study Time', value: '42 → 91 min', icon: TrendingUp },
  { label: 'Self-Reported Task Completion', value: '41% → 88%', icon: Calendar },
] as const

function PilotEvidencePage() {
  return (
    <DashboardShell title="Pilot Evidence" subtitle="Results from the Kitengela International Schools pilot study." decorated={false}>
      <Card className="border-accent/40 bg-accent/5">
        <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-accent text-accent-foreground">Historical pilot study data</Badge>
            <p className="text-sm text-muted-foreground">Not live production metrics — captured during a fixed past study window.</p>
          </div>
          <Link to="/admin/analytics" className="text-sm font-medium text-accent underline underline-offset-2 hover:text-accent/80">
            View current live analytics →
          </Link>
        </CardContent>
      </Card>

      <StatGrid>
        {PILOT_STATS.map((stat, i) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} delay={i * 0.05} />
        ))}
      </StatGrid>

      <Card>
        <CardContent className="space-y-2 py-4 text-sm text-muted-foreground">
          <p>
            Daily focused study time rose from 42 minutes to 91 minutes across the pilot window — a <span className="font-semibold text-foreground">117% increase</span>.
          </p>
          <p>Timer accuracy held to within ±1 second per 25-minute session, and the app loaded in 1.4 seconds on a typical 4G connection during the pilot.</p>
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
