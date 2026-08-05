import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, LoaderCircle, Square, SquareCheck, XCircle } from 'lucide-react'
import { getQuizAuthoringFn, type QuizAuthoringDetail } from '@/features/quizzes/hooks/useQuizzes'
import { isChoiceBasedType, isManualGradingType, type QuestionResponseData } from '@/features/quizzes/questionTypes'
import { gradeAnswer } from '@/features/quizzes/grading'
import { ReorderTaker, MatchTaker, CategorizeTaker, TableFillTaker } from '@/features/quizzes/components/QuizTakingView'
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

// A teacher-only, no-side-effects walkthrough of a quiz: no attempt row, no
// XP/coins, no focus-session tracking, grading happens entirely client-side
// via the same gradeAnswer() the real submit path uses. Reuses
// getQuizAuthoringFn's query cache (same queryKey as useQuizAuthoring) so
// opening this from a page that's already loaded the quiz is instant.
export function QuizPreview({ quizId }: { quizId: string }) {
  const { data: quiz, isLoading } = useQuery<QuizAuthoringDetail>({
    queryKey: ['quizzes', 'authoring', quizId],
    queryFn: () => getQuizAuthoringFn({ data: { quizId } }),
  })
  const [answers, setAnswers] = useState<Record<string, LocalAnswer>>({})
  const [submitted, setSubmitted] = useState(false)
  const [showImmediateFeedback, setShowImmediateFeedback] = useState(true)

  if (isLoading) {
    return (
      <div className="py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
      </div>
    )
  }
  if (!quiz) return <p className="py-10 text-center text-sm text-muted-foreground">Quiz not found.</p>
  if (quiz.questions.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">Add at least one question to preview this quiz.</p>

  let scored = 0
  let maxScore = 0
  if (submitted) {
    for (const question of quiz.questions) {
      maxScore += question.points
      const { pointsEarned } = gradeAnswer(question, answers[question.id] ?? {})
      scored += pointsEarned
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-secondary/40 p-3">
        <div>
          <p className="text-sm font-medium text-foreground">Preview mode</p>
          <p className="text-xs text-muted-foreground">Nothing here is saved. No attempt, XP, or coins are recorded.</p>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-background p-0.5">
          <button
            type="button"
            onClick={() => setShowImmediateFeedback(true)}
            className={cn('rounded px-2.5 py-1 text-xs font-medium transition-colors', showImmediateFeedback ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            Classic Mode
          </button>
          <button
            type="button"
            onClick={() => setShowImmediateFeedback(false)}
            className={cn('rounded px-2.5 py-1 text-xs font-medium transition-colors', !showImmediateFeedback ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            Test Mode
          </button>
        </div>
      </div>

      {submitted && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between py-4">
            <span className="text-sm font-medium text-foreground">Score</span>
            <Badge className="text-sm">{scored}/{maxScore}</Badge>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {quiz.questions.map((question, index) => {
          const current = answers[question.id]
          function setAnswer(next: LocalAnswer) {
            setAnswers((prev) => ({ ...prev, [question.id]: next }))
          }
          const showCorrectness = submitted && showImmediateFeedback && question.questionType !== 'poll'

          return (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-foreground">
                  {index + 1}. {question.questionText} <span className="text-xs font-normal text-muted-foreground">({question.points} pt{question.points === 1 ? '' : 's'})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {isChoiceBasedType(question.questionType) && question.questionType !== 'multi_select' && (
                  <div className="space-y-1">
                    {question.choices.map((choice) => {
                      const isSelected = current?.selectedChoiceId === choice.id
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          disabled={submitted}
                          onClick={() => setAnswer({ selectedChoiceId: choice.id })}
                          className={cn(
                            'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors',
                            isSelected && !submitted && 'border-primary bg-primary/10',
                            !isSelected && !submitted && 'border-border hover:bg-secondary/50',
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
                  </div>
                )}

                {question.questionType === 'multi_select' && (
                  <div className="space-y-1">
                    {question.choices.map((choice) => {
                      const selectedIds = current?.selectedChoiceIds ?? []
                      const isSelected = selectedIds.includes(choice.id)
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          disabled={submitted}
                          onClick={() => setAnswer({ selectedChoiceIds: isSelected ? selectedIds.filter((id) => id !== choice.id) : [...selectedIds, choice.id] })}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                            isSelected && !submitted && 'border-primary bg-primary/10',
                            !isSelected && !submitted && 'border-border hover:bg-secondary/50',
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
                    disabled={submitted}
                    value={(current?.responseData?.kind === 'fill_blank' ? current.responseData.answer : '') ?? ''}
                    onChange={(e) => setAnswer({ responseData: { kind: 'fill_blank', answer: e.target.value } })}
                    placeholder="Your answer"
                  />
                )}

                {question.questionType === 'open_ended' && (
                  <Textarea
                    disabled={submitted}
                    value={(current?.responseData?.kind === 'open_ended' ? current.responseData.answer : '') ?? ''}
                    onChange={(e) => setAnswer({ responseData: { kind: 'open_ended', answer: e.target.value } })}
                    rows={3}
                    placeholder="Your answer"
                  />
                )}

                {question.questionType === 'reorder' && question.answerConfig?.kind === 'reorder' && (
                  <ReorderTaker
                    steps={question.answerConfig.correctOrder}
                    value={current?.responseData?.kind === 'reorder' ? current.responseData.order : undefined}
                    disabled={submitted}
                    onChange={(order) => setAnswer({ responseData: { kind: 'reorder', order } })}
                  />
                )}

                {question.questionType === 'match' && question.answerConfig?.kind === 'match' && (
                  <MatchTaker
                    pairs={question.answerConfig.pairs}
                    value={current?.responseData?.kind === 'match' ? current.responseData.pairs : undefined}
                    disabled={submitted}
                    onChange={(pairs) => setAnswer({ responseData: { kind: 'match', pairs } })}
                  />
                )}

                {question.questionType === 'categorize' && question.answerConfig?.kind === 'categorize' && (
                  <CategorizeTaker
                    config={question.answerConfig}
                    value={current?.responseData?.kind === 'categorize' ? current.responseData.assignments : undefined}
                    disabled={submitted}
                    onChange={(assignments) => setAnswer({ responseData: { kind: 'categorize', assignments } })}
                  />
                )}

                {question.questionType === 'table_fill' && question.answerConfig?.kind === 'table_fill' && (
                  <TableFillTaker
                    config={question.answerConfig}
                    value={current?.responseData?.kind === 'table_fill' ? current.responseData.answers : undefined}
                    disabled={submitted}
                    onChange={(answersRecord) => setAnswer({ responseData: { kind: 'table_fill', answers: answersRecord } })}
                  />
                )}

                {isManualGradingType(question.questionType) && (
                  <Textarea
                    disabled={submitted}
                    value={(current?.responseData?.kind === 'manual' ? current.responseData.text : '') ?? ''}
                    onChange={(e) => setAnswer({ responseData: { kind: 'manual', text: e.target.value } })}
                    rows={3}
                    placeholder="Sample response, graded manually"
                  />
                )}

                {submitted && showImmediateFeedback && question.questionType === 'poll' && (
                  <p className="pt-1 text-xs text-muted-foreground">Polls have no correct answer.</p>
                )}
                {submitted && showImmediateFeedback && (isManualGradingType(question.questionType) || question.questionType === 'open_ended') && (
                  <p className="pt-1 text-xs text-muted-foreground">This type is graded manually by the teacher.</p>
                )}
              </CardContent>
            </Card>
          )
        })}

        {!submitted && (
          <Button onClick={() => setSubmitted(true)} className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            Submit Preview
          </Button>
        )}
        {submitted && (
          <Button variant="outline" onClick={() => { setSubmitted(false); setAnswers({}) }} className="w-full gap-2">
            <LoaderCircle className="hidden size-4" />
            Restart Preview
          </Button>
        )}
      </div>
    </div>
  )
}
