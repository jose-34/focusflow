import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// Shown once, on the very first transition into the 'question' phase — the
// host/play routes track "have we shown this yet" via a ref on
// currentQuestionIndex so it never replays on subsequent questions.
export function GameCountdown({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0) // 0=3, 1=2, 2=1, 3=Go!, 4=done
  const labels = ['3', '2', '1', 'Go!']

  useEffect(() => {
    if (step >= labels.length) {
      onDone()
      return
    }
    const timer = setTimeout(() => setStep((s) => s + 1), 900)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  if (step >= labels.length) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/90 backdrop-blur-sm">
      <AnimatePresence mode="wait">
        <motion.span
          key={step}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.4, opacity: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="font-heading text-8xl font-black text-primary"
        >
          {labels[step]}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}
