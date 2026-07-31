# Sprint 1 — Practice Tasks + Roster Management

*Reality-checked before writing this: "Teacher Foundation" (the sprint originally proposed) was ~90% already built. This sprint folds in the one real gap found (roster removal) and spends the rest on the first genuinely new, substantial feature on the roadmap — Practice Tasks, Version 1.1, already fully specified in [C2](../04_Product_Requirements_Document.md#c2-practice-task-assignment).*

## Sprint Number
1

## Objectives

1. Close the real Teacher Foundation gap: a teacher can remove a student from their class roster.
2. Ship Practice Tasks end-to-end: teacher assigns an ungraded rehearsal task to a class; it fans out to every actively-enrolled student; students see it grouped separately from personal tasks and quiz-linked tasks; a teacher sees aggregate completion.

## Features

- **Roster removal** — soft-delete (`enrollments.status = 'dropped'`), not a hard delete, matching the existing (currently unused) enum value and preserving historical enrollment data.
- **Practice Task assignment** — new `task_templates` table; `tasks` gains `templateId`, `classId`, and a `taskType` enum (`personal`/`practice`/`quiz_assignment`); the existing quiz-auto-task creator gets retagged `quiz_assignment` in the same pass.
- **No XP wiring** — deliberately out of scope. The XP economy (Version 2.0) doesn't exist yet (`users.xp`/`xp_ledger` reconciliation is still an open item); building XP-gating now would mean gating against a system that isn't real yet.

## Dependencies

- None external. Everything needed (`fn_is_class_teacher`, the `enrollments.status` enum, the `tasks` table) already exists.

## Risks

- **`enrollments_update` doesn't exist as an RLS policy today** — confirmed by reading `apply-rls.ts` directly; only select/insert/delete exist. Must be added and empirically verified (per [CONTRIBUTING.md](../../CONTRIBUTING.md)'s standing rule) before roster removal can work at all.
- **Scope discipline**: it would be easy to also build Missions or XP here since they're adjacent in the docs — explicitly not doing that. This sprint is Practice Tasks and roster removal only.

## Acceptance Criteria

- ✓ A teacher can remove a student from their class; the student disappears from the active roster; their historical Task/Quiz/Focus Session records are untouched.
- ✓ A teacher can assign a Practice Task to a class; exactly one task row is created per actively-enrolled student, tagged `practice`.
- ✓ A student joining after assignment does not retroactively receive it (matches [C2](../04_Product_Requirements_Document.md#c2-practice-task-assignment)'s acceptance criteria exactly).
- ✓ `/tasks` groups Personal / Assigned (Practice) / Assigned (Quiz) for students.
- ✓ A teacher sees an aggregate completion count, never individual student behavioral inference (that's the Risk Signal's job, not this feature's).
- ✓ Existing quiz-auto-created tasks are retagged `quiz_assignment`, verified via a direct query, not assumed.

## Testing Plan

- Empirical RLS check for the new `task_templates` and `enrollments_update` policies (two real users, cross-user isolation), per the now-standing project convention.
- Unit test for any new pure logic (the fan-out targeting rule, if it's extractable).
- E2E: teacher creates a Practice Task → student sees it grouped correctly → student completes it (with and without a linked Focus Session, since that distinction matters for the *future* XP rule even though XP itself isn't wired yet) → teacher sees the aggregate count. Separately: teacher removes a student → student's dashboard/roster reflects it, their own historical data is intact.

## Definition of Done

Per [VERSIONING.md](../VERSIONING.md) and [19_Implementation_Guide.md](../19_Implementation_Guide.md)'s ten-stage checklist, applied here as it was for Sprint 0.
