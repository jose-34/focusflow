# Focus Flow: Product Requirements Document

*Where software engineering begins. Every term below is used exactly as defined in [03_Product_Glossary.md](03_Product_Glossary.md) — if a rule here seems to contradict the glossary, the glossary wins and this document needs fixing.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md). Every feature below is tagged **Built** (already implemented and verified — this PRD documents the actual, current contract, not an aspiration) or **Planned** (specified here as the target for engineering, not yet implemented). Building a Planned feature that contradicts its spec here is a bug in the spec or the code — resolve the conflict explicitly, don't silently pick one.

This document does not cover screens, layouts, or visual design — see [11_UI_UX_Design_System.md] — and does not cover schema or API shape in full — see [09_Database_Design.md] and [10_API_Architecture.md]. It covers *behavior*: what a feature does, for whom, under what rules, and how to know it works.

---

## Feature Index

**A. Identity & Onboarding** — [A1](#a1-role-guided-registration) Role-Guided Registration · [A2](#a2-login--session) Login & Session · [A3](#a3-guardian-invitation--access) Guardian Invitation & Access

**B. Curriculum & Classroom** — [B1](#b1-curriculum--subject-reference-data) Curriculum & Subject Reference Data · [B2](#b2-class-creation) Class Creation · [B3](#b3-class-joining) Class Joining · [B4](#b4-roster--enrollment-management) Roster & Enrollment Management

**C. Assignment System** — [C1](#c1-personal-task-management) Personal Task Management · [C2](#c2-practice-task-assignment) Practice Task Assignment · [C3](#c3-quiz-authoring) Quiz Authoring · [C4](#c4-quiz-taking--grading) Quiz Taking & Grading · [C5](#c5-quiz-linked-task-auto-creation) Quiz-Linked Task Auto-Creation

**D. Focus & Behavior** — [D1](#d1-focus-session) Focus Session · [D2](#d2-focus-mode--distraction-detection) Focus Mode & Distraction Detection · [D3](#d3-commitment-setting) Commitment Setting · [D4](#d4-teacher-risk-signal) Teacher Risk Signal

**E. Gamification** — [E1](#e1-xp-engine) XP Engine · [E2](#e2-mastery-path) Mastery Path · [E3](#e3-achievements--badges) Achievements & Badges · [E4](#e4-streaks) Streaks · [E5](#e5-missions) Missions

**F. Social & Live Play** — [F1](#f1-live-game-session) Live Game Session · [F2](#f2-async-challenge-mode) Async Challenge Mode · [F3](#f3-public-quiz-bank) Public Quiz Bank

**G. Wellness** — [G1](#g1-wellness-check-in--reflection) Wellness Check-in & Reflection

**H. Analytics & Reporting** — [H1](#h1-teacher-dashboard) Teacher Dashboard · [H2](#h2-class-trend-analytics) Class Trend Analytics

---

## A. Identity & Onboarding

### A1. Role-Guided Registration
**Status: Built.**
**Purpose:** Get a new user to a working account with the minimum friction, and make role the very first decision so the rest of the form only ever asks what's relevant to that role.

**Actors:** Anonymous visitor (becomes Student or Teacher).

**Inputs**
| Field | Type | Constraint |
|---|---|---|
| Role | enum | `student` \| `teacher`, chosen first, before any other field is shown |
| First name, Last name | string | 1–100 chars |
| Email | string | valid email format, unique |
| Password | string | 8–72 chars, must contain uppercase, lowercase, and a number |
| Confirm password | string | must equal Password |
| Grade level | enum | `4`–`12`; **required if Role = student, hidden entirely if Role = teacher** |

**Outputs:** A new user account; an active session; redirect to Dashboard.

**Rules**
- Role selection is step one of two and cannot be skipped or deferred.
- Grade level is never shown to a Teacher — not disabled, not optional, absent from the DOM entirely.
- A password failing complexity rules is rejected before submission (client-side) and re-validated server-side (never trust the client alone).
- Email uniqueness is enforced at the database level, not only in the form.

**Acceptance Criteria**
- ✓ Choosing Teacher never shows a Grade field, at any point in the flow.
- ✓ Choosing Student requires a Grade field before submission succeeds.
- ✓ A duplicate email is rejected with a clear error, not a generic failure.
- ✓ Successful registration lands on Dashboard with the correct role-specific view immediately, no reload required.

---

### A2. Login & Session
**Status: Built.**
**Purpose:** Re-authenticate a returning user and maintain a session across page loads without re-entering credentials constantly.

**Actors:** Registered Student or Teacher.

**Inputs:** Email, Password.
**Outputs:** An active session (cookie-based); redirect to Dashboard on success; a generic "invalid email or password" message on failure (never revealing which field was wrong).

**Rules**
- Session validation happens on every authenticated request server-side — the client's belief that it's logged in is never trusted alone.
- Logging out invalidates the session immediately; a subsequent request with the old cookie is rejected, not silently accepted.

**Acceptance Criteria**
- ✓ Correct credentials reach Dashboard.
- ✓ Incorrect password or unknown email produce the same generic error message (no user enumeration).
- ✓ Logging out and reusing the browser back button never re-displays authenticated content.

---

### A3. Guardian Invitation & Access
**Status: Planned.**
**Purpose:** Give a parent or guardian narrow, opt-in, read-only visibility into a student's effort and wellbeing *trends* — never grades, never raw behavioral data — closing the "parents have zero visibility between report cards" gap named in [01_Product_Vision.md](01_Product_Vision.md).

**Actors:** Student (invites), Guardian (views).

**Inputs:** Guardian's email (sent by the student, requiring the student's explicit action — never invited by the system or a teacher on the student's behalf); Guardian's own registration/login.
**Outputs:** A Guardian account scoped to exactly the students who invited them; a weekly effort-and-mood *trend* view, never a running feed.

**Rules**
- A Guardian can never see: grades, quiz content, raw focus-session timestamps, individual distraction events, or wellness journal notes — only aggregated weekly trends.
- A Guardian relationship requires the student's own consent to create — it is never established unilaterally.
- A student can revoke Guardian access at any time; revocation is immediate.

**Acceptance Criteria**
- ✓ A Guardian invited by Student A can never query data for Student B, even by guessing an ID.
- ✓ Revoking access immediately removes visibility on the Guardian's next request, not just in the UI.
- ✓ No endpoint exposes raw wellness notes or distraction-event detail to a Guardian role, even if requested directly.

---

## B. Curriculum & Classroom

### B1. Curriculum & Subject Reference Data
**Status: Built.**
**Purpose:** Model real curricula and subjects as data, so a new curriculum is a data-entry task, never a schema migration — the concrete mechanism behind Principle 7 ("Scalable by Design").

**Actors:** System (seeds and serves); Teacher (selects when creating a Class).

**Inputs:** None at runtime — curricula and subjects are seeded via `db/seed-curricula.ts`, not created through the UI.
**Outputs:** A list of curricula, each with its scoped list of subjects, available to any authenticated user.

**Rules**
- No insert/update/delete path exists for curricula or subjects outside the seed script — this is deliberate default-deny, not a missing feature.
- A subject belongs to exactly one curriculum; the same subject name may exist as separate rows under different curricula.

**Acceptance Criteria**
- ✓ Selecting a curriculum filters the subject list to only that curriculum's subjects.
- ✓ Adding a third curriculum requires zero schema changes, verified by doing it via the seed script alone.

---

### B2. Class Creation
**Status: Built.**
**Purpose:** Let a teacher stand up a curriculum-aware class in under a minute, with no configuration project.

**Actors:** Teacher.

**Inputs**
| Field | Type | Constraint |
|---|---|---|
| Name | string | 1–100 chars |
| Curriculum | uuid | must exist |
| Subject | uuid | must belong to the selected Curriculum |
| Grade label | string | optional, ≤50 chars, free text |

**Outputs:** A new Class with a system-generated, unique 6-character Class Code.

**Rules**
- The database itself rejects a Subject/Curriculum mismatch (an `EXISTS` check in the insert policy), not only the UI — a client bug can never create an inconsistent class.
- Only a Teacher-role account can create a Class; a Student attempting this is rejected server-side regardless of what the client sends.
- Class Code generation retries on the rare collision rather than failing the request.

**Acceptance Criteria**
- ✓ Picking a subject that doesn't belong to the selected curriculum is impossible through the UI, and rejected at the database if attempted directly.
- ✓ The generated Class Code is unique across all classes, always exactly 6 characters, from an unambiguous character set (no `0`/`O`/`1`/`I` confusion).

---

### B3. Class Joining
**Status: Built.**
**Purpose:** Let a student join a class with nothing but a code shared verbally or over text — no email invite flow required.

**Actors:** Student.

**Inputs:** Class Code (6 characters, case-insensitive).
**Outputs:** A new Enrollment; the class appears in the student's class list immediately.

**Rules**
- The code lookup happens outside the student's own row-level-security scope (since they have no access to a class they haven't joined yet), but the enrollment write still happens inside it — this is a deliberate, narrow exception, not a general bypass (see [08_System_Architecture.md] for why).
- Joining a class twice is rejected with a clear "already enrolled" message, not a duplicate row.
- Joining an archived (inactive) class is rejected.

**Acceptance Criteria**
- ✓ A correct, active code joins successfully on the first try.
- ✓ A correct code for an archived class is rejected.
- ✓ Re-submitting the same code twice does not create a second enrollment.

---

### B4. Roster & Enrollment Management
**Status: Built.**
**Purpose:** Let a teacher see exactly who is in their class, and let a student confirm their own enrollment and see who teaches it.

**Actors:** Teacher (full roster), Student (their own membership + teacher's name only).

**Inputs:** None (read-only view).
**Outputs:** Teacher sees every active student's name and email; a Student sees the class name, code, curriculum/subject badges, and teacher's name — never their classmates' details.

**Rules**
- A Student can never see another student enrolled in the same class through this feature (no peer roster) — that is out of scope entirely, not merely hidden in the UI.
- A dropped (inactive) enrollment disappears from the active roster count but is not deleted (historical record preserved).

**Acceptance Criteria**
- ✓ A Teacher viewing their own class roster sees every active student.
- ✓ A Student viewing the same class never sees a peer's name, email, or any of their data.

---

## C. Assignment System

### C1. Personal Task Management
**Status: Built.**
**Purpose:** Give every student — regardless of whether they're in any class — a simple, private to-do list, distinct from anything a teacher assigns.

**Actors:** Student (owns).

**Inputs:** Title (1–200 chars), description (optional, ≤2000 chars), priority (`high`/`medium`/`low`), due date (optional).
**Outputs:** A Task, owned solely by its creator; a completed/active toggle.

**Rules**
- A personal Task has no class or teacher link of any kind — it is never visible to anyone but its owner.
- Deleting a task requires explicit confirmation (destructive, irreversible).

**Acceptance Criteria**
- ✓ A personal Task never appears in any teacher-facing view, for any teacher.
- ✓ Filtering by All/Active/Completed returns the correct set immediately after a toggle, no stale state.

---

### C2. Practice Task Assignment
**Status: Planned** (Phase 2 of the redesign roadmap).
**Purpose:** Give teachers a genuinely ungraded, rehearsal-only assignment type — distinct from a graded Quiz and from a student's own personal Task — closing the gap named in [01_Product_Vision.md](01_Product_Vision.md) ("tasks belong to teachers to assign, students to complete, with personal tasks kept separate").

**Actors:** Teacher (assigns), Student (completes).

**Inputs:** Title, description, due date, target Class (and optionally a subset of its roster).
**Outputs:** One `task_templates` row; one Task-shaped row per targeted, actively-enrolled student, tagged `taskType = 'practice'`.

**Rules**
- A Practice Task is never graded and never contributes a score — completion is binary (done/not done), matching a personal Task's mechanic, not a Quiz's.
- Only students actively enrolled at assignment time receive a copy; a student joining later does not retroactively receive past Practice Tasks.
- A teacher can see aggregate completion (how many of N students finished) but this is not the Risk Signal — it's a simple count, not a behavioral inference.
- **[Design Review Board](DESIGN_REVIEW_BOARD.md) blocker #1**: marking a Practice Task complete is a bare, server-unverified toggle — per [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md), a student's only interaction with one is "toggle complete only, not content," with no minimum engagement check. **XP is therefore awarded only when the completed toggle is backed by at least one Focus Session already linked to that Practice Task** (reusing the existing `focus_sessions.taskId` link and its server-side timing verification — see [12_Gamification_Framework.md](12_Gamification_Framework.md) §2), never from the toggle alone.

**Acceptance Criteria**
- ✓ Assigning a Practice Task to a class of 30 creates exactly 30 individual task rows, one per actively-enrolled student.
- ✓ A student who joins the class after assignment does not retroactively see it.
- ✓ Completing a Practice Task never affects a Quiz score or a Mastery Path level directly — only XP, per the same rule as any other verified learning action.
- ✓ Toggling a Practice Task complete with **no** linked Focus Session marks it done but awards **zero** XP.
- ✓ Toggling it complete **with** a linked, genuinely-completed Focus Session awards the flat Practice Task XP.

---

### C3. Quiz Authoring
**Status: Built.**
**Purpose:** Let a teacher build a graded, certifying assessment with confidence that the answer key can never leak to a student before or during the attempt.

**Actors:** Teacher.

**Inputs:** Title, description (optional), time limit in minutes (optional, 1–180), due date (optional); per question: text (1–1000 chars), type (`multiple_choice`/`true_false`), points (1–100), 2–6 choices each marked correct or not.

**Outputs:** A Quiz in draft state; questions and choices; a publish toggle.

**Rules**
- Exactly one choice per question must be marked correct — enforced by validation, not left to author discipline.
- A draft (unpublished) Quiz is invisible to students entirely, with one narrow exception: a student already inside a Live Game Session for that quiz can see its questions (the PIN is its own access gate, independent of publish state).
- `isCorrect` is never present in any payload a student can read before their attempt is submitted — not hidden client-side, absent from the response entirely.

**Acceptance Criteria**
- ✓ Attempting to save a question with zero or more than one correct choice is rejected.
- ✓ A draft quiz is invisible to a student browsing their class, but visible to that same student if they join a Live Game Session hosted on it.
- ✓ Inspecting the network response for a student's in-progress attempt never contains the string `isCorrect` anywhere in the payload.

---

### C4. Quiz Taking & Grading
**Status: Built.**
**Purpose:** Let a student take a published quiz and receive a trustworthy, un-forgeable score.

**Actors:** Student (takes), Teacher (reviews results).

**Inputs:** Selected choice per question (or none, if skipped).
**Outputs:** A Quiz Attempt with a computed score and max score; per-question correctness revealed only after submission.

**Rules**
- Grading is always recomputed server-side from the real answer key at submission time — a client can only ever report which choice it picked, never a claimed correctness or score.
- A quiz cannot be resubmitted once submitted (no re-take path from this feature — see Async Challenge Mode for a sanctioned second attempt).
- `isCorrect` becomes visible on a choice only once that specific attempt's `submittedAt` is set.

**Acceptance Criteria**
- ✓ A tampered client request claiming a wrong answer is "correct" is ignored — the server-recomputed score is the only score that is ever stored.
- ✓ Submitting twice for the same attempt is rejected.
- ✓ Correctness is invisible before submission and visible immediately after, for that attempt only.

---

### C5. Quiz-Linked Task Auto-Creation
**Status: Built.**
**Purpose:** Make sure a graded Quiz with a due date shows up in a student's task list automatically — a due-dated quiz is still something to *do*, and a student's task list should be the one place everything due lives.

**Actors:** System (creates automatically), Student (sees it in their Task list).

**Inputs:** None — triggered the first time a student with an active enrollment sees a published, due-dated Quiz.
**Outputs:** A Task, tagged `taskType = 'quiz_assignment'`, linked via `quizId`.

**Rules**
- Idempotent: seeing the same quiz twice never creates a second linked task.
- Completing the underlying Quiz Attempt does not automatically mark the linked Task complete today — this is a known, named gap, not a hidden one (resolve explicitly in engineering, don't assume either behavior).

**Acceptance Criteria**
- ✓ A student who never opens the quiz still eventually sees a task for it (created lazily on first relevant view, not requiring the student to have already looked at the quiz).
- ✓ Re-triggering the creation path for the same student/quiz pair never duplicates the task.

---

## D. Focus & Behavior

### D1. Focus Session
**Status: Built.**
**Purpose:** Turn "sit down and do the work" into something with its own structure and immediate feedback, and produce honest data about both successful and abandoned attempts.

**Actors:** Student.

**Inputs:** Duration in minutes (≥1), optionally a linked Task.
**Outputs:** A Focus Session row created at start (not just on completion); on completion or abandonment, a success flag and completion timestamp.

**Rules**
- The row is written the moment the session **starts**, so an abandoned session is recorded honestly (`wasSuccessful: false`) rather than simply never existing — abandoned attempts are real signal, not noise to discard.
- A session cannot be "completed" for a duration that hasn't actually elapsed (server-side timing check, not trusting a client-reported elapsed time).

**Acceptance Criteria**
- ✓ Closing the tab mid-session still leaves a real, honestly-marked-failed row in the database.
- ✓ Completing a session earns XP only if genuinely completed, never on an abandoned one.

---

### D2. Focus Mode & Distraction Detection
**Status: Built.**
**Purpose:** Detect real in-app distraction (leaving the tab) during an active session, without ever pretending to block other apps or tabs, which is outside what a website can technically do.

**Actors:** Student (experiences it), System (logs it).

**Inputs:** Page Visibility API state changes during an active Focus Session.
**Outputs:** A Distraction Event with duration, shown to the student as an immediate toast; aggregated (never raw) into the teacher-facing Risk Signal.

**Rules:** Never surfaced to a teacher as an individual, timestamped event — only ever as an aggregate contributing to Risk Signal.

**Acceptance Criteria**
- ✓ Switching tabs for 30 seconds during a session logs one Distraction Event of ~30 seconds and shows the student a toast on return.
- ✓ No endpoint exposes a raw list of a student's individual Distraction Events to a Teacher role.

---

### D3. Commitment Setting
**Status: Planned** (see [02_Product_Definition.md](02_Product_Definition.md), Anti-Procrastination Framework).
**Purpose:** Increase follow-through on a Focus Session using a specific, named intention set immediately before starting — an implementation-intention technique, not a cosmetic prompt.

**Actors:** Student.

**Inputs:** A short free-text commitment (e.g. "finish the first five algebra problems"), required or optional per the open question below.
**Outputs:** A Commitment attached to the Focus Session; shown back to the student at session end alongside a simple met/not-met self-check.

**Rules**
- A Commitment is specific to one session — it is never a standing goal (that's a Mission) or a permanent to-do (that's a Task).
- Whether met/not-met is self-reported, never system-judged — the point is reflection, not a compliance score.

**Acceptance Criteria**
- ✓ A Commitment set at session start is shown back verbatim at session end.
- ✓ Skipping the Commitment (if optional) never blocks starting a session.

**Open question carried from the glossary:** should Commitment Setting be mandatory or optional? Not decided here — resolve deliberately before implementation, since this is a real adoption-friction tradeoff.

---

### D4. Teacher Risk Signal
**Status: Built** (`getAssignmentInsightsFn`).
**Purpose:** Give a teacher an early, supportive signal about which students are quietly disengaging — before a deadline confirms it — without exposing raw behavioral surveillance data.

**Actors:** Teacher (views, scoped to their own classes only).

**Inputs:** None directly — computed from a class's Tasks, Quiz due dates, and students' Focus Sessions.
**Outputs:** Per-student: time between assignment and first attempt, whether focus time was logged before the deadline, completion timing relative to the due date, and an aggregated 0–3 risk score; class-wide aggregates.

**Rules**
- Never exposes raw, individual Distraction Events or moment-level timestamps — only the aggregated signals above.
- Scoped strictly to a teacher's own classes — cross-teacher visibility is impossible, enforced at the database layer, not only in the query.
- Framed and worded supportively in any UI that surfaces it (a product-design constraint carried from [00_Project_Philosophy.md](00_Project_Philosophy.md), not just a policy note).

**Acceptance Criteria**
- ✓ Teacher A can never query Risk Signal data for a class they don't own, even with a valid but mismatched class ID.
- ✓ The signal correctly flags a student with zero logged focus time and a late first attempt as higher risk than one who started early.

---

## E. Gamification

### E1. XP Engine
**Status: Built, partially unified** (wired to the quiz-assignment engagement path in `focusMode.ts` today — **not** the Pomodoro path, which currently awards zero XP; corrected from an earlier, reversed statement here. The two paths unify in a planned phase — see [02_Product_Definition.md](02_Product_Definition.md)).
**Purpose:** The single currency behind every gamification mechanic, earned only from genuine, verified learning actions.

**Actors:** System (awards automatically).

**Inputs:** A completed Focus Session, a correct Quiz answer, a completed Practice Task, a measurably improved retry — never an app open, a click, or idle time.
**Outputs:** An `xp_ledger` entry; contributes to the relevant Subject's Mastery Path.

**Rules:** This is the single most binding rule in the entire product (Principle 1) — any code path that awards XP for a non-verified action is a bug to fix immediately, not a design decision to debate.

**Acceptance Criteria**
- ✓ Opening the app with no other action awards zero XP, always.
- ✓ Every XP-awarding code path is traceable to one of the four verified actions listed above.

---

### E2. Mastery Path
**Status: Planned.**
**Purpose:** Replace a single, flattening global level with a level per Subject, matching a competency-based curriculum's own emphasis on per-subject, per-strand growth.

**Actors:** Student.

**Inputs:** XP earned within a specific Subject's classes.
**Outputs:** A level per enrolled Subject, shown independently (excelling in Math and struggling in Kiswahili show as two different levels, never averaged into one).

**Rules:** No single combined "account level" is ever computed or displayed — this is a deliberate rejection of the generic-gamer-app pattern, not an oversight to fix later.

**Acceptance Criteria**
- ✓ A student enrolled in two subjects with very different XP totals sees two different, independent levels, never one blended number.

---

### E3. Achievements & Badges
**Status: Built** (8 keys today; expansion planned — see [02_Product_Definition.md](02_Product_Definition.md)).
**Purpose:** Recognize specific, genuine behavior patterns — "Achievement" and "Badge" name the same object (see [03_Product_Glossary.md](03_Product_Glossary.md)).

**Actors:** Student.

**Inputs:** None directly — evaluated automatically after any XP-earning action.
**Outputs:** An unlocked achievement, shown once, never re-triggered for the same key.

**Rules:** Idempotent — re-checking already-unlocked achievements never re-fires them or re-awards anything.

**Acceptance Criteria**
- ✓ Crossing a threshold (e.g. a 3-day streak) unlocks the relevant achievement exactly once, even if the check runs again on the same data.

---

### E4. Streaks
**Status: Built.**
**Purpose:** Track consistency in a way that's honest about both current momentum and all-time best.

**Actors:** Student.

**Inputs:** None — computed from Focus Session history.
**Outputs:** Current streak (consecutive days with ≥1 completed session, ending today or yesterday) and longest streak (all-time).

**Rules:** A single missed day resets the current streak to zero the next time it's computed — no grace period, no "streak freeze" purchase mechanic (would conflict with Principle 1's ban on non-learning-based rewards).

**Acceptance Criteria**
- ✓ A student with sessions on 3 consecutive days shows a current streak of 3.
- ✓ A student who skips a day sees their current streak reset, while their longest streak remains unchanged.

---

### E5. Missions
**Status: Planned.**
**Purpose:** A short-term goal scoped to a student's *actual current coursework*, not a generic daily-login quest.

**Actors:** System (generates from real upcoming work) or Teacher (sets manually); Student (completes).

**Inputs:** A student's currently-assigned Practice Tasks and Quizzes with near-term due dates.
**Outputs:** A Mission ("complete 3 practice sessions on linear equations before Friday's quiz") with a completion state.

**Rules:** A Mission must always reference real, currently-assigned work — a Mission with no underlying real Task or Quiz to point at should not be generated.

**Acceptance Criteria**
- ✓ Every active Mission for a student references at least one real, currently-assigned Practice Task or Quiz.
- ✓ A Mission never persists past the due date of the work it references.

---

## F. Social & Live Play

### F1. Live Game Session
**Status: Built.**
**Purpose:** A synchronous, whole-class review moment — the classroom-adoption and engagement driver, explicitly scoped as distinct from the anti-procrastination core (see [02_Product_Definition.md](02_Product_Definition.md)).

**Actors:** Teacher (hosts), Students (join and play).

**Inputs:** A Quiz to host; students join with a Game PIN.
**Outputs:** Live-updating scores, a final leaderboard, per-participant answers with server-computed correctness and response time.

**Rules**
- Scoring is always computed server-side from the server's own clock — a client can only report which choice it picked, never a response time or correctness.
- A draft (unpublished) Quiz can still be hosted live — the PIN is its own access gate, independent of the publish flag.

**Acceptance Criteria**
- ✓ Two students answering correctly at different speeds receive different, correctly-ordered scores, computed server-side.
- ✓ A student cannot join a session for a quiz whose questions they haven't been granted visibility into by the server.

---

### F2. Async Challenge Mode
**Status: Planned** (confirmed quiz mode: "async head-to-head" — see [01_Product_Vision.md](01_Product_Vision.md)).
**Purpose:** A collaborative, persistence-building rematch mechanic distinct from the synchronous Live Game Session.

**Actors:** Challenging student (initiates), challenged student (plays).

**Inputs:** A completed Quiz Attempt to challenge from; a chosen classmate (or an open challenge).
**Outputs:** A second, independent Quiz Attempt for the challenged student; a comparison of the two scores once both exist.

**Rules**
- The challenged student's play is a normal Quiz Attempt — no new attempt schema, no special leniency or difference in grading.
- A challenge is solo and asynchronous — never a synchronized, timed race between the two players.

**Acceptance Criteria**
- ✓ A challenge can be completed entirely on the challenged student's own schedule, with no dependency on the challenger being online.
- ✓ The comparison view never reveals the challenger's specific wrong answers, only the score.

---

### F3. Public Quiz Bank
**Status: Planned** (confirmed quiz mode: "public = shared quiz bank" — see [01_Product_Vision.md](01_Product_Vision.md)).
**Purpose:** Let a teacher publish a quiz for other teachers to discover, filtered by Curriculum and Subject, and copy into their own class — solving quiz-authoring effort at the ecosystem level, not just per-teacher.

**Actors:** Publishing teacher, copying teacher.

**Inputs:** A teacher's decision to mark a quiz `visibility = 'public_bank'`; a browsing teacher's curriculum/subject filter.
**Outputs:** A deep copy (questions and choices) into the copying teacher's own class, as a new, independently-owned Quiz.

**Rules**
- Never visible to students directly — teacher-gated, browsable only by the `teacher` role.
- A bank listing never surfaces `isCorrect` — the same invariant as any other pre-attempt quiz view.
- A copy is fully independent after creation — edits by the copying teacher never affect the original.

**Acceptance Criteria**
- ✓ A student account can never successfully query the public bank endpoint, even directly.
- ✓ Copying a quiz and then editing the copy leaves the original completely unchanged.

---

## G. Wellness

### G1. Wellness Check-in & Reflection
**Status: Built (check-in); Planned (session/quiz reflection extension).**
**Purpose:** Treat mood and self-awareness as data worth checking in on, kept deliberately lightweight — never a diagnostic or clinical tool (see [02_Product_Definition.md](02_Product_Definition.md), Product Boundaries).

**Actors:** Student.

**Inputs:** Mood (1–5), optional note (≤1000 chars); planned: a short post-session/post-quiz reflection prompt.
**Outputs:** A private wellness log entry, visible only to the student.

**Rules:** Never surfaced to a Teacher or Guardian in raw form — any future aggregation must stay at the trend level, matching the Guardian-access rules in A3.

**Acceptance Criteria**
- ✓ A wellness log entry is retrievable only by its own author, never by any teacher or other student, even via direct ID.

---

## H. Analytics & Reporting

### H1. Teacher Dashboard
**Status: Built.**
**Purpose:** One landing view answering "what does my classroom look like right now," role-appropriate from the first screen after login.

**Actors:** Teacher.

**Inputs:** None (read-only aggregate view).
**Outputs:** Active class count, total student count, total quizzes created, a real classes list with curriculum/subject badges, recent quiz attempts across all owned classes.

**Rules:** Scoped strictly to classes the logged-in teacher owns — never another teacher's data, enforced at the database layer.

**Acceptance Criteria**
- ✓ All counts and lists reflect only the logged-in teacher's own classes, verified against a second teacher account showing entirely different numbers.

---

### H2. Class Trend Analytics
**Status: Planned** (Phase 6 of the redesign roadmap).
**Purpose:** Show trends, not just point-in-time scores — the explicit gap named in the founding brief ("analytics that show trends, not just scores").

**Actors:** Teacher.

**Inputs:** A selected class.
**Outputs:** Weekly/monthly focus-minutes trends, quiz completion-rate trends over time, procrastination-flag trends, breakable by Subject once a teacher has multiple classes.

**Rules:** Extends, never replaces, the existing Risk Signal (D4) — this is the same underlying data shown as a trend over time, not a separate, disconnected system.

**Acceptance Criteria**
- ✓ A class's focus-minutes trend correctly reflects a deliberately-seeded pattern of high-then-low engagement across weeks, not just a single aggregate number.

---

**Next:** [05_Information_Architecture.md] — every screen and navigation path implied by the features above, and [09_Database_Design.md] — the schema that makes each Rule and Acceptance Criterion above actually enforceable, not just documented.
