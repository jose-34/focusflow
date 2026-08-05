import { createFileRoute, redirect } from '@tanstack/react-router'
import { Activity } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useSystemActivityFeed } from '@/features/admin/hooks/useAdminPlatform'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/admin/activity')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: AdminActivityPage,
})

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function AdminActivityPage() {
  const { data: feed, isLoading } = useSystemActivityFeed()

  return (
    <DashboardShell title="System Activity" subtitle="Real events across the platform, newest first — refreshes automatically." decorated={false}>
      <Card>
        <CardContent className="space-y-1.5 pt-6">
          {isLoading ? (
            <div className="h-64 animate-pulse rounded-md bg-secondary" />
          ) : !feed || feed.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center text-sm text-muted-foreground">
              <Activity className="size-8 text-muted-foreground/50" />
              No platform activity yet. As teachers and students use FocusFlow, real events appear here.
            </div>
          ) : (
            feed.map((entry) => (
              <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm">
                <span className="text-foreground">{entry.summary}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatTimestamp(entry.timestamp)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
