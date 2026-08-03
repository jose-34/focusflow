import { useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useQuizAuthoring } from '@/features/quizzes/hooks/useQuizzes'
import { QuestionForm } from '@/features/quizzes/components/QuestionForm'
import { AIQuestionGenerator } from '@/features/quizzes/components/AIQuestionGenerator'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin/content/$quizId')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminQuizDetailPage,
})

function AdminQuizDetailPage() {
  const { quizId } = Route.useParams()
  const { quiz, isLoading, addQuestion, isAddingQuestion, deleteQuestion, togglePublish, isTogglingPublish } =
    useQuizAuthoring(quizId)
  const [showForm, setShowForm] = useState(false)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
      </div>
    )
  }

  if (!quiz) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">Quiz not found.</p>
      </div>
    )
  }

  async function handleTogglePublish() {
    try {
      await togglePublish(!quiz!.isPublished)
      toast.success(quiz!.isPublished ? 'Quiz unpublished' : 'Quiz published — now visible on the landing page and to students')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update quiz')
    }
  }

  async function handleDeleteQuestion(questionId: string) {
    try {
      await deleteQuestion(questionId)
      toast.success('Question deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete question')
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Button variant="ghost" className="mb-4 gap-2 pl-0" asChild>
        <Link to="/admin/content">
          <ArrowLeft className="size-4" />
          Back to Content Library
        </Link>
      </Button>

      <div className="mb-6 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/15 via-background to-secondary/80 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Public Content
              </Badge>
              <Badge variant={quiz.isPublished ? 'default' : 'outline'}>{quiz.isPublished ? 'Live' : 'Draft'}</Badge>
            </div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">{quiz.title}</h1>
            {quiz.description && <p className="mt-1 text-sm text-muted-foreground">{quiz.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-center">
              <div className="text-lg font-semibold text-foreground">{quiz.questions.length}</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Questions</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePublish}
              disabled={isTogglingPublish || (quiz.questions.length === 0 && !quiz.isPublished)}
            >
              {isTogglingPublish && <LoaderCircle className="mr-1 size-3.5 animate-spin" />}
              {quiz.isPublished ? 'Unpublish' : 'Publish'}
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="font-heading text-base text-foreground">Questions ({quiz.questions.length})</CardTitle>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-4" />
            Add Question
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <AIQuestionGenerator quizId={quizId} />

          {showForm && (
            <QuestionForm
              onSubmit={async (input) => {
                await addQuestion(input)
                setShowForm(false)
                toast.success('Question added')
              }}
              isSubmitting={isAddingQuestion}
              onCancel={() => setShowForm(false)}
            />
          )}

          {quiz.questions.length === 0 && !showForm ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No questions yet — add your first one above.</p>
          ) : (
            quiz.questions.map((question, index) => (
              <div key={question.id} className="rounded-md border border-border bg-background p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {index + 1}. {question.questionText}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({question.points} pt{question.points === 1 ? '' : 's'})
                    </span>
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteQuestion(question.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <div className="space-y-1">
                  {question.choices.map((choice) => (
                    <div
                      key={choice.id}
                      className={cn(
                        'flex items-center gap-2 rounded px-2 py-1 text-xs',
                        choice.isCorrect ? 'bg-primary/10 text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {choice.isCorrect ? (
                        <CheckCircle2 className="size-3.5 shrink-0" />
                      ) : (
                        <span className="size-3.5 shrink-0" />
                      )}
                      {choice.choiceText}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
