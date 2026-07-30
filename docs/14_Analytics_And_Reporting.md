# Focus Flow: Analytics & Reporting

*The reporting layer — what gets shown, to whom, in what form. [13_Anti_Procrastination_Framework.md](13_Anti_Procrastination_Framework.md) already specified how procrastination risk is *computed*; this document specifies what every audience actually *sees*, across every kind of analytics the founding brief named, including two (School analytics, Performance predictions) not yet addressed anywhere else in this set.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md). Built on [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md)'s access matrix — nothing in this document grants a role visibility it wasn't already given there.

---

## 1. Student analytics

| View | Status | Shows |
|---|---|---|
| `/progress` | Built | 14-day daily focus-minutes chart, today/week totals, current + longest streak, tasks completed this week |
| `/achievements` | Built | Badge grid (locked/unlocked, per [12_Gamification_Framework.md](12_Gamification_Framework.md)) |
| Personal Growth view | Planned | Long-run improvement over time — explicitly *not* the same as the gamification layer; this is the "Growth" stage of the seven-stage student journey ([07_User_Journeys.md](07_User_Journeys.md), S2), the reason to keep coming back once badge novelty wears off |
| Mastery Path view | Planned | Per-subject level and progress-to-next-level, never a single blended number ([12_Gamification_Framework.md](12_Gamification_Framework.md) §3) |

**A real, already-flagged bug this document inherits rather than re-discovers**: `/progress`'s "longest streak" is bounded by the same 14-day query window as the daily chart ([10_API_Architecture.md](10_API_Architecture.md)) — a genuine 20-day streak reports as 14. Scheduled for the Phase 6 `computeStreak()` fix, restated here because it directly undermines this exact view's trustworthiness until fixed.

**A genuine differentiator worth stating plainly**: a student-facing Growth view is rare in this category — Kahoot, Wayground, Google Classroom, Moodle, and Canvas all build analytics for the teacher or administrator, never a "look how far you've come" view for the learner themselves. This is a direct, deliberate extension beyond what [01_Product_Vision.md](01_Product_Vision.md)'s competitive analysis found anywhere else.

---

## 2. Teacher analytics

| View | Status | Shows |
|---|---|---|
| `/dashboard` | Built | Class/student/quiz counts, real classes list, recent quiz attempts across all owned classes ([H1](04_Product_Requirements_Document.md#h1-teacher-dashboard)) |
| Risk Signal (per assignment) | Built | The full metrics table and `atRiskStudents` shortlist specified in [13_Anti_Procrastination_Framework.md](13_Anti_Procrastination_Framework.md) §2 |
| Class Trend Analytics | Planned | Extends `/progress` with a teacher-role branch — see below |

### Class Trend Analytics — concrete chart specification (Planned)

Three trend lines, all sharing one visual language (line charts, drawn from the same five `chart-1`–`chart-5` tokens already defined in [11_UI_UX_Design_System.md](11_UI_UX_Design_System.md), following the existing hand-rolled-chart convention rather than introducing a charting library — consistent with [08_System_Architecture.md](08_System_Architecture.md)'s "direct query, no separate analytics pipeline" architecture):

1. **Weekly focus-minutes trend** — total or average focus minutes logged against this class's assignments, by week, over a full term.
2. **Quiz completion-rate trend** — percent of enrolled students who've submitted, by week, across the class's quizzes.
3. **Procrastination-flag trend** — the share of `atRiskStudents` (riskScore ≥ 2, [13_Anti_Procrastination_Framework.md](13_Anti_Procrastination_Framework.md) §2) per assignment, plotted across the term's assignments in sequence, so a teacher can see whether their own interventions are working over time.

All three should be **breakable by Subject** the moment a teacher has more than one class — a direct payoff of [B1](04_Product_Requirements_Document.md#b1-curriculum--subject-reference-data)'s curriculum-native modeling, not a new capability invented here.

---

## 3. School analytics *(Planned — new in this document)*

Per [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md)'s School Administrator row: **aggregate only, never a named individual student**, no exceptions. Concretely:

- School-wide class count, total enrollment, curriculum mix (how many classes run CBC vs. Cambridge).
- Teacher adoption: how many teachers at the school are active, and how recently — this answers "is this actually being used," the exact question [01_Product_Vision.md](01_Product_Vision.md)'s Mrs. Wanjiru persona cares about, without exposing anything about individual students.
- A school-wide, **anonymized** Risk Signal trend — the same underlying signal as §2's Class Trend Analytics, rolled up and stripped of any student-identifying detail, answering "is engagement improving school-wide" without answering "which specific student is struggling," which stays the teacher's own view alone.

**This is the one place in the whole reporting layer where an aggregation step is not optional** — there is no version of School Analytics that shows a roster, a name, or a per-student number, ever, at any privilege level. This is restated as a hard line because a School Administrator role, once built, is exactly the kind of thing that accretes "just one more drill-down" requests over time — this document draws the line now, before that pressure exists.

---

## 4. Mastery analytics

Today: [12_Gamification_Framework.md](12_Gamification_Framework.md)'s Mastery Path (per-subject level, from XP). **The real, unresolved gap, restated because this is exactly the section it blocks**: a Mastery Path built only from XP totals is a *engagement* proxy, not a true mastery measure — actual competency-based mastery reporting (which strand of a subject a student has actually demonstrated, matching what CBC/CBE assessment already asks teachers to track) requires the Competency data model named as an open question in [03_Product_Glossary.md](03_Product_Glossary.md) and [02_Product_Definition.md](02_Product_Definition.md), which does not exist yet. **Mastery analytics, in the full sense the founding brief asks for, is blocked on that data-model decision** — not a reporting-layer detail to work around.

---

## 5. Behavior analytics

The reporting surface for [13_Anti_Procrastination_Framework.md](13_Anti_Procrastination_Framework.md)'s detection layer — restated here only as *what's shown*, not re-derived: the per-assignment Risk Signal (§2 above) and, once built, its trend over time (§2's third chart). Never raw Distraction Events, never a moment-level timeline, anywhere in this reporting layer — the same binding rule from [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md), restated because a "behavior analytics" section is exactly where a raw event feed would be tempting to add later.

---

## 6. Learning trends

The founding brief's explicit ask — "analytics that show trends, not just scores" — is answered concretely by §2's Class Trend Analytics for teachers and §1's personal Growth view for students. There is no separate "trends" feature beyond these two; this section exists in the founder's original outline as a named concept, and this document's answer is that it's already fully specified above, not a third thing to design.

---

## 7. Risk detection

Fully specified in [13_Anti_Procrastination_Framework.md](13_Anti_Procrastination_Framework.md) §2. This document's only addition: risk detection is reported *per-assignment* today (the Risk Signal) and, once §2's third trend chart ships, *across assignments over time* — the same underlying `riskScore` computation, two different windows onto it.

---

## 8. Performance predictions — a section that pushes back, not just complies

The founding brief asks for "performance predictions." Before specifying what that looks like, it's worth naming the real risk in building it carelessly: **a predictive label shown to a teacher can become a self-fulfilling prophecy.** Educational-data-mining research on this is not ambiguous — a teacher told a student is "predicted to fail" measurably changes how that teacher treats the student, independent of whether the prediction was accurate, and the effect is strongest exactly when the underlying data is thin (a new product, a small number of students, one term of history) — which is precisely Focus Flow's actual starting point per [00_Project_Philosophy.md](00_Project_Philosophy.md).

**Recommendation, not a decision made unilaterally**: do not build an opaque predictive model (a black-box "likely to score X%" number) at this stage. If performance prediction is built at all, it should follow three rules:

1. **Explainable, never opaque** — any prediction must show *why* (e.g., "similar assignments with this pattern of late starts have historically scored lower"), never a bare number with no visible reasoning, so a teacher can judge the prediction rather than defer to it.
2. **One input among many, never authoritative** — shown alongside the Risk Signal and Trend views, never replacing a teacher's own judgment or presented as more certain than the underlying data supports.
3. **Teacher-only, same guardrails as the Risk Signal** — never shown to a student (which would risk exactly the self-fulfilling dynamic described above, aimed at the student instead of the teacher) and never to a Guardian or School Administrator in individual form.

**What this means concretely for now**: the existing 0–3 `riskScore` (transparent, rule-based, fully explainable by construction, since every input to it is named in [13_Anti_Procrastination_Framework.md](13_Anti_Procrastination_Framework.md) §2) already satisfies the *spirit* of "performance prediction" — an early signal of likely outcome — without any of the opacity risk above. **Recommendation: treat the existing Risk Signal as the answer to this requirement for the foreseeable future**, and revisit true predictive modeling only once enough real, multi-term data exists to validate a model's accuracy before ever showing it to a teacher.

---

## 9. Reporting architecture, restated

Every view in this document is a direct query against the operational tables described in [09_Database_Design.md](09_Database_Design.md) — there is no separate analytics warehouse or ETL pipeline, per [08_System_Architecture.md](08_System_Architecture.md), and nothing in this document proposes building one. If query performance ever becomes a real constraint at scale, that is a caching or read-replica decision for [17_Deployment_Architecture.md], not a reason to introduce a parallel data model that could drift from the source of truth.

---

## Open questions carried into engineering

- Mastery analytics is blocked on the Competency data-model decision (§4) — resolve that before scoping any Mastery-analytics feature work.
- School Administrator's exact aggregation boundary (§3) should be reviewed by the founder explicitly before any School Analytics feature is built — "aggregate only" is stated as a hard rule here, but the precise metrics list is a proposal, not a final spec.
- If Performance Predictions are ever pursued, the three rules in §8 should be treated as a prerequisite design review, not a checklist to satisfy after a model already exists.

---

**Next:** [15_Security_Privacy.md] — the full privacy and compliance treatment this analytics layer, and every other sensitive-data surface in this document set, has been assuming throughout.
