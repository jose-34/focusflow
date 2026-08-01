# Focus Flow: Product Roadmap

*This document introduces no new scope. It takes every "Planned" item and every open question named across all seventeen prior documents and sequences them into one ordered plan — cross-referenced back to where each item was actually specified, not redefined here.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md), and by [01_Product_Vision.md](01_Product_Vision.md)'s own recommendation: sequence deliberately behind the core wedge, never bundle the whole ecosystem at once. This roadmap is the concrete expression of that recommendation, not a restatement of it.

---

## Version 1.0 — "Ready for a real school" (hardening, not new features)

**Already built and real**, as of this document set: curriculum-aware classes, role-guided signup, role-based dashboards (Phase 1 of the original redesign plan — complete), Tasks, Focus Timer, Quizzes (author/take/grade), Live Game Sessions, Achievements, Wellness, Progress — plus, from this session specifically, two real RLS vulnerabilities found and fixed ([09_Database_Design.md](09_Database_Design.md)).

**What must happen before wider rollout — not a new feature, a trust prerequisite**: Version 1.0 is the release that makes Focus Flow real and safe to run for an actual school, not the release that adds the next feature:

- Legal review of the parental-consent question ([15_Security_Privacy.md](15_Security_Privacy.md) §7) — the highest-priority item on this entire roadmap, since it's the one thing that could block legitimate operation entirely if resolved wrong. **Not engineering work — needs a founder/legal decision, not code.**
- ~~First real deployment, satisfying the persistent-process constraint for Live Game Sessions~~ — **done**: live on Railway, WebSocket game server on the same process/port as the main app ([17_Deployment_Architecture.md](17_Deployment_Architecture.md) §2, §4).
- Automated backups + a tested restore procedure ([17_Deployment_Architecture.md](17_Deployment_Architecture.md) §10) — **not yet done**.
- Basic error monitoring, evaluated against Principle 6 before adoption ([17_Deployment_Architecture.md](17_Deployment_Architecture.md) §6) — **not yet done**.
- The RLS cross-user-isolation security test suite, formalized from the pattern that already caught real bugs every sprint since ([16_Testing_Strategy.md](16_Testing_Strategy.md) §6) — **still ad hoc** (a throwaway verification script per sprint, not a permanent, repeatable suite).
- ~~Reconcile `users.xp` vs. `xp_ledger` as one source of truth~~ — **done, Sprint 5** ([09_Database_Design.md](09_Database_Design.md), [12_Gamification_Framework.md](12_Gamification_Framework.md)): `users.xp` deleted (confirmed zero readers anywhere before removing it), `xp_ledger` is sole source of truth. See [05_Sprint_5_Review.md](sprints/05_Sprint_5_Review.md).

---

## Version 1.1 — Sprint 1: Practice Tasks + Roster Management — **shipped**

- ~~Practice Task assignment system~~ — **done**: `task_templates`, `tasks.taskType` enum, teacher-assign-to-class flow ([C2](04_Product_Requirements_Document.md#c2-practice-task-assignment)). Found and fixed a real RLS gap along the way (`tasks_teacher_insert_practice`) — see [09_Database_Design.md](09_Database_Design.md).
- **Also folded in, reality-checked before the sprint started**: roster removal (soft-delete an enrollment) — the one real gap in an otherwise-already-built "Teacher Foundation."
- ~~Unit tests for `computeStreaks` and the `riskScore` calculation~~ — **already done in Sprint 0**, ahead of this version, not bundled here as originally planned. See [docs/sprints/00_Sprint_0_Review.md](sprints/00_Sprint_0_Review.md).
- ~~Deferred, not part of this sprint~~ — **Commitment Setting shipped in Sprint 2** ([D3](04_Product_Requirements_Document.md#d3-commitment-setting)): required commitment before a Focus Session starts, shown back with a skippable Met/Not Met self-check at completion. See [docs/sprints/02_Sprint_2_Review.md](sprints/02_Sprint_2_Review.md).

## Version 1.2 — Phase 3: Unified Focus System — **shipped**

Sprint 3 shipped the small, safe slice first (see [03_Sprint_3_Review.md](sprints/03_Sprint_3_Review.md)); Sprint 4 designed and shipped the real architectural work, since [08_System_Architecture.md](08_System_Architecture.md) — cited here as the design source — turned out to contain no actual target schema for the merge (see [04_Sprint_4_Review.md](sprints/04_Sprint_4_Review.md) for the full account, designed collaboratively before any code was written):
- ~~Delete `app/db/schema/focus.ts`~~ — **done, Sprint 3**.
- ~~**Fix**: a quiz-linked focus session currently never unlocks an achievement~~ — **done, Sprint 3**.
- ~~Merge `focus_sessions` and the `start_events`/`focus_heartbeats` system into one~~ — **done, Sprint 4**. `start_events` deleted, folded into `focus_sessions` (created immediately at start, not deferred to the first heartbeat); `focus_heartbeats` kept (the real anti-gaming signal quiz-taking needs, that Pomodoro's live countdown doesn't) but simplified and given its first real FK.
- ~~Reconcile XP awarding between the two paths~~ — **done, Sprint 4**: every completed focus session, Pomodoro or quiz-linked, now earns the same duration-based XP via one shared helper. The assignment-start bonus stays quiz-only, since only quiz-linked sessions have a "started promptly" signal to reward.
- ~~Resolve the polymorphic `assignment_id` pattern~~ — **done, Sprint 4**: retyped to a real `quiz_id` FK, confirmed non-polymorphic in practice (one call site, always a quiz id) before the change, not assumed.

**Still open, deliberately not part of Sprint 4**: reflection prompts extending the existing Wellness Check-in ([13_Anti_Procrastination_Framework.md](13_Anti_Procrastination_Framework.md) §8) — a natural next fit now that session-completion is one unified code path, not two.

---

## Version 2.0 — Phase 4: Gamification expansion

- The full XP economy from [12_Gamification_Framework.md](12_Gamification_Framework.md) §2, including the anti-grinding rule.
- Mastery Path — per-subject levels, the curve proposed in [12_Gamification_Framework.md](12_Gamification_Framework.md) §3.
- Expanded Achievement/Badge catalog ([12_Gamification_Framework.md](12_Gamification_Framework.md) §4). Marathon/Night Owl are already resolved (retired, ahead of schedule per the Design Review Board) rather than deferred to this version.
- Missions ([12_Gamification_Framework.md](12_Gamification_Framework.md) §5).
- ~~The already-built but orphaned `PodiumScene.tsx` finally wired into the Live Game finale~~ — **correction**: verified against `app/routes/game.play.$sessionId.tsx` that it is already imported and rendered in the `finished`-phase view. This was never orphaned; the line above was a factual error, not a real task.

## Version 2.1 — Phase 5: Quiz Bank + Challenge

- Public Quiz Bank ([F3](04_Product_Requirements_Document.md#f3-public-quiz-bank)).
- Async Challenge mode ([F2](04_Product_Requirements_Document.md#f2-async-challenge-mode)).
- **Fix**: `getQuizForStudentFn` never returns `isCorrect`, even post-submission — dead correct/incorrect UI, fixed while this version is already rewriting this file's response mapping ([10_API_Architecture.md](10_API_Architecture.md)).
- **Platform Administrator role + the audit-log mechanism it depends on** ([06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md), [15_Security_Privacy.md](15_Security_Privacy.md) §4) — ships together deliberately, since this version's Public Quiz Bank is exactly the content Platform Administrator exists to moderate; building the role without something for it to moderate yet would be premature.

## Version 2.2 — Phase 6: Trend analytics

- Class Trend Analytics ([H2](04_Product_Requirements_Document.md#h2-class-trend-analytics)) — the concrete chart specification from [14_Analytics_And_Reporting.md](14_Analytics_And_Reporting.md) §2.
- **Fix**: `/progress`'s longest streak is bounded by its own 14-day query window — a shared, all-time `computeStreak()` utility fixes it here.
- The student-facing personal Growth view ([14_Analytics_And_Reporting.md](14_Analytics_And_Reporting.md) §1) — the genuine, named competitive differentiator (no platform in [01_Product_Vision.md](01_Product_Vision.md)'s analysis builds one), shipped alongside the teacher-facing trend work since both draw on the same underlying data.

---

## Version 3.0 — Beyond one classroom

- Guardian role, and the notification service it (and the teacher's private nudge) both depend on ([A3](04_Product_Requirements_Document.md#a3-guardian-invitation--access), [08_System_Architecture.md](08_System_Architecture.md)) — the notification-channel decision is a prerequisite, not a detail to resolve mid-build.
- School Administrator role, aggregate-only per the hard line drawn in [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md) and [14_Analytics_And_Reporting.md](14_Analytics_And_Reporting.md) §3.
- Narrow, reviewable AI-assisted draft generation ([02_Product_Definition.md](02_Product_Definition.md), [08_System_Architecture.md](08_System_Architecture.md)) — quiz/practice question drafts and risk-signal summaries, always teacher-approved before reaching a student, an AI provider decision made at this point, not earlier.
- Object storage + the Resource (file/link sharing) feature it unblocks ([08_System_Architecture.md](08_System_Architecture.md)).
- **Resolve the CBC vs. CBE curriculum-modeling question** ([02_Product_Definition.md](02_Product_Definition.md), [03_Product_Glossary.md](03_Product_Glossary.md)) — a prerequisite for any senior-school (Grades 10–12) rollout, since junior and senior competency-based subjects genuinely differ.

---

## Future vision (beyond Version 3 — matches [01_Product_Vision.md](01_Product_Vision.md)'s Years 3–10 horizon)

- Expansion across East Africa (Uganda, Tanzania) and other underserved curricula (Nigeria, South Africa's CAPS), using the same real-data, no-migration curriculum modeling proven for CBC/Cambridge.
- Redis-backed pub/sub for the WebSocket layer, once real usage justifies more than one server instance ([17_Deployment_Architecture.md](17_Deployment_Architecture.md) §8) — not before.
- Full Competency/strand-level data model, resolving Mastery Path vs. Learning Path ([12_Gamification_Framework.md](12_Gamification_Framework.md) §3, [14_Analytics_And_Reporting.md](14_Analytics_And_Reporting.md) §4) — the prerequisite for true competency-based mastery reporting.
- A Stream/Cohort object ([03_Product_Glossary.md](03_Product_Glossary.md)), only if real school usage shows the current "several classes sharing the same students" model is genuinely insufficient — not built speculatively ahead of that evidence.

---

## Milestones

Tied directly to [01_Product_Vision.md](01_Product_Vision.md) §11's proposed success metrics, not a separate set invented here:

- **M1**: First real school running Version 1.0 in production, with a signed-off legal answer on parental consent.
- **M2**: Teacher month-8 retention measured for the first time, on a real cohort — the single metric [01_Product_Vision.md](01_Product_Vision.md) names as most predictive of institutional survival.
- **M3**: A school with 3+ independently-adopting teachers — the first real evidence of organic, bottom-up spread rather than a single champion using the tool alone.
- **M4**: Version 2.2 shipped and the student-facing Growth view has real, multi-week data to show at least one real student.

---

## Release strategy

Matches the already-confirmed decision in [01_Product_Vision.md](01_Product_Vision.md): **evolve in phases, never rip-and-replace**, and per [16_Testing_Strategy.md](16_Testing_Strategy.md) §7, every version above gets a real UAT pass — a real teacher and a small group of real students trying the golden path in an actual classroom-equivalent setting — before it rolls out further, not just an internal QA pass. Once [17_Deployment_Architecture.md](17_Deployment_Architecture.md)'s CI/CD pipeline exists, each version's merge to main should pass the full test sequence from [16_Testing_Strategy.md](16_Testing_Strategy.md) before it ships — a gate to build toward, not assumed already in place.

---

## Open questions carried into engineering

- Confirm this sequencing with the founder before treating it as committed — several orderings above (e.g., bundling Commitment Setting with Practice Tasks) are judgment calls, not the only valid sequence.
- Revisit this roadmap after Version 1.0's legal review — a restrictive answer on parental consent could change what's actually buildable in later versions, not just when.

---

**Next:** [19_Implementation_Guide.md] — the engineering manual every version above should actually be built against: Requirements → Architecture → Database → API → Backend → Frontend → Testing → Documentation → Deployment → Review, no shortcuts.
