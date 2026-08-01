export interface AchievementDefinition {
  key: string
  title: string
  description: string
}

// Marathon (5+ sessions/day) and Night Owl (after 8pm) were retired per the
// Design Review Board (see docs/DESIGN_REVIEW_BOARD.md, Educational Soundness
// §2) for rewarding overwork/late-night patterns contradicting the product's
// wellbeing principle — then reinstated by founder decision (see
// docs/DESIGN_REVIEW_BOARD.md's reversal note and
// docs/12_Gamification_Framework.md §4). The wellbeing tension the original
// retirement raised was not re-litigated as part of bringing them back; if
// that matters later, a counter-signal (per §4's original proposal) is the
// documented middle ground, not a further reversal.
export const ACHIEVEMENT_DEFINITIONS: Array<AchievementDefinition> = [
  { key: 'first_focus', title: 'First Focus', description: 'Complete your first focus session' },
  { key: 'streak_starter', title: 'Streak Starter', description: 'Reach a 3-day focus streak' },
  { key: 'week_warrior', title: 'Week Warrior', description: 'Reach a 7-day focus streak' },
  { key: 'century_club', title: 'Century Club', description: 'Complete 100 focus sessions' },
  { key: 'task_master', title: 'Task Master', description: 'Complete 50 tasks' },
  { key: 'early_bird', title: 'Early Bird', description: 'Complete a focus session before 8 AM' },
  { key: 'night_owl', title: 'Night Owl', description: 'Complete a focus session after 8 PM' },
  { key: 'marathon', title: 'Marathon', description: 'Complete 5 focus sessions in a single day' },
]

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENT_DEFINITIONS.map((def) => [def.key, def]))
