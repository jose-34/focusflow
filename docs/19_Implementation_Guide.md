# Focus Flow: Implementation Guide

*The engineering manual. Every implementation — whether the next engineer is a human or an AI agent — follows the same ten stages, in order, for every feature. No shortcuts, because this project has already paid the real cost of one: the two live RLS vulnerabilities in [09_Database_Design.md](09_Database_Design.md) both trace back to exactly one skipped step below (§3), not a mystery bug.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md) — read that one first, always, before this or any other document. This is the last document in the set; it is also the first one any new implementation work should be checked against.

```
Requirements → Architecture → Database → API → Backend → Frontend → Testing → Documentation → Deployment → Review
```

Each stage below states what "done" means, which prior document it's checked against, and a real, project-specific failure mode to watch for — not generic engineering advice, the actual gotchas this specific codebase has already hit. A single worked example, **Practice Tasks** (the next item on [18_Product_Roadmap.md](18_Product_Roadmap.md), Version 1.1), runs through all ten stages to keep this concrete rather than abstract.

---

## 1. Requirements

**Done when**: the feature has a real entry in [04_Product_Requirements_Document.md](04_Product_Requirements_Document.md) — Purpose, Actors, Inputs, Outputs, Rules, Acceptance Criteria — tagged Built or Planned accurately, using terms exactly as defined in [03_Product_Glossary.md](03_Product_Glossary.md).

**Watch for**: starting to code against a feature described only in conversation or a roadmap bullet, not yet in the PRD — the PRD entry is what Testing (§7) and Review (§10) get checked against; skipping it means there's nothing concrete to verify the implementation against later.

**Practice Tasks**: already fully specified at [C2](04_Product_Requirements_Document.md#c2-practice-task-assignment) — this stage is already done, confirm the spec still matches intent before starting, don't re-derive it.

---

## 2. Architecture

**Done when**: you've confirmed which existing pattern in [08_System_Architecture.md](08_System_Architecture.md) the feature fits — a new server function against Postgres, an extension of an existing table, or (rarely) a genuinely new service — *before* writing code, not discovered mid-implementation.

**Watch for**: assuming a new external dependency is needed (a queue, a new service) when the existing `createServerFn` + Postgres pattern already covers it — three of this document set's Planned features (Resource storage, Notifications, AI) *do* need a new dependency, and that's named explicitly in §8/§9's confirmed gaps; most features don't, and inventing one anyway is scope creep the roadmap explicitly warns against.

**Practice Tasks**: fits the existing pattern exactly — one new table (`task_templates`), a fan-out insert into the existing `tasks` table, both via ordinary server functions. No architecture document update needed; confirming that is this stage's actual work.

---

## 3. Database — the stage that caused both real bugs this session

**Done when**: every new table or column has real constraints and indexes specified per [09_Database_Design.md](09_Database_Design.md)'s conventions, **and its RLS policy body is written into `apply-rls.ts`, not only as a bare `pgPolicy()` name-stub in the schema file** — and then **verified empirically**, the same way [09_Database_Design.md](09_Database_Design.md)'s own findings were: seed two distinct real users, attempt cross-user access through `withRlsContext`, confirm isolation holds.

**This is the one step this entire guide exists to protect**, stated plainly: `xp_ledger`'s policy body was written in its schema file and never added to `apply-rls.ts` — drizzle-kit push silently dropped it, and the gap went undetected until a documentation exercise happened to test it directly. `start_events`/`focus_heartbeats` never had `.enableRLS()` called at all. Neither was caught by `tsc`, by code review, or by the app appearing to work — both were caught only by the exact empirical test named above. **No database stage is "done" without that test having actually been run, once, for real, against the live database** — not assumed correct because the code looks like every other table's.

**Practice Tasks**: `task_templates` needs a policy (`for: 'all'`, scoped by `fn_is_class_teacher(class_id)`) added to `apply-rls.ts`, and the fan-out-created `tasks` rows need to confirm they're covered by the *existing* `tasks_self_access`/`tasks_teacher_select` policies rather than needing a new one — verify this explicitly, don't assume the existing policy "probably covers it."

---

## 4. API

**Done when**: every new server function is documented in the same shape as [10_API_Architecture.md](10_API_Architecture.md) — conceptual route, input, output, permission rule — and the permission rule matches [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md)'s matrix exactly, not a plausible-sounding approximation of it.

**Watch for**: forgetting that server function calls never appear under their own name in a network tab (`/_serverFn/<base64>`, seroval-encoded) — if writing any new debug tooling or test assertions against these endpoints, match on the decoded function name or the response's real key names, not a URL substring.

**Practice Tasks**: `createPracticeTaskFn` (teacher-only, per [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md)'s Teacher row) — document it before or alongside writing it, not after.

---

## 5. Backend

**Done when**: the handler follows the fixed shape every other server function in this codebase already uses — `requireUser()` first, then `withRlsContext`, and **any client-suppliable ID that implies ownership is re-verified server-side**, exactly like `startFocusSessionFn` already re-verifies a `taskId` belongs to the caller rather than trusting it.

**Practice Tasks**: the fan-out insert (one task row per enrolled student) must scope to *actively* enrolled students only, matching [C2](04_Product_Requirements_Document.md#c2-practice-task-assignment)'s acceptance criteria precisely — a dropped student who somehow still matched the query would be a real, subtle correctness bug, not just an edge case to shrug off.

---

## 6. Frontend

**Done when**: new UI reuses existing primitives (`Card`, `Button`, `DashboardShell`, `nav-config.ts`) rather than inventing a parallel pattern, per [11_UI_UX_Design_System.md](11_UI_UX_Design_System.md), and any new route follows [05_Information_Architecture.md](05_Information_Architecture.md)'s routing conventions.

**Watch for**: the TanStack Router implicit-parent-layout trap — a bare leaf route file that later grows a child silently becomes a non-rendering layout, with no error, just a URL that changes while the old page keeps showing. This has already happened twice, at two different nesting depths, in this project's real history.

**Practice Tasks**: per [05_Information_Architecture.md](05_Information_Architecture.md), this needs **no new route at all** — it's a panel on the existing class-detail page. If a new route is being added for this feature, that's a sign the IA document wasn't checked first.

---

## 7. Testing

**Done when**: at minimum, a Playwright E2E golden-path test exists; the new table has a cross-user-isolation test per [16_Testing_Strategy.md](16_Testing_Strategy.md) §6 (once that suite is formalized); any new pure logic (a calculation, not just a CRUD path) has a unit test.

**Watch for**: the operational realities named in [16_Testing_Strategy.md](16_Testing_Strategy.md) — kill orphaned `chrome.exe` and prefer `--workers=1` on this machine before running anything, and set `retry: false` on any new query expected to fail permanently for access-control reasons (otherwise React Query's default retry makes a real permission bug look like a 7–9 second hang).

**Practice Tasks**: an E2E test proving a dropped student does *not* receive a newly-assigned Practice Task is the single highest-value test here — it's the exact correctness rule named in §5.

---

## 8. Documentation

**Done when**: every document across this set that mentioned the feature as "Planned" is updated to "Built," cross-references are checked for staleness, and — if the feature closed a named open question (e.g., a badge-catalog decision from [12_Gamification_Framework.md](12_Gamification_Framework.md)) — that question is marked resolved, not left dangling as if still open.

**Watch for**: this is the easiest stage to skip silently, because nothing breaks visibly if it's skipped — the cost is a documentation set that quietly stops being trustworthy, which defeats the entire purpose of the eighteen documents preceding this one.

**Practice Tasks**: update the tag on [C2](04_Product_Requirements_Document.md#c2-practice-task-assignment), the Practice Task entries in [03_Product_Glossary.md](03_Product_Glossary.md), and [18_Product_Roadmap.md](18_Product_Roadmap.md)'s Version 1.1 line.

---

## 9. Deployment

**Done when**: the change has been checked against [17_Deployment_Architecture.md](17_Deployment_Architecture.md)'s named constraints — does it need object storage, a notification channel, or anything else not yet built? If so, it isn't shippable yet, regardless of how complete the code is.

**Practice Tasks**: no new infrastructure dependency — confirmed shippable within Version 1.0/1.1's existing deployment target, per [18_Product_Roadmap.md](18_Product_Roadmap.md).

---

## 10. Review

**Done when**: the change has been checked against all seven principles in [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md) directly — not "it seems fine," a literal pass down the list — and, if it touched anything security- or privacy-sensitive, verified empirically per [15_Security_Privacy.md](15_Security_Privacy.md) §10's incident-response pattern (verify the fix works the same rigorous way the original problem was found), not just re-read.

---

## The definition-of-done checklist, all ten stages compressed

- [ ] A real PRD entry exists, correctly tagged Built/Planned.
- [ ] The architectural fit was confirmed, not assumed.
- [ ] Every new/changed table has its RLS policy body in `apply-rls.ts`, and it has been empirically tested with two real users, not just written.
- [ ] Every new server function is documented with its real permission rule, matching the roles matrix exactly.
- [ ] Every client-suppliable ID implying ownership is re-verified server-side.
- [ ] New UI reuses existing primitives; new routes follow the flat-vs-nested convention.
- [ ] A golden-path E2E test exists; a cross-user-isolation test exists for any new table; a unit test exists for any new pure logic.
- [ ] Every "Planned" tag this feature fulfilled has been flipped to "Built," across every document that named it.
- [ ] The change was checked against the deployment constraints — nothing ships half-dependent on infrastructure that doesn't exist yet.
- [ ] The change was checked against all seven principles directly, and any security-sensitive fix was re-verified empirically, not just re-read.

---

## Closing

Twenty documents, from a one-page constitution to this manual, now exist where none did before this session began. They describe a product that is further along than it might have seemed from the outside — a real, RLS-secured, curriculum-native platform already serving its first real classroom — and also more honestly incomplete than a polished pitch would admit: no deployment exists yet, two real security bugs were found and fixed in the course of writing this, and a real, unanswered legal question sits at the top of the roadmap.

That gap between ambition and honest current state is not a flaw in the documentation — it is the documentation doing its job. Per the standing pattern through every one of these documents: **this is where planning ends and implementation begins, and that transition happens on explicit approval, not momentum.**

---

*End of the Focus Flow documentation set: [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md) through this document.*
