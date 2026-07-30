# Focus Flow: Anti-Procrastination Framework

*The mechanic that makes Focus Flow different from every platform named in [01_Product_Vision.md](01_Product_Vision.md)'s competitive analysis — Kahoot, Wayground, Google Classroom, Moodle, and Canvas all answer "was it turned in." None of them answer "what happened between assignment and submission." This document is where that answer gets built.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md), specifically Principle 2 (Reduce Procrastination) and Principle 6 (Student Wellbeing — nothing in this document authorizes surveillance). Extends [D1](04_Product_Requirements_Document.md#d1-focus-session)–[D4](04_Product_Requirements_Document.md#d4-teacher-risk-signal) and [02_Product_Definition.md](02_Product_Definition.md)'s Anti-Procrastination Framework section into full mechanical detail.

---

## 1. Why students procrastinate — named precisely, not gestured at

A design that only offers a countdown timer addresses none of the real causes below — which is exactly why Focus Flow's actual mechanism is Commitment Setting and early detection, not a bigger clock:

- **Present bias / temporal discounting** — a reward available now (anything more immediately gratifying than homework) is weighted far more heavily than a larger, later reward (a good grade in three weeks), even when the student consciously knows the later reward matters more.
- **Task aversiveness** — the work itself feels unpleasant to even begin, independent of its difficulty; starting is the hardest part, not finishing.
- **Low self-efficacy** — a student who doubts they can succeed avoids starting rather than risk confirming the doubt; not starting feels safer than starting and failing.
- **Unclear starting point** — a vague assignment ("study for the test") has no obvious first move, so nothing happens; a concrete one ("do problems 1–5") does.
- **Procrastination as short-term mood repair** (Sirois & Pychyl) — avoiding an unpleasant task is, in the moment, an effective way to feel better *right now*, even though it reliably makes the student feel worse later. This reframes procrastination as an emotion-regulation failure, not a time-management one — which is why a purely logistical tool (a better calendar, a louder reminder) rarely fixes it on its own.
- **Fear of failure / perfectionism** — starting risks producing visible, imperfect work; not starting keeps the work perfectly hypothetical.

---

## 2. How we detect procrastination — the real, already-built algorithm

This is not a proposed design — it is `getAssignmentInsightsFn`, read directly from the source ([10_API_Architecture.md](10_API_Architecture.md)), documented here precisely because this exact mechanism is the product's actual competitive core.

For a given Quiz (an "assignment," in the sense defined in [03_Product_Glossary.md](03_Product_Glossary.md)), for every enrolled student:

| Signal | Computed as |
|---|---|
| `startedAt` | When a `start_event` for this assignment first exists for the student |
| `attemptStartedAt` / `submittedAt` | From the student's `quiz_attempts` row, if one exists |
| `hoursBeforeDeadline` | `quiz.dueDate − attempt.startedAt`, in hours |
| `focusSessionCount` / `totalFocusMinutes` | Focus Sessions linked to this specific assignment (`focus_sessions.assignmentId`) |
| `procrastinationFlag` | True if zero focus time was logged **and** the deadline is within 24 hours |
| `riskScore` (0–3) | **3** — no attempt exists at all. **2** — an attempt exists, but zero focus time was logged and the deadline is within 24 hours. **1** — the deadline is within 48 hours (regardless of focus time). **0** — otherwise |

Class-wide aggregates computed alongside the per-student view: average and median time-to-start (hours from assignment creation to first start event), percent of students who started within 24/72 hours, percent who completed with 24+ hours to spare, the last-minute completion rate, and average focus minutes per student.

**`atRiskStudents`** is the filtered, teacher-facing shortlist: every student with `riskScore >= 2`, each with a specific, plain-language reason ("No attempt started yet and the deadline is close" or "Started without tracked focus time within the final day") — never just a bare number.

**A real integration detail worth stating precisely**: this algorithm already draws from *both* of the not-yet-unified focus-tracking systems named in [08_System_Architecture.md](08_System_Architecture.md) — `start_events` (the quiz-assignment engagement system) for `startedAt`, and `focus_sessions.assignmentId` (shared with the Pomodoro table) for focus time. This is precisely why the Phase 3 unification matters most *here*: today, a student's Pomodoro-style focus time on an assignment and their `start_events`-tracked engagement are two different tables being stitched together per-request, not one clean signal.

---

## 3. How we prevent it

### Commitment Setting

Specified in full in [D3](04_Product_Requirements_Document.md#d3-commitment-setting) and grounded in implementation-intention research in [12_Gamification_Framework.md](12_Gamification_Framework.md) §1 — restated here only to place it correctly: this is the *primary* prevention mechanism, not a nice-to-have layered on top of a timer. A specific, self-named goal ("finish the first five problems") directly answers "unclear starting point" from §1 above.

### Task decomposition

A large assignment should be breakable into smaller sub-goals inside the product itself — mirroring the Commitment prompt, and directly answering task-aversiveness: a five-minute first step is far less aversive than "finish the assignment."

### Low-stakes on-ramps

Practice Tasks ([C2](04_Product_Requirements_Document.md#c2-practice-task-assignment)) exist specifically as an ungraded rehearsal step *before* the certifying Quiz — a deliberate answer to fear-of-failure: a student can start on something that doesn't risk a visible, permanent grade, building the self-efficacy needed to then start the graded work.

### Proximal deadlines

Missions ([12_Gamification_Framework.md](12_Gamification_Framework.md) §5) break a distant due date into nearer, smaller checkpoints — directly countering present bias by making the *next* reward proximal instead of leaving only the distant one.

---

## 4. Behavioral interventions

The four mechanisms in §3, plus one more worth naming as a behavioral (not just logistical) design choice: **feedback must be proximal, not just accurate.** A student who completes a 20-minute Commitment-driven session should feel that immediately (XP, a visible Mastery Path tick — see [12_Gamification_Framework.md](12_Gamification_Framework.md)), not just see it reflected in a score three weeks later. This is the same goal-gradient reasoning from the gamification framework, applied here to the specific problem of procrastination rather than engagement generally.

---

## 5. AI interventions

Per [02_Product_Definition.md](02_Product_Definition.md)'s AI Philosophy and [08_System_Architecture.md](08_System_Architecture.md)'s architectural guardrail (draft-only, always reviewed): AI's role here is narrow and specific —

- Detecting a struggling topic from quiz-answer patterns and **suggesting**, never assigning, a short, specific Practice Task on it.
- Language is always encouraging, never framed around deficit ("this looks like a good one to revisit," never "you're behind" or "you failed this").
- AI never initiates contact with a student directly about their procrastination risk — any AI-detected signal surfaces to the *teacher* first (§6), who decides whether and how to act on it. This is the same non-negotiable human-in-the-loop rule from [08_System_Architecture.md](08_System_Architecture.md), restated here because procrastination-risk framing is exactly the kind of message that could read as surveillance if it ever reached a student unmediated.

---

## 6. Teacher interventions

The Risk Signal (§2) exists to be *acted on*, not just displayed. The intervention itself — a private, supportively-worded message to a specific at-risk student — is named in [07_User_Journeys.md](07_User_Journeys.md)'s T2 journey, and its delivery channel is a real, still-open dependency named in [08_System_Architecture.md](08_System_Architecture.md) (no notification service exists yet). Framing rules that apply regardless of what channel is eventually chosen:

- Never a public or semi-public message (no "your risk score is X" visible to classmates).
- Always framed as an offer of support, never a warning or a citation of a failure to perform.
- Never automatically sent — a teacher always makes the explicit choice to reach out; the system only surfaces *who* might benefit from it.

---

## 7. Habit formation

Procrastination is, structurally, the absence of a working habit loop. The classic cue → routine → reward loop (Duhigg) maps directly onto existing mechanics: the **cue** is a Mission or a due Task appearing in `/tasks`; the **routine** is the Focus Session itself, scaffolded by a Commitment; the **reward** is the immediate XP/badge feedback from [12_Gamification_Framework.md](12_Gamification_Framework.md). Streaks reinforce the loop across days specifically by making the *habit itself* — not just any single session — the thing with visible, protectable value (loss aversion, same citation as the gamification framework).

---

## 8. Reflection

A short prompt at the end of a Focus Session or Quiz Attempt — "what was hard about this," "what helped you focus" — closes the self-regulated-learning cycle (Zimmerman: plan → perform → reflect) named in [02_Product_Definition.md](02_Product_Definition.md)'s Educational Philosophy. **Status: Planned**, extending the existing Wellness Check-in rather than duplicating it — this is the same reflection stage named in [07_User_Journeys.md](07_User_Journeys.md)'s S2 journey, not a new, separate feature.

---

## 9. Study planning

The **Planning** stage of the seven-stage student journey ([07_User_Journeys.md](07_User_Journeys.md), S2) is where study planning actually lives: seeing everything due across every subject in `/tasks`, then choosing what to tackle and setting a Commitment for it. There is no separate "planner" feature proposed here — planning is a *view* over the same Task/Quiz/Mission data every other part of the product already uses, not a new system to maintain in parallel.

---

## 10. Behavior analytics

Two layers, already distinguished in [04_Product_Requirements_Document.md](04_Product_Requirements_Document.md) and worth restating precisely here since this is the document about behavior specifically:

- **Risk Signal** ([D4](04_Product_Requirements_Document.md#d4-teacher-risk-signal), §2 above) — a point-in-time view, per assignment, already built.
- **Class Trend Analytics** ([H2](04_Product_Requirements_Document.md#h2-class-trend-analytics), Planned) — the same underlying signals, shown as a trend across weeks, extending rather than replacing the Risk Signal. This is the concrete mechanism behind the founding brief's explicit ask for "analytics that show trends, not just scores."

---

## 11. Why this is the actual competitive moat

Restated plainly, because it's easy to lose in the mechanical detail above: **every mechanism in this document exists because no competitor named in [01_Product_Vision.md](01_Product_Vision.md) has one.** Kahoot and Wayground have no concept of "before the live session." Google Classroom's entire signal is "turned in" vs. "missing." Moodle and Canvas have gradebooks, not behavior. The Risk Signal in §2 is not a nice-to-have analytics feature bolted onto a classroom tool — it is the one thing this product does that the rest of the category structurally cannot, because none of them were built around a student's *time*, only around their *output*.

---

## 12. Ethical guardrails — restated at the point of maximum relevance

Because this document describes real behavioral detection in the most detail anywhere in this set, the binding rules from [00_Project_Philosophy.md](00_Project_Philosophy.md) and [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md) are restated here, not assumed remembered:

- The Risk Signal is visible **only** to the student's own teacher — never to another student, another teacher, a School Administrator (aggregate/anonymized only), or a Guardian (trend-level only, never this specific signal).
- Raw Distraction Events and moment-level timestamps are never exposed anywhere, to anyone, even aggregated into this signal — only the derived metrics in §2's table.
- Nothing in this document authorizes automated, student-facing messaging about procrastination risk — see §5 and §6.

---

## Open questions carried into engineering

- The Phase 3 unification of `focus_sessions` and `start_events`/`focus_heartbeats` (named again in §2) should be treated as a prerequisite for trusting this signal fully, not a nice-to-have cleanup.
- What delivery channel does a teacher's private nudge actually use — still unresolved from [08_System_Architecture.md](08_System_Architecture.md) and [07_User_Journeys.md](07_User_Journeys.md).
- Should the Reflection prompt (§8) be mandatory or optional — the same adoption-friction tradeoff already named for Commitment Setting in [D3](04_Product_Requirements_Document.md#d3-commitment-setting), not yet decided here either.

---

**Next:** [14_Analytics_And_Reporting.md] — the full reporting layer this framework's signals feed into, for students, teachers, and (eventually) schools.
