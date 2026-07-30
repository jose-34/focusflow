import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { adminDb } from '@/db/admin'
import { sessions, users, type Session, type User } from '@/db/schema'

const SALT_ROUNDS = 12
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export type SanitizedUser = Omit<User, 'passwordHash'>

export interface RegisterInput {
  email: string
  password: string
  firstName: string
  lastName: string
  role: 'student' | 'teacher'
  gradeLevel?: number
}

/**
 * Deliberately uses `adminDb` (bypasses RLS), not `withRlsContext`. Login,
 * registration, and session validation are the operations that ESTABLISH a
 * user's identity in the first place — they inherently need to look up a
 * user by email or a session by token before any `app.user_id` context can
 * exist to scope a query by. Every other feature (tasks, focus sessions,
 * wellness, achievements) must use `db` + `withRlsContext` from `app/db`
 * once a user is already authenticated.
 */
class AuthService {
  sanitizeUser(user: User): SanitizedUser {
    const { passwordHash: _passwordHash, ...sanitized } = user
    return sanitized
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS)
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  async register(input: RegisterInput): Promise<{ user: SanitizedUser; session: Session }> {
    const normalizedEmail = input.email.trim().toLowerCase()

    const existing = await adminDb.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    })
    if (existing) {
      throw new Error('Email already in use')
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS)

    const [user] = await adminDb
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        role: input.role,
        gradeLevel: input.role === 'student' ? input.gradeLevel : null,
        status: 'active',
      })
      .returning()

    const session = await this.createSession(user.id)
    return { user: this.sanitizeUser(user), session }
  }

  async login(email: string, password: string): Promise<{ user: SanitizedUser; session: Session }> {
    const normalizedEmail = email.trim().toLowerCase()

    const user = await adminDb.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    })
    if (!user) {
      throw new Error('Invalid credentials')
    }

    if (user.status !== 'active') {
      throw new Error('Invalid credentials')
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash)
    if (!isValidPassword) {
      throw new Error('Invalid credentials')
    }

    const [updated] = await adminDb
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning()

    const session = await this.createSession(updated.id)
    return { user: this.sanitizeUser(updated), session }
  }

  async createSession(userId: string): Promise<Session> {
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

    const [session] = await adminDb.insert(sessions).values({ userId, token, expiresAt }).returning()
    return session
  }

  async validateSession(token: string): Promise<{ session: Session; user: SanitizedUser } | null> {
    if (!token) return null

    const session = await adminDb.query.sessions.findFirst({
      where: eq(sessions.token, token),
    })
    if (!session) return null

    if (session.expiresAt.getTime() < Date.now()) {
      await adminDb.delete(sessions).where(eq(sessions.id, session.id))
      return null
    }

    const user = await adminDb.query.users.findFirst({
      where: eq(users.id, session.userId),
    })
    if (!user) return null

    return { session, user: this.sanitizeUser(user) }
  }

  async logout(token: string): Promise<void> {
    if (!token) return
    await adminDb.delete(sessions).where(eq(sessions.token, token))
  }
}

export const authService = new AuthService()
