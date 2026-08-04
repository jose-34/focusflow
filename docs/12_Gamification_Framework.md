# Focus Flow: Gamification Framework

*The most important document in this set after the constitution, per the founder's own framing. Every mechanic below exists to make Foundation 1 (Meaningful Gamification) concrete and enforceable — not a list of engaging features first, checked against the principle after.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md), building on the philosophy in [02_Product_Definition.md](02_Product_Definition.md) and the objects defined in [03_Product_Glossary.md](03_Product_Glossary.md). Where a real inconsistency exists between what's already built and what this framework specifies, it's named rather than smoothed over.

---

## 1. Why these mechanics, not others — the psychology this system is built on

Every mechanic in this document is traceable to a specific, named idea from motivation psychology or behavioral science — and every mechanic *deliberately excluded* is excluded because the same literature explains why it backfires for a learning product specifically.

| Principle | What it says | Where Focus Flow applies it |
|---|---|---|
| **Self-Determination Theory** (Deci & Ryan) — intrinsic motivation depends on autonomy, competence, and relatedness | People sustain motivation longer when they choose their own goals, see real evidence of skill growth, and feel connected to others | **Autonomy**: Commitment Setting lets a student name their own goal, not an assigned one. **Competence**: Mastery Path shows real, subject-specific skill growth over time. **Relatedness**: Challenges and small-cohort comparisons connect a student to classmates without ranking them publicly |
| **Growth mindset** (Dweck) | Framing ability as something that develops through effort, not a fixed trait, sustains motivation through setbacks | Mastery Path is explicitly a *growth* track per subject — there is no "you are bad at Math" state, only "not yet leveled up in Math" |
| **Implementation intentions** (Gollwitzer) | A specific, pre-committed "I will do X" plan measurably increases follow-through over a vague intention | Commitment Setting ([D3](04_Product_Requirements_Document.md#d3-commitment-setting)) — already specified in the anti-procrastination framework, restated here because it's also a gamification mechanic (a met Commitment is a small, real reward moment) |
| **Goal-gradient effect** (motivation increases as a goal gets closer) | People work harder the closer they perceive themselves to be to a reward | Mastery Path progress bars show *distance to next level*, not just a raw XP total — the same real number, framed to be motivating rather than just informational |
| **Loss aversion** | People work harder to avoid losing something they already have than to gain an equivalent new thing | Streaks leverage this honestly — a real, earned streak feels worth protecting. **Deliberately not combined** with a "pay to restore a broken streak" mechanic, which turns healthy loss-aversion into a monetized anxiety loop |
| **Overjustification effect** | Tangible/monetary rewards for an already-intrinsically-motivating activity can *reduce* long-term engagement once the reward stops | The reason every reward in this system is representational (badges, levels, cosmetic flourishes), never redeemable points, prizes, or currency — restated here from [02_Product_Definition.md](02_Product_Definition.md) because it's the single most load-bearing exclusion in this whole framework |
| **Social comparison theory** | Public ranking against others reliably demotivates everyone except the small group already winning | The reason no raw, school-wide leaderboard exists anywhere in this system — every comparison is scoped to personal history or a small, opt-in cohort |
| **Variable-ratio reinforcement** (the mechanism behind slot machines and loot boxes) | Unpredictable, randomized rewards produce the most compulsive engagement patterns of any reinforcement schedule | **Explicitly and permanently excluded.** No loot boxes, no randomized reward reveals, no "mystery" unlocks of any kind — every reward in this system is earned by a known, transparent rule, checkable by the student in advance |

---

## 2. XP — the single currency

XP is the one unit every other mechanic (Mastery Path, most Achievements) is built from. The binding rule, repeated because it is the one no exception is ever granted to: **XP is awarded only for verified learning actions**, never for opening the app, starting (but not completing) something, or any action indistinguishable from doing nothing.

### The XP economy (proposed, extending the currently-built partial system)

| Action | XP | Notes |
|---|---|---|
| Focus Session completed (`wasSuccessful: true`) | 1 XP per 5 minutes of the session's actual duration | Abandoned sessions earn 0 — already true today per [D1](04_Product_Requirements_Document.md#d1-focus-session) |
| Commitment met (self-reported) | +2 XP bonus | Only on top of an already-completed session — never awarded standalone, so a Commitment can't become its own XP farm |
| Quiz Attempt submitted | XP equal to points earned (1:1 with the quiz's own point scale) | **Built (2026-08-01)**. Matches the certifying weight a Quiz already carries — no separate, arbitrary XP number invented on top of it. Guarded by the same submit-once check `submitQuizFn` already enforces (`attempt.submittedAt`), so there's no separate idempotency mechanism to maintain |
| Practice Task completed **with a linked, genuinely-completed Focus Session** | 5 XP flat | Deliberately smaller and flatter than a Quiz — practice is lower-stakes by design (see [C2](04_Product_Requirements_Document.md#c2-practice-task-assignment)) — **and deliberately not earned from the completion toggle alone.** [Design Review Board](DESIGN_REVIEW_BOARD.md) blocker #1: a bare toggle has no server-verified engagement behind it (per [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md), a student's only interaction is "toggle complete only, not content"), so nothing stopped a student from marking one done with zero real work and collecting XP anyway. The fix reuses an already-built verification mechanism rather than inventing a new one: XP is awarded only when the toggle is *also* backed by at least one Focus Session already linked to that Practice Task via `taskId` — the same server-timed proof every other XP source in this table already requires |
| Live Game Session — each question answered correctly | 5 XP flat, **not** speed-weighted | Kept deliberately separate from the game's own `score` field, which stays speed-weighted purely for the fun of live play — conflating the two would mean a fast guesser earns more *learning* credit than a slower, more careful one, which is backwards |

**Anti-grinding rule (recommended, not yet implemented):** the first three Focus Sessions in a calendar day earn full XP; any beyond that earn half, until the next day resets the count. This exists specifically to prevent gaming the system with a rapid sequence of minimum-length sessions — a real risk once XP has any visible value at all, and cheaper to design for now than to patch after the fact.

~~A genuine, unresolved reconciliation...~~ — **resolved, Sprint 5**: `users.xp` deleted outright (confirmed zero readers anywhere in the app before removing it — it was never actually consulted, not even by this framework's own future consumers, since none of them exist yet either). `xp_ledger` is the sole source of truth this framework was already written to assume — every table above already describes a ledger entry, not a counter increment, so nothing here needs to change to match.

---

## 3. Mastery Path — growth per subject, not one global number

A student has one Mastery Path **per Subject they're enrolled in** — never a single, blended account level. This is the single most deliberate rejection in this entire framework of the generic mobile-game pattern: a student excelling in Mathematics and struggling in Kiswahili sees two honest, independent numbers, never one misleading average.

### The level curve (proposed)

| Level | Cumulative XP (in that subject) | Title |
|---|---|---|
| 1 | 0 | Novice |
| 2 | 100 | Apprentice |
| 3 | 250 | Practitioner |
| 4 | 450 | Adept |
| 5 | 700 | Skilled |
| 6 | 1,000 | Proficient |
| 7 | 1,400 | Accomplished |
| 8 | 1,900 | Expert |
| 9 | 2,500 | Master |
| 10+ | +900 per level, uncapped | Luminary (10), then unnamed beyond it |

The curve accelerates gradually (each level costs more than the last) — deliberate, so early progress feels fast (a new student sees real movement quickly) while sustained long-term engagement still has room to grow into. Titles were chosen to read as genuine craftsmanship progression (Novice → Master) rather than a video-game power-fantasy ladder, matching the non-childish tone established in [11_UI_UX_Design_System.md](11_UI_UX_Design_System.md).

**A real, deliberately-unresolved distinction, carried from the glossary**: **Learning Path** (a sequenced route through a subject's topics) is not the same system as Mastery Path (this XP-driven level track), and this document does not merge them. Whether Focus Flow eventually needs both, once real Competency/strand data exists (see [03_Product_Glossary.md](03_Product_Glossary.md)'s Competency entry), stays an open question for the PRD, not decided here for convenience.

---

## 4. Achievements & Badges

"Achievement" (the system name) and "Badge" (the plain-language UI term) name the exact same object — see [03_Product_Glossary.md](03_Product_Glossary.md). The catalog below organizes the 8 already-built keys alongside a proposed expansion, by category, so every badge's *reason for existing* is legible at a glance.

| Category | Badge | Trigger | Status |
|---|---|---|---|
| **Consistency** | Streak Starter | 3-day focus streak | Built |
| | Week Warrior | 7-day focus streak | Built |
| | Month of Focus | 30-day focus streak | Planned |
| **Deep Work** | Deep Work | One session with zero logged distraction events | Planned |
| | Century Club | 100 completed focus sessions | Built |
| | Marathon | 5+ completed focus sessions in a single day | Built (reinstated) |
| **Mastery** | First Mastery | Reached Mastery Path level 5 in any subject | Planned |
| | Multi-Subject | Reached level 3 in three or more subjects | Planned |
| | Comeback | A meaningfully improved score on a retry or Challenge | Planned |
| **Assignment Discipline** | Early Starter | Began assigned work well before its deadline, repeated | Planned |
| | Task Master | 50 completed tasks | Built |
| | Practice Makes Progress | 10 completed Practice Tasks | Built (2026-08-01) |
| **Social** | Study Partner | Constructive participation in a Live Game or Challenge | Planned |
| | Good Sport | Completed a Challenge through to the end, win or lose | Planned |
| **Milestone** | First Focus | Completed your first focus session | Built |
| **Time-of-day** | Early Bird | A session completed before 8am | Built |
| | Night Owl | A session completed after 8pm | Built (reinstated) |
| **Learning Outcomes** | Quiz Scholar | 10 submitted quiz attempts | Built (2026-08-01) — not in this table's original catalog; added alongside Quiz Attempt XP so the map reflects real learning volume, modeled on the existing Task Master pattern |
| | Quiz Ace | A perfect score on any quiz | Built (2026-08-01) — same reasoning as Quiz Scholar; the simplest genuine "quiz performance" signal computable from `quizAttempts` without the Mastery Path or Challenge systems this catalog's other Mastery/Social badges depend on |

> **Resolved, then reinstated (2026-08-01)**. Two badges — **Marathon** (5+ sessions in one day) and **Night Owl** (after 8pm) — rewarded exactly the kind of overwork and late-night study pattern Foundation 2 / Principle 6 (Student Wellbeing: "encourages healthy, balanced study habits rather than constant engagement") argues against. Per the [Design Review Board](DESIGN_REVIEW_BOARD.md)'s Educational Soundness finding, both were retired for a period — removed from `ACHIEVEMENT_DEFINITIONS`, unlock logic deleted from `achievement.service.ts` — rather than reframed with a counter-signal. They were subsequently reinstated by founder decision, with both triggers restored unchanged, as part of building the Journey Mode gamified map. The counter-signal option below remains the documented way to address the original wellbeing finding without retiring the badges again, if that's picked up later.

**Every badge is unlocked idempotently** (per [09_Database_Design.md](09_Database_Design.md)'s unique constraint on `(user_id, achievement_key)`) — re-evaluating already-unlocked criteria never re-fires or re-awards.

---

## 5. Missions

**Built, 2026-08-01** (`app/features/missions/hooks/useMissions.ts`). A Mission is a short-term goal scoped to a student's **real, currently-assigned coursework** — never a generic daily-login quest. Actual lifecycle as built, which deviates from this section's original "generated weekly" framing in one deliberate way — noted here rather than silently reworded to match:

- **Generated lazily on read, not on a weekly batch job.** Every time `getMissionsFn` runs (dashboard load), it tops up the student's Mission slots from their currently-assigned, not-yet-completed Practice Tasks and Quizzes with a future due date — nearest-due-date first. There is no cron/scheduled job in this codebase to hang a true weekly cadence off, and a continuously-topped-up slot achieves the same "always real, always current" property the weekly framing was protecting, at lower implementation cost. If a genuinely weekly *cadence* (as opposed to weekly *feel*) matters later, this needs a real scheduler, not a rename.
- A student has at most 3 active Missions at once — enough to feel like real, chosen goals, not a wallpaper of demands.
- A Mission expires the moment its underlying due date passes, whether or not it was completed — an expired Mission is not a failure to be shown punitively, it simply disappears (filtered out of `getMissionsFn`'s query, not deleted).
- A Mission is never generated with no real underlying Task or Quiz to reference — enforced both by the generation query (only pulls from real, currently-assigned, incomplete work) and a DB check constraint (`missions_exactly_one_reference`) requiring exactly one of `taskId`/`quizId`.
- Completion is computed live from the referenced Task's `completed` flag or a submitted `quizAttempt` — never a separate stored flag on the Mission row itself, so it can't drift out of sync with the real work it points at.

---

## 6. Challenges

An asynchronous, exactly-two-player rematch (see [F2](04_Product_Requirements_Document.md#f2-async-challenge-mode)) — the collaboration/persistence mechanic, distinct from the synchronous Live Game Session. Framing rules, specified here because they're gamification-integrity concerns, not just UX polish:

- The comparison view is neutral for both outcomes — there is no "You lost" framing, only both scores shown plainly.
- **Good Sport** (§4) is the only badge tied to Challenge outcome, and it triggers on completion regardless of who won — the system should never have a mechanic that only rewards winning, since that directly punishes exactly the students the anti-procrastination mission is trying to reach.

---

## 7. Seasonal events

Anchored to the real structure of a Kenyan school calendar (term start, mid-term, exam period) — not an arbitrary, generic "season." Deliberately **not** the same intensity throughout the term:

- **Term start** ("Fresh Start"): the highest-energy period — new Missions, a term-long Mastery Path push, celebratory framing for early engagement.
- **Mid-term**: a steady-state Mission cadence, unremarkable by design — this is the bulk of the term and doesn't need constant novelty to stay engaging if the core loop is working.
- **Exam period**: **gamification intensity deliberately decreases, not increases.** This is a genuine correction to the naive default (ramp up competition when stakes are highest) — a stressed student preparing for real exams should see calmer, more supportive framing (encouragement, wellbeing check-in prompts surfaced more, not fewer), not a louder competitive push. This is a direct application of Principle 6, not a separate idea.

---

## 8. Rewards — what's earned, and what never will be

**Reversal, 2026-08-04**: the original table below excluded any redeemable currency permanently. That's been reversed for one specific, narrow case — a coin economy that earns coins alongside XP (same events, roughly half the XP rate) and spends them in an avatar-customization shop (helmets, outfits, accessories, backgrounds). This is *not* a walk-back of §1's overjustification concern in general — it's a judgment call that a **strictly cosmetic** currency (zero effect on gameplay, grading, or standing) sits outside what that concern was actually guarding against. The line items that mattered most — no pay-to-win, no real-world prizes, losing rewarded as much as winning — are unchanged and still fully binding; the coin shop is built to respect all three (every game participant earns a completion bonus regardless of rank, and coins can never buy anything that affects a score, a grade, or an academic outcome).

| Earned (representational only) | Never (excluded permanently, per §1's overjustification/variable-ratio reasoning) |
|---|---|
| Badges (visual, catalog above) | Loot boxes or any randomized/mystery reward reveal |
| Mastery Path level-ups, with a tied 3D celebration moment (reusing the existing celebration system, [02_Product_Definition.md](02_Product_Definition.md)) | Pay-to-win boosts of any kind (XP multipliers, streak repair, purchased levels) |
| Cosmetic profile flourishes (e.g., a name-tag accent tied to highest Mastery Path level reached) | Real-world prizes or school-grade-affecting rewards tied to gamification standing |
| Unlocked celebration-scene variants at milestone levels | Redeemable currency that buys anything **other than** cosmetic avatar items — the coin shop is the one narrow exception, not a general opening |
| **Coins**, spent only in the avatar shop (see the FocusFlow Wayground-style expansion plan) — strictly cosmetic, never redeemable for anything with a gameplay, grading, or real-world effect | |

---

## 9. Anti-gaming & integrity

Every mechanic above depends on the server-side enforcement already established elsewhere in this document set — restated here as a checklist specifically against gamification abuse, not repeated for its own sake:

- Focus Session duration and completion are server-timed, never trusted from a client-reported value ([10_API_Architecture.md](10_API_Architecture.md)).
- Quiz and Challenge grading is always recomputed server-side from the real answer key — a client can never inflate its own XP by claiming a false score.
- Achievement unlocking is idempotent — no repeated-check exploit can re-award the same badge.
- **Recommended, not yet built**: a rate-limit or anomaly check on rapid-fire "genuine" completions (e.g., ten one-minute distraction-free sessions inside ten minutes) — the existing timing checks stop a client from *lying* about a session's duration, but don't yet stop a real, very short, repeatedly-completed session from being used as a grinding loop. Named here as a real gap the anti-grinding rule in §2 only partially addresses.

---

## 10. What this framework deliberately does not do

Restated concretely, now that every mechanic above has been specified, so this list reads as binding constraints on real features rather than abstract principle:

- No XP, badge, or level for opening the app, starting-but-abandoning a session, or any idle action.
- No public, school-wide, raw-score leaderboard, anywhere.
- No tangible or real-world-monetary reward of any kind. (The one exception, per §8's 2026-08-04 reversal: an in-app coin currency, spendable only on cosmetic avatar items — never redeemable for anything real, never affecting gameplay/grading.)
- No randomized or "mystery" reward mechanic.
- No pay-to-win or pay-to-restore mechanic (streak repair, purchased XP, or similar).
- No gamification mechanic that only rewards winning a Challenge or Live Game — losing gracefully is always at least as rewarded as winning.
- No increase in gamification intensity during a school's exam period — the opposite, by design.

---

## Open questions carried into engineering

- ~~Resolve the `users.xp` vs. `xp_ledger` source-of-truth question~~ — **done, Sprint 5**.
- ~~Decide the fate of the Marathon and Night Owl badges~~ — **resolved**: retired, then reinstated 2026-08-01 (§4).
- Decide whether Mastery Path and Learning Path are ultimately one system or two, once Competency/strand data exists.
- Build the remaining anti-grinding measures: the daily-diminishing-XP rule and the rapid-fire-completion anomaly check (§9) are still proposed, not yet implemented. The `startAssignmentFn` per-day XP cap and the Practice-Task-requires-a-linked-Focus-Session rule (§2) **have** been implemented, per the Design Review Board's blocker #1.
- Confirm the exact Mastery Path level curve and titles above with the founder before treating them as final — they are a concrete proposal, not a decision made unilaterally.

---

**Next:** [13_Anti_Procrastination_Framework.md] — expanding [D1](04_Product_Requirements_Document.md#d1-focus-session)–[D4](04_Product_Requirements_Document.md#d4-teacher-risk-signal) and [02_Product_Definition.md](02_Product_Definition.md)'s anti-procrastination philosophy into the same level of mechanical detail this document just gave gamification.
