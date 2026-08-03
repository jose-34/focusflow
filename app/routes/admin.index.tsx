import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, CheckCircle2, ListChecks, Plus, Sparkles } from 'lucide-react'
import { getCurrentUserFn, useAuth } from '@/features/auth/hooks/useAuth'
import { getAdminContentListFn } from '@/features/quizzes/hooks/useQuizzes'
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

function AdminOverviewPage() {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['quizzes', 'admin-content'],
    queryFn: () => getAdminContentListFn(),
  })

  const quizzes = data ?? []
  const publishedCount = quizzes.filter((q) => q.isPublished).length
  const questionCount = quizzes.reduce((sum, q) => sum + q.questionCount, 0)

  return (
    <DashboardShell
      title={`Welcome back, ${user?.firstName}`}
      subtitle="Manage the public content library shown on the landing page and to every student."
      decorated={false}
    >
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-md bg-secondary" />
      ) : (
        <StatGrid>
          <StatCard label="Public Quizzes" value={quizzes.length} icon={BookOpen} delay={0} />
          <StatCard label="Published" value={publishedCount} icon={CheckCircle2} delay={0.05} />
          <StatCard label="Total Questions" value={questionCount} icon={ListChecks} delay={0.1} />
        </StatGrid>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-foreground">Recent Content</CardTitle>
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
          {quizzes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No public content yet — create your first quiz for the landing page and student dashboards.
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
