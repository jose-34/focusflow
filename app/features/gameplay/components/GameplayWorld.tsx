import { AnimatePresence, motion } from 'framer-motion'
import { GAMEPLAY_THEMES, type GameplayThemeKey } from '@/features/gameplay/gameplayThemes'

interface GameplayWorldProps {
  theme: GameplayThemeKey
  totalSteps: number
  stepsCompleted: number
  lastResult: 'correct' | 'incorrect' | null
  resultKey: string | number
}

// One real, reusable "learning input -> world reaction" mechanic, reskinned
// five ways (see gameplayThemes.ts) rather than five separate bespoke
// gameplay implementations. A correct answer visibly advances the character
// toward the destination; a wrong answer is a small, non-humiliating
// stumble — the character never goes backward past where it already
// reached, and there is no dead end.
export function GameplayWorld({ theme, totalSteps, stepsCompleted, lastResult, resultKey }: GameplayWorldProps) {
  const skin = GAMEPLAY_THEMES[theme]
  const safeTotalSteps = Math.max(totalSteps, 1)
  const clampedCompleted = Math.min(stepsCompleted, safeTotalSteps)
  const progressPct = (clampedCompleted / safeTotalSteps) * 100
  const steps = Array.from({ length: safeTotalSteps }, (_, i) => i)

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border/60 px-5 pt-10 pb-6"
      style={{ background: skin.gradient }}
    >
      <div className="mb-1 flex items-center justify-between text-xs font-medium" style={{ color: skin.accent }}>
        <span>{skin.label}</span>
        <span>
          {clampedCompleted} / {safeTotalSteps}
        </span>
      </div>

      <div className="relative mt-6 h-8">
        {/* Track */}
        <div className="absolute top-1/2 right-0 left-0 h-1 -translate-y-1/2 rounded-full bg-black/10" />
        <div
          className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%`, backgroundColor: skin.accent }}
        />

        {/* Step markers */}
        {steps.map((i) => {
          const stepPct = safeTotalSteps === 1 ? 100 : (i / (safeTotalSteps - 1)) * 100
          const done = i < clampedCompleted
          return (
            <span
              key={i}
              className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center text-base"
              style={{ left: `${stepPct}%`, opacity: done ? 1 : 0.45 }}
            >
              {skin.stepIcon}
            </span>
          )
        })}

        {/* Destination */}
        <span className="absolute top-1/2 right-0 flex translate-x-1/2 -translate-y-1/2 items-center justify-center text-xl">
          {skin.destinationIcon}
        </span>

        {/* Character */}
        <motion.div
          className="absolute top-1/2 -translate-y-[130%]"
          animate={{ left: `${progressPct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}
          style={{ transform: 'translateX(-50%)' }}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={resultKey}
              initial={lastResult === 'incorrect' ? { x: 0 } : { scale: 0.7, opacity: 0 }}
              animate={
                lastResult === 'incorrect'
                  ? { x: [0, -6, 6, -4, 4, 0] }
                  : { scale: 1, opacity: 1 }
              }
              transition={{ duration: lastResult === 'incorrect' ? 0.5 : 0.3 }}
              className="block text-3xl drop-shadow"
            >
              {lastResult === 'incorrect' ? skin.stumbleCharacter : skin.character}
            </motion.span>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
