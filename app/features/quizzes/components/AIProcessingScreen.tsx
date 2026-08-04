import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

const STAGES = ['Reading your material…', 'Understanding the topic…', 'Writing questions…', 'Almost done…']

// Shown in place of the Generate button while an AI generation call is in
// flight — cycles through stages on a timer purely for perceived-progress
// feedback (the real call is a single request/response, there's no actual
// per-stage signal from the server to key off).
export function AIProcessingScreen() {
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, STAGES.length - 1))
    }, 3500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-accent/40 bg-accent/5 py-8">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}>
        <Sparkles className="size-6 text-accent" />
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.p
          key={stageIndex}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="text-sm font-medium text-foreground"
        >
          {STAGES[stageIndex]}
        </motion.p>
      </AnimatePresence>
      <p className="text-xs text-muted-foreground">This can take up to 30 seconds for longer documents.</p>
    </div>
  )
}
