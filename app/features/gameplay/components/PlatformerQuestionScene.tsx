import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Sparkles, Volume2, VolumeX, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { playCorrectSound, playJumpSound, playWrongSound } from '@/lib/sound'

// The single shared jump-to-answer mechanic, extracted from the landing
// page's ArcadeDemoGame so every real playing surface (live games, async
// quizzes, teacher preview) uses the literal same component, not a
// lookalike — see app/components/marketing/ArcadeDemoGame.tsx, which was
// refactored to consume this too. A controlled component: the caller owns
// all state (selection, lock, reveal) and answer submission; this only
// renders the scene and reports clicks via onSelect.
const ZONE_WIDTH = 250
const PLATFORM_X_IN_ZONE = [35, 100, 165, 230]
const PLATFORM_HEIGHTS = [50, 140, 45, 105]
const GROUND_Y = 0
const VIEW_ANCHOR_X = 150
export const PLATFORMER_SCENE_HEIGHT = 360
const DECORATIONS = ['/assets/roadmap/tree-pine.png', '/assets/roadmap/bush.png', '/assets/roadmap/rock-1.png', '/assets/roadmap/rock-2.png']

function zoneStartX(questionIndex: number) {
  return questionIndex * ZONE_WIDTH + 35
}

function platformPos(questionIndex: number, choiceIndex: number) {
  const x = PLATFORM_X_IN_ZONE[choiceIndex % PLATFORM_X_IN_ZONE.length]
  const y = PLATFORM_HEIGHTS[choiceIndex % PLATFORM_HEIGHTS.length]
  return { x: zoneStartX(questionIndex) + x, y }
}

function ReactionEmoji({ symbol, atX, atY }: { symbol: string; atX: number; atY: number }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10, scale: 0.5 }}
      animate={{ opacity: [0, 1, 1, 0], y: [10, -10, -18, -26], scale: [0.5, 1.2, 1.1, 1] }}
      transition={{ duration: 1, times: [0, 0.25, 0.7, 1] }}
      className="pointer-events-none absolute text-2xl"
      style={{ left: atX, bottom: 70 + atY + 60 }}
    >
      {symbol}
    </motion.span>
  )
}

export interface PlatformerChoice {
  id: string
  text: string
}

export interface PlatformerQuestionSceneProps {
  questionText: string
  choices: Array<PlatformerChoice>
  questionNumber: number
  totalQuestions: number
  /** Correct/incorrect for each PREVIOUS question, in order — drives the breadcrumb trail. */
  history: Array<boolean>
  selectedChoiceId: string | null
  /** True once this question is locked in (answered, awaiting/showing reveal). */
  locked: boolean
  /** Only set once reveal is allowed for THIS question — never send this before that point, it's the answer key. */
  correctChoiceId?: string | null
  onSelect: (choiceId: string) => void
  score?: number
  muted?: boolean
  onToggleMute?: () => void
  className?: string
}

export function PlatformerQuestionScene({
  questionText,
  choices,
  questionNumber,
  totalQuestions,
  history,
  selectedChoiceId,
  locked,
  correctChoiceId,
  onSelect,
  score,
  muted,
  onToggleMute,
  className,
}: PlatformerQuestionSceneProps) {
  const questionIndex = questionNumber - 1
  const reveal = locked && correctChoiceId !== undefined && correctChoiceId !== null
  const selectedIndex = selectedChoiceId ? choices.findIndex((c) => c.id === selectedChoiceId) : -1
  const lastResult: 'idle' | 'correct' | 'wrong' = !reveal || selectedIndex < 0 ? 'idle' : selectedChoiceId === correctChoiceId ? 'correct' : 'wrong'
  const prevResultRef = useRef<'idle' | 'correct' | 'wrong'>('idle')

  useEffect(() => {
    if (lastResult !== 'idle' && prevResultRef.current === 'idle') {
      const timer = setTimeout(() => (lastResult === 'correct' ? playCorrectSound() : playWrongSound()), 60)
      prevResultRef.current = lastResult
      return () => clearTimeout(timer)
    }
    prevResultRef.current = lastResult
  }, [lastResult])

  const avatarTarget = useMemo(() => {
    if (selectedIndex >= 0) return platformPos(questionIndex, selectedIndex)
    if (history.length === 0) return { x: 0, y: GROUND_Y }
    // Previous questions' exact chosen platform isn't tracked here — the
    // zone center is a fine, deterministic stand-in for "somewhere in the
    // previous zone" since only the breadcrumb's correct/incorrect color
    // carries real information, not its exact x/y.
    const prevIndex = questionIndex - 1
    const center = zoneStartX(prevIndex) + (Math.min(...PLATFORM_X_IN_ZONE) + Math.max(...PLATFORM_X_IN_ZONE)) / 2
    return { x: center, y: 0 }
  }, [selectedIndex, questionIndex, history.length])

  const zoneCenterX = zoneStartX(questionIndex) + (Math.min(...PLATFORM_X_IN_ZONE) + Math.max(...PLATFORM_X_IN_ZONE)) / 2
  const cameraX = Math.min(0, -(zoneCenterX - VIEW_ANCHOR_X))

  const decorations = useMemo(
    () => Array.from({ length: totalQuestions * 2 + 4 }, (_, i) => ({ x: i * 140 - 40, src: DECORATIONS[i % DECORATIONS.length], flip: i % 2 === 0 })),
    [totalQuestions],
  )

  function handleClick(choiceId: string) {
    if (locked) return
    playJumpSound()
    onSelect(choiceId)
  }

  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-border', className)} style={{ height: PLATFORMER_SCENE_HEIGHT }}>
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

      <motion.div
        className="absolute bottom-0 left-0 h-full"
        animate={{ x: cameraX }}
        transition={{ type: 'spring', stiffness: 90, damping: 18 }}
        style={{ width: totalQuestions * ZONE_WIDTH + 200 }}
      >
        <div className="absolute right-0 bottom-0 left-0 h-17.5 bg-linear-to-b from-role-teacher/70 to-role-teacher/90" />
        {decorations.map((d, i) => (
          <img key={i} src={d.src} alt="" aria-hidden className={cn('absolute bottom-17 w-10 opacity-90', d.flip && 'scale-x-[-1]')} style={{ left: d.x }} />
        ))}

        {history.map((correct, i) => {
          const center = zoneStartX(i) + (Math.min(...PLATFORM_X_IN_ZONE) + Math.max(...PLATFORM_X_IN_ZONE)) / 2
          return (
            <div
              key={i}
              className={cn(
                'absolute flex size-6 items-center justify-center rounded-full border-2 text-white',
                correct ? 'border-role-teacher bg-role-teacher' : 'border-destructive bg-destructive',
              )}
              style={{ left: center - 12, bottom: 70 - 12 }}
            >
              {correct ? <CheckCircle2 className="size-3.5" /> : <XCircle className="size-3.5" />}
            </div>
          )
        })}

        {choices.map((choice, index) => {
          const pos = platformPos(questionIndex, index)
          const isSelected = selectedChoiceId === choice.id
          const isCorrectChoice = reveal && choice.id === correctChoiceId
          return (
            <button
              key={choice.id}
              type="button"
              disabled={locked}
              onClick={() => handleClick(choice.id)}
              className={cn('absolute flex w-24 -translate-x-1/2 flex-col items-center transition-transform', !locked && 'hover:-translate-y-0.5')}
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
                {choice.text}
              </span>
              <span className="h-3 w-1.5 bg-amber-800/70" />
            </button>
          )
        })}

        <motion.img
          src="/assets/roadmap/avatar-walker.png"
          alt=""
          aria-hidden
          className="absolute bottom-17.5 size-14 -translate-x-1/2 object-contain"
          animate={{
            left: avatarTarget.x,
            bottom:
              lastResult === 'wrong'
                ? [70 + avatarTarget.y + 20, 70 + avatarTarget.y - 14, 70 + avatarTarget.y]
                : lastResult === 'correct'
                  ? [70 + avatarTarget.y, 70 + avatarTarget.y + 34, 70 + avatarTarget.y]
                  : 70 + avatarTarget.y,
            scaleY: lastResult === 'idle' ? 1 : lastResult === 'correct' ? [1, 1.25, 0.9, 1.08, 1] : [1, 0.75, 1.1, 0.92, 1],
            scaleX: lastResult === 'idle' ? 1 : lastResult === 'correct' ? [1, 0.85, 1.1, 0.95, 1] : [1, 1.15, 0.9, 1.05, 1],
            rotate: lastResult === 'idle' ? 0 : lastResult === 'correct' ? [0, -10, 8, 0] : [0, 18, -22, 6, 0],
            filter: lastResult === 'wrong' ? ['saturate(1)', 'saturate(0.4)', 'saturate(1)'] : 'saturate(1)',
          }}
          transition={{
            left: { type: 'spring', stiffness: 140, damping: 14 },
            bottom: { duration: 0.55, times: lastResult === 'idle' ? undefined : [0, 0.55, 1] },
            scaleY: { duration: 0.55 },
            scaleX: { duration: 0.55 },
            rotate: { duration: 0.55 },
            filter: { duration: 0.55 },
          }}
          style={{ transformOrigin: 'bottom center' }}
        />

        <AnimatePresence>
          {lastResult === 'correct' && <ReactionEmoji key="happy" symbol="🎉" atX={avatarTarget.x - 12} atY={avatarTarget.y} />}
          {lastResult === 'wrong' && <ReactionEmoji key="sad" symbol="😢" atX={avatarTarget.x - 12} atY={avatarTarget.y} />}
        </AnimatePresence>
      </motion.div>

      <div className="absolute top-3 right-3 left-3 flex items-center justify-between">
        <span className="rounded-full bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
          Question {questionNumber} of {totalQuestions}
        </span>
        <div className="flex items-center gap-2">
          {score !== undefined && (
            <span className="flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-xs font-semibold text-accent shadow-sm">
              <Sparkles className="size-3.5" />
              {score}
            </span>
          )}
          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              className="flex size-7 items-center justify-center rounded-full bg-background/85 text-muted-foreground shadow-sm hover:text-foreground"
            >
              {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
            </button>
          )}
        </div>
      </div>

      <div className="absolute top-11 right-3 left-3 flex justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={questionNumber}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className="max-w-md rounded-lg bg-background/90 px-4 py-2 text-center font-heading text-sm font-semibold text-foreground shadow-sm md:text-base"
          >
            {questionText}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
