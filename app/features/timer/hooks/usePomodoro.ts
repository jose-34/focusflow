import { useCallback } from 'react'
import { useTimer } from '../TimerContext'

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
