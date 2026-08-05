import { useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AlertTriangle, Award, GraduationCap, LoaderCircle, LogIn, RefreshCw, Sparkles } from 'lucide-react'
import { getCurrentUserFn, useAuth } from '@/features/auth/hooks/useAuth'
import { useReseedPilotDemo } from '@/features/admin/hooks/useAdminPlatform'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export const Route = createFileRoute('/admin/demo-center')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: DemoCenterPage,
})

const DEMO_PASSWORD = 'PilotDemo2026!'

// Real Kitengela pilot accounts — see docs/DEMO_LOGIN_CREDENTIALS.md. These
// shortcuts pre-fill the real /login form, they never create a session
// directly; the normal login mutation still runs on submit.
const DEMO_ACCOUNTS = [
  { role: 'Student', name: 'Amani Wanjiru', email: 'pilot-amani.wanjiru@kitengela.demo', icon: Sparkles, note: 'Grade 7 · 14-day streak, richest journey/achievement history' },
  { role: 'Teacher', name: 'Grace Mwangi', email: 'pilot-grace.mwangi@kitengela.demo', icon: GraduationCap, note: 'Owns both Mathematics classes, real submitted results to show' },
] as const

function DemoCenterPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
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

  async function handleLoginAs(email: string) {
    await logout()
    await navigate({ to: '/login', search: { email, password: DEMO_PASSWORD } })
  }

  return (
    <DashboardShell title="Demo Center" subtitle="Quick entry points for a live presentation, backed by real seeded pilot data." decorated={false}>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">Log in as…</CardTitle>
          <CardDescription>Signs you out of this admin session and takes you to the real login form, pre-filled — you still submit it yourself.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((account) => (
            <div key={account.email} className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
              <div className="flex items-center gap-2">
                <account.icon className="size-4 text-accent" />
                <span className="text-sm font-semibold text-foreground">{account.role} — {account.name}</span>
              </div>
              <p className="text-xs text-muted-foreground">{account.note}</p>
              <Button variant="outline" size="sm" className="mt-1 w-fit gap-2" onClick={() => handleLoginAs(account.email)}>
                <LogIn className="size-3.5" />
                Log in as {account.role}
              </Button>
            </div>
          ))}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-base text-foreground">
            <Award className="size-4 text-accent" />
            Pilot Evidence
          </CardTitle>
          <CardDescription>Historical results from the Kitengela pilot study.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" asChild>
            <Link to="/admin/pilot-evidence">View Pilot Evidence</Link>
          </Button>
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
