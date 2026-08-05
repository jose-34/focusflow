import { createFileRoute, redirect } from '@tanstack/react-router'
import { Building2, GraduationCap, Users } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useInstitutions } from '@/features/admin/hooks/useAdminPlatform'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card, CardContent } from '@/components/ui/card'

export const Route = createFileRoute('/admin/institutions')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: AdminInstitutionsPage,
})

function AdminInstitutionsPage() {
  const { data: institutions, isLoading } = useInstitutions()

  return (
    <DashboardShell title="Institutions" subtitle="Every school on FocusFlow, with its teachers and learners." decorated={false}>
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-md bg-secondary" />
      ) : !institutions || institutions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">No institutions seeded yet.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {institutions.map((inst) => (
            <Card key={inst.id}>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-start gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Building2 className="size-4" />
                  </div>
                  <div>
                    <p className="font-heading text-sm font-semibold text-foreground">{inst.name}</p>
                    {inst.campus && <p className="text-xs text-muted-foreground">{inst.campus}</p>}
                  </div>
                </div>
                <div className="flex gap-4 border-t border-border pt-3 text-sm">
                  <span className="flex items-center gap-1.5 text-foreground">
                    <GraduationCap className="size-3.5 text-muted-foreground" />
                    {inst.teacherCount} teacher{inst.teacherCount === 1 ? '' : 's'}
                  </span>
                  <span className="flex items-center gap-1.5 text-foreground">
                    <Users className="size-3.5 text-muted-foreground" />
                    {inst.studentCount} student{inst.studentCount === 1 ? '' : 's'}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardShell>
  )
}
