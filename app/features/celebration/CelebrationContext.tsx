import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { CelebrationOverlay } from './components/CelebrationOverlay'

export type CelebrationPayload =
  | { type: 'achievement'; title: string; description: string }
  | { type: 'quiz'; title: string; score: number; maxScore: number }
  | { type: 'chest'; taskTitle: string }

interface CelebrationContextValue {
  celebrate: (payload: CelebrationPayload) => void
}

const CelebrationContext = createContext<CelebrationContextValue | null>(null)

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Array<CelebrationPayload>>([])
  const current = queue[0] ?? null

  const celebrate = useCallback((payload: CelebrationPayload) => {
    setQueue((q) => [...q, payload])
  }, [])

  const dismiss = useCallback(() => {
    setQueue((q) => q.slice(1))
  }, [])

  const value = useMemo(() => ({ celebrate }), [celebrate])

  return (
    <CelebrationContext.Provider value={value}>
      {children}
      <CelebrationOverlay payload={current} onDismiss={dismiss} />
    </CelebrationContext.Provider>
  )
}

export function useCelebration() {
  const ctx = useContext(CelebrationContext)
  if (!ctx) {
    throw new Error('useCelebration must be used within a CelebrationProvider')
  }
  return ctx
}
