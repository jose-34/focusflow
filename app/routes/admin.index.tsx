import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Activity, BookOpen, CheckCircle2, GraduationCap, ListChecks, Plus, Radio, Sparkles, Timer, Users } from 'lucide-react'
import { getCurrentUserFn, useAuth } from '@/features/auth/hooks/useAuth'
import { getAdminContentListFn } from '@/features/quizzes/hooks/useQuizzes'
import { usePlatformOverview, useSystemActivityFeed } from '@/features/admin/hooks/useAdminPlatform'
import { DashboardShell, StatGrid } from '@/components/dashboard/DashboardShell'
import { StatCard } from '@/components/dashboard/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/admin/')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminOverviewPage,
})

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function AdminOverviewPage() {
  const { user } = useAuth()
  const { data: overview, isLoading: overviewLoading } = usePlatformOverview()
  const { data: feed, isLoading: feedLoading } = useSystemActivityFeed()
  const { data: content, isLoading: contentLoading } = useQuery({
    queryKey: ['quizzes', 'admin-content'],
    queryFn: () => getAdminContentListFn(),
  })

  const quizzes = content ?? []

  return (
    <DashboardShell
      title={`Welcome back, ${user?.firstName}`}
      subtitle="Platform overview: who's on FocusFlow, what's happening, and whether the system is healthy."
      decorated={false}
    >
      {overviewLoading ? (
        <div className="h-24 animate-pulse rounded-md bg-secondary" />
      ) : (
        overview && (
          <StatGrid>
            <StatCard label="Students" value={overview.totalStudents} icon={Users} delay={0} />
            <StatCard label="Teachers" value={overview.totalTeachers} icon={GraduationCap} delay={0.05} />
            <StatCard label="Institutions" value={overview.totalInstitutions} icon={BookOpen} delay={0.1} />
            <StatCard label="Classes" value={overview.totalClasses} icon={ListChecks} delay={0.15} />
            <StatCard label="Activities" value={overview.totalActivities} icon={CheckCircle2} delay={0.2} />
            <StatCard label="Focus Sessions" value={overview.totalFocusSessions} icon={Timer} delay={0.25} />
            <StatCard label="Live Sessions Now" value={overview.activeLiveSessions} icon={Radio} delay={0.3} />
            <StatCard label="Completion Rate" value={`${overview.completionRate}%`} icon={Activity} delay={0.35} />
          </StatGrid>
        )
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-foreground">
            <Activity className="size-4" />
            System Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {feedLoading ? (
            <div className="h-24 animate-pulse rounded-md bg-secondary" />
          ) : !feed || feed.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No platform activity yet.</p>
          ) : (
            feed.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm">
                <span className="text-foreground">{entry.summary}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(entry.timestamp)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-foreground">Content Library</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="gap-2" asChild>
              <Link to="/admin/content/new">
                <Plus className="size-4" />
                New Quiz
              </Link>
            </Button>
            <Button size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" asChild>
              <Link to="/admin/content/generate">
                <Sparkles className="size-4" />
                Generate with AI
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {contentLoading ? (
            <div className="h-16 animate-pulse rounded-md bg-secondary" />
          ) : quizzes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No public content yet. Create your first quiz for the landing page and student dashboards.
            </p>
          ) : (
            quizzes.slice(0, 5).map((quiz) => (
              <Link
                key={quiz.id}
                to="/admin/content/$quizId"
                params={{ quizId: quiz.id }}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 transition-colors hover:bg-secondary/50"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{quiz.title}</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {quiz.curriculumName}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {quiz.subjectName}
                    </Badge>
                    {quiz.gradeLabel && (
                      <Badge variant="outline" className="text-[10px]">
                        {quiz.gradeLabel}
                      </Badge>
                    )}
                  </div>
                </div>
                <Badge variant={quiz.isPublished ? 'default' : 'outline'}>{quiz.isPublished ? 'Live' : 'Draft'}</Badge>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  )
}
