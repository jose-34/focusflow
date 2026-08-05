# Demo Login Credentials

Seeded via `npm run db:seed-pilot-demo` (local + production, both currently seeded).
Institution: **Kitengela International Schools — Athi River Campus**.

All pilot accounts (teachers + students) share one password:

```
PilotDemo2026!
```

## Admin

| Environment | Email | Password | Notes |
|---|---|---|---|
| Local dev | `verify-admin@focusflow.test` | `AdminPass123!` | Created this session via `npm run db:seed-admin` for testing. |
| Production | `admin@focusflow.co.ke` | *(already set — not created or known by this session)* | Pre-existing admin account. |

To create/reset an admin account on either environment:
```
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=YourPassword123! npm run db:seed-admin
```

## Teachers

| Name | Email | Classes |
|---|---|---|
| Grace Mwangi | `pilot-grace.mwangi@kitengela.demo` | Grade 7 Mathematics, Grade 8 Mathematics |
| Peter Otieno | `pilot-peter.otieno@kitengela.demo` | Grade 7 Pre-Technical Studies, Grade 8 Pre-Technical Studies |

## Students — Grade 7

| Name | Email |
|---|---|
| Amani Wanjiru | `pilot-amani.wanjiru@kitengela.demo` |
| Brian Otieno | `pilot-brian.otieno@kitengela.demo` |
| Cynthia Achieng | `pilot-cynthia.achieng@kitengela.demo` |
| Dennis Kiptoo | `pilot-dennis.kiptoo@kitengela.demo` |
| Esther Nyambura | `pilot-esther.nyambura@kitengela.demo` |
| Felix Mutua | `pilot-felix.mutua@kitengela.demo` |
| Grace Chebet | `pilot-grace.chebet@kitengela.demo` |

## Students — Grade 8

| Name | Email |
|---|---|
| Hassan Mohamed | `pilot-hassan.mohamed@kitengela.demo` |
| Irene Wambui | `pilot-irene.wambui@kitengela.demo` |
| James Kamau | `pilot-james.kamau@kitengela.demo` |
| Kevin Odhiambo | `pilot-kevin.odhiambo@kitengela.demo` |
| Linet Auma | `pilot-linet.auma@kitengela.demo` |
| Moses Kariuki | `pilot-moses.kariuki@kitengela.demo` |
| Naomi Cherono | `pilot-naomi.cherono@kitengela.demo` |
| Oscar Njoroge | `pilot-oscar.njoroge@kitengela.demo` |

## Good demo picks

- **Amani Wanjiru** and **Brian Otieno** were seeded with a near-continuous 14-day
  streak (the "star" students) — best accounts to show off streak/roadmap progress.
- **Grace Mwangi** (teacher) owns both Mathematics classes, including the
  "Fractions Mastery Assessment" with real submitted scores from all Grade 8
  students — good for showing teacher-side results.

## Re-seeding

Re-running `npm run db:seed-pilot-demo` is safe — it deletes all `pilot-*@kitengela.demo`
accounts and the Kitengela institution first, then recreates everything fresh
with newly randomized (but realistic) session/task/attempt history. Student
and teacher emails stay identical across runs; only the generated activity
history changes.
