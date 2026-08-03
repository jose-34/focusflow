import { getRequestIP } from '@tanstack/react-start/server'

// A simple in-memory sliding-window limiter — no Redis, since this app runs
// as a single server instance (see ws-server.ts's globalThis-backed rooms
// Map for the same reasoning). Good enough to blunt basic brute-force/abuse
// against the handful of unauthenticated, public-facing endpoints (login,
// register, join-by-code) without adding infrastructure this deployment
// doesn't have. Railway sits behind a proxy, so `xForwardedFor: true` is
// required or every request would appear to come from the same internal IP.
interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Without this, a long-running server would accumulate one bucket entry per
// distinct IP+endpoint forever. Unref'd so it never keeps the process alive.
setInterval(
  () => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt < now) buckets.delete(key)
    }
  },
  5 * 60_000,
).unref()

export function rateLimit(name: string, opts: { max: number; windowMs: number }) {
  const ip = getRequestIP({ xForwardedFor: true }) ?? 'unknown'
  const key = `${name}:${ip}`
  const now = Date.now()

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs })
    return
  }

  bucket.count += 1
  if (bucket.count > opts.max) {
    throw new Error('Too many attempts — please wait a moment and try again.')
  }
}
