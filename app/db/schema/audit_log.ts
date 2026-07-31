import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

// Sprint 0 (docs/15_Security_Privacy.md §4): the prerequisite Platform
// Administrator's whole "audited exception" access model depends on. No app
// role has a select policy on this table today — not even the actor who
// wrote a row can read it back — since no Platform Administrator role exists
// yet to consume it (see docs/18_Product_Roadmap.md, Version 2.1). Writing is
// only ever done via adminDb, through logAuditEvent() (app/db/audit.ts).
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    // Nullable + set null on delete, deliberately not 'restrict': an audit
    // record must outlive the actor's account (e.g. after a right-to-erasure
    // request, docs/15_Security_Privacy.md), not block that account's
    // deletion or disappear with it.
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetTable: text('target_table').notNull(),
    targetId: uuid('target_id'),
    // Required, not optional — an audited exception with no stated reason
    // isn't audited, it's just logged. See docs/15_Security_Privacy.md §4.
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('audit_log_actor_user_id_idx').on(table.actorUserId),
    index('audit_log_target_table_target_id_idx').on(table.targetTable, table.targetId),
    index('audit_log_created_at_idx').on(table.createdAt),
    // Real policy body lives in app/db/apply-rls.ts (see that file for why).
    // Deliberately no policy at all yet — default-deny for every app role,
    // including the actor, until Platform Administrator exists to read it.
  ],
).enableRLS()

export type AuditLogEntry = typeof auditLog.$inferSelect
export type NewAuditLogEntry = typeof auditLog.$inferInsert
