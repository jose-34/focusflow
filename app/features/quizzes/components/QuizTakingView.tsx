import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, LoaderCircle, XCircle } from 'lucide-react'
import { useQuizTaking } from '@/features/quizzes/hooks/useQuizzes'
import { endFocusSessionFn, reportFocusHeartbeatFn, startAssignmentFn } from '@/features/focusMode'
import { ACHIEVEMENT_MAP } from '@/features/achievements/definitions'
import { useCelebration } from '@/features/celebration/CelebrationContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Shared by both the class-scoped quiz route and the classless
// (admin/public-content) quiz route — quiz-taking itself never depended on
// classId, only the "back" link at the top of the page did, so that's the
// one thing the caller supplies rather than this component assuming a
// class context exists.
export function QuizTakingView({ quizId, backLink }: { quizId: string; backLink: ReactNode }) {
  const { quiz, isLoading, startAttempt, isStarting, submitQuiz, isSubmitting } = useQuizTaking(quizId)
  const { celebrate } = useCelebration()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [isStartingQuiz, setIsStartingQuiz] = useState(false)
  const [focusSessionId, setFocusSessionId] = useState<string | null>(null)
  const [verifiedMinutes, setVerifiedMinutes] = useState<number | null>(null)
  const [focusHeartbeatError, setFocusHeartbeatError] = useState<string | null>(null)

  const hasSubmitted = !!quiz?.attempt?.submittedAt

  useEffect(() => {
    const savedSessionId = typeof window !== 'undefined' ? sessionStorage.getItem(`focusflow.focusSessionId.${quizId}`) : null
    if (savedSessionId) setFocusSessionId(savedSessionId)
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
    if (!focusSessionId) return
    const interval = setInterval(() => {
      void handleFocusHeartbeat()
    }, 15000)
    void handleFocusHeartbeat()
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSessionId, quizId])

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
      const startResult = await startAssignmentFn({ data: { quizId, startMethod: 'web' } })
      setFocusSessionId(startResult.sessionId)
      sessionStorage.setItem(`focusflow.focusSessionId.${quizId}`, startResult.sessionId)
      if (startResult.startXPAwarded > 0) {
        toast.success(startResult.message)
      }
      await startAttempt()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to start quiz')
    } finally {
      setIsStartingQuiz(false)
    }
  }

  async function handleFocusHeartbeat() {
    if (!focusSessionId) return
    try {
      const result = await reportFocusHeartbeatFn({
        data: { sessionId: focusSessionId, clientHeartbeatAt: new Date().toISOString() },
      })
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

      const unlockedAchievements = [...result.unlockedAchievements]
      if (focusSessionId) {
        const focusResult = await endFocusSessionFn({ data: { sessionId: focusSessionId } })
        for (const key of focusResult.unlockedAchievements) {
          if (!unlockedAchievements.includes(key)) unlockedAchievements.push(key)
        }
      }
      for (const key of unlockedAchievements) {
        const definition = ACHIEVEMENT_MAP.get(key)
        if (definition) {
          celebrate({ type: 'achievement', title: definition.title, description: definition.description })
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to submit quiz')
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {backLink}

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
            {focusSessionId && (
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
