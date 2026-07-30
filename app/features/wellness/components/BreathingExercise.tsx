import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'

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

function nextPhase(phase: Phase): Phase {
  if (phase === 'inhale') return 'hold'
  if (phase === 'hold') return 'exhale'
  return 'inhale'
}

export function BreathingExercise() {
  const [isActive, setIsActive] = useState(false)
  const [phase, setPhase] = useState<Phase>('inhale')
  const [secondsLeft, setSecondsLeft] = useState(PHASE_DURATIONS.inhale)

  useEffect(() => {
    if (!isActive) return
    const interval = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setPhase((currentPhase) => nextPhase(currentPhase))
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

  function toggle() {
    if (isActive) {
      setIsActive(false)
    } else {
      setPhase('inhale')
      setSecondsLeft(PHASE_DURATIONS.inhale)
      setIsActive(true)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6 py-4">
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
          <p className="font-heading text-lg font-semibold text-foreground">{isActive ? PHASE_LABELS[phase] : 'Ready?'}</p>
          {isActive && <p className="text-sm text-muted-foreground">{secondsLeft}s</p>}
        </div>
      </div>
      <Button onClick={toggle} className="bg-primary text-primary-foreground hover:bg-primary/90">
        {isActive ? 'Stop' : 'Start 4-7-8 breathing'}
      </Button>
    </div>
  )
}
