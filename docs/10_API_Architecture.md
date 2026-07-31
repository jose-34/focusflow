# Focus Flow: API Architecture

*Every server function, verified directly against the real source files — not recalled — with its request shape, response shape, permission rule, and real error conditions.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md). Implements the contracts specified in [04_Product_Requirements_Document.md](04_Product_Requirements_Document.md), against the schema in [09_Database_Design.md](09_Database_Design.md).

---

## A translation note, up front

The founder's own example format (`POST /classes`, `GET /classes`, `PATCH /classes/:id`) describes a conventional REST API. **Focus Flow does not have one.** As established in [08_System_Architecture.md](08_System_Architecture.md), every operation is a `createServerFn` — an RPC call that, on the wire, hits an opaque `/_serverFn/<base64>` URL, not a clean resource path. There is no router mapping `GET /classes` to anything; there is a function named `getClassesFn`.

This document uses a **conceptual REST label** for every function anyway, because it's a genuinely useful way to scan "what operations exist on this resource" at a glance. Treat the label as a documentation convenience, not a real route — anyone implementing against this document should call the named function, not construct a URL.

**Every function below shares three rules, stated once instead of repeated thirty times:**
1. Every call resolves the current user via `requireUser()` first — an unauthenticated call fails before anything else runs.
2. Every call then runs inside `withRlsContext(user.id, ...)` — the database itself, not the function body, is the real permission enforcer. The "Permission rule" column below states the effective rule; consult [09_Database_Design.md](09_Database_Design.md) for the exact policy.
3. Input is validated by a zod schema before the handler body ever runs — the "Input" column is that schema's shape.

---

## A. Identity & Onboarding

| Conceptual route | Function | Input | Output | Permission rule | Key errors |
|---|---|---|---|---|---|
| `POST /register` | `registerFn` | firstName, lastName, email, password, confirmPassword, role, gradeLevel? | `{ user }`, sets session cookie | Anyone | Duplicate email; password complexity; grade level required for students |
| `POST /login` | `loginFn` | email, password | `{ user }`, sets session cookie | Anyone | Generic "invalid email or password" (never reveals which) |
| `POST /logout` | `logoutFn` | none | `{ success: true }` | Any authenticated user | None — always succeeds, even with no active session |
| `GET /me` | `getCurrentUserFn` | none (reads cookie) | `SanitizedUser \| null` | Anyone | Never throws — returns `null` if not authenticated |

**Note on `registerFn`:** never trusts `role` or `gradeLevel` beyond what the zod schema (`registerSchema`) already constrains — a teacher's `gradeLevel` is simply never read even if a client sent one.

---

## B. Curriculum & Classroom

| Conceptual route | Function | Input | Output | Permission rule | Key errors |
|---|---|---|---|---|---|
| `GET /curricula` | `getCurriculaFn` | none | `Array<{id, code, name, country, subjects[]}>` | Any authenticated user | — |
| `GET /classes` | `getClassesFn` | none | `Array<ClassSummary>` (role-branched: owned classes for teacher, enrolled classes for student) | Any authenticated user | — |
| `POST /classes` | `createClassFn` | name, curriculumId, subjectId, gradeLabel? | The created class row | Teacher only | Subject/curriculum mismatch (checked in-app *and* by the database's own `EXISTS` constraint); non-teacher caller |
| `POST /classes/join` | `joinClassFn` | code | `{ enrollment, className }` | Student only | No active class with that code (deliberately generic — doesn't reveal whether the code once existed); already enrolled |
| `POST /classes/:id` (detail) | `getClassDetailFn` | classId | `ClassDetail` (roster for teacher, class info for student) | Enrolled student or owning teacher | Class not found / not accessible (RLS-enforced, indistinguishable from "doesn't exist") |

**Note on `joinClassFn`'s discovery pattern**, since it looks different from every other read in this system and that difference is deliberate: the code lookup runs through `adminDb` (bypassing RLS) *specifically because* a student has no RLS-visible relationship to a class they haven't joined yet — the same chicken-and-egg case documented in [08_System_Architecture.md](08_System_Architecture.md). The enrollment write immediately afterward still goes through the student's own `withRlsContext`, because by that point `enrollments_insert`'s policy (`student_id = current user`) is all that's needed.

---

## C. Assignment System

### Tasks

| Conceptual route | Function | Input | Output | Permission rule | Key errors |
|---|---|---|---|---|---|
| `GET /tasks` | `getTasksFn` | none | `Array<Task>`, owner's own only | Owner only | — |
| `POST /tasks` | `createTaskFn` | title, description?, priority, dueDate? | The created task | Owner (any authenticated user) | — |
| `POST /tasks/:id/toggle` | `toggleTaskFn` | id, completed | `{ task, unlockedAchievements }` | Owner only (`id` + `userId` both checked in the `WHERE`, not just RLS) | Silently updates 0 rows if `id` doesn't belong to caller — returns an empty result, not an error |
| `POST /tasks/:id/delete` | `deleteTaskFn` | id | `{ success: true }` | Owner only | Same silent-no-op-if-not-yours behavior as toggle |

### Quizzes

| Conceptual route | Function | Input | Output | Permission rule | Key errors |
|---|---|---|---|---|---|
| `GET /classes/:id/quizzes` | `getClassQuizzesFn` | classId | `Array<ClassQuizSummary>` (role-branched; also runs [C5](04_Product_Requirements_Document.md#c5-quiz-linked-task-auto-creation)'s task auto-creation as a side effect for students) | Enrolled student (published only) or owning teacher (all) | — |
| `POST /quizzes` | `createQuizFn` | classId, title, description?, timeLimitMinutes?, dueDate? | The created quiz (unpublished) | Teacher only | Non-teacher caller |
| `POST /quizzes/:id/questions` | `addQuestionFn` | quizId, questionText, questionType, points, choices[] (2–6, exactly one `isCorrect`) | The created question | Owning teacher only | Zero or multiple correct choices rejected by the zod schema before the handler runs |
| `POST /quizzes/questions/:id/delete` | `deleteQuestionFn` | questionId | `{ success: true }` | Owning teacher only | — |
| `POST /quizzes/:id/publish` | `togglePublishFn` | quizId, isPublished | The updated quiz | Owning teacher only | Quiz not found |
| `GET /quizzes/:id/authoring` | `getQuizAuthoringFn` | quizId | Full quiz + all questions/choices (including `isCorrect`) + all student attempts | Owning teacher only | Quiz not found |
| `GET /quizzes/:id/insights` | `getAssignmentInsightsFn` | quizId | `AssignmentInsightsResponse` — per-student procrastination metrics + class aggregates ([D4](04_Product_Requirements_Document.md#d4-teacher-risk-signal)) | Owning teacher only | Quiz not found |
| `GET /quizzes/:id` (student view) | `getQuizForStudentFn` | quizId | Questions + choices **without `isCorrect`**, even post-submission — see note below | Student, published quiz only | Quiz not found / not published |
| `POST /quizzes/:id/start` | `startAttemptFn` | quizId | The (possibly pre-existing) attempt — idempotent, returns the same attempt if one already exists | Student only | — |
| `POST /quizzes/attempts/:id/submit` | `submitQuizFn` | attemptId, answers[] (questionId, selectedChoiceId) | `{ attempt, graded[], score, maxScore }` | The attempt's own student only | Attempt not found / not yours; already submitted |

**Verified, real finding, not a new one — restated here because this is the document where it's most load-bearing:** `getQuizForStudentFn`'s choice mapping is `{ id, choiceText }` only, permanently — `isCorrect` is never included, even when `existingAttempt.submittedAt` is set. This means the "show correct/incorrect after submission" UI this codebase's own comments describe elsewhere is currently backed by a response that can never supply it. This is the same gap named in the original redesign plan (scheduled to be fixed alongside Public Quiz Bank work in Phase 5) — confirmed again here by reading the live handler, not just recalled.

**`submitQuizFn` is the load-bearing trust boundary for the entire quiz system**, worth spelling out precisely: it re-fetches each question's real choices from the database and computes `isCorrect` itself (`answer.selectedChoiceId === correctChoice?.id`) — the request body's `answers` array is the only client input, and it can only ever say *which choice ID was picked*, never a claimed correctness or score. A tampered request has no way to influence its own grade.

### Live Game Session

| Conceptual route | Function | Input | Output | Permission rule | Key errors |
|---|---|---|---|---|---|
| `POST /games` | `createGameSessionFn` | quizId, questionDurationSeconds (5–120) | The created session (status `lobby`, unique PIN) | Teacher only | PIN collision retried up to 5 times before failing |
| `POST /games/join` | `joinGameFn` | pin | `{ sessionId, participantId }` — idempotent if already joined | Student only | No lobby-status session with that PIN |
| `POST /games/:id/start` | `startGameFn` | sessionId | The session, now `status: question`; broadcasts state over the WebSocket | Host only | Session not found |
| `POST /games/:id/advance` | `advancePhaseFn` | sessionId | The session in its next phase (`question`→`reveal`→next question, or →`finished`); broadcasts | Host only | Session not found |
| `POST /games/:id/answer` | `submitGameAnswerFn` | sessionId, questionId, selectedChoiceId | `{ isCorrect, pointsAwarded }` — idempotent, returns the existing answer if already submitted | Participant only, and only while `status = question` | "This question is no longer accepting answers"; "You are not in this game" |
| `GET /games/:id/host-state` | `getHostStateFn` | sessionId | Full host view: current question **with** `isCorrect`, live answer counts, participant leaderboard | Host only | Session not found |
| `GET /games/:id/player-state` | `getPlayerStateFn` | sessionId | Player view: current question, **`isCorrect` present only when `status` is `reveal`/`finished`** | Participant only | Session not found; "You are not in this game" |

**Scoring is computed entirely server-side** from `session.phaseStartedAt` (the server's own clock) and the real answer key — `responseTimeMs` and `isCorrect` are never accepted from the client, matching [F1](04_Product_Requirements_Document.md#f1-live-game-session)'s rule.

**Real-time delivery**: these same reads are also pushed over the WebSocket (`ws://…:3001?sessionId=…&role=host|player`) via `broadcastGameState()`, called after `startGameFn` and `advancePhaseFn`. `useHostGameStateRealtime`/`usePlayerGameStateRealtime` prefer the WebSocket and fall back to polling `getHostStateFn`/`getPlayerStateFn` every 1200ms if it's unavailable — this is the fallback path named in [08_System_Architecture.md](08_System_Architecture.md).

---

## D. Focus & Behavior

Two parallel systems exist and are **not yet unified** (Phase 3 of the redesign roadmap) — both are documented here as they really are today, not as they'll eventually become one.

### Pomodoro path (`useFocusSession.ts`)

| Conceptual route | Function | Input | Output | Permission rule | Key errors |
|---|---|---|---|---|---|
| `POST /focus-sessions` | `startFocusSessionFn` | durationMinutes, taskId? | The created session | Any authenticated user | A `taskId` the caller doesn't own is silently ignored (re-verified server-side, not trusted from the client — see the schema file's own comment) |
| `POST /focus-sessions/:id/complete` | `completeFocusSessionFn` | id | `{ session, unlockedAchievements }` | Any authenticated user (own session, enforced by RLS) | Runs `checkAndUnlockAchievements` |
| `POST /focus-sessions/:id/abandon` | `abandonFocusSessionFn` | id | The session, marked `wasSuccessful: false` | Any authenticated user | Does **not** call `checkAndUnlockAchievements` — an abandoned session earns nothing, by design |
| `POST /focus-sessions/:id/distraction` | `logDistractionFn` | focusSessionId, durationSeconds | `{ success: true }` | Any authenticated user | — |

### Quiz-assignment engagement path (`focusMode.ts`)

| Conceptual route | Function | Input | Output | Permission rule | Key errors |
|---|---|---|---|---|---|
| `POST /assignments/:id/start` | `startAssignmentFn` | assignmentId, startMethod?, clientTimestamp? | Start-XP confirmation + a `startToken` | Student only | "Assignment not found" if neither a quiz nor a task with that ID exists; idempotent via `onConflictDoNothing` — a second call returns "Already started," awarding 0 XP |
| `POST /focus/heartbeat` | `reportFocusHeartbeatFn` | startToken or startEventId, clientHeartbeatAt, clientOffsetMs? | `{ accepted, focusSessionId, totalVerifiedMinutes }` | Student, and only for their own `start_event` (checked explicitly, not RLS alone, since `start_events` had no RLS until this session's fix — see [09_Database_Design.md](09_Database_Design.md)) | "Invalid or expired start token"; "Start token does not belong to current user" |
| `POST /focus/:sessionId/end` | `endFocusSessionFn` | sessionId | `{ durationMinutes, verified, xpAwarded }` | Any authenticated user (own session) | Session not found. **Does not call `checkAndUnlockAchievements`** — confirmed by reading the handler: a quiz-linked focus session can currently never unlock an achievement, exactly the gap named in this project's own history and scheduled for the Phase 3 unification. |

**A genuinely fragile spot worth naming plainly**: `reportFocusHeartbeatFn`'s "verified minutes" calculation (`Math.floor(hbCount / 4)`, assuming ~4 heartbeats/minute) is a heuristic, not a measured duration — and `endFocusSessionFn`'s XP award (`Math.floor(durationMinutes / 10) * 2`) is computed independently, from the same heuristic. Neither is wrong, but neither should be treated as more precise than it is when this system is unified with the Pomodoro path.

### Achievements & Wellness

| Conceptual route | Function | Input | Output | Permission rule |
|---|---|---|---|---|
| `GET /achievements` | `getAchievementsFn` | none | All 8 definitions, each with `unlockedAt` (or `null`) | Owner only |
| `GET /wellness/logs` | `getRecentWellnessLogsFn` | none | Last 7 logs | Owner only |
| `POST /wellness/logs` | `createWellnessLogFn` | mood (1–5), notes? | The created log | Owner only |

### Progress

| Conceptual route | Function | Input | Output | Permission rule |
|---|---|---|---|---|
| `GET /progress` | `getProgressDataFn` | none | 14-day daily minutes, today/week totals, current + longest streak, tasks completed this week | Owner only |

**Verified, real finding, restated from [08_System_Architecture.md](08_System_Architecture.md)'s recollection — now confirmed by reading the handler directly:** `computeStreaks` is called against `minutesByDay`, which is itself built only from sessions inside the 14-day query window. A genuine 20-day streak would be reported as 14. This is the exact bug named for [H2](04_Product_Requirements_Document.md#h2-class-trend-analytics)'s Phase 6 fix (a shared `computeStreak()` utility, all-time, not window-bounded) — confirmed here at the API layer, not just asserted.

---

## E–H. Settings, Dashboard

| Conceptual route | Function | Input | Output | Permission rule |
|---|---|---|---|---|
| `POST /settings/profile` | `updateProfileFn` | firstName, lastName | Sanitized updated user | Owner only |
| `POST /settings/password` | `updatePasswordFn` | currentPassword, newPassword | `{ success: true }` | Owner only, and only with the correct current password (bcrypt-compared server-side) |
| `GET /dashboard` | `getDashboardDataFn` | none | Role-branched: teacher gets class/student/quiz counts + recent attempts; student gets classes + achievement count + real `focusSessionsToday` | Any authenticated user |

---

## Validation summary

Every `Input` column above is a real zod schema, shared verbatim between the client (`react-hook-form`'s `zodResolver`) and the server (`.validator(schema)` on the `createServerFn` call) — there is exactly one definition of what a valid request looks like, not a client copy and a server copy that can silently drift apart.

## Error handling summary

**Sprint 0 decision (see [docs/VERSIONING.md](VERSIONING.md)): bare `throw new Error('message')` is the standard, deliberately, not a stopgap.** A structured `{code, message}` taxonomy was considered and explicitly declined for now — there is no i18n layer and no external API consumer today that would benefit from machine-readable codes, and every handler already follows this convention consistently. Revisit only if a real need appears (a public API, a localization pass) — don't add the taxonomy speculatively.

Two deliberate patterns recur throughout, worth naming once rather than per-function:

- **Generic-on-purpose errors**: login failure, class-code lookup — never reveal *which* part was wrong, to avoid user enumeration or code-guessing feedback.
- **~~Silent no-ops instead of errors~~ — fixed.** `toggleTaskFn`/`deleteTaskFn` previously scoped their `WHERE` to the caller's own `userId`, so an ID belonging to someone else silently matched zero rows instead of throwing. Both now explicitly check the result and `throw new Error('Task not found')` when it's empty, matching the rest of the system's explicit-error convention.

## Open questions carried into engineering

- When [Phase 3's unification](08_System_Architecture.md) merges the two Focus & Behavior paths, which set of functions survives — `useFocusSession.ts`'s, `focusMode.ts`'s, or a new third API replacing both?

---

**Next:** [11_UI_UX_Design_System.md] — the visual language every one of these responses gets rendered through.
