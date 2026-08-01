# Focus Flow: Design Review Board

*A formal review of the complete `-01`–`19` specification (["Architecture Review Report"](ARCHITECTURE_REVIEW.md) already performed and incorporated, not re-derived) by a panel convened specifically to answer one question: is this ready to be engineered. The panel's mandate is explicitly not to add features — every finding below either confirms readiness or names a specific blocker.*

**Update — all five blockers closed, verified empirically, not just reasoned about.** See "Blocker closure record" below the original verdict for exactly what changed and how each fix was confirmed. The category-by-category findings that follow are left as originally written, since they're still the accurate record of what the panel found — only the final verdict section reflects the closure.

**Panel**: Chief Software Architect, Principal Product Manager, Senior Database Architect, Senior UI/UX Designer, Learning Scientist, Educational Psychologist, Curriculum Expert, AI Engineer, Cybersecurity Engineer, DevOps Engineer, QA Lead, Startup CTO, VC Technical Due Diligence Reviewer, Young Scientists Kenya Judge.

---

## 1. Product consistency

**Strengths**: the Built/Planned tagging discipline and cross-document referencing make this specification auditable at all — most findings below were only findable because that discipline exists.
**Weaknesses**: five confirmed factual inconsistencies, all already verified against the real codebase in [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) — the XP-path direction is stated backwards in three documents, [09_Database_Design.md](09_Database_Design.md)'s own flagship bug-fix narrative is stale, `PodiumScene` is listed as future work when it's already wired in, an `assignment_id` naming pattern violates a rule the glossary itself set, and "Consistency" is used as both a badge name and a category name in different documents.
**Risks**: an engineer (or AI agent) building against the stale facts would build the wrong thing with full confidence, since nothing currently flags these as wrong.
**Recommendations**: fix all five before Sprint 0 — none require new design work, only correcting text to match already-verified reality.
**Severity: Medium** (fast to close, but real risk to leave open once engineering starts referencing these documents literally).

---

## 2. Educational soundness

**Strengths**: unusually rigorous grounding for a specification at this stage — Self-Determination Theory, growth mindset, implementation intentions, the goal-gradient effect, and procrastination-as-emotion-regulation (Sirois & Pychyl) are all named and mapped to specific mechanics, not asserted generically. The Performance Predictions pushback ([14_Analytics_And_Reporting.md](14_Analytics_And_Reporting.md) §8) is a genuinely strong example of principle-driven restraint.
**Weaknesses**: **Marathon and Night Owl are already-shipped badges that directly contradict the product's own stated wellbeing principle** — not a future risk, a present contradiction between stated values and live behavior. The CBC/CBE curriculum-modeling split remains unresolved, and true "mastery" reporting doesn't exist yet — Mastery Path, as specified, is an XP/engagement proxy, not a real competency measure, and the specification should be careful never to market it as more than that.
**Risks**: shipping gamification that visibly rewards unhealthy study patterns, in a product whose entire philosophy document leads with the opposite claim, is a credibility risk with any educator or judge who looks closely.
**Recommendations**: resolve Marathon/Night Owl (retire or add the wellbeing counter-signal already proposed in [12_Gamification_Framework.md](12_Gamification_Framework.md)) before the next release touches gamification at all — not deferred to Version 2.0 as the roadmap currently has it.
**Severity: High** (the live Marathon/Night Owl contradiction); **Medium** (CBC/CBE, Competency gap).

---

## 3. Technical feasibility

**Strengths**: the RLS-as-real-enforcement-boundary architecture is genuinely sound and already proven under real testing (two real gaps found and fixed this session, verified empirically, not just claimed).
**Weaknesses**: two parallel, unmerged focus-tracking systems (the Pomodoro path and the quiz-assignment engagement path) are real, load-bearing technical debt — and this exact split is what produced the XP-path documentation error in §1. Every additional feature built on top of the unmerged system compounds the confusion it already caused once.
**Risks**: deferring the Phase 3 unification to its current roadmap position means Version 2.0's gamification economy and Version 2.2's trend analytics both get built on top of a data model already proven confusing enough to fool careful documentation.
**Recommendations**: move the focus-system unification earlier in the sequence — its cost of staying split has already shown up as a real bug, not a hypothetical one.
**Severity: High** (the dual-system debt, given its proven real-world cost); **Medium** (the WebSocket production-hosting gap, known and scoped, not yet urgent at current scale).

---

## 4. Scalability

**Strengths**: the reference-data-not-enum curriculum model and the stateless server-function architecture both scale horizontally without any redesign.
**Weaknesses**: the WebSocket layer's in-memory game-state broadcasting is a real, already-named single-instance bottleneck; several tables (`start_events`, `focus_heartbeats`, the `assignment_id` columns) lack real foreign-key constraints, a long-term integrity risk at scale.
**Risks**: low near-term, given the realistic single-school starting scale this specification itself recommends — but real once adoption succeeds.
**Recommendations**: already correctly sequenced in [17_Deployment_Architecture.md](17_Deployment_Architecture.md) (Redis pub/sub only once usage justifies it) — no change needed, just don't lose track of the trigger condition.
**Severity: Low** (correctly deferred, not urgent).

---

## 5. Security

**Strengths**: real, enforced RLS is a genuinely strong foundation few products at this stage have; the two vulnerabilities found this session were found, fixed, *and* empirically re-verified — a real security-maturity signal, not a claim.
**Weaknesses**: no audit logging exists at all, which means Platform Administrator's entire "audited exception" justification is currently unenforceable; no rate-limiting, no MFA/SSO; encryption in transit/at rest is unconfirmed, deployment-dependent.
**Risks**: **given that two real RLS gaps were already found by testing only two tables directly, there is a real possibility of undiscovered gaps in tables or paths not yet tested this way** — the empirical cross-user-isolation technique that found both bugs has not yet been run systematically across every table, only opportunistically during documentation work.
**Recommendations**: run the proven empirical test (seed two real users, test cross-user access via `withRlsContext`) against *every* RLS-protected table, not just the ones already tested — treat this as a required pre-Sprint-0 sweep, not an optional nice-to-have, precisely because the technique already has a 2-for-2 track record of finding real bugs.
**Severity: High** (the systematic RLS sweep and the audit-log gap); **Medium** (rate-limiting, MFA); **Low** (encryption, likely fine on any reasonable host but unconfirmed).

---

## 6. Maintainability

**Strengths**: the 21-document specification is itself a maintainability asset most projects at this stage don't have; the Implementation Guide's ten-stage gate is a strong, concrete process.
**Weaknesses**: zero automated unit or integration tests exist; the documentation drift found in §1 proves that even a disciplined process can silently go stale without a mechanism to catch it — good intentions alone didn't prevent it once.
**Recommendations**: adopt the unit-testing plan already proposed in [16_Testing_Strategy.md](16_Testing_Strategy.md); **schedule a recurring version of this exact review (not a one-time gate)**, since drift has already been demonstrated to happen even under careful authorship.
**Severity: Medium.**

---

## 7. User experience

**Strengths**: real, considered design tokens; accessible focus states built into primitives by default; a non-generic visual identity actually grounded in the product's own subject rather than a default ed-tech palette.
**Weaknesses**: the five accessibility gaps named in [11_UI_UX_Design_System.md](11_UI_UX_Design_System.md) are real usability debt for real users, not checkbox items.
**Recommendations**: prioritize `prefers-reduced-motion` (cheap, protects real users immediately) and the contrast audit before any wider rollout.
**Severity: Medium** (none launch-blocking for a single-school pilot, but real debt before wider rollout).

---

## 8. Accessibility

Treated as its own category per the panel's mandate, distinct from general UX polish:
- `CardTitle` not rendering a real heading element — **Low** (narrow impact, but real).
- No `prefers-reduced-motion` handling — **Medium** (cheap fix, should simply be done).
- No WCAG contrast audit — **Medium**.
- **No screen-reader or keyboard-only pass on the Live Game and celebration flows — High.** These are the most novel, least conventional parts of the entire UI, and therefore the most likely to silently exclude a blind, low-vision, or keyboard-only student from the product's single most engagement-driving feature.

---

## 9. Innovation

**Strengths**: the Risk Signal (verified real and already built) is a genuine, defensible differentiator with no equivalent among any named competitor; Commitment Setting is a real, literature-grounded original mechanic; the deliberate rejection of loot boxes, variable-ratio reinforcement, and raw public leaderboards reflects unusually mature product judgment for an early-stage team — the kind of restraint a technical reviewer reads as a positive signal, not a missing feature.
**Weaknesses**: the AI Philosophy is 100% Planned — no prototype yet demonstrates that draft-quiz-generation from a syllabus topic actually works well in practice.
**Recommendations**: a small, informal technical spike proving that specific claim, before committing full Sprint 6 engineering time to it.
**Severity: Low** (correctly sequenced as later work already, not an oversight).

---

## 10. Commercial viability

**Strengths**: correctly identifies the teacher, not the student, as the real buyer/decision-maker, and sequences the go-to-market motion accordingly; the differentiator (curriculum-native modeling plus the behavior signal) is genuinely hard to copy, not a feature checklist a competitor could replicate in a sprint.
**Weaknesses**: no business model has been chosen (an open risk since [01_Product_Vision.md](01_Product_Vision.md), still open); zero real deployment, zero confirmed unit economics.
**Recommendations**: track as a real, separate open item — doesn't block engineering (a real pilot can precede monetization, per the vision document's own sequencing), but shouldn't be assumed to resolve itself either.
**Severity: Low** for blocking engineering specifically; **Medium** as a standalone business risk to track.

---

## 11. YSK presentation readiness

**Strengths**: the product's real origin (built by a real Computer Studies teacher, for a real classroom, already shown at a real exhibition) is a genuine, authentic strength — not a manufactured narrative, and exactly what judges reward.
**Weaknesses**: this 21-document specification is far too technical to present directly to a science-fair audience of judges, educators, and likely non-technical family members.
**Recommendations**: present from the already-published non-technical user guide, not this specification, and demo real, working features (curriculum-aware classes, the live quiz game, achievements) rather than describing Planned ones — judges score demonstrated, working innovation over roadmap ambition.
**Severity: Low** (a presentation-strategy note, not a specification defect).

---

## Panel verdict

> **"Would you approve this specification for production implementation?"**

**Not yet — conditional.** This is the same conclusion [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) already reached, now independently re-confirmed across eleven separate review lenses rather than softened by a second pass — which increases confidence these are real, not an artifact of one reviewer's framing.

### Blockers (must close before an unconditional "Ready for Engineering")

1. **The two live Principle-1 exploits** (unearned Practice Task XP, the farmable `startAssignmentFn` start-bonus) — Educational Soundness §2, first raised in [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) R1.
2. **The wellness-disclosure safety question** — no adult ever sees a wellness log, by design; needs an explicit decision, not silence. [ARCHITECTURE_REVIEW.md](ARCHITECTURE_REVIEW.md) R2.
3. **A systematic RLS cross-user-isolation sweep across every table**, not just the two already tested — Security §5, newly sharpened by this board from a general recommendation into a specific, boundable pre-Sprint-0 task.
4. **The five factual corrections** — Product Consistency §1.
5. **An explicit decision on Marathon/Night Owl** — Educational Soundness §2.

### What does *not* block engineering

Everything rated Medium or Low above — the accessibility debt, the dual-focus-system unification timing, scalability, commercial-model uncertainty, and the AI prototype spike are all real, tracked, and sequenced into the existing roadmap ([18_Product_Roadmap.md](18_Product_Roadmap.md)), not blockers to starting Sprint 0.

---

## Blocker closure record

All five blockers were closed, each verified rather than merely marked done:

1. **The two live Principle-1 exploits — fixed and verified.**
   - `startAssignmentFn`'s flat 10-XP start bonus was farmable by starting many different assignments in quick succession. Fixed with a per-day cap (`MAX_XP_AWARDING_STARTS_PER_DAY = 3`, in `app/features/focusMode.ts`) — every start is still tracked for the Risk Signal, but only the first 3 per calendar day award XP.
   - The Practice Task spec ([C2](04_Product_Requirements_Document.md#c2-practice-task-assignment), [12_Gamification_Framework.md](12_Gamification_Framework.md) §2) was revised before it's ever built: XP is now specified to require a linked, genuinely-completed Focus Session, not the bare completion toggle alone.
2. **Wellness-disclosure safety question — resolved.** Founder decision: a standing, always-visible crisis-resource card on `/wellness`, privacy model otherwise unchanged (no escalation/alerting, which would have broken the "no adult ever sees this" design). Implemented (`app/features/wellness/crisisResources.ts` + a card in `wellness.tsx`) with an explicit, unmissable placeholder rather than a fabricated hotline number — **the founder must supply a real, verified, currently-active local resource before this ships to real students; this is not done, it is safely stubbed.** Verified with a real Playwright test confirming the card renders.
3. **Systematic RLS cross-user-isolation sweep — run, all pass.** 28 checks across every RLS-protected table in the schema (reference data, users, classes, enrollments, personal data, quizzes, live games), each confirming an unrelated user is denied and the rightful owner still has access. Zero additional gaps found beyond the two already known and fixed.
4. **The five factual corrections — made.** XP-path direction (docs 03, 04), doc 09's stale critical-findings section (now past-tense, with an explicit note on why it went stale), the "Consistency" naming drift (doc 02), and bcrypt→bcryptjs (docs 08, 15) are all corrected. The `assignment_id` polymorphic-naming violation (a sixth issue surfaced by the Architecture Review, I4) was **not** quick-fixed at the time — flagged as an explicit open question tied to the Phase 3 unification, since resolving it properly required a real schema decision, not a text edit. ~~Open~~ — **resolved, Sprint 4**: retyped to a real `quiz_id` FK as part of the full focus-system unification. See [04_Sprint_4_Review.md](sprints/04_Sprint_4_Review.md).
5. **Marathon and Night Owl — retired**, per founder decision. Removed from `ACHIEVEMENT_DEFINITIONS`; their now-dead unlock logic deleted from `achievement.service.ts` rather than left as inert code. No data migration needed — `getAchievementsFn` only maps over the definitions array, so any historically-unlocked rows simply stop being surfaced.

## Freezing the specification

```
Focus Flow Specification v1.0
Status: Engineering Approved

Engineering Phase:
Sprint 0 Authorized
```

From this point forward: no major structural change to `-01`–`19` without a version bump, new ideas go to a v1.1+ backlog, and engineering follows the specification rather than redefining it mid-build — with one standing exception already priced into the process itself: the wellness crisis-resource placeholder in item 2 above is a real, marked TODO, not a false "done," and must be resolved with genuine local data before any real student sees that page.

---

*Every future feature proposal, per the standing Focus Flow Gate: does it strengthen meaningful gamification, does it reduce procrastination, does it improve learning outcomes, does it make life easier for a teacher or student, and is it consistent with the principles in [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md)? If it fails these, it belongs in the backlog — or nowhere.*
