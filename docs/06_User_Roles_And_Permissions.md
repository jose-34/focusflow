# Focus Flow: User Roles & Permissions

*Every role, against every object named in [03_Product_Glossary.md](03_Product_Glossary.md), for every one of six actions: View, Create, Update, Delete, Share, Moderate. Nothing here is left ambiguous — where something is genuinely undecided, it is marked as an open question, not silently assumed.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md). Legend: **✅** allowed · **—** never allowed · **🔶** allowed only under a stated condition (the condition is the point — read it, don't skip it).

Five roles exist or are planned. Two are Built (**Student**, **Teacher**); three are Planned and introduced here for the first time as fully-specified roles, resolving an ambiguity in the original brief that named both "Administrator" and "School Administrator" — these are treated as two genuinely different roles, not a duplicate:

- **Guardian** — a parent/guardian, scoped to read-only trends for the students who invited them ([A3](04_Product_Requirements_Document.md#a3-guardian-invitation--access)).
- **School Administrator** — a school-level role (e.g. a deputy principal) seeing school-wide *aggregate* adoption and engagement data, never individual student behavioral detail.
- **Platform Administrator** — Focus Flow's own internal support/moderation role, deliberately given the *least* routine access to individual student data of any role in this document, including less than a School Administrator.

---

## Student

| Object | View | Create | Update | Delete | Share | Moderate |
|---|---|---|---|---|---|---|
| Own account/profile | ✅ | ✅ (register) | ✅ | — | — | — |
| Curriculum & Subject | ✅ (read-only) | — | — | — | — | — |
| Class | 🔶 (enrolled only) | — | — | — | — | — |
| Enrollment | 🔶 (own) | ✅ (join via code) | — | — *(no self-unenroll built — open question)* | — | — |
| Personal Task | 🔶 (own) | ✅ | ✅ (own) | ✅ (own) | — | — |
| Practice Task | 🔶 (assigned to them) | — | 🔶 (toggle complete only, not content) | — | — | — |
| Quiz | 🔶 (published, in own class; or draft, via Live Game participation) | — | — | — | — | — |
| Quiz Attempt | 🔶 (own) | ✅ (start/submit) | — (immutable post-submit) | — | 🔶 (planned, via Challenge) | — |
| Resource | 🔶 (shared to own class) | — | — | — | — | — |
| Focus Session | 🔶 (own) | ✅ (start) | ✅ (complete/abandon, own) | — | — | — |
| Distraction Event | 🔶 (real-time toast only — no historical list view built) | (system-logged) | — | — | — | — |
| Commitment | 🔶 (own) | ✅ (own, planned) | — (locked once session starts) | — | — | — |
| Risk Signal | — *(never shown to the student directly, by design)* | — | — | — | — | — |
| Wellness Check-in | 🔶 (own) | ✅ | — *(immutable once logged)* | — | — | — |
| XP | 🔶 (own total) | (system-awarded) | — | — | — | — |
| Mastery Path | 🔶 (own) | — | — | — | — | — |
| Achievement/Badge | 🔶 (own) | (system-awarded) | — | — | — | — |
| Streak | 🔶 (own) | (system-computed) | — | — | — | — |
| Mission | 🔶 (own) | — (system/teacher-generated) | 🔶 (indirectly, by completing underlying work) | — | — | — |
| Challenge | 🔶 (sent/received) | ✅ (initiate, planned) | — | 🔶 (cancel an open, unaccepted one — planned) | ✅ (planned — inviting a classmate is the mechanic) | — |
| Public Quiz Bank | — *(teacher-only; students never browse the raw bank, by design)* | — | — | — | — | — |
| Live Game Session | 🔶 (as participant) | — (join only, not host) | — | — | — | — |
| Guardian–Student Link | ✅ (own) | ✅ (invite a guardian) | — | ✅ (revoke access) | — | — |
| Another student's roster entry | — | — | — | — | — | — |

---

## Teacher

| Object | View | Create | Update | Delete | Share | Moderate |
|---|---|---|---|---|---|---|
| Own account/profile | ✅ | ✅ (register) | ✅ | — | — | — |
| Curriculum & Subject | ✅ (read-only) | — | — | — | — | — |
| Class | 🔶 (own only) | ✅ | 🔶 (own only) | 🔶 (own only — RLS supports it; no delete action in the UI yet) | ✅ (Class Code) | — |
| Enrollment | 🔶 (own classes' rosters) | — (students self-join) | — | — *(no remove-student action built — open question)* | — | — |
| Personal Task | — *(never sees a student's)* / 🔶 own | ✅ (own) | ✅ (own) | ✅ (own) | — | — |
| Practice Task | 🔶 (own-created + aggregate completion count) | ✅ (planned) | ✅ (own) | ✅ (own) | — | — |
| Quiz | 🔶 (own classes, draft + published) | ✅ | ✅ (own) | ✅ (own) | 🔶 (publish to Public Quiz Bank, planned) | — |
| Quiz Attempt | 🔶 (results, own classes' students only) | — | — (server-graded, immutable) | — | — | — |
| Resource | 🔶 (own) | ✅ (planned) | ✅ (own) | ✅ (own) | ✅ (the point of it) | — |
| Focus Session | — *(never raw; only aggregated into Risk Signal)* / 🔶 own | ✅ (own) | ✅ (own) | — | — | — |
| Distraction Event | — *(never, even aggregated View is Risk Signal, not this object)* | — | — | — | — | — |
| Commitment | — *(student's own, private)* / 🔶 own | ✅ (own, planned) | — | — | — | — |
| Risk Signal | 🔶 (own classes' students only) | (system-computed) | — | — | — *(private by design — never a public ranking)* | — |
| Wellness Check-in | — *(never, in raw form, by design)* / 🔶 own | ✅ (own) | — | — | — | — |
| XP | — *(student's own XP total is not teacher-visible today)* / 🔶 own | — | — | — | — | — |
| Mastery Path | 🔶 *(planned; scope not yet decided — open question, see below)* | — | — | — | — | — |
| Achievement/Badge | — *(not currently teacher-visible)* / 🔶 own | (system-awarded) | — | — | — | — |
| Streak | — *(not currently teacher-visible per-student)* / 🔶 own | (system-computed) | — | — | — | — |
| Mission | 🔶 (own-assigned) | ✅ (manual, planned) | ✅ (own-assigned) | ✅ (own-assigned) | — | — |
| Challenge | — *(student-to-student; no teacher role, planned)* | — | — | — | — | — |
| Public Quiz Bank | ✅ (browse, planned) | ✅ (publish own quiz, planned) | ✅ (own listing) | ✅ (own listing) | ✅ (copy into own class) | — *(reserved for Platform Administrator — see risk below)* |
| Live Game Session | ✅ (as host) | ✅ (host one) | ✅ (advance phases) | — (no end-early action built) | ✅ (share the PIN) | 🔶 (own session only — e.g. removing a participant, if built) |
| Guardian–Student Link | — *(managed entirely between student and guardian)* | — | — | — | — | — |
| A student's roster entry | 🔶 (own classes only — name/email) | — | — | — | — | — |

---

## Guardian *(Planned)*

Deliberately the most restricted role in this document apart from an unauthenticated visitor — this is a design choice, not an oversight, per [A3](04_Product_Requirements_Document.md#a3-guardian-invitation--access) and [00_Project_Philosophy.md](00_Project_Philosophy.md)'s stance on a child's data.

| Object | View | Create | Update | Delete | Share | Moderate |
|---|---|---|---|---|---|---|
| Own account/profile | ✅ | ✅ | ✅ | — | — | — |
| Linked student's weekly effort/mood *trend* | ✅ | — | — | — | — | — |
| Guardian–Student Link | ✅ (own) | — *(student initiates, never the guardian)* | — | 🔶 *(self-revoke — logical, not yet decided; open question)* | — | — |
| **Everything else** — grades, quiz content, individual scores, raw focus-session timestamps, individual Distraction Events, Task/Quiz/Practice Task detail, wellness journal notes, XP, Achievements, Streak, any other student's data | — | — | — | — | — | — |

---

## School Administrator *(Planned)*

Scoped to school-wide **aggregate** visibility only — never a named individual student's behavioral or wellness detail, which stays between that student and their own teacher (and, per above, an invited Guardian's trend view).

| Object | View | Create | Update | Delete | Share | Moderate |
|---|---|---|---|---|---|---|
| Own account/profile | ✅ | ✅ | ✅ | — | — | — |
| Classes at their school (aggregate: count, enrollment size, curriculum mix) | 🔶 (aggregate only, not roster/content) | — | — | — | — | — |
| Teacher accounts at their school (adoption: active/inactive, last login) | 🔶 (planned) | — *(teachers self-register; open question: should a School Administrator ever provision accounts?)* | — | — | — | — |
| School-wide Risk Signal trend (anonymized, aggregated) | 🔶 (aggregate, never per-student) | — | — | — | — | — |
| Public Quiz Bank | 🔶 (browse, same scope as Teacher) | — | — | — | — | — |
| **Any individual student's** Task, Quiz Attempt, Focus Session, Distraction Event, Commitment, Wellness Check-in, XP, Achievement, Streak | — *(never — this is the binding privacy line for this role)* | — | — | — | — | — |

---

## Platform Administrator *(Planned, internal)*

Focus Flow's own support/operations role. Deliberately **not** a "god mode" — access to individual student data is the exception requiring an audited process, never the default, which is the concrete demonstration of Principle 6 (Student Wellbeing / data-as-responsibility) rather than just an assertion of it.

| Object | View | Create | Update | Delete | Share | Moderate |
|---|---|---|---|---|---|---|
| Public Quiz Bank (all listings) | ✅ | — | — | 🔶 (remove a listing for policy violation) | — | ✅ *(the one role with real moderation power — resolves the "public-bank content quality is inconsistently vetted" risk named in [01_Product_Vision.md](01_Product_Vision.md))* |
| Any user account (support context) | 🔶 (only via an audited, logged support exception — never ambient/routine) | — | 🔶 (support actions: password reset, role correction) | 🔶 (account deletion / right-to-erasure requests) | — | — |
| Any individual student's behavioral or wellness data (Focus Session, Distraction Event, Wellness Check-in, Commitment) | 🔶 *(only under an audited exception tied to a specific support ticket — the exact mechanism is out of scope here; see [15_Security_Privacy.md])* | — | — | — | — | — |
| A teacher's Class/Quiz/Task content | 🔶 (only as needed for a specific, logged support ticket) | — | — | — | — | — |

---

## Principles applied throughout this matrix

- **Ownership is the default access boundary.** A role can act on its own data almost without restriction; every cross-boundary access (a teacher's class roster, a guardian's trend view, an administrator's support exception) is the exception, and is marked 🔶 with the exact condition stated, never left as a bare ✅.
- **Moderate is reserved, not generic.** Only the Public Quiz Bank and the Platform Administrator role carry real moderation power in this version of the product — no role "moderates" a student directly; that would contradict the anti-surveillance stance in [00_Project_Philosophy.md](00_Project_Philosophy.md).
- **No role sees another student's individual behavioral or wellness data, ever, without an audited exception** — this line holds even for School Administrator and Platform Administrator, the two most privileged planned roles, not just for Teacher and Guardian.
- **A dash (—) is a real answer, not a placeholder.** Where this document says a role cannot do something, that is binding until a future document explicitly revises it — it is not an oversight to quietly fill in later.

## Open questions carried into engineering

- Should a student be able to leave/un-enroll from a class themselves, or is this teacher-initiated only?
- Should a teacher be able to remove a student from their class roster?
- Should a teacher eventually see aggregate or individual Mastery Path data, given CBC/CBE's own competency-reporting requirements named in [02_Product_Definition.md](02_Product_Definition.md) — and if so, at what aggregation level?
- Should a Guardian be able to self-revoke their own access, independent of the student revoking it?
- Should a School Administrator ever be able to provision teacher accounts for their school, or does every teacher always self-register?

---

**Next:** [07_User_Journeys.md] — the same roles, walked step by step through their real workflows, from first login to the specific outcome each one cares about.
