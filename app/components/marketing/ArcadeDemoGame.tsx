import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, RotateCcw, Sparkles, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DEMO_QUESTIONS } from './demoQuestions'

const NUDGE_AFTER_CORRECT = 2
const ADVANCE_DELAY_CORRECT_MS = 900
const ADVANCE_DELAY_WRONG_MS = 1400

type AnswerState = 'idle' | 'correct' | 'wrong'

export function ArcadeDemoGame() {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [finished, setFinished] = useState(false)

  const question = DEMO_QUESTIONS[questionIndex]
  const showNudge = score >= NUDGE_AFTER_CORRECT && !nudgeDismissed && !finished
  const platformCount = question?.choices.length ?? 4
  const avatarSlot = selected ?? -1

  function handleSelect(choiceIndex: number) {
    if (answerState !== 'idle' || !question) return
    const isCorrect = choiceIndex === question.correctIndex
    setSelected(choiceIndex)
    setAnswerState(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) setScore((s) => s + 1)

    setTimeout(
      () => {
        if (questionIndex + 1 >= DEMO_QUESTIONS.length) {
          setFinished(true)
        } else {
          setQuestionIndex((i) => i + 1)
          setSelected(null)
          setAnswerState('idle')
        }
      },
      isCorrect ? ADVANCE_DELAY_CORRECT_MS : ADVANCE_DELAY_WRONG_MS,
    )
  }

  function handleReplay() {
    setQuestionIndex(0)
    setScore(0)
    setSelected(null)
    setAnswerState('idle')
    setFinished(false)
    setNudgeDismissed(false)
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-accent/10 via-background to-role-teacher/10 p-6 md:p-8">
      {!finished ? (
        <>
          <div className="mb-6 flex items-center justify-between">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Question {questionIndex + 1} of {DEMO_QUESTIONS.length}
            </span>
            <span className="flex items-center gap-1 text-xs font-semibold text-accent">
              <Sparkles className="size-3.5" />
              {score} correct
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.h3
              key={question.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mb-8 text-center font-heading text-xl font-semibold text-foreground md:text-2xl"
            >
              {question.question}
            </motion.h3>
          </AnimatePresence>

          {/* Track: avatar hops between platform buttons below it */}
          <div className="relative h-16">
            <motion.img
              src="/assets/roadmap/avatar-walker.png"
              alt=""
              aria-hidden
              className="absolute bottom-0 size-14 -translate-x-1/2 object-contain"
              animate={{
                left: avatarSlot >= 0 ? `${(100 / platformCount) * (avatarSlot + 0.5)}%` : '0%',
                y: answerState === 'idle' ? 0 : [0, -28, 0],
              }}
              transition={{ left: { type: 'spring', stiffness: 260, damping: 20 }, y: { duration: 0.5, ease: 'easeOut' } }}
            />
          </div>

          <div className={cn('grid gap-3', platformCount <= 2 ? 'grid-cols-2' : platformCount === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4')}>
            {question.choices.map((choice, index) => {
              const isSelected = selected === index
              const isCorrectChoice = index === question.correctIndex
              const reveal = answerState !== 'idle'
              return (
                <motion.button
                  key={choice}
                  type="button"
                  disabled={answerState !== 'idle'}
                  onClick={() => handleSelect(index)}
                  whileHover={answerState === 'idle' ? { y: -3 } : undefined}
                  whileTap={answerState === 'idle' ? { scale: 0.96 } : undefined}
                  animate={isSelected && answerState === 'wrong' ? { x: [0, -6, 6, -6, 0] } : {}}
                  transition={{ duration: 0.35 }}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-xl border-2 px-3 py-3 text-sm font-medium transition-colors',
                    !reveal && 'border-border bg-card hover:border-accent/50 hover:bg-accent/5',
                    reveal && isCorrectChoice && 'border-role-teacher bg-role-teacher/15 text-role-teacher',
                    reveal && isSelected && !isCorrectChoice && 'border-destructive bg-destructive/10 text-destructive',
                    reveal && !isSelected && !isCorrectChoice && 'border-border bg-card opacity-50',
                  )}
                >
                  {reveal && isCorrectChoice && <CheckCircle2 className="size-4 shrink-0" />}
                  {reveal && isSelected && !isCorrectChoice && <XCircle className="size-4 shrink-0" />}
                  {choice}
                </motion.button>
              )
            })}
          </div>

          <AnimatePresence>
            {showNudge && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                className="mt-6 flex flex-col items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 sm:flex-row"
              >
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Nice going!</span> Create a free account to save this progress and keep playing.
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <Link to="/register">Sign Up Free</Link>
                  </Button>
                  <button
                    type="button"
                    onClick={() => setNudgeDismissed(true)}
                    aria-label="Dismiss"
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-6 text-center">
          <img src="/assets/roadmap/avatar-walker.png" alt="" aria-hidden className="size-16 object-contain" />
          <div>
            <p className="font-heading text-2xl font-bold text-foreground">
              {score} / {DEMO_QUESTIONS.length} correct
            </p>
            <p className="mt-1 text-sm text-muted-foreground">That's just a taste — sign up free to track real progress, streaks, and achievements.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/register">Sign Up Free to Save Progress</Link>
            </Button>
            <Button size="lg" variant="outline" onClick={handleReplay} className="gap-2">
              <RotateCcw className="size-4" />
              Play Again
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
