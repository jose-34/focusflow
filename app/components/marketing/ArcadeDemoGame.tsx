import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, RotateCcw, Sparkles, X, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DEMO_QUESTIONS } from './demoQuestions'

const NUDGE_AFTER_CORRECT = 2
const ADVANCE_DELAY_MS = 1300

// Level geometry — a side-scrolling "camera" pans across this track as the
// player advances, rather than resetting to a fixed spot each question, so
// progress reads as movement through a level (matching the reference
// platformer this is modeled on) instead of a quiz that happens to have a
// mascot icon next to it.
const ZONE_WIDTH = 340
const PLATFORM_X_IN_ZONE = [55, 145, 235, 325]
const PLATFORM_HEIGHTS = [50, 140, 45, 105] // px above ground, deliberately uneven — a real jump, not a flat row
const GROUND_Y = 0
const GAME_HEIGHT = 360
const VIEW_ANCHOR_X = 230
const DECORATIONS = ['/assets/roadmap/tree-pine.png', '/assets/roadmap/bush.png', '/assets/roadmap/rock-1.png', '/assets/roadmap/rock-2.png']

function zoneStartX(questionIndex: number) {
  return questionIndex * ZONE_WIDTH + 50
}

function platformPos(questionIndex: number, choiceIndex: number) {
  return { x: zoneStartX(questionIndex) + PLATFORM_X_IN_ZONE[choiceIndex], y: PLATFORM_HEIGHTS[choiceIndex] }
}

type AnswerState = 'idle' | 'correct' | 'wrong'

export function ArcadeDemoGame() {
  const [questionIndex, setQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [finished, setFinished] = useState(false)
  const [pathTaken, setPathTaken] = useState<Array<{ x: number; y: number; correct: boolean }>>([])

  const question = DEMO_QUESTIONS[questionIndex]
  const showNudge = score >= NUDGE_AFTER_CORRECT && !nudgeDismissed && !finished

  const avatarTarget = useMemo(() => {
    if (selected !== null) return platformPos(questionIndex, selected)
    const last = pathTaken[pathTaken.length - 1]
    return last ? { x: last.x, y: last.y } : { x: 0, y: GROUND_Y }
  }, [selected, questionIndex, pathTaken])

  const cameraX = Math.min(0, -(avatarTarget.x - VIEW_ANCHOR_X))

  const decorations = useMemo(
    () =>
      Array.from({ length: DEMO_QUESTIONS.length * 2 + 4 }, (_, i) => ({
        x: i * 140 - 40,
        src: DECORATIONS[i % DECORATIONS.length],
        flip: i % 2 === 0,
      })),
    [],
  )

  function handleSelect(choiceIndex: number) {
    if (answerState !== 'idle' || !question) return
    const isCorrect = choiceIndex === question.correctIndex
    setSelected(choiceIndex)
    setAnswerState(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) setScore((s) => s + 1)

    setTimeout(() => {
      const landedPos = platformPos(questionIndex, choiceIndex)
      setPathTaken((p) => [...p, { ...landedPos, correct: isCorrect }])
      if (questionIndex + 1 >= DEMO_QUESTIONS.length) {
        setFinished(true)
      } else {
        setQuestionIndex((i) => i + 1)
        setSelected(null)
        setAnswerState('idle')
      }
    }, ADVANCE_DELAY_MS)
  }

  function handleReplay() {
    setQuestionIndex(0)
    setScore(0)
    setSelected(null)
    setAnswerState('idle')
    setFinished(false)
    setNudgeDismissed(false)
    setPathTaken([])
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
      <div className="relative overflow-hidden" style={{ height: GAME_HEIGHT }}>
        {/* Sky + mountains — fixed, doesn't scroll with the track, for parallax depth */}
        <div className="absolute inset-0 bg-linear-to-b from-sky-300 via-sky-100 to-accent/20" />
        <svg className="absolute right-0 bottom-17.5 left-0 h-24 w-full opacity-40" viewBox="0 0 400 100" preserveAspectRatio="none">
          <polygon points="0,100 60,30 130,100" fill="#8a97a8" />
          <polygon points="90,100 170,15 250,100" fill="#6f7d90" />
          <polygon points="220,100 300,40 380,100" fill="#8a97a8" />
        </svg>
        {[60, 220, 380].map((left, i) => (
          <motion.img
            key={i}
            src="/assets/roadmap/cloud.png"
            alt=""
            aria-hidden
            className="absolute top-6 w-20 opacity-80"
            style={{ left }}
            animate={{ x: [0, 14, 0] }}
            transition={{ duration: 8 + i * 2, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        {/* Scrolling track: ground, decorations, platforms, avatar all share this coordinate space */}
        <motion.div
          className="absolute bottom-0 left-0 h-full"
          animate={{ x: cameraX }}
          transition={{ type: 'spring', stiffness: 90, damping: 18 }}
          style={{ width: DEMO_QUESTIONS.length * ZONE_WIDTH + 200 }}
        >
          <div className="absolute right-0 bottom-0 left-0 h-17.5 bg-linear-to-b from-role-teacher/70 to-role-teacher/90" />
          {decorations.map((d, i) => (
            <img key={i} src={d.src} alt="" aria-hidden className={cn('absolute bottom-17 w-10 opacity-90', d.flip && 'scale-x-[-1]')} style={{ left: d.x }} />
          ))}

          {/* Breadcrumb markers for already-answered questions */}
          {pathTaken.map((p, i) => (
            <div
              key={i}
              className={cn(
                'absolute flex size-6 items-center justify-center rounded-full border-2 text-white',
                p.correct ? 'border-role-teacher bg-role-teacher' : 'border-destructive bg-destructive',
              )}
              style={{ left: p.x - 12, bottom: 70 + p.y - 12 }}
            >
              {p.correct ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
            </div>
          ))}

          {/* Current question's platforms */}
          {!finished &&
            question &&
            question.choices.map((choice, index) => {
              const pos = platformPos(questionIndex, index)
              const isSelected = selected === index
              const isCorrectChoice = index === question.correctIndex
              const reveal = answerState !== 'idle'
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={answerState !== 'idle'}
                  onClick={() => handleSelect(index)}
                  className={cn(
                    'absolute flex w-24 -translate-x-1/2 flex-col items-center transition-transform',
                    answerState === 'idle' && 'hover:-translate-y-0.5',
                  )}
                  style={{ left: pos.x, bottom: 70 + pos.y }}
                >
                  <span
                    className={cn(
                      'w-full rounded-lg border-2 px-2 py-2 text-center text-xs leading-tight font-semibold shadow-md',
                      !reveal && 'border-accent/60 bg-card text-foreground',
                      reveal && isCorrectChoice && 'border-role-teacher bg-role-teacher text-white',
                      reveal && isSelected && !isCorrectChoice && 'border-destructive bg-destructive text-white',
                      reveal && !isSelected && !isCorrectChoice && 'border-border bg-card text-muted-foreground opacity-60',
                    )}
                  >
                    {choice}
                  </span>
                  <span className="h-3 w-1.5 bg-amber-800/70" />
                </button>
              )
            })}

          {/* Avatar — real jump arc (x + y together) with a squash-stretch landing */}
          <motion.img
            src="/assets/roadmap/avatar-walker.png"
            alt=""
            aria-hidden
            className="absolute bottom-17.5 size-14 -translate-x-1/2 object-contain"
            animate={{
              left: avatarTarget.x,
              bottom: 70 + avatarTarget.y,
              scaleY: answerState === 'idle' ? [1] : [1, 1.15, 0.85, 1.05, 1],
              rotate: answerState === 'idle' ? 0 : [0, -8, 6, 0],
            }}
            transition={{
              left: { type: 'spring', stiffness: 140, damping: 14 },
              bottom: { type: 'spring', stiffness: 140, damping: 11 },
              scaleY: { duration: 0.5, times: [0, 0.3, 0.55, 0.8, 1] },
              rotate: { duration: 0.5 },
            }}
            style={{ transformOrigin: 'bottom center' }}
          />
        </motion.div>

        {/* HUD — fixed over the scene */}
        <div className="absolute top-3 right-3 left-3 flex items-center justify-between">
          <span className="rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
            Question {Math.min(questionIndex + 1, DEMO_QUESTIONS.length)} of {DEMO_QUESTIONS.length}
          </span>
          <span className="flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-xs font-semibold text-accent shadow-sm">
            <Sparkles className="size-3.5" />
            {score}
          </span>
        </div>

        {!finished && question && (
          <div className="absolute top-11 right-3 left-3 flex justify-center">
            <AnimatePresence mode="wait">
              <motion.p
                key={question.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
                className="max-w-md rounded-lg bg-background/90 px-4 py-2 text-center font-heading text-sm font-semibold text-foreground shadow-sm md:text-base"
              >
                {question.question}
              </motion.p>
            </AnimatePresence>
          </div>
        )}

        {finished && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 text-center backdrop-blur-sm"
          >
            <p className="font-heading text-3xl font-bold text-foreground">
              {score} / {DEMO_QUESTIONS.length} correct
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">That's just a taste — sign up free to track real progress, streaks, and achievements.</p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
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

      <AnimatePresence>
        {showNudge && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col items-center justify-between gap-3 border-t border-accent/30 bg-accent/10 px-4 py-3 sm:flex-row"
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
    </div>
  )
}
