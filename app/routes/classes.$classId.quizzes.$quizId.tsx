import { useEffect, useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Gamepad2, LoaderCircle, Plus, Timer, Trash2, XCircle } from 'lucide-react'
import { getCurrentUserFn, useAuth } from '@/features/auth/hooks/useAuth'
import { useAssignmentInsights, useQuizAuthoring, useQuizTaking } from '@/features/quizzes/hooks/useQuizzes'
import { endFocusSessionFn, reportFocusHeartbeatFn, startAssignmentFn } from '@/features/focusMode'
import { questionTypeValues } from '@/features/quizzes/schemas'
import { useCelebration } from '@/features/celebration/CelebrationContext'
import { useCreateGameSession } from '@/features/games/hooks/useGames'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  const { quiz, isLoading, addQuestion, isAddingQuestion, deleteQuestion, togglePublish, isTogglingPublish } =
    useQuizAuthoring(quizId)
  const [showForm, setShowForm] = useState(false)
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
      toast.success(quiz!.isPublished ? 'Quiz unpublished' : 'Quiz published — students can now see it')
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

  async function handleHostLiveGame() {
    try {
      const session = await createGameSession.mutateAsync({ quizId }) as { id: string }
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
            <Button
              size="sm"
              onClick={handleHostLiveGame}
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
          {showForm && (
            <QuestionForm
              quizId={quizId}
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

function QuestionForm({
  quizId,
  onSubmit,
  isSubmitting,
  onCancel,
}: {
  quizId: string
  onSubmit: (input: {
    questionText: string
    questionType: (typeof questionTypeValues)[number]
    points: number
    choices: Array<{ choiceText: string; isCorrect: boolean }>
  }) => Promise<void>
  isSubmitting: boolean
  onCancel: () => void
}) {
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState<(typeof questionTypeValues)[number]>('multiple_choice')
  const [points, setPoints] = useState('1')
  const [choices, setChoices] = useState([
    { choiceText: '', isCorrect: true },
    { choiceText: '', isCorrect: false },
  ])

  function updateChoiceText(index: number, text: string) {
    setChoices((prev) => prev.map((c, i) => (i === index ? { ...c, choiceText: text } : c)))
  }

  function setCorrectChoice(index: number) {
    setChoices((prev) => prev.map((c, i) => ({ ...c, isCorrect: i === index })))
  }

  function addChoice() {
    if (choices.length >= 6) return
    setChoices((prev) => [...prev, { choiceText: '', isCorrect: false }])
  }

  function removeChoice(index: number) {
    if (choices.length <= 2) return
    setChoices((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (!next.some((c) => c.isCorrect)) next[0].isCorrect = true
      return next
    })
  }

  async function handleSubmit() {
    if (!questionText.trim() || choices.some((c) => !c.choiceText.trim())) {
      toast.error('Fill in the question and all choice fields')
      return
    }
    await onSubmit({
      questionText: questionText.trim(),
      questionType,
      points: Number(points) || 1,
      choices,
    })
    void quizId
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-3">
      <div className="space-y-2">
        <Label>Question</Label>
        <Input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Question text" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={questionType} onValueChange={(v) => setQuestionType(v as typeof questionType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
              <SelectItem value="true_false">True / False</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Points</Label>
          <Input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Choices (select the correct one)</Label>
        {choices.map((choice, index) => (
          <div key={index} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCorrectChoice(index)}
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                choice.isCorrect ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent',
              )}
            >
              <CheckCircle2 className="size-4" />
            </button>
            <Input
              value={choice.choiceText}
              onChange={(e) => updateChoiceText(index, e.target.value)}
              placeholder={`Choice ${index + 1}`}
            />
            {choices.length > 2 && (
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => removeChoice(index)}>
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}
        {choices.length < 6 && (
          <Button variant="outline" size="sm" className="gap-1" onClick={addChoice}>
            <Plus className="size-3.5" />
            Add choice
          </Button>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isSubmitting && <LoaderCircle className="size-3.5 animate-spin" />}
          Save Question
        </Button>
      </div>
    </div>
  )
}

// ---------------- Student taking view ----------------

function StudentQuizView({ classId, quizId }: { classId: string; quizId: string }) {
  const { quiz, isLoading, startAttempt, isStarting, submitQuiz, isSubmitting } = useQuizTaking(quizId)
  const { celebrate } = useCelebration()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [isStartingQuiz, setIsStartingQuiz] = useState(false)
  const [startToken, setStartToken] = useState<string | null>(null)
  const [startEventId, setStartEventId] = useState<string | null>(null)
  const [focusSessionId, setFocusSessionId] = useState<string | null>(null)
  const [verifiedMinutes, setVerifiedMinutes] = useState<number | null>(null)
  const [focusHeartbeatError, setFocusHeartbeatError] = useState<string | null>(null)

  // Sprint 0 fix (docs/CONTRIBUTING.md, docs/16_Testing_Strategy.md): these
  // four hooks previously sat AFTER the isLoading/!quiz early returns below,
  // meaning they were called conditionally — a real Rules-of-Hooks
  // violation (not just a lint nitpick), caught by npm run lint while
  // wiring up Sprint 0's CI pipeline. Moved above every early return; each
  // effect already guards its own body against `quiz` being undefined.
  const hasSubmitted = !!quiz?.attempt?.submittedAt

  useEffect(() => {
    const savedToken = typeof window !== 'undefined' ? sessionStorage.getItem(`focusflow.startToken.${quizId}`) : null
    const savedEventId = typeof window !== 'undefined' ? sessionStorage.getItem(`focusflow.startEventId.${quizId}`) : null
    if (savedToken) setStartToken(savedToken)
    if (savedEventId) setStartEventId(savedEventId)
  }, [quizId])

  useEffect(() => {
    if (!quiz?.timeLimitMinutes || hasSubmitted) return
    setTimeLeft(quiz.timeLimitMinutes * 60)
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval)
          if (quiz?.attempt && !hasSubmitted) {
            void handleSubmit()
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [quiz?.timeLimitMinutes, hasSubmitted, quiz?.attempt?.id])

  useEffect(() => {
    if (!startToken && !startEventId) return
    const interval = setInterval(() => {
      void handleFocusHeartbeat()
    }, 15000)
    void handleFocusHeartbeat()
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startToken, startEventId, focusSessionId, quizId])

  useEffect(() => {
    const savedSessionId = typeof window !== 'undefined' ? sessionStorage.getItem(`focusflow.focusSessionId.${quizId}`) : null
    if (savedSessionId) {
      setFocusSessionId(savedSessionId)
    }
  }, [quizId])

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
        <p className="text-sm text-muted-foreground">Quiz not found, or it hasn&apos;t been published yet.</p>
      </div>
    )
  }

  async function handleStart() {
    setIsStartingQuiz(true)
    try {
      const startResult = await startAssignmentFn({ data: { assignmentId: quizId, startMethod: 'web' } })
      if (startResult.startToken) {
        sessionStorage.setItem(`focusflow.startToken.${quizId}`, startResult.startToken)
        sessionStorage.setItem(`focusflow.startEventId.${quizId}`, startResult.startEventId)
        setStartToken(startResult.startToken)
        setStartEventId(startResult.startEventId)
      }
      if (startResult.startXPAwarded > 0) {
        toast.success(startResult.message ?? `You earned ${startResult.startXPAwarded} XP for starting!`)
      }
      await startAttempt()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start quiz')
    } finally {
      setIsStartingQuiz(false)
    }
  }

  async function handleFocusHeartbeat() {
    if (!startToken && !startEventId) {
      return
    }
    try {
      const result = await reportFocusHeartbeatFn({
        data: {
          startToken: startToken ?? undefined,
          startEventId: startEventId ?? undefined,
          sessionId: focusSessionId ?? undefined,
          clientHeartbeatAt: new Date().toISOString(),
        },
      })
      if (result.focusSessionId) {
        setFocusSessionId(result.focusSessionId)
        sessionStorage.setItem(`focusflow.focusSessionId.${quizId}`, result.focusSessionId)
      }
      setVerifiedMinutes(result.totalVerifiedMinutes)
      setFocusHeartbeatError(null)
    } catch (error) {
      setFocusHeartbeatError(error instanceof Error ? error.message : 'Heartbeat failed')
    }
  }

  async function handleSubmit() {
    if (!quiz!.attempt) return
    try {
      const result = await submitQuiz({
        attemptId: quiz!.attempt.id,
        answers: quiz!.questions.map((q) => ({ questionId: q.id, selectedChoiceId: answers[q.id] ?? null })),
      })
      celebrate({ type: 'quiz', title: quiz!.title, score: result.score ?? 0, maxScore: result.maxScore })
      if (focusSessionId) {
        await endFocusSessionFn({ data: { sessionId: focusSessionId } })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit quiz')
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

      <div className="mb-6 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 via-background to-secondary/70 p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Challenge Mode
              </Badge>
              {quiz.timeLimitMinutes && (
                <Badge variant="outline">
                  {timeLeft !== null ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')} left` : `${quiz.timeLimitMinutes} min limit`}
                </Badge>
              )}
            </div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">{quiz.title}</h1>
            {quiz.description && <p className="mt-1 text-sm text-muted-foreground">{quiz.description}</p>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {quiz.dueDate && (
              <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                Due {new Date(quiz.dueDate).toLocaleDateString()}
              </span>
            )}
            <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
              {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'}
            </span>
            {(focusSessionId || startToken) && (
              <span className="rounded-full border border-success/70 bg-success/10 px-3 py-1 text-success">
                Focus mode active{verifiedMinutes !== null ? ` · ${verifiedMinutes} min verified` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {hasSubmitted && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <span className="text-sm font-medium text-foreground">Your score</span>
            <Badge className="text-sm">
              {quiz.attempt!.score}/{quiz.attempt!.maxScore}
            </Badge>
          </CardContent>
        </Card>
      )}

      {!quiz.attempt ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'} — ready when you are.
            </p>
            <Button onClick={handleStart} disabled={isStarting || isStartingQuiz} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {(isStarting || isStartingQuiz) && <LoaderCircle className="size-4 animate-spin" />}
              Start Quiz
            </Button>
            {focusHeartbeatError && (
              <p className="text-xs text-destructive">Focus session sync error: {focusHeartbeatError}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {quiz.questions.map((question, index) => {
            const myAnswer = hasSubmitted
              ? quiz.myAnswers.find((a) => a.questionId === question.id)?.selectedChoiceId
              : answers[question.id]

            return (
              <Card key={question.id}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-foreground">
                    {index + 1}. {question.questionText}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({question.points} pt{question.points === 1 ? '' : 's'})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {question.choices.map((choice) => {
                    const isSelected = myAnswer === choice.id
                    const showCorrectness = hasSubmitted && choice.isCorrect !== undefined
                    return (
                      <button
                        key={choice.id}
                        type="button"
                        disabled={hasSubmitted}
                        onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: choice.id }))}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                          isSelected && !hasSubmitted && 'border-primary bg-primary/10',
                          !isSelected && !hasSubmitted && 'border-border hover:bg-secondary/50',
                          showCorrectness && choice.isCorrect && 'border-primary bg-primary/10 text-primary',
                          showCorrectness && isSelected && !choice.isCorrect && 'border-destructive bg-destructive/10 text-destructive',
                          showCorrectness && !isSelected && !choice.isCorrect && 'border-border text-muted-foreground',
                        )}
                      >
                        {choice.choiceText}
                        {showCorrectness && choice.isCorrect && <CheckCircle2 className="size-4 shrink-0" />}
                        {showCorrectness && isSelected && !choice.isCorrect && <XCircle className="size-4 shrink-0" />}
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}

          {!hasSubmitted && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSubmitting && <LoaderCircle className="size-4 animate-spin" />}
              Submit Quiz
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
