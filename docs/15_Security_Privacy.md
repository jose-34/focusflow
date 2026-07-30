# Focus Flow: Security & Privacy

*Consolidates and extends the security and privacy commitments already made throughout this document set — [09_Database_Design.md](09_Database_Design.md)'s RLS model, [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md)'s access matrix, [00_Project_Philosophy.md](00_Project_Philosophy.md)'s stance on children's data — into one place, and adds what none of them covered: audit logging, retention, backups, and compliance. Legal/compliance sections here are analysis to bring to actual counsel, not a substitute for it — this document flags where legal review is needed, it does not conclude compliance.*

Governed by [-01_Focus_Flow_Principles.md](-01_Focus_Flow_Principles.md), specifically Principle 6.

---

## 1. Authentication

**Built**, per [08_System_Architecture.md](08_System_Architecture.md)/[10_API_Architecture.md](10_API_Architecture.md): `bcryptjs` password hashing; a first-party session mechanism (`session_token` cookie — `httpOnly`, `secure`, `sameSite: lax`, 7-day expiry) validated against a `sessions` table on every request; no third-party auth provider.

**Real, named gaps**: no multi-factor authentication; no SSO/OAuth (notably no "Sign in with Google" — a real disadvantage against Google Classroom's trusted-IT-admin story named in [01_Product_Vision.md](01_Product_Vision.md), and a real future need if a school wants Google Workspace integration); no passwordless option. None of these block launch, but none should be assumed "eventually free" additions — each is a real scope item for a future phase.

---

## 2. Authorization

**Built and the real enforcement boundary** — Postgres Row-Level Security, not application-layer checks, as established throughout [09_Database_Design.md](09_Database_Design.md). Not re-derived here; the two load-bearing patterns (SECURITY DEFINER for cross-table checks, never self-referencing a table's own SELECT policy under `INSERT ... RETURNING`) are permanent rules for any new table, cross-referenced rather than restated.

**Why this document trusts that model**: this session's own work is the case study. Writing [09_Database_Design.md](09_Database_Design.md) surfaced two real, live authorization bugs (a completely-disabled-RLS table leaking data cross-user, and a silently-dropped policy body) that had existed undetected until documentation-driven verification found them empirically. The lesson carried forward, not just noted: **a policy existing in a schema file is not evidence it's enforced** — the only trustworthy verification is testing the actual live behavior, exactly as [09_Database_Design.md](09_Database_Design.md) did. Any future schema change should be verified the same way, not assumed correct because the code looks right.

---

## 3. Encryption

| Layer | Status |
|---|---|
| Passwords | **Built** — `bcryptjs`, one-way hash, never stored or logged in plaintext |
| Data in transit (HTTPS/WSS) | **Depends on deployment** — the session cookie's `secure: true` flag assumes HTTPS is enforced, but TLS termination is a hosting-layer concern with no configuration visible in this codebase; a real dependency on [17_Deployment_Architecture.md](17_Deployment_Architecture.md), not yet resolved |
| Data at rest (database-level encryption) | **Depends on deployment** — whatever Postgres hosting is chosen; not something this application layer configures or verifies today |

Neither "depends on deployment" row should be read as "handled" — both are open dependencies, named here so they're not silently assumed solved by the time [17_Deployment_Architecture.md](17_Deployment_Architecture.md) is written.

---

## 4. Audit logs — a real, significant gap this document surfaces for the first time

**None exist.** No table logs who accessed what, when, or why — not for ordinary application use, and not for the one role whose entire design in [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md) explicitly depends on logging existing: **Platform Administrator's access to individual student data was specified as permissible "only via an audited, logged support exception" — and no audit-logging mechanism exists anywhere in this schema to make that true.** That role's entire privacy justification is currently a promise with nothing behind it.

**This needs to be built before Platform Administrator is a real role, not after.** A minimal version: an `audit_log` table (actor user ID, action, target resource, timestamp, and — critically — a required reason/ticket-reference field for any cross-user access) written to automatically whenever an `adminDb`-bypassing query touches another user's sensitive data. This is scoped here as a concrete prerequisite, not a nice-to-have hardening pass.

---

## 5. Data retention

**No retention policy exists today** — no scheduled deletion, no TTL beyond a session's own `expires_at`. Proposed, for founder review rather than asserted as decided:

| Data | Proposed retention |
|---|---|
| Expired sessions | Deleted on a rolling basis (they're already functionally dead once expired) |
| Wellness logs, distraction events | Retained for the active school year, then archived or deleted — this is exactly the kind of sensitive, behavioral data that shouldn't accumulate indefinitely with no purpose |
| Account data after deletion request | Deleted per the right-to-erasure capability already named for Platform Administrator in [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md) — cascading deletes already make this mechanically real (per [09_Database_Design.md](09_Database_Design.md)'s cascade rules), but *when* a deletion is triggered (student request? account inactivity? a fixed post-graduation period?) is not yet decided |

---

## 6. Privacy

The "who sees what" rules are already fully specified in [06_User_Roles_And_Permissions.md](06_User_Roles_And_Permissions.md), [13_Anti_Procrastination_Framework.md](13_Anti_Procrastination_Framework.md) §12, and [14_Analytics_And_Reporting.md](14_Analytics_And_Reporting.md) §3 — not repeated here. What this section adds is the underlying *principle set* those rules already implement, named explicitly so future decisions can be checked against them directly rather than against scattered precedent:

- **Data minimization** — collect only what a named feature actually uses (this is why, for example, the Guardian role gets trends, never raw logs: the trend is the minimum needed for its actual purpose).
- **Purpose limitation** — behavioral/wellness data collected to help a student is never repurposed for a different goal (e.g., never fed into a "engagement" growth metric for the business itself, per [00_Project_Philosophy.md](00_Project_Philosophy.md)'s explicit commitment).
- **Storage limitation** — see §5.
- **Integrity & confidentiality** — the RLS model (§2).
- **Accountability** — the audit-log gap (§4) is precisely where this principle is currently unmet.

---

## 7. Compliance — flagged for legal review, not resolved here

**This section is analysis to bring to actual legal counsel. Nothing here should be treated as a compliance conclusion.**

- **Kenya's Data Protection Act (2019)** is the primary, directly-applicable law given Focus Flow's real, current user base. Whether formal registration with the Office of the Data Protection Commissioner is required depends on processing volume/type thresholds this document does not attempt to resolve — a question for counsel, not for this document.
- **A specific, real, and currently-unaddressed question**: Focus Flow's registration flow ([A1](04_Product_Requirements_Document.md#a1-role-guided-registration)) lets a student self-register with only their own email — there is no parental/guardian consent step anywhere in the flow. Depending on the applicable age thresholds and whether an education-context legal basis applies (many jurisdictions allow a school to provide consent on a student's behalf for legitimate educational purposes, similar in spirit to COPPA's "school official exception" in the US) versus requiring individual parental consent per student, this may or may not be a real gap — **this is exactly the kind of question that needs a real answer from counsel before wider rollout, not an assumption either way from this document.**
- **Future-market considerations**, restated from [01_Product_Vision.md](01_Product_Vision.md) rather than re-analyzed: COPPA and FERPA if a US school market is ever entered; GDPR and the UK Age Appropriate Design Code if a UK/EU market is ever entered. None apply to Focus Flow's actual, current operation — named here only so they aren't discovered for the first time mid-expansion.

---

## 8. Backups

**None documented; a real dependency on [17_Deployment_Architecture.md](17_Deployment_Architecture.md)**, not resolved here. Whatever managed Postgres hosting is eventually chosen should have automated backups as a baseline requirement, not an afterthought — named as a hard requirement for that document to satisfy, not a suggestion.

## 9. Recovery

Same status as Backups — no disaster-recovery plan exists. A real prerequisite for treating this product as production-grade for a real school's data, not yet addressed.

---

## 10. Security incident response — a light process, not yet formal

This session's own experience is the concrete argument for having one: two real vulnerabilities were found and fixed during ordinary documentation work, verified empirically, and disclosed plainly rather than quietly patched. **Recommendation**: formalize this instinct into a lightweight, written process — when a real vulnerability is found (by anyone, at any time), it gets (1) verified empirically before any fix is trusted, (2) fixed with the smallest correct change, (3) disclosed plainly to whoever owns the product, not minimized or buried, and (4) the fix itself gets re-verified the same way the original bug was found. This is exactly what happened in [09_Database_Design.md](09_Database_Design.md)'s findings — worth writing down as the standing process rather than relying on it happening again by habit.

---

## Open questions carried into engineering

- Build the audit-log mechanism (§4) — a genuine prerequisite for Platform Administrator being a real, trustworthy role, not a later hardening pass.
- Decide the data retention policy (§5) — proposed above, not yet approved.
- Get real legal review on the parental-consent question (§7) before any wider rollout beyond the current pilot context.
- Confirm encryption-in-transit/at-rest as concrete requirements when [17_Deployment_Architecture.md](17_Deployment_Architecture.md) is written — not assumed handled by this document.
- Decide backup/recovery requirements as a hosting-selection criterion, not an afterthought once a host is already chosen.

---

**Next:** [16_Testing_Strategy.md] — how every rule, constraint, and guardrail across this entire document set actually gets verified before it's trusted, including the accessibility and reduced-motion gaps named in [11_UI_UX_Design_System.md](11_UI_UX_Design_System.md).
