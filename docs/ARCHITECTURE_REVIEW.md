# Focus Flow: Architecture Review Report — Phase 0

*An independent design review of the complete `-01` through `19` documentation set, performed before any implementation begins. Method: a fresh, independent read of all 21 documents by a separate reviewer with no authorship stake in them, cross-checked directly against the real codebase (schema files, `apply-rls.ts`, server function handlers) rather than trusted at face value — then the most consequential findings were independently re-verified a second time before inclusion here. Several real, previously-unnoticed problems surfaced. This report does not soften them to make the documentation phase look more finished than it is.*

---

## Strengths

- The documentation set is internally coherent at the level of *reasoning*: every major decision (curriculum-native modeling, the anti-procrastination wedge, the rejection of raw leaderboards and opaque predictive models, the Platform Administrator audit requirement) is traceable to a specific principle or a named psychological/legal source, not asserted by fiat.
- Where real bugs were found during the documentation process itself (two RLS gaps, a streak-truncation bug, a dead `isCorrect` response field), they were reported plainly rather than quietly fixed and hidden — the right instinct, even though (see Inconsistencies) the execution of that instinct had a real gap.
- Genuine, substantive pushback exists in several places rather than compliant agreement with the brief: Performance Predictions (14 §8), the Marathon/Night Owl badge tension (12 §4), the Live Game Mode's honest scoping as an engagement driver rather than a procrastination fix (02, 05).
- The Built/Planned tagging discipline, applied consistently, makes it possible to audit this documentation against reality at all — most of this report's findings were only findable *because* that discipline exists.

---

## Risks

### R1 — Two Principle-1-violating mechanics are already live in shipped code, not merely "planned to be fixed later"

- **Practice Task XP is unearned by design as specified.** Per [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md), a student's only interaction with a Practice Task is "toggle complete only, not content" — no minimum engagement, no linked Focus Session, no server-side timing check. As specified in [C2](04_Product_Requirements_Document.md#c2-practice-task-assignment) and [12_Gamification_Framework.md](12_Gamification_Framework.md) §2, nothing stops a student from toggling it done with zero real engagement and collecting XP — the exact thing Principle 1 exists to prevent.
- **`startAssignmentFn`'s flat 10-XP "start" bonus is already live** in `app/features/focusMode.ts`, and it is exploitable today: idempotency only blocks re-starting the *same* assignment, so starting many different assignments in quick succession collects 10 XP each with minimal engagement. [12_Gamification_Framework.md](12_Gamification_Framework.md)'s anti-grinding rule (§2/§9) is explicitly "recommended, not yet implemented" — but the code path it's meant to guard is not hypothetical, it's shipping now.

### R2 — A real safety blind spot: nobody, ever, sees a wellness disclosure

`wellness_logs` is deliberately self-access-only — "not even an aggregate" view exists for a teacher, by design, confirmed in both the documentation and the actual RLS comment ("mood/notes are private mental-health-adjacent data"). No document in the set considers what happens if a minor discloses something genuinely alarming (self-harm, abuse) in a wellness note. As specified, the system structurally guarantees no adult ever sees it. This is not a hypothetical edge case for a product whose actual users are children — it needs an explicit answer, not silence.

### R3 — Cascade-delete collateral risk on the exact feature framed as protecting privacy

`classes.teacher_id` cascades on delete. A teacher exercising their own right-to-erasure ([15_Security_Privacy.md](15_Security_Privacy.md), [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md)) would cascade-delete their classes → their students' enrollments, quiz attempts, and grades — none of which the students asked to have deleted. The erasure capability is framed positively everywhere it's mentioned; its actual blast radius is examined nowhere.

---

## Inconsistencies

### I1 — The XP-path fact is stated backwards in three documents, and the real code disagrees with all of them

[03_Product_Glossary.md](03_Product_Glossary.md) ("today only wired to the Pomodoro path"), and the assumption carried into [04_Product_Requirements_Document.md](04_Product_Requirements_Document.md) (E1) and [12_Gamification_Framework.md](12_Gamification_Framework.md) (§2's economy table), all have this **backwards**. Verified directly: `app/features/timer/hooks/useFocusSession.ts` (the Pomodoro path) contains zero `xpLedger` writes. `app/features/focusMode.ts` (the quiz-assignment engagement path) is the one that actually writes XP. Every document describing "the Pomodoro path" as the one that currently awards XP is describing the wrong system.

### I2 — 09_Database_Design.md's own flagship "we found and fixed two real bugs" case study is stale and self-contradicting

Verified directly: `app/db/apply-rls.ts` already contains `xp_ledger_self_access`, `start_events_self_access`, and `focus_heartbeats_self_access`, each with an inline comment reading `// Fix, 09_Database_Design.md: ...` — both bugs were fixed within the same session doc 09 was written in. But **doc 09's own text was never updated** to reflect this: it still reads, present-tense, "not fixed inline... fails silently or throws today." Meanwhile [15_Security_Privacy.md](15_Security_Privacy.md), [16_Testing_Strategy.md](16_Testing_Strategy.md), and [18_Product_Roadmap.md](18_Product_Roadmap.md) all correctly describe the same two bugs as already fixed. The one document repeatedly cited elsewhere as proof the process works is itself internally stale — a real, slightly ironic gap in the flagship example.

### I3 — `PodiumScene.tsx` is already wired in, not orphaned

[18_Product_Roadmap.md](18_Product_Roadmap.md) Version 2.0 lists as future work: "the already-built but orphaned `PodiumScene.tsx` finally wired into the Live Game finale." Verified directly: `app/routes/game.play.$sessionId.tsx` already imports and renders it in the `finished`-phase view. This roadmap line is describing already-completed work as a future task.

### I4 — The schema violates a naming rule the glossary itself set specifically to prevent this

[03_Product_Glossary.md](03_Product_Glossary.md)'s own Assignment entry states: "Anyone writing a requirement or a schema should never create an 'Assignment' table or type — say specifically which of the two [Task or Quiz] is meant." Yet `start_events`, `focus_heartbeats`, and `focus_sessions` all carry a literal, untyped `assignment_id` column, polymorphically referencing either a Task or a Quiz with no FK constraint. [09_Database_Design.md](09_Database_Design.md) documents the missing-FK integrity half of this gap prominently but never notices the naming half — even though the rule it's violating was written specifically to prevent it.

### I5 — Minor precision gaps

"Consistency" is used in [02_Product_Definition.md](02_Product_Definition.md) as if naming one specific badge, but [12_Gamification_Framework.md](12_Gamification_Framework.md) correctly uses it as a *category* containing three separately-named badges — no badge is actually named "Consistency." Also: [08_System_Architecture.md](08_System_Architecture.md) and [15_Security_Privacy.md](15_Security_Privacy.md) both say "bcrypt"; `package.json` actually depends on `bcryptjs`, a distinct package — a small but real gap in documents that repeatedly claim to be verified against real source.

---

## Missing requirements

1. **Wellness-disclosure escalation path** — see R2. Not named as an open question anywhere; it should be.
2. **Password reset / account recovery** — no flow exists or is documented, and it compounds with the already-known absence of any notification service.
3. **Email verification at registration** — not addressed anywhere.
4. **Localization/i18n** — never named as a gap, despite Kiswahili being a recurring example subject and the product being framed as built specifically for Kenyan classrooms.
5. **Offline/connectivity-drop handling** — heavily emphasized low-end-device and metered-data constraints (00, 01, 17) are addressed for bundle size and rendering cost, but not for a session's data surviving a mid-session connectivity drop.
6. **Login rate-limiting / brute-force protection** — [15_Security_Privacy.md](15_Security_Privacy.md) names the absence of MFA but not this.
7. **Roster bulk-import** — worth at least naming as an open question given the vision doc's own 40–50-student-class persona; manual join-by-code is the only path specified anywhere.
8. **Data model gaps for several heavily-emphasized Planned features** — Commitment Setting (no column/table proposed anywhere for the commitment text itself, despite being called one of the most original mechanics in the whole set), Missions (no table), Async Challenge (no relationship record for who challenged whom), Mastery Path (the product's most-repeated differentiator, with a full level curve specified in doc 12, has no schema treatment beyond one comment), and Guardian (a fully-specified role across four documents, with zero mention anywhere in 09_Database_Design.md — not even a stub).

---

## Scope creep candidates

- **Platform Administrator**, introduced wholesale in [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md) with a brand-new required subsystem (audit logging) attached, has no antecedent anywhere in the founding vision (00/01/02) and currently has zero real users. [01_Product_Vision.md](01_Product_Vision.md) names "scope sprawl" as its own top risk and explicitly recommends sequencing over bundling — a fully-specified permission matrix and mandatory new infrastructure for a role nobody occupies yet is arguably exactly what that recommendation warns against.
- **Three full Planned-role permission matrices** (Guardian, School Administrator, Platform Administrator) are documented at the same structural depth as the two real, Built roles — worth asking whether that depth was earned yet, or borrowed against a future that hasn't arrived.

---

## Recommendations, prioritized

1. **Fix the two live Principle-1 exploits (R1) before Version 1.0** — this is a code fix, not a documentation fix, and it's more urgent than anything currently scheduled in Version 1.0.
2. **Answer R2 (wellness-disclosure escalation) explicitly** before treating the current wellness design as final — silence on this is itself a decision, and not obviously the right one.
3. **Correct the factual record**: fix doc 09's stale critical-findings section (I2), fix the XP-path direction in docs 03/04/12 (I1), fix the PodiumScene roadmap line (I3) — all quick, all just require updating text to match already-verified reality.
4. **Resolve the `assignment_id` naming/FK gap (I4)** as part of the Phase 3 focus-system unification already scheduled — it's the same area of the schema, no new work item needed, just don't let the naming violation ship unexamined.
5. **Name R3 (cascade-delete collateral risk) as an explicit open question** in [15_Security_Privacy.md](15_Security_Privacy.md) — likely needs a "soft delete / anonymize the teacher, preserve student records" approach rather than the current hard cascade, but that's a design decision for the founder, not resolved here.
6. **Reconsider the Platform Administrator / three-role-matrix scope** against [01_Product_Vision.md](01_Product_Vision.md)'s own sequencing advice — possibly defer the full permission-matrix depth for Guardian/School Admin/Platform Admin until closer to when each is actually built, keeping the current specs as a lighter sketch until then.
7. **Add the missing data models (§8 above)** for Commitment, Missions, Challenge, Mastery Path, and Guardian to [09_Database_Design.md](09_Database_Design.md) — none require new design thinking, since all are already fully specified conceptually elsewhere; this is a documentation-completeness gap, not an open design question.

---

## Verdict: Conditional Pass

The documentation is **not rejected**, but it is **not an unqualified "Ready for Implementation" either.** The reasoning throughout is genuinely sound, and most findings above are fast to close — corrections to text, not new design work. But two of them (R1's live exploits, R2's safety blind spot) are real enough that starting Version 1.0 implementation before they're explicitly addressed would mean knowingly shipping a hardening release with a known gamification integrity hole and an unanswered child-safety question already sitting in the documentation that supposedly cleared it for launch.

**Recommended gate**: resolve R1 and R2 explicitly (a fix or a deliberate, stated decision for each — not necessarily a fully-built solution yet, but not silence either), correct the five factual inconsistencies above, then proceed to Version 1.0.
