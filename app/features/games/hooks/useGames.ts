import { createServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { eq, sql } from 'drizzle-orm'
import { useState, useRef, useEffect } from 'react'
import { withRlsContext } from '@/db'
import { adminDb } from '@/db/admin'
import { gameAnswers, gameParticipants, gameSessions } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'
import { createGameSessionSchema, joinGameSchema, sessionIdSchema, submitGameAnswerSchema } from '@/features/auth/validators'
import { broadcastGameState } from '@/lib/ws-server'
import { rateLimit } from '@/lib/rateLimit'

const MAX_POINTS = 1000
const MIN_POINTS = 100

function generatePin(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

// Dev's standalone WS server listens on its own port (3001, see
// app/lib/ws-server.ts's getWss()) because vite's dev server is a separate
// process. In production the game socket is mounted on the SAME http.Server
// and port as the main app (see server/prod.ts's attachGameWebSocketServer),
// so the client must connect same-origin, path-based, with no explicit port.
function buildGameWsUrl(params: Record<string, string>): string {
  const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const search = new URLSearchParams(params).toString()
  if (import.meta.env.DEV) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
    return `${wsProtocol}//${host}:3001?${search}`
  }
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost'
  return `${wsProtocol}//${host}/ws/game?${search}`
}

export const createGameSessionFn = createServerFn({ method: 'POST' })
  .validator(createGameSessionSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'teacher') {
      throw new Error('Only teachers can host a live game')
    }

    return withRlsContext(user.id, async (tx) => {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const [session] = await tx
            .insert(gameSessions)
            .values({
              quizId: data.quizId,
              hostId: user.id,
              pin: generatePin(),
              questionDurationSeconds: data.questionDurationSeconds,
            })
            .returning()
          return session
        } catch (error) {
          const isUniqueViolation = error instanceof Error && 'code' in error && (error as { code?: string }).code === '23505'
          if (!isUniqueViolation || attempt === 4) throw error
        }
      }
      throw new Error('Could not generate a unique game PIN — please try again')
    })
  })

export const joinGameFn = createServerFn({ method: 'POST' })
  .validator(joinGameSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    if (user.role !== 'student') {
      throw new Error('Only students can join a game')
    }
    // Same reasoning as joinClassFn: a 6-digit PIN is brute-forceable
    // without a cap on guess rate.
    rateLimit('join-game', { max: 15, windowMs: 60_000 })

    const normalizedPin = data.pin.trim()

    // Looking a session up by PIN is a discovery operation, same as looking a
    // class up by join code: the student has no participant row yet, so RLS
    // (which only grants visibility to the host or an existing participant)
    // would never let them find the row to join in the first place.
    const targetSession = await adminDb.query.gameSessions.findFirst({
      where: (gs, { eq: eqOp, and: andOp }) => andOp(eqOp(gs.pin, normalizedPin), eqOp(gs.status, 'lobby')),
    })
    if (!targetSession) {
      throw new Error('No game found with that PIN — it may not have started yet or has already begun')
    }

    return withRlsContext(user.id, async (tx) => {
      const existing = await tx.query.gameParticipants.findFirst({
        where: (gp, { eq: eqOp, and: andOp }) => andOp(eqOp(gp.sessionId, targetSession.id), eqOp(gp.studentId, user.id)),
      })
      if (existing) {
        return { sessionId: targetSession.id, participantId: existing.id }
      }

      const [participant] = await tx
        .insert(gameParticipants)
        .values({
          sessionId: targetSession.id,
          studentId: user.id,
          nickname: `${user.firstName} ${user.lastName.charAt(0)}.`,
        })
        .returning()

      // Without this, the host's WS-held state never reflects new joiners
      // (nothing else broadcasts during the lobby phase), so "Start Game" —
      // gated on participants.length > 0 — could stay disabled forever once
      // the host's WebSocket has connected.
      const participants = await tx.query.gameParticipants.findMany({
        where: (gp, { eq: eqOp }) => eqOp(gp.sessionId, targetSession.id),
      })
      const questions = await tx.query.quizQuestions.findMany({
        where: (q, { eq: eqOp }) => eqOp(q.quizId, targetSession.quizId),
      })
      void broadcastGameState(targetSession.id, {
        id: targetSession.id,
        status: targetSession.status,
        pin: targetSession.pin,
        currentQuestionIndex: targetSession.currentQuestionIndex,
        questionDurationSeconds: targetSession.questionDurationSeconds,
        phaseStartedAt: targetSession.phaseStartedAt.toISOString(),
        totalQuestions: questions.length,
        currentQuestion: null,
        answeredCount: 0,
        choiceCounts: {},
        participants: participants.map((p) => ({ id: p.id, nickname: p.nickname, score: p.score })),
      })

      return { sessionId: targetSession.id, participantId: participant.id }
    })
  })

export const startGameFn = createServerFn({ method: 'POST' })
  .validator(sessionIdSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const [session] = await tx
        .update(gameSessions)
        .set({ status: 'question', currentQuestionIndex: 0, phaseStartedAt: new Date() })
        .where(eq(gameSessions.id, data.sessionId))
        .returning()
      if (!session) throw new Error('Game session not found')

      const questions = await tx.query.quizQuestions.findMany({
        where: (q, { eq: eqOp }) => eqOp(q.quizId, session.quizId),
        with: { choices: true },
        orderBy: (q, { asc }) => asc(q.position),
      })
      const currentQuestionRow = questions[0] ?? null
      const gameState = {
        id: session.id,
        status: session.status,
        pin: session.pin,
        currentQuestionIndex: session.currentQuestionIndex,
        questionDurationSeconds: session.questionDurationSeconds,
        phaseStartedAt: session.phaseStartedAt.toISOString(),
        totalQuestions: questions.length,
        currentQuestion: currentQuestionRow
          ? {
              id: currentQuestionRow.id,
              questionText: currentQuestionRow.questionText,
              choices: currentQuestionRow.choices
                .sort((a, b) => a.position - b.position)
                .map((c) => ({ id: c.id, choiceText: c.choiceText, isCorrect: c.isCorrect })),
            }
          : null,
        answeredCount: 0,
        choiceCounts: {},
        participants: [],
      }
      void broadcastGameState(session.id, gameState)

      return session
    })
  })

export const advancePhaseFn = createServerFn({ method: 'POST' })
  .validator(sessionIdSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const session = await tx.query.gameSessions.findFirst({
        where: (gs, { eq: eqOp }) => eqOp(gs.id, data.sessionId),
      })
      if (!session) throw new Error('Game session not found')

      const questionCount = await tx.query.quizQuestions.findMany({
        where: (q, { eq: eqOp }) => eqOp(q.quizId, session.quizId),
      })

      if (session.status === 'question') {
        const [updated] = await tx
          .update(gameSessions)
          .set({ status: 'reveal', phaseStartedAt: new Date() })
          .where(eq(gameSessions.id, data.sessionId))
          .returning()

        const questions = await tx.query.quizQuestions.findMany({
          where: (q, { eq: eqOp }) => eqOp(q.quizId, session.quizId),
          with: { choices: true },
          orderBy: (q, { asc }) => asc(q.position),
        })
        const currentQuestionRow = questions[session.currentQuestionIndex] ?? null
        const answers = await tx.query.gameAnswers.findMany({
          where: (a, { eq: eqOp }) => eqOp(a.questionId, currentQuestionRow?.id),
        })
        const participants = await tx.query.gameParticipants.findMany({
          where: (gp, { eq: eqOp }) => eqOp(gp.sessionId, data.sessionId),
        })
        const participantIds = new Set(participants.map((p) => p.id))
        const relevantAnswers = answers.filter((a) => participantIds.has(a.participantId))
        const choiceCounts: Record<string, number> = {}
        if (currentQuestionRow) {
          for (const choice of currentQuestionRow.choices) choiceCounts[choice.id] = 0
          for (const answer of relevantAnswers) {
            if (answer.selectedChoiceId && answer.selectedChoiceId in choiceCounts) {
              choiceCounts[answer.selectedChoiceId] += 1
            }
          }
        }
        const gameState = {
          id: session.id,
          status: updated.status,
          pin: session.pin,
          currentQuestionIndex: session.currentQuestionIndex,
          questionDurationSeconds: session.questionDurationSeconds,
          phaseStartedAt: updated.phaseStartedAt.toISOString(),
          totalQuestions: questions.length,
          currentQuestion: currentQuestionRow
            ? {
                id: currentQuestionRow.id,
                questionText: currentQuestionRow.questionText,
                choices: currentQuestionRow.choices
                  .sort((a, b) => a.position - b.position)
                  .map((c) => ({ id: c.id, choiceText: c.choiceText, isCorrect: c.isCorrect })),
              }
            : null,
          answeredCount: relevantAnswers.length,
          choiceCounts,
          participants: participants.map((p) => ({ id: p.id, nickname: p.nickname, score: p.score })),
        }
        void broadcastGameState(session.id, gameState)

        return updated
      }

      if (session.status === 'reveal') {
        const isLastQuestion = session.currentQuestionIndex + 1 >= questionCount.length
        const [updated] = await tx
          .update(gameSessions)
          .set(
            isLastQuestion
              ? { status: 'finished', endedAt: new Date() }
              : { status: 'question', currentQuestionIndex: session.currentQuestionIndex + 1, phaseStartedAt: new Date() },
          )
          .where(eq(gameSessions.id, data.sessionId))
          .returning()

        const questions = await tx.query.quizQuestions.findMany({
          where: (q, { eq: eqOp }) => eqOp(q.quizId, session.quizId),
          with: { choices: true },
          orderBy: (q, { asc }) => asc(q.position),
        })
        const nextQuestionIndex = isLastQuestion ? session.currentQuestionIndex : session.currentQuestionIndex + 1
        const currentQuestionRow = questions[nextQuestionIndex] ?? null
        const gameState = {
          id: session.id,
          status: updated.status,
          pin: session.pin,
          currentQuestionIndex: updated.currentQuestionIndex,
          questionDurationSeconds: session.questionDurationSeconds,
          phaseStartedAt: updated.phaseStartedAt.toISOString(),
          totalQuestions: questions.length,
          currentQuestion: currentQuestionRow
            ? {
                id: currentQuestionRow.id,
                questionText: currentQuestionRow.questionText,
                choices: currentQuestionRow.choices
                  .sort((a, b) => a.position - b.position)
                  .map((c) => ({ id: c.id, choiceText: c.choiceText, isCorrect: c.isCorrect })),
              }
            : null,
          answeredCount: 0,
          choiceCounts: {},
          participants: [],
        }
        void broadcastGameState(session.id, gameState)

        return updated
      }

      return session
    })
  })

export const submitGameAnswerFn = createServerFn({ method: 'POST' })
  .validator(submitGameAnswerSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()

    return withRlsContext(user.id, async (tx) => {
      const session = await tx.query.gameSessions.findFirst({
        where: (gs, { eq: eqOp }) => eqOp(gs.id, data.sessionId),
      })
      if (!session) throw new Error('Game session not found')
      if (session.status !== 'question') {
        throw new Error('This question is no longer accepting answers')
      }

      const participant = await tx.query.gameParticipants.findFirst({
        where: (gp, { eq: eqOp, and: andOp }) => andOp(eqOp(gp.sessionId, data.sessionId), eqOp(gp.studentId, user.id)),
      })
      if (!participant) throw new Error('You are not in this game')

      const existingAnswer = await tx.query.gameAnswers.findFirst({
        where: (a, { eq: eqOp, and: andOp }) => andOp(eqOp(a.participantId, participant.id), eqOp(a.questionId, data.questionId)),
      })
      if (existingAnswer) {
        return { isCorrect: existingAnswer.isCorrect, pointsAwarded: existingAnswer.pointsAwarded }
      }

      const question = await tx.query.quizQuestions.findFirst({
        where: (q, { eq: eqOp }) => eqOp(q.id, data.questionId),
        with: { choices: true },
      })
      if (!question) throw new Error('Question not found')

      // Response time and correctness are always computed here from
      // server-held state (phaseStartedAt, the real answer key) — never
      // trusted from client-supplied values, so nothing can be gamed.
      const responseTimeMs = Math.max(0, Date.now() - session.phaseStartedAt.getTime())
      const correctChoice = question.choices.find((c) => c.isCorrect)
      const isCorrect = !!data.selectedChoiceId && data.selectedChoiceId === correctChoice?.id

      let pointsAwarded = 0
      if (isCorrect) {
        const durationMs = session.questionDurationSeconds * 1000
        const remainingRatio = Math.min(1, Math.max(0, (durationMs - responseTimeMs) / durationMs))
        pointsAwarded = Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * remainingRatio)
      }

      await tx.insert(gameAnswers).values({
        participantId: participant.id,
        questionId: data.questionId,
        selectedChoiceId: data.selectedChoiceId,
        isCorrect,
        pointsAwarded,
        responseTimeMs,
      })

      await tx
        .update(gameParticipants)
        .set({ score: sql`${gameParticipants.score} + ${pointsAwarded}` })
        .where(eq(gameParticipants.id, participant.id))

      return { isCorrect, pointsAwarded }
    })
  })

export interface HostGameQuestion {
  id: string
  questionText: string
  choices: Array<{ id: string; choiceText: string; isCorrect: boolean }>
}

export interface HostGameState {
  id: string
  status: 'lobby' | 'question' | 'reveal' | 'finished'
  pin: string
  currentQuestionIndex: number
  questionDurationSeconds: number
  phaseStartedAt: string
  totalQuestions: number
  currentQuestion: HostGameQuestion | null
  answeredCount: number
  choiceCounts: Record<string, number>
  participants: Array<{ id: string; nickname: string; score: number }>
}

export const getHostStateFn = createServerFn({ method: 'POST' })
  .validator(sessionIdSchema)
  .handler(async ({ data }): Promise<HostGameState> => {
    const user = await requireUser()

    return withRlsContext(user.id, async (tx) => {
      const session = await tx.query.gameSessions.findFirst({
        where: (gs, { eq: eqOp }) => eqOp(gs.id, data.sessionId),
      })
      if (!session) throw new Error('Game session not found')

      const questions = await tx.query.quizQuestions.findMany({
        where: (q, { eq: eqOp }) => eqOp(q.quizId, session.quizId),
        with: { choices: true },
        orderBy: (q, { asc }) => asc(q.position),
      })

      const currentQuestionRow = questions[session.currentQuestionIndex] ?? null
      const currentQuestion: HostGameQuestion | null = currentQuestionRow
        ? {
            id: currentQuestionRow.id,
            questionText: currentQuestionRow.questionText,
            choices: currentQuestionRow.choices
              .sort((a, b) => a.position - b.position)
              .map((c) => ({ id: c.id, choiceText: c.choiceText, isCorrect: c.isCorrect })),
          }
        : null

      const participants = await tx.query.gameParticipants.findMany({
        where: (gp, { eq: eqOp }) => eqOp(gp.sessionId, data.sessionId),
        orderBy: (gp, { desc }) => desc(gp.score),
      })

      let answeredCount = 0
      const choiceCounts: Record<string, number> = {}
      if (currentQuestion) {
        const answers = await tx.query.gameAnswers.findMany({
          where: (a, { eq: eqOp }) => eqOp(a.questionId, currentQuestion.id),
        })
        const participantIds = new Set(participants.map((p) => p.id))
        const relevantAnswers = answers.filter((a) => participantIds.has(a.participantId))
        answeredCount = relevantAnswers.length
        for (const choice of currentQuestion.choices) choiceCounts[choice.id] = 0
        for (const answer of relevantAnswers) {
          if (answer.selectedChoiceId && answer.selectedChoiceId in choiceCounts) {
            choiceCounts[answer.selectedChoiceId] += 1
          }
        }
      }

      return {
        id: session.id,
        status: session.status,
        pin: session.pin,
        currentQuestionIndex: session.currentQuestionIndex,
        questionDurationSeconds: session.questionDurationSeconds,
        phaseStartedAt: session.phaseStartedAt.toISOString(),
        totalQuestions: questions.length,
        currentQuestion,
        answeredCount,
        choiceCounts,
        participants: participants.map((p) => ({ id: p.id, nickname: p.nickname, score: p.score })),
      }
    })
  })

export interface PlayerGameQuestion {
  id: string
  questionText: string
  choices: Array<{ id: string; choiceText: string; isCorrect?: boolean }>
}

export interface PlayerGameState {
  status: 'lobby' | 'question' | 'reveal' | 'finished'
  currentQuestionIndex: number
  questionDurationSeconds: number
  phaseStartedAt: string
  totalQuestions: number
  myParticipantId: string
  myScore: number
  hasAnsweredCurrent: boolean
  myLastAnswer: { isCorrect: boolean; pointsAwarded: number } | null
  currentQuestion: PlayerGameQuestion | null
  leaderboard: Array<{ id: string; nickname: string; score: number }>
  lobbyParticipants: Array<{ id: string; nickname: string }>
}

export const getPlayerStateFn = createServerFn({ method: 'POST' })
  .validator(sessionIdSchema)
  .handler(async ({ data }): Promise<PlayerGameState> => {
    const user = await requireUser()

    return withRlsContext(user.id, async (tx) => {
      const session = await tx.query.gameSessions.findFirst({
        where: (gs, { eq: eqOp }) => eqOp(gs.id, data.sessionId),
      })
      if (!session) throw new Error('Game session not found')

      const participant = await tx.query.gameParticipants.findFirst({
        where: (gp, { eq: eqOp, and: andOp }) => andOp(eqOp(gp.sessionId, data.sessionId), eqOp(gp.studentId, user.id)),
      })
      if (!participant) throw new Error('You are not in this game')

      const questions = await tx.query.quizQuestions.findMany({
        where: (q, { eq: eqOp }) => eqOp(q.quizId, session.quizId),
        with: { choices: true },
        orderBy: (q, { asc }) => asc(q.position),
      })
      const currentQuestionRow = questions[session.currentQuestionIndex] ?? null

      let hasAnsweredCurrent = false
      let myLastAnswer: { isCorrect: boolean; pointsAwarded: number } | null = null
      if (currentQuestionRow) {
        const answer = await tx.query.gameAnswers.findFirst({
          where: (a, { eq: eqOp, and: andOp }) =>
            andOp(eqOp(a.participantId, participant.id), eqOp(a.questionId, currentQuestionRow.id)),
        })
        if (answer) {
          hasAnsweredCurrent = true
          myLastAnswer = { isCorrect: answer.isCorrect, pointsAwarded: answer.pointsAwarded }
        }
      }

      // Reveal is safe to send the answer key for (the round is over); during
      // the live "question" phase the choices must never carry is_correct.
      const revealAnswers = session.status === 'reveal' || session.status === 'finished'
      const currentQuestion: PlayerGameQuestion | null = currentQuestionRow
        ? {
            id: currentQuestionRow.id,
            questionText: currentQuestionRow.questionText,
            choices: currentQuestionRow.choices
              .sort((a, b) => a.position - b.position)
              .map((c) => ({
                id: c.id,
                choiceText: c.choiceText,
                ...(revealAnswers ? { isCorrect: c.isCorrect } : {}),
              })),
          }
        : null

      let leaderboard: Array<{ id: string; nickname: string; score: number }> = []
      let lobbyParticipants: Array<{ id: string; nickname: string }> = []
      if (session.status === 'lobby') {
        const all = await tx.query.gameParticipants.findMany({ where: (gp, { eq: eqOp }) => eqOp(gp.sessionId, data.sessionId) })
        lobbyParticipants = all.map((p) => ({ id: p.id, nickname: p.nickname }))
      } else {
        const all = await tx.query.gameParticipants.findMany({
          where: (gp, { eq: eqOp }) => eqOp(gp.sessionId, data.sessionId),
          orderBy: (gp, { desc }) => desc(gp.score),
        })
        leaderboard = all.map((p) => ({ id: p.id, nickname: p.nickname, score: p.score }))
      }

      return {
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        questionDurationSeconds: session.questionDurationSeconds,
        phaseStartedAt: session.phaseStartedAt.toISOString(),
        totalQuestions: questions.length,
        myParticipantId: participant.id,
        myScore: participant.score,
        hasAnsweredCurrent,
        myLastAnswer,
        currentQuestion,
        leaderboard,
        lobbyParticipants,
      }
    })
  })

export interface PastGameSessionSummary {
  id: string
  quizTitle: string
  endedAt: string
  participantCount: number
  topScore: number
}

// Reports are host-only for now — the same person who ran the live game
// revisiting it later, matching how the "Host Live Game" entry point
// itself is host-scoped. RLS's game_sessions_select already grants the
// host (fn_quiz_owned_by_teacher) access regardless of status, so a
// finished session is exactly as reachable as a live one.
export const getPastGameSessionsFn = createServerFn({ method: 'GET' }).handler(async (): Promise<Array<PastGameSessionSummary>> => {
  const user = await requireUser()

  return withRlsContext(user.id, async (tx) => {
    const sessions = await tx.query.gameSessions.findMany({
      where: (gs, { eq: eqOp, and: andOp }) => andOp(eqOp(gs.hostId, user.id), eqOp(gs.status, 'finished')),
      with: { quiz: true, participants: true },
      orderBy: (gs, { desc }) => desc(gs.endedAt),
    })

    return sessions.map((session) => ({
      id: session.id,
      quizTitle: session.quiz.title,
      endedAt: session.endedAt ? session.endedAt.toISOString() : session.createdAt.toISOString(),
      participantCount: session.participants.length,
      topScore: session.participants.reduce((max, p) => Math.max(max, p.score), 0),
    }))
  })
})

export interface GameReportChoiceBreakdown {
  choiceId: string
  choiceText: string
  isCorrect: boolean
  count: number
}

export interface GameReportQuestion {
  questionId: string
  questionText: string
  points: number
  correctCount: number
  totalAnswered: number
  choices: Array<GameReportChoiceBreakdown>
}

export interface GameReportLeaderboardEntry {
  rank: number
  participantId: string
  nickname: string
  score: number
}

export interface GameReport {
  sessionId: string
  quizTitle: string
  endedAt: string | null
  participantCount: number
  leaderboard: Array<GameReportLeaderboardEntry>
  questions: Array<GameReportQuestion>
}

export const getGameReportFn = createServerFn({ method: 'POST' })
  .validator(sessionIdSchema)
  .handler(async ({ data }): Promise<GameReport> => {
    const user = await requireUser()

    return withRlsContext(user.id, async (tx) => {
      const session = await tx.query.gameSessions.findFirst({
        where: (gs, { eq: eqOp }) => eqOp(gs.id, data.sessionId),
        with: { quiz: true },
      })
      if (!session) throw new Error('Game session not found')
      if (session.hostId !== user.id) throw new Error('Only the host can view this report')

      const participants = await tx.query.gameParticipants.findMany({
        where: (gp, { eq: eqOp }) => eqOp(gp.sessionId, data.sessionId),
        orderBy: (gp, { desc }) => desc(gp.score),
      })

      const questions = await tx.query.quizQuestions.findMany({
        where: (q, { eq: eqOp }) => eqOp(q.quizId, session.quizId),
        with: { choices: true },
        orderBy: (q, { asc }) => asc(q.position),
      })

      const participantIds = new Set(participants.map((p) => p.id))
      const allAnswers = await tx.query.gameAnswers.findMany({
        where: (a, { inArray: inArrayOp }) => inArrayOp(a.questionId, questions.map((q) => q.id)),
      })
      const relevantAnswers = allAnswers.filter((a) => participantIds.has(a.participantId))
      const answersByQuestion = new Map<string, Array<(typeof relevantAnswers)[number]>>()
      for (const answer of relevantAnswers) {
        const list = answersByQuestion.get(answer.questionId) ?? []
        list.push(answer)
        answersByQuestion.set(answer.questionId, list)
      }

      return {
        sessionId: session.id,
        quizTitle: session.quiz.title,
        endedAt: session.endedAt ? session.endedAt.toISOString() : null,
        participantCount: participants.length,
        leaderboard: participants.map((p, index) => ({
          rank: index + 1,
          participantId: p.id,
          nickname: p.nickname,
          score: p.score,
        })),
        questions: questions.map((q) => {
          const answersForQuestion = answersByQuestion.get(q.id) ?? []
          const sortedChoices = q.choices.slice().sort((a, b) => a.position - b.position)
          return {
            questionId: q.id,
            questionText: q.questionText,
            points: q.points,
            correctCount: answersForQuestion.filter((a) => a.isCorrect).length,
            totalAnswered: answersForQuestion.length,
            choices: sortedChoices.map((c) => ({
              choiceId: c.id,
              choiceText: c.choiceText,
              isCorrect: c.isCorrect,
              count: answersForQuestion.filter((a) => a.selectedChoiceId === c.id).length,
            })),
          }
        }),
      }
    })
  })

export function usePastGameSessions() {
  return useQuery({
    queryKey: ['games', 'past-sessions'],
    queryFn: () => getPastGameSessionsFn(),
  })
}

export function useGameReport(sessionId: string) {
  return useQuery({
    queryKey: ['games', 'report', sessionId],
    queryFn: () => getGameReportFn({ data: { sessionId } }),
    retry: false,
  })
}

export function useCreateGameSession() {
  return useMutation({
    mutationFn: (input: { quizId: string; questionDurationSeconds?: number }) =>
      createGameSessionFn({ data: { quizId: input.quizId, questionDurationSeconds: input.questionDurationSeconds ?? 20 } }),
  })
}

export function useJoinGame() {
  return useMutation({
    mutationFn: (pin: string) => joinGameFn({ data: { pin } }),
    // joinGameFn returns { sessionId, participantId }
  })
}

export function useHostGameState(sessionId: string) {
  return useQuery({
    queryKey: ['games', 'host', sessionId],
    queryFn: () => getHostStateFn({ data: { sessionId } }),
    refetchInterval: 1200,
    retry: false,
  })
}

export function usePlayerGameState(sessionId: string) {
  return useQuery({
    queryKey: ['games', 'play', sessionId],
    queryFn: () => getPlayerStateFn({ data: { sessionId } }),
    refetchInterval: 1200,
    retry: false,
  })
}

export function useStartGame() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => startGameFn({ data: { sessionId } }),
    onSuccess: (_data, sessionId) => queryClient.invalidateQueries({ queryKey: ['games', 'host', sessionId] }),
  })
}

export function useAdvancePhase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => advancePhaseFn({ data: { sessionId } }),
    onSuccess: (_data, sessionId) => queryClient.invalidateQueries({ queryKey: ['games', 'host', sessionId] }),
  })
}

export function useSubmitGameAnswer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { sessionId: string; questionId: string; selectedChoiceId: string | null }) =>
      submitGameAnswerFn({ data: input }),
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ['games', 'play', variables.sessionId] }),
  })
}

export function useHostGameStateRealtime(sessionId: string) {
  const [state, setState] = useState<HostGameState | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fallbackQuery = useHostGameState(sessionId)

  useEffect(() => {
    if (!sessionId) return
    let ws: WebSocket | null = null
    let retries = 0
    const maxRetries = 3

    function connect() {
      try {
        ws = new WebSocket(buildGameWsUrl({ sessionId, role: 'host' }))
        wsRef.current = ws

        ws.onopen = () => {
          setConnected(true)
          setError(null)
          retries = 0
        }
        ws.onclose = () => {
          setConnected(false)
          wsRef.current = null
          if (retries < maxRetries) {
            retries += 1
            setTimeout(connect, 1000 * retries)
          }
        }
        ws.onerror = () => {
          setError(new Error('WebSocket connection failed'))
          setConnected(false)
        }
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            if (message.type === 'init' || message.type === 'state:update') {
              setState(message.state as HostGameState)
            }
          } catch {
            // ignore
          }
        }
      } catch {
        setError(new Error('WebSocket not supported'))
      }
    }

    connect()
    return () => {
      ws?.close()
      wsRef.current = null
    }
  }, [sessionId])

  return {
    data: state ?? fallbackQuery.data,
    isLoading: !state && fallbackQuery.isLoading,
    error: state ? null : (error ?? fallbackQuery.error),
    connected,
    refetch: fallbackQuery.refetch,
  }
}

// Unlike the host hook, this never accepts a raw state payload over the
// socket — the server only ever sends a player {type: 'state:changed'}
// notification (see ws-server.ts), never the host-shaped broadcast state,
// because a player's correct view (myScore, hasAnsweredCurrent, the
// answer key hidden until reveal) can only be computed per-player by
// getPlayerStateFn. The socket's only job here is to trigger an immediate
// refetch instead of waiting out the polling interval.
export function usePlayerGameStateRealtime(sessionId: string, participantId: string) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fallbackQuery = usePlayerGameState(sessionId)
  const refetchRef = useRef(fallbackQuery.refetch)
  refetchRef.current = fallbackQuery.refetch

  useEffect(() => {
    if (!sessionId || !participantId) return
    let ws: WebSocket | null = null
    let retries = 0
    const maxRetries = 3

    function connect() {
      try {
        ws = new WebSocket(buildGameWsUrl({ sessionId, role: 'player', participantId }))
        wsRef.current = ws

        ws.onopen = () => {
          setConnected(true)
          setError(null)
          retries = 0
        }
        ws.onclose = () => {
          setConnected(false)
          wsRef.current = null
          if (retries < maxRetries) {
            retries += 1
            setTimeout(connect, 1000 * retries)
          }
        }
        ws.onerror = () => {
          setError(new Error('WebSocket connection failed'))
          setConnected(false)
        }
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data)
            if (message.type === 'init' || message.type === 'state:changed') {
              void refetchRef.current()
            }
          } catch {
            // ignore
          }
        }
      } catch {
        setError(new Error('WebSocket not supported'))
      }
    }

    connect()
    return () => {
      ws?.close()
      wsRef.current = null
    }
  }, [sessionId, participantId])

  return {
    data: fallbackQuery.data,
    isLoading: fallbackQuery.isLoading,
    error: error ?? fallbackQuery.error,
    connected,
    refetch: fallbackQuery.refetch,
  }
}
