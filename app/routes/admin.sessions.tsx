import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { CalendarClock, Gamepad2, ListChecks } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useAdminSessions, type SessionStatus } from '@/features/admin/hooks/useAdminPlatform'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/admin/sessions')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: AdminSessionsPage,
})

const STATUS_STYLE: Record<SessionStatus, string> = {
  scheduled: 'bg-secondary text-muted-foreground',
  running: 'bg-primary/10 text-primary',
  completed: 'bg-accent/15 text-accent',
  paused: 'bg-destructive/10 text-destructive',
}

const TABS: Array<'all' | SessionStatus> = ['all', 'running', 'scheduled', 'completed', 'paused']

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function AdminSessionsPage() {
  const { data: sessions, isLoading } = useAdminSessions()
  const [tab, setTab] = useState<'all' | SessionStatus>('all')

  const filtered = (sessions ?? []).filter((s) => tab === 'all' || s.status === tab)

  return (
    <DashboardShell title="Sessions" subtitle="Every quiz assignment and live game across the platform." decorated={false}>
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
              tab === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-1.5 pt-6">
          {isLoading ? (
            <div className="h-64 animate-pulse rounded-md bg-secondary" />
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No sessions in this status.</p>
          ) : (
            filtered.map((s) => (
              <div key={`${s.kind}-${s.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-secondary">
                    {s.kind === 'game' ? <Gamepad2 className="size-4 text-muted-foreground" /> : <ListChecks className="size-4 text-muted-foreground" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.teacherName}
                      {s.className ? ` · ${s.className}` : ' · Live game'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarClock className="size-3.5" />
                    {formatDate(s.date)}
                  </span>
                  <span>{s.participantCount} participant{s.participantCount === 1 ? '' : 's'}</span>
                  {s.accuracyPct !== null && <span>{s.accuracyPct}% accuracy</span>}
                  <Badge className={`text-[10px] capitalize ${STATUS_STYLE[s.status]}`}>{s.status}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
