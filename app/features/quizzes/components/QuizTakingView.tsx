import { useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, ListChecks, LoaderCircle, Sparkles, Square, SquareCheck, XCircle } from 'lucide-react'
import { useQuizTaking } from '@/features/quizzes/hooks/useQuizzes'
import { isChoiceBasedType, isManualGradingType, type QuestionResponseData } from '@/features/quizzes/questionTypes'
import { useTranslation } from '@/features/i18n/I18nContext'
import { endFocusSessionFn, reportFocusHeartbeatFn, startAssignmentFn } from '@/features/focusMode'
import { ACHIEVEMENT_MAP } from '@/features/achievements/definitions'
import { useCelebration } from '@/features/celebration/CelebrationContext'
import { useWellness } from '@/features/wellness/hooks/useWellness'
import { MoodPicker } from '@/features/wellness/components/MoodPicker'
import { GameplayWorld } from '@/features/gameplay/components/GameplayWorld'
import { getStoredGameplayTheme } from '@/features/gameplay/gameplayThemes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface LocalAnswer {
  selectedChoiceId?: string
  selectedChoiceIds?: Array<string>
  responseData?: QuestionResponseData
}

// Deterministic (not Math.random) so the shuffle doesn't change across
// re-renders — seeded off the steps' own text so it's stable per question.
function seededShuffle(items: Array<string>): Array<string> {
  const seed = items.join('').split('').reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7)
  let state = seed || 1
  function nextRandom() {
    state = (state * 1103515245 + 12345) >>> 0
    return state / 0xffffffff
  }
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  // If the shuffle happened to land on the original (already-correct)
  // order, nudge it by swapping the first two items — showing the correct
  // order by default would hand the answer away for free.
  return result.join('|') === items.join('|') && result.length > 1 ? [result[1], result[0], ...result.slice(2)] : result
}

export function ReorderTaker({ steps, value, disabled, onChange }: { steps: Array<string>; value: Array<string> | undefined; disabled: boolean; onChange: (order: Array<string>) => void }) {
  // Never display `steps` (the correct order) directly — that would leak
  // the answer. Shuffle once per question, then let the student rearrange
  // from there; record the shuffled starting order as their answer even if
  // they never touch it, so "didn't reorder anything" is graded as their
  // actual (very likely wrong) answer rather than silently uncounted.
  const [shuffled] = useState(() => seededShuffle(steps))
  const order = value ?? shuffled
  useEffect(() => {
    if (!value) onChange(shuffled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function move(index: number, direction: -1 | 1) {
    const next = [...order]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }
  return (
    <div className="space-y-1">
      {order.map((step, index) => (
        <div key={step} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">{index + 1}</span>
          <span className="flex-1">{step}</span>
          {!disabled && (
            <div className="flex gap-1">
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="text-xs text-muted-foreground disabled:opacity-30">
                ↑
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === order.length - 1} className="text-xs text-muted-foreground disabled:opacity-30">
                ↓
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function MatchTaker({
  pairs,
  value,
  disabled,
  onChange,
}: {
  pairs: Array<{ left: string; right: string }>
  value: Array<{ left: string; right: string }> | undefined
  disabled: boolean
  onChange: (pairs: Array<{ left: string; right: string }>) => void
}) {
  const { t } = useTranslation()
  const rightOptions = pairs.map((p) => p.right)
  function setRightFor(left: string, right: string) {
    const current = value ?? []
    const next = current.filter((p) => p.left !== left)
    next.push({ left, right })
    onChange(next)
  }
  return (
    <div className="space-y-1">
      {pairs.map((pair) => {
        const selected = (value ?? []).find((p) => p.left === pair.left)?.right ?? ''
        return (
          <div key={pair.left} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2">
            <span className="rounded-md border border-border px-3 py-2 sm:w-1/2 sm:truncate">{pair.left}</span>
            <select
              disabled={disabled}
              value={selected}
              onChange={(e) => setRightFor(pair.left, e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm sm:w-1/2"
            >
              <option value="" disabled>
                {t('taking.chooseMatch')}
              </option>
              {rightOptions.map((right) => (
                <option key={right} value={right}>
                  {right}
                </option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}

export function CategorizeTaker({
  config,
  value,
  disabled,
  onChange,
}: {
  config: { categories: Array<string>; items: Array<{ text: string; category: string }> }
  value: Array<{ text: string; category: string }> | undefined
  disabled: boolean
  onChange: (assignments: Array<{ text: string; category: string }>) => void
}) {
  const { t } = useTranslation()
  function setCategoryFor(text: string, category: string) {
    const current = value ?? []
    const next = current.filter((a) => a.text !== text)
    next.push({ text, category })
    onChange(next)
  }
  return (
    <div className="space-y-1">
      {config.items.map((item) => {
        const selected = (value ?? []).find((a) => a.text === item.text)?.category ?? ''
        return (
          <div key={item.text} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2">
            <span className="rounded-md border border-border px-3 py-2 sm:w-1/2 sm:truncate">{item.text}</span>
            <select
              disabled={disabled}
              value={selected}
              onChange={(e) => setCategoryFor(item.text, e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm sm:w-1/2"
            >
              <option value="" disabled>
                {t('taking.chooseCategory')}
              </option>
              {config.categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        )
      })}
    </div>
  )
}

export function TableFillTaker({
  config,
  value,
  disabled,
  onChange,
}: {
  config: { rows: Array<string>; columns: Array<string> }
  value: Record<string, string> | undefined
  disabled: boolean
  onChange: (answers: Record<string, string>) => void
}) {
  const { t } = useTranslation()
  const answers = value ?? {}
  return (
    <div className="space-y-1">
      {config.rows.map((row) =>
        config.columns.map((col) => {
          const key = `${row}|${col}`
          return (
            <div key={key} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2">
              <span className="text-xs text-muted-foreground sm:w-32 sm:shrink-0 sm:truncate sm:text-sm">
                {row} × {col}
              </span>
              <Input disabled={disabled} value={answers[key] ?? ''} onChange={(e) => onChange({ ...answers, [key]: e.target.value })} placeholder={t('taking.yourAnswerPlaceholder')} />
            </div>
          )
        }),
      )}
    </div>
  )
}

// Shared by both the class-scoped quiz route and the classless
// (admin/public-content) quiz route — quiz-taking itself never depended on
// classId, only the "back" link at the top of the page did, so that's the
// one thing the caller supplies rather than this component assuming a
// class context exists.
export function QuizTakingView({ quizId, backLink }: { quizId: string; backLink: ReactNode }) {
  const { quiz, isLoading, startAttempt, isStarting, submitQuiz, isSubmitting } = useQuizTaking(quizId)
  const { celebrate } = useCelebration()
  const { t } = useTranslation()
  const { checkIn: logMood } = useWellness()
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({})
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [isStartingQuiz, setIsStartingQuiz] = useState(false)
  const [focusSessionId, setFocusSessionId] = useState<string | null>(null)
  const [verifiedMinutes, setVerifiedMinutes] = useState<number | null>(null)
  const [focusHeartbeatError, setFocusHeartbeatError] = useState<string | null>(null)
  const [preMood, setPreMood] = useState<number | null>(null)
  const [postMood, setPostMood] = useState<number | null>(null)
  const [replayGraded, setReplayGraded] = useState<Array<boolean | null> | null>(null)
  const [replayStep, setReplayStep] = useState(0)
  const pendingCelebrationRef = useRef<(() => void) | null>(null)
  const [gameplayTheme] = useState(() => getStoredGameplayTheme())

  const hasSubmitted = !!quiz?.attempt?.submittedAt

  // After submitting, step through each question's real result one at a
  // time so the GameplayWorld can animate the "journey" before the
  // celebration overlay fires — same honest per-question data the score
  // card already shows, just paced out instead of dumped all at once.
  useEffect(() => {
    if (!replayGraded) return
    if (replayStep >= replayGraded.length) {
      pendingCelebrationRef.current?.()
      pendingCelebrationRef.current = null
      setReplayGraded(null)
      return
    }
    const timer = setTimeout(() => setReplayStep((s) => s + 1), 700)
    return () => clearTimeout(timer)
  }, [replayGraded, replayStep])

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
        <p className="text-sm text-muted-foreground">{t('taking.notFound')}</p>
      </div>
    )
  }

  async function handleStart() {
    setIsStartingQuiz(true)
    // Best-effort — an optional mood check should never block starting the quiz.
    if (preMood) logMood({ mood: preMood }).catch(() => {})
    try {
      const startResult = await startAssignmentFn({ data: { quizId, startMethod: 'web' } })
      setFocusSessionId(startResult.sessionId)
      sessionStorage.setItem(`focusflow.focusSessionId.${quizId}`, startResult.sessionId)
      if (startResult.startXPAwarded > 0) {
        toast.success(startResult.message)
      }
      await startAttempt()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('taking.failedToStart'))
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
        answers: quiz!.questions.map((q) => ({
          questionId: q.id,
          selectedChoiceId: answers[q.id]?.selectedChoiceId ?? null,
          selectedChoiceIds: answers[q.id]?.selectedChoiceIds,
          responseData: answers[q.id]?.responseData as Record<string, unknown> | undefined,
        })),
      })
      const unlockedAchievements = [...result.unlockedAchievements]
      if (focusSessionId) {
        const focusResult = await endFocusSessionFn({ data: { sessionId: focusSessionId } })
        for (const key of focusResult.unlockedAchievements) {
          if (!unlockedAchievements.includes(key)) unlockedAchievements.push(key)
        }
      }

      pendingCelebrationRef.current = () => {
        celebrate({ type: 'quiz', title: quiz!.title, score: result.score ?? 0, maxScore: result.maxScore })
        for (const key of unlockedAchievements) {
          const definition = ACHIEVEMENT_MAP.get(key)
          if (definition) {
            celebrate({ type: 'achievement', title: definition.title, description: definition.description })
          }
        }
      }
      setReplayStep(0)
      setReplayGraded(result.graded.map((g) => g.isCorrect))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('taking.failedToSubmit'))
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
                {t('taking.challengeMode')}
              </Badge>
              {quiz.timeLimitMinutes && (
                <Badge variant="outline">
                  {timeLeft !== null
                    ? `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')} ${t('taking.left')}`
                    : `${quiz.timeLimitMinutes} ${t('taking.minLimit')}`}
                </Badge>
              )}
            </div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">{quiz.title}</h1>
            {quiz.description && <p className="mt-1 text-sm text-muted-foreground">{quiz.description}</p>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {quiz.dueDate && (
              <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
                {t('taking.due')} {new Date(quiz.dueDate).toLocaleDateString()}
              </span>
            )}
            <span className="rounded-full border border-border/70 bg-background/80 px-3 py-1">
              {quiz.questions.length} {quiz.questions.length === 1 ? t('taking.question') : t('taking.questions')}
            </span>
            {focusSessionId && (
              <span className="rounded-full border border-success/70 bg-success/10 px-3 py-1 text-success">
                {t('taking.focusModeActive')}
                {verifiedMinutes !== null ? ` · ${verifiedMinutes} ${t('taking.minVerified')}` : ''}
              </span>
            )}
          </div>
        </div>
      </div>

      {quiz.attempt && (
        <div className="mb-6">
          <GameplayWorld
            theme={gameplayTheme}
            totalSteps={quiz.questions.length}
            stepsCompleted={replayGraded ? replayStep : hasSubmitted ? quiz.questions.length : 0}
            lastResult={replayGraded && replayStep > 0 ? (replayGraded[replayStep - 1] === true ? 'correct' : replayGraded[replayStep - 1] === false ? 'incorrect' : null) : null}
            resultKey={`replay-${replayStep}`}
          />
        </div>
      )}

      {hasSubmitted && (
        <Card className="mb-6 border-primary/30 bg-primary/5">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">{t('taking.yourScore')}</span>
              <Badge className="text-sm">
                {quiz.attempt!.score}/{quiz.attempt!.maxScore}
              </Badge>
            </div>
            <div className="flex flex-col items-center gap-2 border-t border-primary/20 pt-3">
              <p className="text-xs text-muted-foreground">{postMood ? t('taking.moodThanks') : t('taking.howFeelingAfter')}</p>
              <MoodPicker
                value={postMood}
                onChange={(mood) => {
                  setPostMood(mood)
                  logMood({ mood }).catch(() => {})
                }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {!quiz.attempt ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {t('taking.focusOn')} {quiz.title}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-foreground">
                <ListChecks className="size-3.5 text-muted-foreground" />
                {quiz.questions.length} {quiz.questions.length === 1 ? t('taking.question') : t('taking.questions')}
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" />
                {t('taking.reward')} +{quiz.questions.reduce((sum, q) => sum + q.points, 0)} XP
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-muted-foreground">{t('taking.howFeelingBefore')}</p>
              <MoodPicker value={preMood} onChange={setPreMood} />
            </div>
            <Button onClick={handleStart} disabled={isStarting || isStartingQuiz} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              {(isStarting || isStartingQuiz) && <LoaderCircle className="size-4 animate-spin" />}
              {t('taking.startQuiz')}
            </Button>
            {focusHeartbeatError && (
              <p className="text-xs text-destructive">
                {t('taking.focusSyncError')} {focusHeartbeatError}
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {quiz.questions.map((question, index) => {
            const myStoredAnswer = quiz.myAnswers.find((a) => a.questionId === question.id)
            const current = hasSubmitted
              ? { selectedChoiceId: myStoredAnswer?.selectedChoiceId ?? undefined, selectedChoiceIds: myStoredAnswer?.selectedChoiceIds, responseData: myStoredAnswer?.responseData ?? undefined }
              : answers[question.id]

            function setAnswer(next: LocalAnswer) {
              setAnswers((prev) => ({ ...prev, [question.id]: next }))
            }

            return (
              <Card key={question.id}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-foreground">
                    {index + 1}. {question.questionText}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({question.points} {question.points === 1 ? t('taking.pt') : t('taking.pts')})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {isChoiceBasedType(question.questionType) && question.questionType !== 'multi_select' && (
                    <div className="space-y-1">
                      {question.choices.map((choice) => {
                        const isSelected = current?.selectedChoiceId === choice.id
                        const showCorrectness = hasSubmitted && choice.isCorrect !== undefined && question.questionType !== 'poll'
                        return (
                          <button
                            key={choice.id}
                            type="button"
                            disabled={hasSubmitted}
                            onClick={() => setAnswer({ selectedChoiceId: choice.id })}
                            className={cn(
                              'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                              isSelected && !hasSubmitted && 'border-primary bg-primary/10',
                              !isSelected && !hasSubmitted && 'border-border hover:bg-secondary/50',
                              showCorrectness && choice.isCorrect && 'border-primary bg-primary/10 text-primary',
                              showCorrectness && isSelected && !choice.isCorrect && 'border-destructive bg-destructive/10 text-destructive',
                              showCorrectness && !isSelected && !choice.isCorrect && 'border-border text-muted-foreground',
                              hasSubmitted && question.questionType === 'poll' && isSelected && 'border-primary bg-primary/10',
                            )}
                          >
                            {choice.choiceText}
                            {showCorrectness && choice.isCorrect && <CheckCircle2 className="size-4 shrink-0" />}
                            {showCorrectness && isSelected && !choice.isCorrect && <XCircle className="size-4 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {question.questionType === 'multi_select' && (
                    <div className="space-y-1">
                      {question.choices.map((choice) => {
                        const selectedIds = current?.selectedChoiceIds ?? []
                        const isSelected = selectedIds.includes(choice.id)
                        const showCorrectness = hasSubmitted && choice.isCorrect !== undefined
                        return (
                          <button
                            key={choice.id}
                            type="button"
                            disabled={hasSubmitted}
                            onClick={() =>
                              setAnswer({ selectedChoiceIds: isSelected ? selectedIds.filter((id) => id !== choice.id) : [...selectedIds, choice.id] })
                            }
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                              isSelected && !hasSubmitted && 'border-primary bg-primary/10',
                              !isSelected && !hasSubmitted && 'border-border hover:bg-secondary/50',
                              showCorrectness && choice.isCorrect && 'border-primary bg-primary/10 text-primary',
                              showCorrectness && isSelected && !choice.isCorrect && 'border-destructive bg-destructive/10 text-destructive',
                            )}
                          >
                            {isSelected ? <SquareCheck className="size-4 shrink-0" /> : <Square className="size-4 shrink-0" />}
                            {choice.choiceText}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {question.questionType === 'fill_blank' && (
                    <Input
                      disabled={hasSubmitted}
                      value={(current?.responseData?.kind === 'fill_blank' ? current.responseData.answer : '') ?? ''}
                      onChange={(e) => setAnswer({ responseData: { kind: 'fill_blank', answer: e.target.value } })}
                      placeholder={t('taking.yourAnswerPlaceholder')}
                    />
                  )}

                  {question.questionType === 'open_ended' && (
                    <Textarea
                      disabled={hasSubmitted}
                      value={(current?.responseData?.kind === 'open_ended' ? current.responseData.answer : '') ?? ''}
                      onChange={(e) => setAnswer({ responseData: { kind: 'open_ended', answer: e.target.value } })}
                      rows={3}
                      placeholder={t('taking.yourAnswerPlaceholder')}
                    />
                  )}

                  {question.questionType === 'reorder' && question.answerConfig?.kind === 'reorder' && (
                    <ReorderTaker
                      steps={question.answerConfig.correctOrder}
                      value={current?.responseData?.kind === 'reorder' ? current.responseData.order : undefined}
                      disabled={hasSubmitted}
                      onChange={(order) => setAnswer({ responseData: { kind: 'reorder', order } })}
                    />
                  )}

                  {question.questionType === 'match' && question.answerConfig?.kind === 'match' && (
                    <MatchTaker
                      pairs={question.answerConfig.pairs}
                      value={current?.responseData?.kind === 'match' ? current.responseData.pairs : undefined}
                      disabled={hasSubmitted}
                      onChange={(pairs) => setAnswer({ responseData: { kind: 'match', pairs } })}
                    />
                  )}

                  {question.questionType === 'categorize' && question.answerConfig?.kind === 'categorize' && (
                    <CategorizeTaker
                      config={question.answerConfig}
                      value={current?.responseData?.kind === 'categorize' ? current.responseData.assignments : undefined}
                      disabled={hasSubmitted}
                      onChange={(assignments) => setAnswer({ responseData: { kind: 'categorize', assignments } })}
                    />
                  )}

                  {question.questionType === 'table_fill' && question.answerConfig?.kind === 'table_fill' && (
                    <TableFillTaker
                      config={question.answerConfig}
                      value={current?.responseData?.kind === 'table_fill' ? current.responseData.answers : undefined}
                      disabled={hasSubmitted}
                      onChange={(answersRecord) => setAnswer({ responseData: { kind: 'table_fill', answers: answersRecord } })}
                    />
                  )}

                  {isManualGradingType(question.questionType) && (
                    <Textarea
                      disabled={hasSubmitted}
                      value={(current?.responseData?.kind === 'manual' ? current.responseData.text : '') ?? ''}
                      onChange={(e) => setAnswer({ responseData: { kind: 'manual', text: e.target.value } })}
                      rows={3}
                      placeholder={t('taking.manualGradingPlaceholder')}
                    />
                  )}

                  {hasSubmitted && myStoredAnswer && (myStoredAnswer.responseData || (myStoredAnswer.selectedChoiceIds?.length ?? 0) > 0) && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      {question.questionType === 'poll'
                        ? t('taking.pollThanks')
                        : isManualGradingType(question.questionType) || question.questionType === 'open_ended'
                          ? t('taking.awaitingReview')
                          : null}
                    </p>
                  )}
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
              {t('taking.submitQuiz')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
