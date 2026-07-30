import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ACHIEVEMENT_MAP } from '@/features/achievements/definitions'
import { useCelebration } from '@/features/celebration/CelebrationContext'
import { useFocusSession } from './hooks/useFocusSession'

export type TimerMode = 'focus' | 'short_break' | 'long_break'

export const FOCUS_DURATION_OPTIONS = [15, 25, 30, 45] as const

const SHORT_BREAK_MINUTES = 5
const LONG_BREAK_MINUTES = 15
const SESSIONS_UNTIL_LONG_BREAK = 4

interface TimerContextValue {
  mode: TimerMode
  timeLeft: number
  isRunning: boolean
  focusMinutes: number
  setFocusMinutes: (minutes: number) => void
  selectedTaskId: string | null
  setTaskId: (taskId: string | null) => void
  completedFocusSessions: number
  currentSessionNumber: number
  sessionsUntilLongBreak: number
  totalDurationSeconds: number
  start: () => Promise<void>
  pause: () => void
  reset: () => Promise<void>
  skipBreak: () => void
  recordDistraction: (durationSeconds: number) => void
}

const TimerContext = createContext<TimerContextValue | null>(null)

function durationSecondsForMode(mode: TimerMode, focusMinutes: number) {
  if (mode === 'focus') return focusMinutes * 60
  if (mode === 'short_break') return SHORT_BREAK_MINUTES * 60
  return LONG_BREAK_MINUTES * 60
}

function playCompletionSound() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioContextClass()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8)
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    oscillator.stop(ctx.currentTime + 0.8)
  } catch {
    // Audio is a nice-to-have; never let it break the timer.
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [focusMinutes, setFocusMinutesState] = useState<number>(25)
  const [mode, setMode] = useState<TimerMode>('focus')
  const [timeLeft, setTimeLeft] = useState(() => durationSecondsForMode('focus', 25))
  const [isRunning, setIsRunning] = useState(false)
  const [completedFocusSessions, setCompletedFocusSessions] = useState(0)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const sessionIdRef = useRef<string | null>(null)
  const { startSession, completeSession, abandonSession, logDistraction } = useFocusSession()
  const { celebrate } = useCelebration()

  useEffect(() => {
    if (!isRunning) {
      setTimeLeft(durationSecondsForMode(mode, focusMinutes))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, focusMinutes])

  const handleModeComplete = useCallback(async () => {
    setIsRunning(false)
    playCompletionSound()

    if (mode === 'focus') {
      const sessionId = sessionIdRef.current
      sessionIdRef.current = null
      if (sessionId) {
        try {
          const result = await completeSession(sessionId)
          for (const key of result.unlockedAchievements) {
            const definition = ACHIEVEMENT_MAP.get(key)
            if (definition) {
              celebrate({ type: 'achievement', title: definition.title, description: definition.description })
            }
          }
        } catch {
          // Best-effort: don't let a network hiccup break the timer UX.
        }
      }
      const nextCount = completedFocusSessions + 1
      setCompletedFocusSessions(nextCount)
      const isLongBreak = nextCount % SESSIONS_UNTIL_LONG_BREAK === 0
      toast.success(isLongBreak ? 'Great work! Time for a long break.' : 'Focus session complete! Take a short break.')
      setMode(isLongBreak ? 'long_break' : 'short_break')
    } else {
      toast.info('Break over — ready to focus?')
      setMode('focus')
    }
  }, [mode, completedFocusSessions, completeSession, celebrate])

  useEffect(() => {
    if (!isRunning || timeLeft > 0) return
    handleModeComplete()
  }, [isRunning, timeLeft, handleModeComplete])

  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)
    return () => clearInterval(interval)
  }, [isRunning])

  const start = useCallback(async () => {
    if (mode === 'focus' && !sessionIdRef.current) {
      try {
        const session = await startSession({ durationMinutes: focusMinutes, taskId: selectedTaskId })
        sessionIdRef.current = session.id
      } catch {
        toast.error('Could not start your session — check your connection and try again.')
        return
      }
    }
    setIsRunning(true)
  }, [mode, focusMinutes, selectedTaskId, startSession])

  const pause = useCallback(() => {
    setIsRunning(false)
  }, [])

  const reset = useCallback(async () => {
    setIsRunning(false)
    const sessionId = sessionIdRef.current
    if (mode === 'focus' && sessionId) {
      sessionIdRef.current = null
      try {
        await abandonSession(sessionId)
      } catch {
        // Best-effort.
      }
    }
    setTimeLeft(durationSecondsForMode(mode, focusMinutes))
  }, [mode, focusMinutes, abandonSession])

  const skipBreak = useCallback(() => {
    if (mode === 'focus') return
    setIsRunning(false)
    setMode('focus')
  }, [mode])

  const setFocusMinutes = useCallback(
    (minutes: number) => {
      if (isRunning) return
      setFocusMinutesState(minutes)
    },
    [isRunning],
  )

  const setTaskId = useCallback(
    (taskId: string | null) => {
      if (isRunning) return
      setSelectedTaskId(taskId)
    },
    [isRunning],
  )

  const recordDistraction = useCallback(
    (durationSeconds: number) => {
      const sessionId = sessionIdRef.current
      if (mode === 'focus' && isRunning && sessionId && durationSeconds > 0) {
        logDistraction({ focusSessionId: sessionId, durationSeconds }).catch(() => {})
      }
    },
    [mode, isRunning, logDistraction],
  )

  const currentSessionNumber = (completedFocusSessions % SESSIONS_UNTIL_LONG_BREAK) + 1

  const value = {
    mode,
    timeLeft,
    isRunning,
    focusMinutes,
    setFocusMinutes,
    selectedTaskId,
    setTaskId,
    completedFocusSessions,
    currentSessionNumber,
    sessionsUntilLongBreak: SESSIONS_UNTIL_LONG_BREAK,
    totalDurationSeconds: durationSecondsForMode(mode, focusMinutes),
    start,
    pause,
    reset,
    skipBreak,
    recordDistraction,
    handleModeComplete,
  }

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export function useTimer() {
  const ctx = useContext(TimerContext)
  if (!ctx) {
    throw new Error('useTimer must be used within a TimerProvider')
  }
  return ctx
}

export function usePomodoro() {
  const timer = useTimer()

  const recordDistraction = useCallback(
    (durationSeconds: number) => {
      timer.recordDistraction(durationSeconds)
    },
    [timer],
  )

  return {
    mode: timer.mode,
    timeLeft: timer.timeLeft,
    isRunning: timer.isRunning,
    focusMinutes: timer.focusMinutes,
    setFocusMinutes: timer.setFocusMinutes,
    selectedTaskId: timer.selectedTaskId,
    setTaskId: timer.setTaskId,
    completedFocusSessions: timer.completedFocusSessions,
    currentSessionNumber: timer.currentSessionNumber,
    sessionsUntilLongBreak: timer.sessionsUntilLongBreak,
    totalDurationSeconds: timer.totalDurationSeconds,
    start: timer.start,
    pause: timer.pause,
    reset: timer.reset,
    skipBreak: timer.skipBreak,
    recordDistraction,
  }
}
