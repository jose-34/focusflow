import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { BookOpen, Plus } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useAdminContent } from '@/features/quizzes/hooks/useQuizzes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/admin/content/')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminContentPage,
})

function AdminContentPage() {
  const { data: quizzes, isLoading } = useAdminContent()

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Content Library</h1>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
          <Link to="/admin/content/new">
            <Plus className="size-4" />
            New Quiz
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-secondary" />
      ) : !quizzes || quizzes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <BookOpen className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No public content yet — create your first quiz for the landing page and student dashboards.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((quiz) => (
            <Link key={quiz.id} to="/admin/content/$quizId" params={{ quizId: quiz.id }}>
              <Card className="h-full transition-colors hover:bg-secondary/50">
                <CardHeader>
                  <CardTitle className="font-heading text-foreground">{quiz.title}</CardTitle>
                  <div className="flex flex-wrap gap-1.5 pt-1">
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
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <Badge variant={quiz.isPublished ? 'default' : 'outline'}>{quiz.isPublished ? 'Live' : 'Draft'}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
