import { describe, expect, it } from 'vitest'
import { computeStreaks } from './streaks'

// Local helper mirroring the private toDateKey() in useProgress.ts — kept
// separate rather than exported purely for test convenience, since it's a
// one-line format, not logic worth sharing.
function dateKeyDaysAgo(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)
}

describe('computeStreaks', () => {
  it('returns zero for both when there is no history', () => {
    expect(computeStreaks(new Set())).toEqual({ current: 0, longest: 0 })
  })

  it('counts a current streak anchored on today', () => {
    const dates = new Set([dateKeyDaysAgo(0), dateKeyDaysAgo(1), dateKeyDaysAgo(2)])
    expect(computeStreaks(dates)).toEqual({ current: 3, longest: 3 })
  })

  it('still counts a current streak anchored on yesterday (today not yet logged)', () => {
    const dates = new Set([dateKeyDaysAgo(1), dateKeyDaysAgo(2), dateKeyDaysAgo(3)])
    expect(computeStreaks(dates)).toEqual({ current: 3, longest: 3 })
  })

  it('resets current streak to zero when neither today nor yesterday is present', () => {
    const dates = new Set([dateKeyDaysAgo(5), dateKeyDaysAgo(6)])
    const { current, longest } = computeStreaks(dates)
    expect(current).toBe(0)
    expect(longest).toBe(2)
  })

  it('tracks longest streak independently of a broken current streak', () => {
    // A 5-day run far in the past, then a gap, then today alone.
    const dates = new Set([
      dateKeyDaysAgo(0),
      dateKeyDaysAgo(20),
      dateKeyDaysAgo(21),
      dateKeyDaysAgo(22),
      dateKeyDaysAgo(23),
      dateKeyDaysAgo(24),
    ])
    const { current, longest } = computeStreaks(dates)
    expect(current).toBe(1)
    expect(longest).toBe(5)
  })

  it('correctly computes a streak longer than 14 days when given full history — proving computeStreaks itself has no window limit', () => {
    const dates = new Set(Array.from({ length: 20 }, (_, i) => dateKeyDaysAgo(i)))
    expect(computeStreaks(dates)).toEqual({ current: 20, longest: 20 })
  })
})
