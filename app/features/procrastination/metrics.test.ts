import { describe, expect, it } from 'vitest'
import {
  averageDelayMinutes,
  computeDailyStartDelays,
  computeTaskLatency,
  earliestPerDay,
  isProcrastinationReduced,
} from './metrics'

describe('earliestPerDay', () => {
  it('keeps only the earliest timestamp for each calendar day', () => {
    const result = earliestPerDay([new Date('2026-08-01T10:00:00Z'), new Date('2026-08-01T08:00:00Z'), new Date('2026-08-02T09:00:00Z')])
    expect(result.get('2026-08-01')?.toISOString()).toBe('2026-08-01T08:00:00.000Z')
    expect(result.get('2026-08-02')?.toISOString()).toBe('2026-08-02T09:00:00.000Z')
  })
})

describe('computeDailyStartDelays', () => {
  it('computes minutes between login and first session for days with both', () => {
    const logins = earliestPerDay([new Date('2026-08-01T08:00:00Z')])
    const sessions = earliestPerDay([new Date('2026-08-01T08:30:00Z')])
    const result = computeDailyStartDelays(logins, sessions, ['2026-08-01'])
    expect(result).toEqual([{ date: '2026-08-01', delayMinutes: 30 }])
  })

  it('returns null delay for a day missing either a login or a session', () => {
    const logins = earliestPerDay([new Date('2026-08-01T08:00:00Z')])
    const sessions = new Map<string, Date>()
    const result = computeDailyStartDelays(logins, sessions, ['2026-08-01'])
    expect(result).toEqual([{ date: '2026-08-01', delayMinutes: null }])
  })
})

describe('averageDelayMinutes', () => {
  it('ignores null entries when averaging', () => {
    const avg = averageDelayMinutes([{ date: 'a', delayMinutes: 10 }, { date: 'b', delayMinutes: null }, { date: 'c', delayMinutes: 30 }])
    expect(avg).toBe(20)
  })

  it('returns null when there is no data at all', () => {
    expect(averageDelayMinutes([{ date: 'a', delayMinutes: null }])).toBeNull()
  })
})

describe('isProcrastinationReduced', () => {
  function daySeries(minutesOldToNew: Array<number | null>) {
    return minutesOldToNew.map((delayMinutes, i) => ({ date: `day-${i}`, delayMinutes }))
  }

  it('is true when the recent 7-day average is at least 20% lower than the prior 7-day average', () => {
    const prior = Array(7).fill(60) // 60 min average
    const recent = Array(7).fill(40) // 40 min average -> 33% reduction
    expect(isProcrastinationReduced(daySeries([...prior, ...recent]))).toBe(true)
  })

  it('is false when the reduction is under 20%', () => {
    const prior = Array(7).fill(60)
    const recent = Array(7).fill(55) // ~8% reduction
    expect(isProcrastinationReduced(daySeries([...prior, ...recent]))).toBe(false)
  })

  it('is false when there is not yet a full prior window to compare against', () => {
    const recent = Array(7).fill(10)
    expect(isProcrastinationReduced(daySeries(recent))).toBe(false)
  })
})

describe('computeTaskLatency', () => {
  it('averages latency in hours across completed tasks only', () => {
    const result = computeTaskLatency([
      { createdAt: new Date('2026-08-01T00:00:00Z'), completedAt: new Date('2026-08-01T06:00:00Z') },
      { createdAt: new Date('2026-08-01T00:00:00Z'), completedAt: new Date('2026-08-02T00:00:00Z') },
      { createdAt: new Date('2026-08-01T00:00:00Z'), completedAt: null },
    ])
    expect(result.count).toBe(2)
    expect(result.averageLatencyHours).toBe(15) // (6 + 24) / 2
  })

  it('returns null average with zero count when nothing is completed', () => {
    expect(computeTaskLatency([{ createdAt: new Date(), completedAt: null }])).toEqual({ averageLatencyHours: null, count: 0 })
  })
})
