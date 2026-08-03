import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { adminDb } from './admin'
import { users } from './schema'

const SALT_ROUNDS = 12

// The only way an admin account is ever created — deliberately not exposed
// on public /register (see app/db/schema/users.ts's comment on
// userRoleEnum). Run with ADMIN_EMAIL/ADMIN_PASSWORD set, e.g.:
//   ADMIN_EMAIL=you@focusflow.co.ke ADMIN_PASSWORD=... npm run db:seed-admin
// Idempotent: re-running with the same email updates that account's role
// to 'admin' and resets its password, rather than erroring or duplicating.
async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables before running this script.')
  }
  if (password.length < 8) {
    throw new Error('ADMIN_PASSWORD must be at least 8 characters.')
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const normalizedEmail = email.trim().toLowerCase()

  const existing = await adminDb.query.users.findFirst({ where: eq(users.email, normalizedEmail) })

  if (existing) {
    await adminDb.update(users).set({ role: 'admin', passwordHash, status: 'active', updatedAt: new Date() }).where(eq(users.id, existing.id))
    console.log(`✅ Existing account ${normalizedEmail} promoted to admin and password reset.`)
  } else {
    await adminDb.insert(users).values({
      email: normalizedEmail,
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    })
    console.log(`✅ Admin account created: ${normalizedEmail}`)
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed to seed admin account:', error)
    process.exit(1)
  })
