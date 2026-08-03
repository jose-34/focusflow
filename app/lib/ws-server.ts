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
import { gameParticipants, gameSessions, quizQuestions, sessions } from '../db/schema'

async function validateSessionToken(token: string): Promise<{ userId: string } | null> {
  const session = await adminDb.query.sessions.findFirst({ where: eq(sessions.token, token) })
  if (!session || session.expiresAt.getTime() < Date.now()) return null
  return { userId: session.userId }
}

type GameState = {
  id: string
  pin: string
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

// The very first "init" message a freshly-connected socket receives (before
// any real game action has triggered broadcastGameState()) used to be a
// generic placeholder with no pin/id — which meant the PIN never actually
// appeared on the host's lobby screen once the WebSocket connected, since
// that placeholder overrides the correct REST-fetched fallback state on the
// client. Fetching the real row here instead means "init" is correct even
// for the very first connection, and for a host/player reconnecting
// mid-game.
async function buildInitialRoomState(sessionId: string): Promise<GameState> {
  const session = await adminDb.query.gameSessions.findFirst({ where: eq(gameSessions.id, sessionId) })
  if (!session) {
    return {
      id: sessionId,
      pin: '',
      status: 'lobby',
      currentQuestionIndex: 0,
      questionDurationSeconds: 20,
      phaseStartedAt: new Date().toISOString(),
      totalQuestions: 0,
      currentQuestion: null,
      answeredCount: 0,
      choiceCounts: {},
      participants: [],
    }
  }

  const questions = await adminDb.query.quizQuestions.findMany({ where: eq(quizQuestions.quizId, session.quizId) })
  const participants = await adminDb.query.gameParticipants.findMany({
    where: eq(gameParticipants.sessionId, sessionId),
    orderBy: (gp, { desc }) => desc(gp.score),
  })

  return {
    id: session.id,
    pin: session.pin,
    status: session.status,
    currentQuestionIndex: session.currentQuestionIndex,
    questionDurationSeconds: session.questionDurationSeconds,
    phaseStartedAt: session.phaseStartedAt.toISOString(),
    totalQuestions: questions.length,
    currentQuestion: null,
    answeredCount: 0,
    choiceCounts: {},
    participants: participants.map((p) => ({ id: p.id, nickname: p.nickname, score: p.score })),
  }
}

type GameRoom = {
  host: WebSocket | null
  players: Map<string, WebSocket>
  state: GameState
}

// In dev, vite.config.ts loads this file via a raw require() (a plain Node
// CJS load, outside Vite's module graph — see getWss() below) to start the
// standalone WS server, while application server functions (useGames.ts)
// import it through Vite's own SSR module transform/cache. Those are two
// separate module instantiations with two separate `rooms` Maps — a
// broadcastGameState() call from a server function was silently hitting an
// empty map belonging to the wrong instance, so no live update ever reached
// an already-connected socket after its first 'init' message (confirmed via
// a live-game Playwright walkthrough: participants joining never appeared
// on the host's screen, and no error was thrown — the miss is silent by
// design in broadcastGameState). Stashing the Map on `globalThis` guarantees
// every instantiation of this module, however it was loaded, shares the one
// real Map. Harmless in production, which only ever has one instance.
const globalForGameRooms = globalThis as unknown as { __focusflowGameRooms?: Map<string, GameRoom> }
const rooms = globalForGameRooms.__focusflowGameRooms ?? new Map<string, GameRoom>()
globalForGameRooms.__focusflowGameRooms = rooms

// The production entry (server/prod.ts) mounts the game socket on the same
// http.Server and port as the main app via attachGameWebSocketServer() — one
// public port, one TLS cert, no extra host-side networking config. Dev keeps
// its own standalone port (see getWss() below) since vite.config.ts's dev
// server is a separate process from this one.
export const GAME_WS_PATH = '/ws/game'

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

function handleGameConnection(ws: WebSocket, req: import('node:http').IncomingMessage) {
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
        state: await buildInitialRoomState(sessionId),
      })
    }

    const room = rooms.get(sessionId)!

    if (role === 'host') {
      room.host = ws
      ws.send(JSON.stringify({ type: 'init', state: room.state }))
    } else if (role === 'player' && participantId) {
      room.players.set(participantId, ws)
      // Players never receive the raw broadcast state — it's host-shaped
      // (participants/choiceCounts, and unconditionally includes each
      // choice's isCorrect) rather than player-shaped (myScore,
      // hasAnsweredCurrent, leaderboard, answer-key hidden until reveal).
      // 'state:changed' just tells the client to refetch through
      // getPlayerStateFn, which already computes the correct per-player,
      // security-correct shape — see submitGameAnswerFn's is_correct
      // handling and getPlayerStateFn's revealAnswers gate.
      ws.send(JSON.stringify({ type: 'state:changed' }))
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
}

// Host and players are deliberately sent different payloads — see the
// 'state:changed' comment above for why players never get the raw
// broadcast state.
export function broadcastGameState(sessionId: string, state: GameState) {
  const room = rooms.get(sessionId)
  if (!room) return
  room.state = state

  const hostPayload = JSON.stringify({ type: 'state:update', state })
  if (room.host && room.host.readyState === 1) {
    room.host.send(hostPayload)
  }

  const playerPayload = JSON.stringify({ type: 'state:changed' })
  for (const player of room.players.values()) {
    if (player.readyState === 1) {
      player.send(playerPayload)
    }
  }
}

let devWss: WebSocketServer | null = null

// Dev-only: a standalone server on its own port, called from vite.config.ts.
// Kept exactly as before — vite's dev server is a separate process, so there
// is no shared http.Server to attach to here.
export function getWss() {
  if (!devWss) {
    devWss = new WebSocketServer({ port: 3001 })

    // listen()'s failure (e.g. EADDRINUSE from a stray leftover dev-server
    // process) fires asynchronously as an 'error' event, after the
    // constructor above has already returned — outside the synchronous
    // try/catch that wraps require('./app/lib/ws-server') in vite.config.ts.
    // Without a listener here, Node treats this as an unhandled 'error'
    // event and crashes the ENTIRE process, taking down Vite itself, not
    // just the optional realtime feature. The app already polls as a
    // fallback whenever the socket never connects (see
    // useHostGameStateRealtime/usePlayerGameStateRealtime), so degrading to
    // a warning instead of a crash is the correct behavior here.
    devWss.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(
          '⚠️  Game WebSocket server: port 3001 is already in use (likely a leftover dev-server process). ' +
            'Live-game updates will fall back to polling. Stop the other process and restart `npm run dev` to restore realtime.',
        )
      } else {
        console.error('Game WebSocket server error:', err)
      }
    })

    devWss.on('connection', handleGameConnection)
  }
  return devWss
}

// Production: mounted on the same http.Server (and therefore the same port
// and TLS cert) as the main app, via the server's 'upgrade' event, filtered
// to GAME_WS_PATH so it never intercepts an unrelated upgrade request.
export function attachGameWebSocketServer(server: import('node:http').Server): WebSocketServer {
  const prodWss = new WebSocketServer({ noServer: true })
  prodWss.on('connection', handleGameConnection)

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')
    if (pathname !== GAME_WS_PATH) {
      socket.destroy()
      return
    }
    prodWss.handleUpgrade(req, socket, head, (ws) => {
      prodWss.emit('connection', ws, req)
    })
  })

  return prodWss
}
