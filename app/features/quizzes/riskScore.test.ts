import { describe, expect, it } from 'vitest'
import { computeRiskScore } from './riskScore'

describe('computeRiskScore', () => {
  it('scores 3 when no attempt exists at all', () => {
    expect(computeRiskScore({ hasAttempt: false, focusSessionCount: 0, hoursBeforeDeadline: null })).toEqual({
      procrastinationFlag: false,
      riskScore: 3,
    })
  })

  it('scores 2 when an attempt exists but zero focus time was logged within 24h of the deadline', () => {
    expect(computeRiskScore({ hasAttempt: true, focusSessionCount: 0, hoursBeforeDeadline: 12 })).toEqual({
      procrastinationFlag: true,
      riskScore: 2,
    })
  })

  it('scores 1 when the deadline is within 48h but focus time was logged', () => {
    expect(computeRiskScore({ hasAttempt: true, focusSessionCount: 2, hoursBeforeDeadline: 40 })).toEqual({
      procrastinationFlag: false,
      riskScore: 1,
    })
  })

  it('scores 0 when there is no near deadline and no procrastination signal', () => {
    expect(computeRiskScore({ hasAttempt: true, focusSessionCount: 3, hoursBeforeDeadline: 96 })).toEqual({
      procrastinationFlag: false,
      riskScore: 0,
    })
  })

  it('does not flag procrastination when focus sessions exist, even close to the deadline', () => {
    const { procrastinationFlag } = computeRiskScore({ hasAttempt: true, focusSessionCount: 1, hoursBeforeDeadline: 6 })
    expect(procrastinationFlag).toBe(false)
  })

  it('never flags procrastination when there is no due date at all', () => {
    expect(computeRiskScore({ hasAttempt: true, focusSessionCount: 0, hoursBeforeDeadline: null })).toEqual({
      procrastinationFlag: false,
      riskScore: 0,
    })
  })
})
