# Sprint 1 — Review

## Sprint Review

Both objectives in [01_Sprint_1_Plan.md](01_Sprint_1_Plan.md) are complete and empirically verified, not just marked done. A real RLS gap was found and fixed along the way — the fan-out insert for Practice Tasks initially violated `tasks_self_access`'s `WITH CHECK`, exactly the kind of bug this project's "verify by attempting the cross-user access, don't assume the policy is right" convention exists to catch.

## Completed

1. **Roster removal** — `enrollments_update` RLS policy added (didn't exist before this sprint; confirmed missing by reading `apply-rls.ts` directly, per the plan's own named risk) and empirically verified. `removeStudentFn` soft-deletes via `enrollments.status = 'dropped'`, scoped to the requesting teacher's own class; a removed student's historical Task/Quiz/Focus Session data is untouched. UI: a remove button on each roster row in `/classes/$classId`.
2. **Practice Task assignment, end-to-end** — new `task_templates` table; `tasks` extended with `taskType` enum (`personal`/`practice`/`quiz_assignment`), `templateId`, `classId`; existing quiz-auto-tasks retagged `quiz_assignment` in the same pass. `createPracticeTaskFn` fans out one task per actively-enrolled student at assignment time only — a student who joins afterward correctly does not retroactively receive it, matching [C2](../04_Product_Requirements_Document.md#c2-practice-task-assignment)'s acceptance criteria exactly (verified directly in e2e, not just asserted).
3. **A real RLS bug found and fixed, not part of the original plan's risk list**: the fan-out insert (`createPracticeTaskFn` inserting a task row with `user_id` set to each student, not the teacher's own id) violated `tasks_self_access`'s `WITH CHECK (user_id = current_user_id())`. Found via a direct isolation script (`_verify_fanout.mjs`, bypassing the browser entirely) before it was ever mistaken for a test bug. Fixed with a new, narrowly-scoped `tasks_teacher_insert_practice` INSERT policy (`task_type = 'practice' AND class_id IS NOT NULL AND fn_is_class_teacher(class_id)`) — re-verified with a 4-case script: fan-out succeeds; exactly one task lands on the correct student; a teacher cannot use this policy to insert a `personal`-typed task for someone else; an unrelated teacher cannot insert into another teacher's class.
4. **`/tasks` grouping** — Personal / Assigned (Practice) / Assigned (Quiz), each its own section; Practice and Quiz groups correctly have no delete button (a student can complete an assigned task, not discard it).
5. **Teacher-side aggregate view** — a "Practice Tasks" panel on `/classes/$classId` showing each assigned task's completion count (e.g. "1 of 1 done") — aggregate only, no individual student behavioral inference, matching [06_User_Roles_And_Permissions.md](../06_User_Roles_And_Permissions.md)'s binding line.
6. **`deleteTaskFn` hardened** — scoped to `taskType = 'personal'` in addition to id/userId, closing a real gap where a student could otherwise delete an assigned Practice/Quiz task client-side and corrupt the teacher's aggregate count.

## Deferred

- **Commitment Setting** ([D3](../04_Product_Requirements_Document.md#d3-commitment-setting)) — originally floated in the roadmap as shipping alongside Practice Tasks; deliberately dropped from this sprint's scope to hold it to exactly two features, per the plan's own named "scope discipline" risk. Not built. Still next in line on the roadmap, corrected in [18_Product_Roadmap.md](../18_Product_Roadmap.md).
- **XP wiring for Practice Task completion** — correctly out of scope per the plan; the XP economy (Version 2.0) doesn't exist yet.
- Missions, Mastery Path — not touched, per the plan's explicit scope-discipline risk note.

## Known Issues

- The pre-existing e2e flake on `curriculum-onboarding.spec.ts` (recorded in [00_Sprint_0_Review.md](00_Sprint_0_Review.md), Known Issue #1) was **not observed this sprint** across the full suite runs performed, but is not claimed fixed — no code in this sprint touched that test's path, so its absence this run is consistent with the prior finding that it's memory-pressure-related, not a re-verification that it's gone.
- The CI workflow still has never run on a real GitHub Actions runner — still no remote configured for this repository. Unchanged from Sprint 0.

## Documentation Updated?

Yes — [04_Product_Requirements_Document.md](../04_Product_Requirements_Document.md) (C2, B4), [03_Product_Glossary.md](../03_Product_Glossary.md) (Practice Task status), [09_Database_Design.md](../09_Database_Design.md) (`tasks` columns, new `task_templates` table, full RLS-gap account), [06_User_Roles_And_Permissions.md](../06_User_Roles_And_Permissions.md) (Teacher rows, resolved open question), [05_Information_Architecture.md](../05_Information_Architecture.md) (`/classes/$classId` route), [18_Product_Roadmap.md](../18_Product_Roadmap.md) (Version 1.1 marked shipped, Commitment Setting claim corrected).

## Tests Passed?

- `tsc -b`: clean.
- `npm run lint`: clean.
- `npm run test:unit`: 12/12 passing (unchanged from Sprint 0 — no new pure logic was extractable this sprint; the fan-out targeting rule lives in a server function with a DB round-trip, not a pure function).
- `npx playwright test`: 10/10 passing (5 new in `e2e/practice-tasks.spec.ts`, plus the 5 pre-existing suites), after several rounds of fixing genuine test-authoring bugs (Radix dialog scoping, non-exact `getByText` collisions, a test-sequencing mistake that was actually the app behaving correctly) — none of which were app defects.

## Ready for Next Sprint?

**Yes.** Both Known Issues are carried forward openly, unchanged from Sprint 0, not newly introduced. Commitment Setting is the natural next scope, now that Practice Tasks (its stated pairing rationale) actually exists to attach it to.
