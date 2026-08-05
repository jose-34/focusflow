import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Database, LoaderCircle, RefreshCw, XCircle } from 'lucide-react'
import { getCurrentUserFn, useAuth } from '@/features/auth/hooks/useAuth'
import { useReseedPilotDemo, useSystemHealth } from '@/features/admin/hooks/useAdminPlatform'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export const Route = createFileRoute('/admin/settings')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: AdminSettingsPage,
})

function HealthRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{detail}</span>
        {ok ? <CheckCircle2 className="size-4 text-primary" /> : <XCircle className="size-4 text-destructive" />}
      </div>
    </div>
  )
}

function AdminSettingsPage() {
  const { user } = useAuth()
  const { data: health, isLoading: healthLoading } = useSystemHealth()
  const reseed = useReseedPilotDemo()
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleReseed() {
    setConfirmOpen(false)
    try {
      const result = await reseed.mutateAsync()
      toast.success(
        `Reseeded ${result.institutionName}: ${result.studentCount} students, ${result.totalSessions} focus sessions, ${result.totalAttempts} quiz attempts.`,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reseed demo data')
    }
  }

  return (
    <DashboardShell title="Settings" subtitle="Platform account and system-level settings." decorated={false}>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">Admin Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="text-foreground">{user?.firstName} {user?.lastName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="text-foreground">{user?.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <Badge variant="secondary" className="capitalize">{user?.role}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Database className="size-4 text-muted-foreground" />
          <CardTitle className="font-heading text-base text-foreground">System Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {healthLoading || !health ? (
            <div className="h-32 animate-pulse rounded-md bg-secondary" />
          ) : (
            <>
              <HealthRow label="Database" ok={health.databaseOk} detail={`${health.databaseLatencyMs}ms`} />
              <HealthRow label="Active sessions" ok={true} detail={`${health.activeSessionCount} active, ${health.expiredSessionCount} expired`} />
              <HealthRow label="Error tracking" ok={health.errorTrackingConfigured} detail={health.errorTrackingConfigured ? 'Configured' : 'Not configured'} />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="border-accent/30">
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">Demo Data</CardTitle>
          <CardDescription>Kitengela International Schools pilot dataset — institution, teachers, students, classes, activities, and 14 days of realistic history.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="gap-2" onClick={() => setConfirmOpen(true)} disabled={reseed.isPending}>
            {reseed.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Reset Demo Data
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Deletes and recreates every pilot-*@kitengela.demo account with freshly randomized (but realistic) activity history.
            Real teacher/student accounts are never touched.
          </p>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-accent" />
              Reset demo data?
            </DialogTitle>
            <DialogDescription>
              This deletes every pilot-*@kitengela.demo account and the Kitengela institution, then recreates them with fresh
              randomized activity history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleReseed} className="bg-accent text-accent-foreground hover:bg-accent/90">Reset Demo Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  )
}
