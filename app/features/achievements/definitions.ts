export interface AchievementDefinition {
  key: string
  title: string
  description: string
}

// Marathon (5+ sessions/day) and Night Owl (after 8pm) were retired per the
// Design Review Board (see docs/DESIGN_REVIEW_BOARD.md, Educational Soundness
// §2): both rewarded overwork/late-night patterns directly contradicting the
// product's own wellbeing principle. Removing them from this array is
// sufficient — getAchievementsFn only ever maps over this list, so any
// already-unlocked 'marathon'/'night_owl' rows in user_achievements simply
// stop being surfaced, with no data migration needed.
export const ACHIEVEMENT_DEFINITIONS: Array<AchievementDefinition> = [
  { key: 'first_focus', title: 'First Focus', description: 'Complete your first focus session' },
  { key: 'streak_starter', title: 'Streak Starter', description: 'Reach a 3-day focus streak' },
  { key: 'week_warrior', title: 'Week Warrior', description: 'Reach a 7-day focus streak' },
  { key: 'century_club', title: 'Century Club', description: 'Complete 100 focus sessions' },
  { key: 'task_master', title: 'Task Master', description: 'Complete 50 tasks' },
  { key: 'early_bird', title: 'Early Bird', description: 'Complete a focus session before 8 AM' },
]

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENT_DEFINITIONS.map((def) => [def.key, def]))
