# Focus Flow: Product Glossary

*The dictionary. Read this before writing or reviewing the PRD, the database design, the API, or any UI copy. Every later document uses these terms exactly as defined here — if a document appears to use one differently, the document is wrong, not the glossary.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md). Extends the modules introduced in [02_Product_Definition.md](02_Product_Definition.md).

Each entry is tagged **Built** (exists in the product today) or **Planned** (defined in the vision/product-definition documents, not yet implemented) so this glossary never implies more than actually exists. Where a term is genuinely ambiguous today — used loosely in conversation to mean two different things — that ambiguity is named and resolved here, not smoothed over.

---

## Quick reference

| Term | Status | One line |
|---|---|---|
| [Student](#student) | Built | A learner enrolled in one or more classes. |
| [Teacher](#teacher) | Built | Creates classes, assigns work, reviews progress. |
| [Guardian](#guardian) | Planned | A parent/guardian with read-only visibility into a student's effort and wellbeing trends. |
| [Curriculum](#curriculum) | Built | A named educational framework (e.g. CBC, Cambridge) that subjects belong to. |
| [Subject](#subject) | Built | A named academic discipline, scoped to exactly one curriculum. |
| [Class](#class) | Built | One teacher's group of students, for one subject, under one curriculum. |
| [Stream](#stream) | Not modeled | A school's homeroom/cohort grouping — not currently a Focus Flow object. |
| [Grade Label](#grade-label) | Built | Free-text, curriculum-specific grade naming on a class ("Grade 9", "Year 10"). |
| [Enrollment](#enrollment) | Built | The link between one student and one class. |
| [Competency](#competency) | Conceptual | A skill or strand within a subject — not yet a distinct data object. |
| [Assignment](#assignment) | Conceptual | The act of a teacher giving work to students — realized as a Task or a Quiz, never its own object. |
| [Task](#task) | Built | A to-do item owned by one student — personal, practice, or quiz-linked. |
| [Practice Task](#practice-task) | Built (Sprint 1) | A teacher-assigned, ungraded rehearsal task, distinct from a personal Task. |
| [Quiz](#quiz) | Built | A graded, certifying assessment with questions and choices. |
| [Assessment](#assessment) | Conceptual | The general concept of certifying evaluation — realized specifically as a Quiz. |
| [Resource](#resource) | Planned | A file or link a teacher shares with a class. |
| [Submission](#submission) | Conceptual | The act of completing a Task or a Quiz — not a single shared data object. |
| [Focus Session](#focus-session) | Built | A timed block of committed work, optionally linked to a Task or Quiz. |
| [Focus Mode](#focus-mode) | Built | Tab-visibility monitoring active during a Focus Session. |
| [Distraction Event](#distraction-event) | Built | A logged instance of leaving the tab during Focus Mode. |
| [Commitment](#commitment) | Planned | A specific, named intention set before a Focus Session begins. |
| [Risk Signal](#risk-signal) | Built (teacher-facing) | A private, aggregated procrastination indicator for a teacher. |
| [Wellness Check-in](#wellness-check-in) | Built | A student's self-reported mood and optional note. |
| [XP](#xp) | Built | Points earned only from verified learning actions. |
| [Mastery Path](#mastery-path) | Planned | A subject-scoped level track, replacing one global account level. |
| [Learning Path](#learning-path) | Planned, distinct from Mastery Path | A sequenced route through a subject's topics or competencies. |
| [Achievement (Badge)](#achievement-badge) | Built | A recognition unlocked for a specific, genuine behavior pattern. |
| [Streak](#streak) | Built | Consecutive days with at least one completed Focus Session. |
| [Mission](#mission) | Planned | A short-term goal scoped to a student's real, current coursework. |
| [Challenge](#challenge) | Planned | An asynchronous, head-to-head quiz rematch between two students. |
| [Public Quiz Bank](#public-quiz-bank) | Planned | A shared library of teacher-published quizzes, browsable and copyable by other teachers. |
| [Live Game Session](#live-game-session) | Built | A synchronous, host-led multiplayer quiz round. |
| [Class Code](#class-code) | Built | The 6-character code a student uses to join a class. |
| [Game PIN](#game-pin) | Built | The 6-digit code a student uses to join a Live Game Session. |
| [Session (ambiguity notice)](#session-ambiguity-notice) | — | The word "Session" alone is never precise — always qualify it. |

---

## People & Roles

### Student
**Status: Built.**
**Definition:** A learner account enrolled in zero or more Classes, grades 4–12, under the CBC or Cambridge curriculum today.
**Owner:** Self (registers their own account).
**Consumers:** Teacher (of their enrolled classes), eventually Guardian.
**May include:** grade level, enrolled classes, Focus Sessions, Tasks, Quiz attempts, XP, Achievements, Wellness Check-ins.
**Related objects:** Class, Enrollment, Task, Quiz, Focus Session.
**Not to be confused with:** Guardian (a student's parent, a separate future role, never the same account).

### Teacher
**Status: Built.**
**Definition:** An account that creates and owns Classes, assigns Tasks and Quizzes to enrolled students, and reviews their progress.
**Owner:** Self (registers their own account).
**Consumers:** Their enrolled students (indirectly, via assigned work); school administrators (future).
**May include:** owned classes, authored quizzes, assigned practice tasks, roster views, risk signals.
**Related objects:** Class, Task, Quiz, Risk Signal.
**Not to be confused with:** School Administrator (a future, higher-scoped role overseeing multiple teachers — not yet designed).

### Guardian
**Status: Planned** (see [01_Product_Vision.md](01_Product_Vision.md) — secondary user).
**Definition:** A parent or guardian with narrow, opt-in, read-only visibility into a student's effort and wellbeing *trends* — never raw behavioral data, never grades (which remain the school's own domain).
**Owner:** Invited by the student or the account holder; not self-registering independently of a student.
**Consumers:** No one — a Guardian is a viewer only, never an actor on a student's data.
**May include:** weekly effort summary, weekly mood trend.
**Related objects:** Student.
**Not to be confused with:** Teacher (a Guardian never sees grades, class rosters, or other students).

---

## Curriculum & Structure

### Curriculum
**Status: Built** (`curricula` table).
**Definition:** A named educational framework — today, "Competency-Based Curriculum (CBC)" or "Cambridge International" — that a set of Subjects belongs to. Modeled as real, insertable data specifically so a new curriculum never requires a migration.
**Owner:** System (seeded via `db/seed-curricula.ts`), not user-created.
**Consumers:** Teacher (selects one when creating a Class), Subject (belongs to exactly one).
**May include:** code, name, country, description.
**Related objects:** Subject, Class.
**Not to be confused with:** Subject (a curriculum is the framework; a subject is one discipline inside it).

### Subject
**Status: Built** (`subjects` table).
**Definition:** A named academic discipline — e.g. "Mathematics," "Kiswahili" — scoped to exactly one Curriculum. The same subject name can exist under two different curricula as two distinct rows (Cambridge's "Mathematics" and CBC's "Mathematics" are not the same Subject record).
**Owner:** System (seeded), not user-created.
**Consumers:** Teacher (selects when creating a Class), Class.
**May include:** name, code, parent curriculum.
**Related objects:** Curriculum, Class.
**Not to be confused with:** Competency (a subject is the discipline; a competency is a specific skill or strand within it — see below).

### Class
**Status: Built** (`classes` table).
**Definition:** One teacher's group of enrolled students, for exactly one Subject, under exactly one Curriculum, identified by a unique join code. This is Focus Flow's actual unit of "a class" — one teacher, one subject, one group of students.
**Owner:** Teacher.
**Consumers:** Enrolled students.
**May include:** name, class code, curriculum, subject, grade label, roster, assigned tasks and quizzes.
**Related objects:** Curriculum, Subject, Enrollment, Task, Quiz.
**Not to be confused with:** Stream (see below — a real, unresolved distinction).

### Stream
**Status: Not currently modeled.**
**Definition:** In common Kenyan school usage, a "stream" is a whole cohort of students who share a homeroom or form (e.g. "Grade 9 East," "Grade 9 West") and typically take *multiple* subjects together as a group. Focus Flow's `Class` object today models one teacher's single-subject group, not a whole-cohort homeroom — so a real school's "9 East" stream, which takes Math with one teacher and English with another, currently has no single Focus Flow object representing "9 East" as a whole; it exists only implicitly, as the same set of students independently enrolled in several unrelated Classes.
**Owner:** Not applicable — does not exist as an object yet.
**Consumers:** Not applicable.
**May include:** Not applicable.
**Related objects:** Class (a stream would, if built, group several classes).
**Not to be confused with:** Class. **This is flagged, not resolved** — the PRD must decide whether a Stream/Cohort object is needed, or whether "several classes that happen to share the same students" is sufficient indefinitely.

### Grade Label
**Status: Built** (`classes.gradeLabel`, nullable free text).
**Definition:** A free-text, curriculum-specific grade descriptor on a Class — e.g. "Grade 9," "Year 10," "PP2" — deliberately not tied to the numeric `users.gradeLevel` check constraint, because grade naming differs by curriculum (CBC includes PP1/PP2; Cambridge uses "Year N").
**Owner:** Teacher (set when creating a Class).
**Consumers:** Displayed to students viewing the class.
**May include:** any short string.
**Related objects:** Class.
**Not to be confused with:** `users.gradeLevel` (a student's own numeric grade, set at registration — the two are not currently reconciled or validated against each other).

### Enrollment
**Status: Built** (`enrollments` table).
**Definition:** The record linking one Student to one Class, with a status (active or dropped).
**Owner:** Created by the student, via joining with a Class Code.
**Consumers:** Teacher (roster), Student (their own class list).
**May include:** enrolled-at timestamp, status.
**Related objects:** Class, Student.
**Not to be confused with:** Class Code (the code is how an enrollment is *created*, not the enrollment itself).

### Competency
**Status: Conceptual — not yet a distinct data object.**
**Definition:** A specific skill or strand within a Subject that a competency-based curriculum (CBC/CBE) asks a student to demonstrate — e.g., within Mathematics, "solving linear equations" as a strand distinct from "interpreting statistical data." Today, Focus Flow's Quiz results report one overall score per attempt; they do not yet report mastery per competency/strand. This is a named, open gap (see [02_Product_Definition.md](02_Product_Definition.md), Recommendations) that the PRD and database design must resolve before senior-school (CBE) support is built.
**Owner:** Not applicable yet.
**Consumers:** Not applicable yet.
**Related objects:** Subject, Quiz, Mastery Path.
**Not to be confused with:** Subject (broader), Mastery Path (the gamified level built from competency data, once it exists).

---

## Work & Assignment

### Assignment
**Status: Conceptual — not a database object.**
**Definition:** The general act of a teacher giving work to one or more students. Assignment is never itself an object in Focus Flow — it is always realized as one of two concrete things: a **Task** (personal, or teacher-assigned as Practice, or auto-created from a Quiz) or a **Quiz**. Anyone writing a requirement or a schema should never create an "Assignment" table or type — say specifically which of the two is meant.
**Related objects:** Task, Quiz.
**Not to be confused with:** Task specifically (a Task is one *kind* of realized assignment, not a synonym for the general concept).

### Task
**Status: Built** (`tasks` table).
**Definition:** A to-do item owned by exactly one student, with a title, optional description, priority, optional due date, and a completed/not-completed state. Today a Task is either fully personal (created by the student themselves, with no class or quiz link) or auto-created for a student the first time they see a due-dated, published Quiz (linked via `tasks.quizId`) — this second kind exists so a graded Quiz also shows up in a student's task list, not as a separate assignment type.
**Owner:** Student (personal) or the system, on behalf of a Quiz's due date (quiz-linked).
**Consumers:** The owning student only.
**May include:** title, description, priority, due date, completed state, linked quiz (optional).
**Related objects:** Quiz (optional link), Focus Session (optional link).
**Not to be confused with:** Practice Task (see next entry — a genuinely different, teacher-initiated object) or Quiz (a Task can point *at* a quiz; it is never the quiz itself).

### Practice Task
**Status: Built** (Sprint 1).
**Definition:** A teacher-assigned, **ungraded** rehearsal activity, scoped to a Class, distinct from both a personal Task and a graded Quiz. Where a Quiz certifies whether a skill has been mastered, a Practice Task exists purely for low-stakes retrieval rehearsal — it is safe to get wrong and does not feed a permanent grade.
**Owner:** Teacher (creates a `task_templates` row; the system fans it out to one Task-like row per enrolled student).
**Consumers:** Enrolled students in the class it was assigned to.
**May include:** title, description, due date, linked class, linked subject.
**Related objects:** Class, Task (a Practice Task is realized to each student as a row with `taskType = 'practice'`).
**Not to be confused with:** a personal Task (student-initiated, ungraded, but never teacher-assigned) or a Quiz (graded, certifying, never a Practice Task).

### Quiz
**Status: Built** (`quizzes`, `quiz_questions`, `quiz_choices`, `quiz_attempts`, `quiz_answers` tables).
**Definition:** A graded, certifying assessment authored by a teacher for a Class, made up of multiple-choice or true/false questions, each with exactly one correct choice. Grading is always computed server-side from the real answer key — a client only ever submits which choice it picked, never a claimed correctness.
**Owner:** Teacher.
**Consumers:** Enrolled students (take it), Teacher (reviews results).
**May include:** title, description, time limit, due date, published/draft state, questions, choices, student attempts and scores.
**Related objects:** Class, Task (auto-creates one when due-dated and published), Live Game Session (a quiz's questions can be played live), Public Quiz Bank (planned), Challenge (planned).
**Not to be confused with:** Assessment (the general concept — Quiz is its concrete realization) or Practice Task (ungraded, never a Quiz).

### Assessment
**Status: Conceptual.**
**Definition:** The general educational concept of certifying evaluation of a skill. In Focus Flow, "Assessment" is never a data object — it is always realized specifically as a **Quiz**. Use "Quiz" in any technical document; reserve "Assessment" for educational-philosophy discussion only (as in [02_Product_Definition.md](02_Product_Definition.md)'s Educational Philosophy section).
**Related objects:** Quiz.
**Not to be confused with:** Quiz itself, when writing a requirement, schema, or API — always say "Quiz."

### Resource
**Status: Planned — not yet designed or built.**
**Definition:** A file or link a teacher shares with a Class — lecture notes, a past paper, a reference document. Named in the documentation roadmap and in Information Architecture sketches, but has no schema, no upload mechanism, and no UI today.
**Owner:** Teacher (would be, once built).
**Consumers:** Enrolled students (would be).
**Related objects:** Class.
**Not to be confused with:** Task or Quiz (a Resource is reference material to consult, never something a student "completes" or is graded on).

### Submission
**Status: Conceptual — not a single shared object.**
**Definition:** The general act of a student completing a piece of assigned work. Focus Flow has no single "Submission" table — completing a Task means flipping its completed flag; completing a Quiz means creating a `quiz_attempts` row with its associated `quiz_answers`. Anyone modeling a new work type should decide explicitly how "submission" is realized for it, rather than assuming a shared Submission object exists to plug into.
**Related objects:** Task, Quiz (Quiz Attempt).
**Not to be confused with:** Quiz Attempt specifically, which is the real, named object for a quiz's submission — use "Quiz Attempt," not "Submission," in any Quiz-specific technical document.

---

## Focus & Behavior

### Focus Session
**Status: Built** (`focus_sessions` table).
**Definition:** A timed block of committed work time, created the moment it *starts* (not just on completion), optionally linked to a Task. Recording an abandoned session honestly (`wasSuccessful: false`) is deliberate — the product needs real procrastination signal, not just a record of successes.
**Owner:** Student.
**Consumers:** Self (streaks, XP), Teacher (aggregated risk signal only, never raw session detail).
**May include:** duration, started/completed timestamps, success flag, linked task (optional).
**Related objects:** Task, Distraction Event, XP, Streak, Commitment (planned).
**Not to be confused with:** Live Game Session (a synchronous multiplayer quiz round — an entirely different object that happens to share the word "session"; see the Session ambiguity notice below).

### Focus Mode
**Status: Built.**
**Definition:** Page Visibility API monitoring active during a live Focus Session — detects when a student switches away from the tab and shows them a toast reporting how long they were away.
**Owner:** System, active only during an in-progress Focus Session.
**Consumers:** The student in that session (immediate feedback); aggregated into Risk Signal for the teacher.
**Related objects:** Focus Session, Distraction Event.
**Not to be confused with:** a device-level screen-time blocker — Focus Flow cannot block other apps or tabs; this is in-app tab-visibility detection only (see [02_Product_Definition.md](02_Product_Definition.md), Product Boundaries).

### Distraction Event
**Status: Built** (`distraction_events` table).
**Definition:** A single logged instance of leaving the browser tab during an active Focus Session, with its duration.
**Owner:** System, written during Focus Mode.
**Consumers:** Aggregated into Risk Signal; never shown to a teacher as raw, individual events.
**Related objects:** Focus Session, Focus Mode.

### Commitment
**Status: Planned** (see [02_Product_Definition.md](02_Product_Definition.md), Anti-Procrastination Framework — "Commitment Setting").
**Definition:** A specific, named intention a student sets immediately before a Focus Session begins — e.g. "finish the first five algebra problems," not "study math." An implementation-intention technique, not a cosmetic prompt.
**Owner:** Student, set per Focus Session.
**Consumers:** Self (during and after the session, to check whether it was met).
**Related objects:** Focus Session.
**Not to be confused with:** a Task or Mission (a Commitment is a single session's specific intention, not a standing to-do item or a multi-day goal).

### Risk Signal
**Status: Built** (teacher-facing assignment insights; see `getAssignmentInsightsFn`).
**Definition:** A private, aggregated indicator surfaced only to a student's own teacher — time between an assignment appearing and a first attempt, whether any focus time was logged before a deadline, completion timing relative to the due date. Deliberately never shown as a public ranking or score, and never exposes raw, moment-level behavioral data (see [02_Product_Definition.md](02_Product_Definition.md), Anti-Procrastination Framework and Product Boundaries).
**Owner:** System, computed from a student's Tasks, Quizzes, and Focus Sessions.
**Consumers:** The teacher of the relevant Class only.
**Related objects:** Task, Quiz, Focus Session.
**Not to be confused with:** a public leaderboard or score — a Risk Signal is private, supportive, and teacher-only by design, never student- or parent-facing in raw form.

### Wellness Check-in
**Status: Built** (`wellness_logs` table).
**Definition:** A student's self-reported mood (1–5) with an optional journal note, logged voluntarily.
**Owner:** Student.
**Consumers:** Self only, today (aggregated wellbeing engagement may inform future teacher- or Guardian-facing trend views, never raw notes).
**Related objects:** none currently linked to Focus Session or Task, though the Anti-Procrastination Framework proposes a lightweight post-session reflection prompt extending this (planned).

---

## Gamification

### XP
**Status: Built** (`xp_ledger` table; today only wired to the quiz-assignment engagement path in `focusMode.ts` — **corrected**: earlier drafts of this glossary had this backwards, stating the Pomodoro path was the one that worked. Verified directly against source: `useFocusSession.ts`'s Pomodoro handlers contain zero `xpLedger` writes; `focusMode.ts` is the one that awards XP. See [Phase 3 of the redesign plan] for the planned unification).
**Definition:** Points earned only from verified learning actions — a completed Focus Session, a correct Quiz answer, a completed Practice Task, a measurable improvement on a retry. Never earned for opening the app, starting a timer, or remaining idle — this is a binding rule from [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md), not a style preference.
**Owner:** System, awarded automatically.
**Consumers:** Student (visible progress), Mastery Path (planned, consumes XP per subject).
**Related objects:** Focus Session, Quiz, Practice Task, Mastery Path.

### Mastery Path
**Status: Planned** (see [02_Product_Definition.md](02_Product_Definition.md), Gamification Philosophy).
**Definition:** A **subject-scoped** level track — a student has one Mastery Path per Subject they're enrolled in, not one global account level. Deliberately replaces a single combined number, which would flatten a student excelling in one subject and struggling in another into one misleading digit.
**Owner:** System, computed from XP earned within that subject.
**Consumers:** Student.
**Related objects:** Subject, XP, Competency (a full Mastery Path eventually wants competency-level data, not just a subject-wide XP total — see the Competency entry above).
**Not to be confused with:** Learning Path (see next entry — related but distinct, and the PRD must decide whether both are needed).

### Learning Path
**Status: Planned, and explicitly distinct from Mastery Path — this distinction is not yet resolved.**
**Definition:** A potential sequenced route through a subject's topics or competencies — "do this, then this, then this" — which is a content-sequencing concept, not a gamification level. Named in early planning documents alongside Mastery Path; the two have not been reconciled.
**Related objects:** Subject, Competency, Mastery Path.
**Not to be confused with:** Mastery Path (a level/progress track). **Open question for the PRD:** does Focus Flow need both a Mastery Path (gamified level) and a separate Learning Path (content sequence), or should they be merged into one system once Competency data exists? Treat as unresolved, not decided by default.

### Achievement (Badge)
**Status: Built** (`user_achievements` table, 8 static keys today; the product-definition document's "Badge" terminology refers to the same underlying object, redesigned around genuine-behavior criteria).
**Definition:** A recognition unlocked when a student's real behavior matches a specific, named pattern — e.g. a sustained, distraction-free Focus Session, a meaningfully improved retry score, a real weekly streak. "Achievement" is the system/database name; "Badge" is the plain-language UI term for the exact same object — they are not two different systems, and no future document should treat them as such.
**Owner:** System, unlocked automatically via `checkAndUnlockAchievements`.
**Consumers:** Student.
**Related objects:** Focus Session, Task, Quiz, Streak, XP.

### Streak
**Status: Built** (computed in `useProgress.ts` from `focus_sessions`, not a stored column).
**Definition:** The count of consecutive days on which a student completed at least one Focus Session — both a "current streak" (still active) and a "longest streak" (all-time record) are tracked.
**Owner:** Computed, not user-set.
**Consumers:** Student (dashboard, sidebar), feeds Achievement unlocks.
**Related objects:** Focus Session, Achievement.

### Mission
**Status: Planned** (see [02_Product_Definition.md](02_Product_Definition.md), Gamification Philosophy).
**Definition:** A short-term goal scoped to a student's *actual current coursework* — e.g. "complete three practice sessions on linear equations before Friday's quiz" — deliberately not a generic daily-login quest disconnected from real content.
**Owner:** System-generated (from real upcoming Tasks/Quizzes) or teacher-set.
**Consumers:** Student.
**Related objects:** Practice Task, Quiz, Class.
**Not to be confused with:** Commitment (a Mission spans days and multiple sessions; a Commitment is set fresh for a single Focus Session).

### Challenge
**Status: Planned** (see [01_Product_Vision.md](01_Product_Vision.md) — confirmed quiz mode: "async head-to-head").
**Definition:** An asynchronous, solo-played rematch: a student who has already taken a Quiz challenges a classmate to beat their score. The challenged student plays the same quiz alone, on their own time; results are compared afterward. Explicitly **not** the synchronous Live Game Session.
**Owner:** The challenging student (initiates it).
**Consumers:** The challenged student.
**Related objects:** Quiz, Quiz Attempt.
**Not to be confused with:** Live Game Session (synchronous, whole-class, host-led — a Challenge is asynchronous and exactly two participants).

### Public Quiz Bank
**Status: Planned** (see [01_Product_Vision.md](01_Product_Vision.md) — confirmed quiz mode: "public = shared quiz bank").
**Definition:** A library of quizzes a teacher has published for other teachers to browse and copy (never for students to browse directly), filterable by Curriculum and Subject. Copying deep-copies the quiz's questions and choices into the copying teacher's own class as a new, independent Quiz.
**Owner:** The original authoring teacher (publishes into the bank); each copy is owned independently by the copying teacher thereafter.
**Consumers:** Teachers (browsing and copying) only — never directly visible to students.
**Related objects:** Quiz, Curriculum, Subject.
**Not to be confused with:** a Class's own Quiz list (private to that class) — the Public Quiz Bank is a separate, cross-class, teacher-only library.

---

## Live & Social

### Live Game Session
**Status: Built** (`game_sessions`, `game_participants`, `game_answers` tables).
**Definition:** A synchronous, host-led (teacher) multiplayer round of a Quiz's questions, joined by a 6-digit Game PIN, with server-clock-timed, speed-weighted scoring and a live leaderboard. An engagement and classroom-adoption module — see [02_Product_Definition.md](02_Product_Definition.md)'s explicit scoping note that this does not, by itself, serve the anti-procrastination mission.
**Owner:** Teacher (hosts it).
**Consumers:** Enrolled students who join with the PIN.
**Related objects:** Quiz, Game PIN.
**Not to be confused with:** Focus Session (an individual, asynchronous work block) or Challenge (asynchronous, two-player).

### Class Code
**Status: Built** (`classes.code`, 6-character unique).
**Definition:** The code a teacher shares so a student can join their Class.
**Owner:** System-generated at Class creation.
**Consumers:** Student (enters it to join).
**Related objects:** Class, Enrollment.
**Not to be confused with:** Game PIN (joins a Live Game Session, not a Class — the two codes are unrelated and not interchangeable).

### Game PIN
**Status: Built** (`game_sessions.pin`, 6-digit unique).
**Definition:** The code a student enters to join a specific, currently-running Live Game Session.
**Owner:** System-generated when a teacher starts a Live Game Session.
**Consumers:** Enrolled students.
**Related objects:** Live Game Session.
**Not to be confused with:** Class Code (joins a Class permanently; a Game PIN joins one live round and expires with it).

---

## System

### Session (ambiguity notice)
**Status: Not an object — a naming hazard.**
**Definition:** The bare word "Session" is used in this codebase and documentation set for at least three unrelated things: a **Focus Session** (a student's individual work block), a **Live Game Session** (a synchronous multiplayer quiz round), and an **authentication session** (the logged-in browser session tied to a `session_token` cookie, unrelated to either). No document, schema, or API should ever use "session" unqualified — always write "Focus Session," "Live Game Session," or "auth session" specifically.
**Related objects:** Focus Session, Live Game Session, authentication/login.

---

**Next:** [04_Product_Requirements_Document.md](04_Product_Requirements_Document.md) — every feature named above gets specified to the level of detail shown in the founder's Focus Session example: purpose, actors, inputs, outputs, rules, and acceptance criteria.
