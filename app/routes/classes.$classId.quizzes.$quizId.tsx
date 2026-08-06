import { useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Eye, Gamepad2, LoaderCircle, Plus, Timer, Trash2 } from 'lucide-react'
import { getCurrentUserFn, useAuth } from '@/features/auth/hooks/useAuth'
import { useAssignmentInsights, useQuizAuthoring } from '@/features/quizzes/hooks/useQuizzes'
import { QuestionForm } from '@/features/quizzes/components/QuestionForm'
import { AIQuestionGenerator } from '@/features/quizzes/components/AIQuestionGenerator'
import { QuizTakingView } from '@/features/quizzes/components/QuizTakingView'
import { QuizPreview } from '@/features/quizzes/components/QuizPreview'
import { useCreateGameSession } from '@/features/games/hooks/useGames'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/classes/$classId/quizzes/$quizId')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: QuizDetailPage,
})

function QuizDetailPage() {
  const { classId, quizId } = Route.useParams()
  const { isTeacher } = useAuth()

  return isTeacher ? <TeacherQuizView classId={classId} quizId={quizId} /> : <StudentQuizView classId={classId} quizId={quizId} />
}

// ---------------- Teacher authoring view ----------------

function TeacherQuizView({ classId, quizId }: { classId: string; quizId: string }) {
  const {
    quiz,
    isLoading,
    addQuestion,
    isAddingQuestion,
    deleteQuestion,
    togglePublish,
    isTogglingPublish,
    toggleVisibility,
    isTogglingVisibility,
  } = useQuizAuthoring(quizId)
  const [showForm, setShowForm] = useState(false)
  const [hostDialogOpen, setHostDialogOpen] = useState(false)
  const [accessMode, setAccessMode] = useState<'class' | 'public'>('class')
  const navigate = useNavigate()
  const createGameSession = useCreateGameSession()

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
      toast.success(quiz!.isPublished ? 'Quiz unpublished' : 'Quiz published. Students can now see it')
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

  async function handleToggleVisibility() {
    try {
      await toggleVisibility(quiz!.visibility === 'public' ? 'private' : 'public')
      toast.success(
        quiz!.visibility === 'public'
          ? 'Now private. Visible only to your class'
          : 'Now public. Visible to any logged-in student and on the landing page',
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update visibility')
    }
  }

  async function handleHostLiveGame() {
    setHostDialogOpen(false)
    try {
      const session = await createGameSession.mutateAsync({ quizId, accessMode }) as { id: string }
      navigate({ to: '/game/host/$sessionId', params: { sessionId: session.id } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start live game')
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Button variant="ghost" className="mb-4 gap-2 pl-0" asChild>
        <Link to="/classes/$classId" params={{ classId }}>
          <ArrowLeft className="size-4" />
          Back to Class
        </Link>
      </Button>

      <div className="mb-6 overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/15 via-background to-secondary/80 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Quiz Studio
              </Badge>
              <Badge variant={quiz.isPublished ? 'default' : 'outline'}>{quiz.isPublished ? 'Live' : 'Draft'}</Badge>
              {quiz.visibility === 'public' && (
                <Badge variant="secondary" className="bg-accent/15 text-accent">
                  Public
                </Badge>
              )}
            </div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">{quiz.title}</h1>
            {quiz.description && <p className="mt-1 text-sm text-muted-foreground">{quiz.description}</p>}
            {quiz.dueDate && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                Due {new Date(quiz.dueDate).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-center">
              <div className="text-lg font-semibold text-foreground">{quiz.questions.length}</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Questions</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/80 px-3 py-2 text-center">
              <div className="text-lg font-semibold text-foreground">{quiz.attempts.length}</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Submissions</div>
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
            <Button variant="outline" size="sm" onClick={handleToggleVisibility} disabled={isTogglingVisibility}>
              {isTogglingVisibility && <LoaderCircle className="mr-1 size-3.5 animate-spin" />}
              {quiz.visibility === 'public' ? 'Make Private' : 'Publish to Public'}
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5" disabled={quiz.questions.length === 0}>
                  <Eye className="size-3.5" />
                  Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{quiz.title}</DialogTitle>
                </DialogHeader>
                <QuizPreview quizId={quizId} />
              </DialogContent>
            </Dialog>
            <Dialog open={hostDialogOpen} onOpenChange={setHostDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  disabled={quiz.questions.length === 0 || createGameSession.isPending}
                  className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {createGameSession.isPending ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Gamepad2 className="size-3.5" />
                  )}
                  Host Live Game
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Who can play?</DialogTitle>
                  <DialogDescription>Choose who can join with the PIN before starting.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setAccessMode('class')}
                    className={cn(
                      'rounded-lg border-2 p-3 text-left text-sm transition-colors',
                      accessMode === 'class' ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50',
                    )}
                  >
                    <p className="font-medium text-foreground">Students in my class</p>
                    <p className="mt-1 text-xs text-muted-foreground">Only students enrolled in this class can join.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccessMode('public')}
                    className={cn(
                      'rounded-lg border-2 p-3 text-left text-sm transition-colors',
                      accessMode === 'public' ? 'border-primary bg-primary/10' : 'border-border hover:bg-secondary/50',
                    )}
                  >
                    <p className="font-medium text-foreground">Public — anyone with the code</p>
                    <p className="mt-1 text-xs text-muted-foreground">Anyone can join and enter their name, no account needed.</p>
                  </button>
                </div>
                <DialogFooter>
                  <Button onClick={handleHostLiveGame} disabled={createGameSession.isPending} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                    {createGameSession.isPending && <LoaderCircle className="size-4 animate-spin" />}
                    Start Game
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Card className="mb-6">
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
            <p className="py-6 text-center text-sm text-muted-foreground">No questions yet. Add your first one above.</p>
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

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">Results ({quiz.attempts.length})</CardTitle>
          <CardDescription>Students who have submitted this quiz.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {quiz.attempts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No submissions yet.</p>
          ) : (
            quiz.attempts.map((attempt) => (
              <div
                key={attempt.id}
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
              >
                <span className="text-sm font-medium text-foreground">{attempt.studentName}</span>
                <Badge variant="outline">
                  {attempt.score}/{attempt.maxScore}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {quiz.dueDate && <AssignmentInsightsCard quizId={quizId} />}
    </div>
  )
}

function AssignmentInsightsCard({ quizId }: { quizId: string }) {
  const { data, isLoading } = useAssignmentInsights(quizId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-base text-foreground">Assignment Insights</CardTitle>
        <CardDescription>
          Focus time logged against this assignment and how close to the deadline each student attempted it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-24 animate-pulse rounded-md bg-secondary" />
        ) : !data || data.insights.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No enrolled students yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Focus Time</TableHead>
                <TableHead>Attempted</TableHead>
                <TableHead>Score</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.insights.map((insight) => (
                <TableRow key={insight.studentId}>
                  <TableCell className="font-medium text-foreground">{insight.studentName}</TableCell>
                  <TableCell>
                    {insight.focusSessionCount > 0 ? (
                      <span className="flex items-center gap-1 text-sm">
                        <Timer className="size-3.5 text-primary" />
                        {insight.totalFocusMinutes} min ({insight.focusSessionCount} session
                        {insight.focusSessionCount === 1 ? '' : 's'})
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">None logged</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {insight.attemptStartedAt ? (
                      <span className="text-sm text-muted-foreground">
                        {insight.hoursBeforeDeadline !== null && insight.hoursBeforeDeadline >= 0
                          ? `${Math.round(insight.hoursBeforeDeadline)}h before deadline`
                          : insight.hoursBeforeDeadline !== null
                            ? `${Math.round(-insight.hoursBeforeDeadline)}h after deadline`
                            : new Date(insight.attemptStartedAt).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not started</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {insight.score !== null ? (
                      <Badge variant="outline">
                        {insight.score}/{insight.maxScore}
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {insight.procrastinationFlag && (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="size-3.5" />
                        Last-minute, no focus time
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------- Student taking view ----------------

function StudentQuizView({ classId, quizId }: { classId: string; quizId: string }) {
  return (
    <QuizTakingView
      quizId={quizId}
      backLink={
        <Button variant="ghost" className="mb-4 gap-2 pl-0" asChild>
          <Link to="/classes/$classId" params={{ classId }}>
            <ArrowLeft className="size-4" />
            Back to Class
          </Link>
        </Button>
      }
    />
  )
}
