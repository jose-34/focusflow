import { adminDb } from './admin'
import { auditLog } from './schema'

/**
 * The only writer for `audit_log`. Always goes through `adminDb` — no app
 * role has an insert policy, since `audit_log` has no RLS policy at all yet
 * (default-deny). Call this from any future code path that uses `adminDb`
 * to access another user's sensitive data outside their own RLS scope (see
 * docs/15_Security_Privacy.md §4) — a required, specific `reason` is the
 * whole point, not an optional detail.
 */
export async function logAuditEvent(entry: {
  actorUserId: string | null
  action: string
  targetTable: string
  targetId?: string | null
  reason: string
}) {
  await adminDb.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    targetTable: entry.targetTable,
    targetId: entry.targetId ?? null,
    reason: entry.reason,
  })
}
