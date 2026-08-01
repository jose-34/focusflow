import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { playBreatheHoldSound, playBreatheInSound, playBreatheOutSound, playCalmCompleteSound } from '@/lib/sound'

type Phase = 'inhale' | 'hold' | 'exhale'

const PHASE_DURATIONS: Record<Phase, number> = {
  inhale: 4,
  hold: 7,
  exhale: 8,
}

const PHASE_LABELS: Record<Phase, string> = {
  inhale: 'Breathe in',
  hold: 'Hold',
  exhale: 'Breathe out',
}

const PHASE_SCALE: Record<Phase, number> = {
  inhale: 1.4,
  hold: 1.4,
  exhale: 1,
}

const PHASE_SOUND: Record<Phase, () => void> = {
  inhale: playBreatheInSound,
  hold: playBreatheHoldSound,
  exhale: playBreatheOutSound,
}

const CYCLES_FOR_COMPLETION = 3

function nextPhase(phase: Phase): Phase {
  if (phase === 'inhale') return 'hold'
  if (phase === 'hold') return 'exhale'
  return 'inhale'
}

// No XP, no achievement, no score anywhere in here, deliberately — this is
// a pure wellbeing feature. Principle 1 (docs/12_Gamification_Framework.md
// §2, §9): XP only ever comes from a verified learning action, and a
// breathing exercise is the opposite of that by design — it's supposed to
// be the moment nothing is being measured.
export function BreathingExercise({ onComplete }: { onComplete?: () => void } = {}) {
  const [isActive, setIsActive] = useState(false)
  const [phase, setPhase] = useState<Phase>('inhale')
  const [secondsLeft, setSecondsLeft] = useState(PHASE_DURATIONS.inhale)
  const [cyclesCompleted, setCyclesCompleted] = useState(0)
  const [showComplete, setShowComplete] = useState(false)
  const hasPlayedPhaseSound = useRef<Phase | null>(null)

  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setPhase((currentPhase) => {
            const next = nextPhase(currentPhase)
            if (currentPhase === 'exhale') {
              setCyclesCompleted((c) => c + 1)
            }
            return next
          })
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [isActive])

  useEffect(() => {
    if (secondsLeft === 0 && isActive) {
      setSecondsLeft(PHASE_DURATIONS[phase])
    }
  }, [phase, isActive, secondsLeft])

  // Play each phase's cue exactly once per phase entry, not once per second.
  useEffect(() => {
    if (!isActive || hasPlayedPhaseSound.current === phase) return
    hasPlayedPhaseSound.current = phase
    PHASE_SOUND[phase]()
  }, [phase, isActive])

  useEffect(() => {
    if (cyclesCompleted > 0 && cyclesCompleted % CYCLES_FOR_COMPLETION === 0) {
      setIsActive(false)
      setShowComplete(true)
      playCalmCompleteSound()
      onComplete?.()
    }
  }, [cyclesCompleted, onComplete])

  function toggle() {
    if (isActive) {
      setIsActive(false)
    } else {
      setShowComplete(false)
      setPhase('inhale')
      setSecondsLeft(PHASE_DURATIONS.inhale)
      hasPlayedPhaseSound.current = null
      setIsActive(true)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      <div className="relative flex size-40 items-center justify-center">
        <motion.div
          animate={{ scale: isActive ? PHASE_SCALE[phase] : 1 }}
          transition={{ duration: isActive ? PHASE_DURATIONS[phase] : 0.3, ease: 'easeInOut' }}
          className="absolute size-24 rounded-full bg-primary/20"
        />
        <motion.div
          animate={{ scale: isActive ? PHASE_SCALE[phase] : 1 }}
          transition={{ duration: isActive ? PHASE_DURATIONS[phase] : 0.3, ease: 'easeInOut' }}
          className="absolute size-16 rounded-full bg-primary/40"
        />
        <div className="relative z-10 text-center">
          <p className="font-heading text-lg font-semibold text-foreground">
            {showComplete ? "You're recharged 🌿" : isActive ? PHASE_LABELS[phase] : 'Ready?'}
          </p>
          {isActive && <p className="text-sm text-muted-foreground">{secondsLeft}s</p>}
        </div>

        {/* A soft spark drifts up and fades on each completed full cycle — a
            quiet "you did something" cue, not a score. */}
        <AnimatePresence>
          {isActive &&
            Array.from({ length: cyclesCompleted % CYCLES_FOR_COMPLETION }).map((_, i) => (
              <motion.span
                key={`${cyclesCompleted}-${i}`}
                initial={{ opacity: 0, y: 0, x: (i - 1) * 22 }}
                animate={{ opacity: [0, 1, 0], y: -70 }}
                transition={{ duration: 2.2, ease: 'easeOut' }}
                className="pointer-events-none absolute bottom-2 text-primary"
              >
                <Sparkle className="size-3.5 fill-primary" />
              </motion.span>
            ))}
        </AnimatePresence>
      </div>

      {cyclesCompleted > 0 && !showComplete && (
        <p className="text-xs text-muted-foreground">
          {cyclesCompleted % CYCLES_FOR_COMPLETION} of {CYCLES_FOR_COMPLETION} calm breaths
        </p>
      )}

      <Button onClick={toggle} className="bg-primary text-primary-foreground hover:bg-primary/90">
        {showComplete ? 'Breathe again' : isActive ? 'Stop' : 'Start 4-7-8 breathing'}
      </Button>
    </div>
  )
}
