import { and, eq } from 'drizzle-orm'
import { WebSocketServer, WebSocket } from 'ws'
// Relative imports only: this module is loaded directly by vite.config.ts via
// require() during config load, outside Vite's own bundling/alias-resolution
// pipeline — the "@/" path alias (resolved by vite-tsconfig-paths for the
// app's normal module graph) does not apply here. For the same reason this
// inlines a minimal session lookup instead of importing the shared
// auth.service.ts, which itself uses "@/" imports for its normal (aliased)
// consumers elsewhere in the app.
import { withRlsContext } from '../db'
import { adminDb } from '../db/admin'
import { gameParticipants, gameSessions, sessions } from '../db/schema'

async function validateSessionToken(token: string): Promise<{ userId: string } | null> {
  const session = await adminDb.query.sessions.findFirst({ where: eq(sessions.token, token) })
  if (!session || session.expiresAt.getTime() < Date.now()) return null
  return { userId: session.userId }
}

type GameState = {
  status: 'lobby' | 'question' | 'reveal' | 'finished'
  currentQuestionIndex: number
  questionDurationSeconds: number
  phaseStartedAt: string
  totalQuestions: number
  currentQuestion: { id: string; questionText: string; choices: Array<{ id: string; choiceText: string; isCorrect: boolean }> } | null
  answeredCount: number
  choiceCounts: Record<string, number>
  participants: Array<{ id: string; nickname: string; score: number }>
}

type GameRoom = {
  host: WebSocket | null
  players: Map<string, WebSocket>
  state: GameState
}

const rooms = new Map<string, GameRoom>()
const wss = new WebSocketServer({ port: 3001 })

// listen()'s failure (e.g. EADDRINUSE from a stray leftover dev-server
// process) fires asynchronously as an 'error' event, after the constructor
// above has already returned — outside the synchronous try/catch that wraps
// require('./app/lib/ws-server') in vite.config.ts. Without a listener here,
// Node treats this as an unhandled 'error' event and crashes the ENTIRE
// process, taking down Vite itself, not just the optional realtime feature.
// The app already polls as a fallback whenever the socket never connects
// (see useHostGameStateRealtime/usePlayerGameStateRealtime), so degrading to
// a warning instead of a crash is the correct behavior here.
wss.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(
      '⚠️  Game WebSocket server: port 3001 is already in use (likely a leftover dev-server process). ' +
        'Live-game updates will fall back to polling. Stop the other process and restart `npm run dev` to restore realtime.',
    )
  } else {
    console.error('Game WebSocket server error:', err)
  }
})

function parseCookie(header: string | undefined, name: string): string | null {
  if (!header) return null
  const match = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}

// Every connection is authenticated (real session cookie) and authorized
// against the SAME RLS rules the rest of the app trusts — host must actually
// own the session, player must actually own the claimed participant row.
// Without this, anyone who observes a sessionId (trivially visible in any
// real participant's own browser URL) could connect as role=host and receive
// the answer key (is_correct) broadcast live, before the reveal phase —
// bypassing the is_correct-hiding invariant enforced everywhere else in the
// app at the RLS/application layer.
async function authorizeConnection(
  req: import('node:http').IncomingMessage,
  sessionId: string,
  role: 'host' | 'player',
  participantId: string | null,
): Promise<boolean> {
  const token = parseCookie(req.headers.cookie, 'session_token')
  if (!token) return false
  const validated = await validateSessionToken(token)
  if (!validated) return false
  const { userId } = validated

  return withRlsContext(userId, async (tx) => {
    const session = await tx.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) })
    if (!session) return false
    if (role === 'host') {
      return session.hostId === userId
    }
    if (!participantId) return false
    const participant = await tx.query.gameParticipants.findFirst({
      where: and(eq(gameParticipants.id, participantId), eq(gameParticipants.sessionId, sessionId), eq(gameParticipants.studentId, userId)),
    })
    return !!participant
  })
}

wss.on('connection', (ws, req) => {
  void (async () => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const sessionId = url.searchParams.get('sessionId')
    const role = url.searchParams.get('role') as 'host' | 'player' | null
    const participantId = url.searchParams.get('participantId')

    if (!sessionId || !role || (role !== 'host' && role !== 'player')) {
      ws.close(1008, 'Missing sessionId or role')
      return
    }

    const authorized = await authorizeConnection(req, sessionId, role, participantId).catch(() => false)
    if (!authorized) {
      ws.close(1008, 'Not authorized for this game session')
      return
    }

    if (!rooms.has(sessionId)) {
      rooms.set(sessionId, {
        host: null,
        players: new Map(),
        state: {
          status: 'lobby',
          currentQuestionIndex: 0,
          questionDurationSeconds: 20,
          phaseStartedAt: new Date().toISOString(),
          totalQuestions: 0,
          currentQuestion: null,
          answeredCount: 0,
          choiceCounts: {},
          participants: [],
        },
      })
    }

    const room = rooms.get(sessionId)!

    if (role === 'host') {
      room.host = ws
      ws.send(JSON.stringify({ type: 'init', state: room.state }))
    } else if (role === 'player' && participantId) {
      room.players.set(participantId, ws)
      ws.send(JSON.stringify({ type: 'init', state: room.state }))
    }

    // State is only ever pushed via broadcastGameState(), called from the
    // trusted server-side game-action handlers (startGameFn/advancePhaseFn/
    // submitGameAnswerFn) after a real, authorized DB mutation. Clients are
    // deliberately read-only on this socket — no message handler accepts
    // client-sent state, since that would let any connected socket broadcast
    // arbitrary game state (including the answer key) to the whole room.

    ws.on('close', () => {
      if (role === 'host') {
        room.host = null
      } else if (role === 'player' && participantId) {
        room.players.delete(participantId)
      }
      if (!room.host && room.players.size === 0) {
        rooms.delete(sessionId)
      }
    })
  })().catch(() => {
    ws.close(1011, 'Internal error')
  })
})

function broadcast(sessionId: string, message: unknown, exclude?: WebSocket) {
  const room = rooms.get(sessionId)
  if (!room) return
  const payload = JSON.stringify(message)
  if (room.host && room.host !== exclude && room.host.readyState === 1) {
    room.host.send(payload)
  }
  for (const player of room.players.values()) {
    if (player !== exclude && player.readyState === 1) {
      player.send(payload)
    }
  }
}

export function broadcastGameState(sessionId: string, state: GameState) {
  const room = rooms.get(sessionId)
  if (!room) return
  room.state = state
  broadcast(sessionId, { type: 'state:update', state })
}

export function getWss() {
  return wss
}
