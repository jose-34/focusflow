// Design Review Board blocker #2 (docs/DESIGN_REVIEW_BOARD.md, Educational
// Psychologist finding): wellness logs are deliberately private — no adult
// ever sees them, even aggregated — which means a genuine crisis disclosure
// (self-harm, abuse) currently has nowhere to go. The founder-approved fix is
// a standing, always-visible resource note here, not an escalation/alerting
// system (that would break the privacy model this feature depends on).
//
// The placeholder text below is intentionally NOT a plausible-looking phone
// number — a wrong or disconnected number shown to a student in crisis is a
// real, serious harm, not a cosmetic bug. Do not ship this without replacing
// every bracketed value with a real, verified, currently-active resource.
export interface CrisisResource {
  name: string
  contact: string
  description: string
}

export const CRISIS_RESOURCES: Array<CrisisResource> = [
  {
    name: '[VERIFIED RESOURCE NEEDED]',
    contact: '[Insert a real, currently-active Kenya-based crisis/helpline number here]',
    description: 'Replace this entire entry with a verified, currently-operating support line before this feature ships to real students.',
  },
]
