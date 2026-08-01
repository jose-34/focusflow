import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CelebrationScene } from './CelebrationScene'
import { playAchievementSound, playChestSound, playQuizResultSound } from '@/lib/sound'
import type { CelebrationPayload } from '../CelebrationContext'

const GOLD = '#C9A84C'

function playSoundFor(payload: CelebrationPayload) {
  if (payload.type === 'achievement') playAchievementSound()
  else if (payload.type === 'chest') playChestSound()
  else playQuizResultSound(payload.score === payload.maxScore)
}

export function CelebrationOverlay({
  payload,
  onDismiss,
}: {
  payload: CelebrationPayload | null
  onDismiss: () => void
}) {
  useEffect(() => {
    if (payload) playSoundFor(payload)
    // Only the arrival of a new payload should play a sound, not every
    // re-render while one is already showing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload])

  return (
    <AnimatePresence>
      {payload && (
        <motion.div
          key={`${payload.type}-${payload.type === 'chest' ? payload.taskTitle : payload.title}`}
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onDismiss}
        >
          <motion.div
            className="relative flex flex-col items-center"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.35 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-64 w-64 sm:h-80 sm:w-80">
              <CelebrationScene
                accentColor={GOLD}
                sparkleCount={payload.type === 'quiz' && payload.score === payload.maxScore ? 80 : 40}
                shape={payload.type === 'chest' ? 'chest' : 'badge'}
              />
            </div>
            <div className="-mt-6 flex flex-col items-center gap-1 px-4 text-center">
              {payload.type === 'achievement' ? (
                <>
                  <span className="text-xs font-semibold tracking-wide text-accent uppercase">Achievement Unlocked</span>
                  <h2 className="font-heading text-2xl font-bold text-white">{payload.title}</h2>
                  <p className="max-w-xs text-sm text-white/70">{payload.description}</p>
                </>
              ) : payload.type === 'chest' ? (
                <>
                  <span className="text-xs font-semibold tracking-wide text-accent uppercase">Task Complete</span>
                  <h2 className="font-heading text-2xl font-bold text-white">{payload.taskTitle}</h2>
                </>
              ) : (
                <>
                  <span className="text-xs font-semibold tracking-wide text-accent uppercase">
                    {payload.score === payload.maxScore ? 'Perfect Score!' : 'Quiz Complete'}
                  </span>
                  <h2 className="font-heading text-2xl font-bold text-white">{payload.title}</h2>
                  <p className="text-lg font-semibold text-white/90">
                    {payload.score}/{payload.maxScore} correct
                  </p>
                </>
              )}
              <button
                onClick={onDismiss}
                className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Continue
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
