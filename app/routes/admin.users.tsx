import { useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { GraduationCap, Search, Shield, User } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useAdminUsers } from '@/features/admin/hooks/useAdminPlatform'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/admin/users')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) throw redirect({ to: '/login' })
    if (user.role !== 'admin') throw redirect({ to: '/dashboard' })
  },
  component: AdminUsersPage,
})

const ROLE_ICON = { student: User, teacher: GraduationCap, admin: Shield } as const

function AdminUsersPage() {
  const { data: users, isLoading } = useAdminUsers()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'teacher' | 'admin'>('all')

  const filtered = (users ?? []).filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (search.trim() === '') return true
    const q = search.trim().toLowerCase()
    return `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q)
  })

  return (
    <DashboardShell title="Users" subtitle="Every account on FocusFlow, across every institution." decorated={false}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1" style={{ minWidth: 220 }}>
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1.5">
              {(['all', 'student', 'teacher', 'admin'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    roleFilter === r ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="h-40 animate-pulse rounded-md bg-secondary" />
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No users match.</p>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((u) => {
                const Icon = ROLE_ICON[u.role]
                return (
                  <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-8 items-center justify-center rounded-full bg-secondary">
                        <Icon className="size-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {u.institutionName && (
                        <Badge variant="outline" className="text-[10px]">
                          {u.institutionName}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-[10px] capitalize">
                        {u.role}
                      </Badge>
                      {u.status !== 'active' && (
                        <Badge variant="destructive" className="text-[10px] capitalize">
                          {u.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
