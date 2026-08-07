import { createServerFn } from '@tanstack/react-start'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { eq, sql } from 'drizzle-orm'
import { useState, useRef, useEffect } from 'react'
import { withRlsContext, type QueryDb } from '@/db'
import { adminDb } from '@/db/admin'
import { gameAnswers, gameParticipants, gameSessions } from '@/db/schema'
import { requireUser } from '@/features/auth/utils'
import {
  createGameSessionSchema,
  gameSessionPinSchema,
  guestParticipantSchema,
  guestSubmitGameAnswerSchema,
  joinGameAsGuestSchema,
  joinGameSchema,
  sessionIdSchema,
  submitGameAnswerSchema,
} from '@/features/auth/validators'
import { broadcastGameState } from '@/lib/ws-server'
import { rateLimit } from '@/lib/rateLimit'
import { awardCoins, getBulkEquippedSprites } from '@/features/economy/hooks/useEconomy'

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
      // A live game has no "wait for the teacher to grade this" concept —
      // manual-grading question types (audio/video response, draw,
      // hotspot, math response, graphing, open-ended) can't be scored in
      // real time, so a quiz containing any of them can't be hosted live.
      const questions = await tx.query.quizQuestions.findMany({
        where: (q, { eq: eqOp }) => eqOp(q.quizId, data.quizId),
      })
      const manualTypeQuestion = questions.find((q) => q.requiresManualGrading)
      if (manualTypeQuestion) {
        throw new Error('This quiz has a question type that needs manual grading, so it can\'t be hosted as a live game.')
      }

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const [session] = await tx
            .insert(gameSessions)
            .values({
              quizId: data.quizId,
              hostId: user.id,
              pin: generatePin(),
              questionDurationSeconds: data.questionDurationSeconds,
              accessMode: data.accessMode,
              pacingMode: data.pacingMode,
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
      with: { quiz: true },
    })
    if (!targetSession) {
      throw new Error('No game found with that PIN — it may not have started yet or has already begun')
    }

    // Mirrors game_participants_insert's RLS check (fn_can_join_game_session,
    // via fn_is_class_student — requires an ACTIVE enrollment) exactly, so a
    // student who isn't enrolled (or was dropped) gets a clear message here
    // instead of a raw Postgres RLS-violation error from the insert below.
    // A 'public' session skips this — fn_can_join_game_session admits any
    // authenticated student there regardless of enrollment.
    if (targetSession.accessMode !== 'public' && targetSession.quiz.classId) {
      const enrollment = await adminDb.query.enrollments.findFirst({
        where: (e, { eq: eqOp, and: andOp }) => andOp(eqOp(e.classId, targetSession.quiz.classId!), eqOp(e.studentId, user.id), eqOp(e.status, 'active')),
      })
      if (!enrollment) {
        throw new Error("You're not enrolled in the class this game belongs to")
      }
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

// Anonymous-safe: called from /game/join before any account exists, so it
// must never require auth. Leaks nothing beyond "does this PIN currently
// resolve to a lobby, and can a guest join it" — same visibility rule an
// attacker could already infer by trying joinGameFn and reading its error.
export const getGameSessionAccessModeFn = createServerFn({ method: 'POST' })
  .validator(gameSessionPinSchema)
  .handler(async ({ data }): Promise<{ exists: boolean; accessMode: 'class' | 'public' | null }> => {
    const session = await adminDb.query.gameSessions.findFirst({
      where: (gs, { eq: eqOp, and: andOp }) => andOp(eqOp(gs.pin, data.pin.trim()), eqOp(gs.status, 'lobby')),
    })
    if (!session) return { exists: false, accessMode: null }
    return { exists: true, accessMode: session.accessMode }
  })

// Guest join: no requireUser() at all — a public-session participant has no
// FocusFlow account. Entirely adminDb-backed (RLS never applies here, same
// as the PIN discovery lookup above), with authorization enforced in code:
// the session must be status='lobby' AND accessMode='public'. A guest can
// never land in a class-only session even with a valid PIN.
export const joinGameAsGuestFn = createServerFn({ method: 'POST' })
  .validator(joinGameAsGuestSchema)
  .handler(async ({ data }) => {
    rateLimit('join-game', { max: 15, windowMs: 60_000 })

    const targetSession = await adminDb.query.gameSessions.findFirst({
      where: (gs, { eq: eqOp, and: andOp }) => andOp(eqOp(gs.pin, data.pin.trim()), eqOp(gs.status, 'lobby')),
    })
    if (!targetSession) {
      throw new Error('No game found with that PIN — it may not have started yet or has already begun')
    }
    if (targetSession.accessMode !== 'public') {
      throw new Error('This game requires a FocusFlow account — log in, or ask your teacher for a public join code')
    }

    const [participant] = await adminDb
      .insert(gameParticipants)
      .values({
        sessionId: targetSession.id,
        studentId: null,
        nickname: data.officialName.trim(),
      })
      .returning()

    const participants = await adminDb.query.gameParticipants.findMany({
      where: (gp, { eq: eqOp }) => eqOp(gp.sessionId, targetSession.id),
    })
    const questions = await adminDb.query.quizQuestions.findMany({
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
        pacingMode: session.pacingMode,
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
        participantProgress: [],
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

        if (isLastQuestion) {
          // Flat completion bonus to every participant, winner or not —
          // docs/12_Gamification_Framework.md §10: losing gracefully is
          // always at least as rewarded as winning, so this can't scale
          // with rank or score.
          const finishedParticipants = await tx.query.gameParticipants.findMany({
            where: (gp, { eq: eqOp }) => eqOp(gp.sessionId, data.sessionId),
          })
          for (const participant of finishedParticipants) {
            // Guests (studentId null) have no users row, so no ledger to credit.
            if (participant.studentId) {
              await awardCoins(tx, participant.studentId, 5, 'game_completion', { sessionId: data.sessionId })
            }
          }
        }

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

// Shared by submitGameAnswerFn (registered) and submitGameAnswerAsGuestFn
// (guest) — grading/scoring is identical either way; only how the coin
// award happens afterward differs (guests have no ledger to credit).
async function submitGameAnswerCore(
  tx: QueryDb,
  session: { id: string; quizId: string; status: string; pacingMode: 'teacher_led' | 'student_led'; phaseStartedAt: Date; questionDurationSeconds: number },
  participant: { id: string; studentId: string | null; currentQuestionIndex: number; questionStartedAt: Date; finishedAt: Date | null },
  questionId: string,
  selectedChoiceId: string | null,
): Promise<{ isCorrect: boolean; pointsAwarded: number; correctChoiceId: string | null }> {
  if (session.status !== 'question') {
    throw new Error('This question is no longer accepting answers')
  }
  if (session.pacingMode === 'student_led' && participant.finishedAt) {
    throw new Error('You have already finished this game')
  }

  const question = await tx.query.quizQuestions.findFirst({
    where: (q, { eq: eqOp }) => eqOp(q.id, questionId),
    with: { choices: true },
  })
  if (!question) throw new Error('Question not found')
  const correctChoice = question.choices.find((c) => c.isCorrect)

  const existingAnswer = await tx.query.gameAnswers.findFirst({
    where: (a, { eq: eqOp, and: andOp }) => andOp(eqOp(a.participantId, participant.id), eqOp(a.questionId, questionId)),
  })
  if (existingAnswer) {
    return { isCorrect: existingAnswer.isCorrect, pointsAwarded: existingAnswer.pointsAwarded, correctChoiceId: correctChoice?.id ?? null }
  }

  // student_led: each participant has their own cursor through the quiz —
  // reject an answer for anything but their actual current question,
  // rather than silently grading a stale/out-of-order client.
  let totalQuestions: number | null = null
  if (session.pacingMode === 'student_led') {
    const questions = await tx.query.quizQuestions.findMany({ where: (q, { eq: eqOp }) => eqOp(q.quizId, session.quizId) })
    totalQuestions = questions.length
    const expected = questions[participant.currentQuestionIndex]
    if (!expected || expected.id !== questionId) {
      throw new Error('This is not your current question')
    }
  }

  // Response time and correctness are always computed here from
  // server-held state (phaseStartedAt / the participant's own
  // questionStartedAt, and the real answer key) — never trusted from
  // client-supplied values, so nothing can be gamed.
  const responseStartedAt = session.pacingMode === 'student_led' ? participant.questionStartedAt : session.phaseStartedAt
  const responseTimeMs = Math.max(0, Date.now() - responseStartedAt.getTime())
  const isCorrect = !!selectedChoiceId && selectedChoiceId === correctChoice?.id

  let pointsAwarded = 0
  if (isCorrect) {
    const durationMs = session.questionDurationSeconds * 1000
    const remainingRatio = Math.min(1, Math.max(0, (durationMs - responseTimeMs) / durationMs))
    pointsAwarded = Math.round(MIN_POINTS + (MAX_POINTS - MIN_POINTS) * remainingRatio)
  }

  await tx.insert(gameAnswers).values({
    participantId: participant.id,
    questionId,
    selectedChoiceId,
    isCorrect,
    pointsAwarded,
    responseTimeMs,
  })

  await tx
    .update(gameParticipants)
    .set({ score: sql`${gameParticipants.score} + ${pointsAwarded}` })
    .where(eq(gameParticipants.id, participant.id))

  if (session.pacingMode === 'student_led' && totalQuestions !== null) {
    const isLastQuestion = participant.currentQuestionIndex + 1 >= totalQuestions
    if (isLastQuestion) {
      await tx.update(gameParticipants).set({ finishedAt: new Date() }).where(eq(gameParticipants.id, participant.id))
      // Guests (studentId null) have no users row, so no ledger to credit.
      if (participant.studentId) {
        await awardCoins(tx, participant.studentId, 5, 'game_completion', { sessionId: session.id })
      }

      // Auto-finish the whole session once every participant is done —
      // via adminDb, not `tx`: a student's own RLS context can never
      // update gameSessions (only the host's fn_quiz_owned_by_teacher
      // check does), and this is a legitimate system-triggered side
      // effect, not the student claiming arbitrary state. This
      // participant's own just-set finishedAt may not be visible yet on
      // a separate connection if `tx` is still an open transaction, so
      // it's treated as finished by id rather than re-reading it.
      const allParticipants = await adminDb.query.gameParticipants.findMany({
        where: (gp, { eq: eqOp }) => eqOp(gp.sessionId, session.id),
      })
      const allFinished = allParticipants.every((p) => p.id === participant.id || p.finishedAt !== null)
      if (allFinished) {
        await adminDb.update(gameSessions).set({ status: 'finished', endedAt: new Date() }).where(eq(gameSessions.id, session.id))
      }
    } else {
      await tx
        .update(gameParticipants)
        .set({ currentQuestionIndex: participant.currentQuestionIndex + 1, questionStartedAt: new Date() })
        .where(eq(gameParticipants.id, participant.id))
    }
  }

  return { isCorrect, pointsAwarded, correctChoiceId: correctChoice?.id ?? null }
}

export const submitGameAnswerFn = createServerFn({ method: 'POST' })
  .validator(submitGameAnswerSchema)
  .handler(async ({ data }) => {
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

      const result = await submitGameAnswerCore(tx, session, participant, data.questionId, data.selectedChoiceId)

      // Live-game scoring (100-1000/question) is on a different scale than
      // quiz points — a flat small award per correct answer, not tied to
      // the speed-bonus score, keeps this roughly in line with the async
      // quiz path's coin rate rather than paying out hundreds of coins for
      // one fast answer.
      if (result.isCorrect) {
        await awardCoins(tx, user.id, 2, 'game_answer', { sessionId: data.sessionId, questionId: data.questionId })
      }

      return result
    })
  })

// Guest submission: no requireUser(), authorized purely by participantId
// ownership of a guest (studentId null) row in this exact session — same
// bearer-token reasoning as getGuestPlayerStateFn. No coin award: guests
// have no users row to credit.
export const submitGameAnswerAsGuestFn = createServerFn({ method: 'POST' })
  .validator(guestSubmitGameAnswerSchema)
  .handler(async ({ data }) => {
    const session = await adminDb.query.gameSessions.findFirst({
      where: (gs, { eq: eqOp }) => eqOp(gs.id, data.sessionId),
    })
    if (!session) throw new Error('Game session not found')

    const participant = await adminDb.query.gameParticipants.findFirst({
      where: (gp, { eq: eqOp, and: andOp, isNull }) =>
        andOp(eqOp(gp.id, data.participantId), eqOp(gp.sessionId, data.sessionId), isNull(gp.studentId)),
    })
    if (!participant) throw new Error('You are not in this game')

    return submitGameAnswerCore(adminDb, session, participant, data.questionId, data.selectedChoiceId)
  })

export interface HostGameQuestion {
  id: string
  questionText: string
  choices: Array<{ id: string; choiceText: string; isCorrect: boolean }>
}

export interface HostGameState {
  id: string
  status: 'lobby' | 'question' | 'reveal' | 'finished'
  pacingMode: 'teacher_led' | 'student_led'
  pin: string
  currentQuestionIndex: number
  questionDurationSeconds: number
  phaseStartedAt: string
  totalQuestions: number
  currentQuestion: HostGameQuestion | null
  answeredCount: number
  choiceCounts: Record<string, number>
  participants: Array<{ id: string; nickname: string; score: number }>
  // Only populated for student_led — one shared "current question" doesn't
  // exist, each participant has their own.
  participantProgress: Array<{ id: string; nickname: string; currentQuestionIndex: number; totalQuestions: number; score: number; finished: boolean }>
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

      const participants = await tx.query.gameParticipants.findMany({
        where: (gp, { eq: eqOp }) => eqOp(gp.sessionId, data.sessionId),
        orderBy: (gp, { desc }) => desc(gp.score),
      })

      if (session.pacingMode === 'student_led') {
        return {
          id: session.id,
          status: session.status,
          pacingMode: session.pacingMode,
          pin: session.pin,
          currentQuestionIndex: session.currentQuestionIndex,
          questionDurationSeconds: session.questionDurationSeconds,
          phaseStartedAt: session.phaseStartedAt.toISOString(),
          totalQuestions: questions.length,
          currentQuestion: null,
          answeredCount: 0,
          choiceCounts: {},
          participants: participants.map((p) => ({ id: p.id, nickname: p.nickname, score: p.score })),
          participantProgress: participants.map((p) => ({
            id: p.id,
            nickname: p.nickname,
            currentQuestionIndex: p.currentQuestionIndex,
            totalQuestions: questions.length,
            score: p.score,
            finished: !!p.finishedAt,
          })),
        }
      }

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
        pacingMode: session.pacingMode,
        pin: session.pin,
        currentQuestionIndex: session.currentQuestionIndex,
        questionDurationSeconds: session.questionDurationSeconds,
        phaseStartedAt: session.phaseStartedAt.toISOString(),
        totalQuestions: questions.length,
        currentQuestion,
        answeredCount,
        choiceCounts,
        participants: participants.map((p) => ({ id: p.id, nickname: p.nickname, score: p.score })),
        participantProgress: [],
      }
    })
  })

// Host-only explicit "end it now" — covers "OR the teacher ends the game"
// for student_led sessions (their own progress-driven auto-finish in
// submitGameAnswerCore already covers "once everyone's done"). Harmless
// if used on a teacher_led session too, though that mode already ends
// naturally via the last advancePhaseFn call.
export const endGameFn = createServerFn({ method: 'POST' })
  .validator(sessionIdSchema)
  .handler(async ({ data }) => {
    const user = await requireUser()
    return withRlsContext(user.id, async (tx) => {
      const [session] = await tx
        .update(gameSessions)
        .set({ status: 'finished', endedAt: new Date() })
        .where(eq(gameSessions.id, data.sessionId))
        .returning()
      if (!session) throw new Error('Game session not found')
      return session
    })
  })

export interface PlayerGameQuestion {
  id: string
  questionText: string
  choices: Array<{ id: string; choiceText: string; isCorrect?: boolean }>
}

export interface PlayerGameState {
  status: 'lobby' | 'question' | 'reveal' | 'finished'
  pacingMode: 'teacher_led' | 'student_led'
  currentQuestionIndex: number
  questionDurationSeconds: number
  phaseStartedAt: string
  totalQuestions: number
  myParticipantId: string
  myScore: number
  hasAnsweredCurrent: boolean
  myLastAnswer: { isCorrect: boolean; pointsAwarded: number } | null
  currentQuestion: PlayerGameQuestion | null
  leaderboard: Array<{ id: string; nickname: string; score: number; sprites: Record<string, string> }>
  lobbyParticipants: Array<{ id: string; nickname: string; sprites: Record<string, string> }>
}

// Shared by getPlayerStateFn (registered student, withRlsContext) and
// getGuestPlayerStateFn (public-session guest, adminDb) — the ONE place
// the "never leak is_correct before reveal" invariant lives, so both
// paths can never drift apart on that guarantee.
async function buildPlayerGameState(
  tx: QueryDb,
  session: {
    id: string
    quizId: string
    status: 'lobby' | 'question' | 'reveal' | 'finished'
    pacingMode: 'teacher_led' | 'student_led'
    currentQuestionIndex: number
    questionDurationSeconds: number
    phaseStartedAt: Date
  },
  participant: { id: string; score: number; studentId: string | null; currentQuestionIndex: number; finishedAt: Date | null },
): Promise<PlayerGameState> {
  const questions = await tx.query.quizQuestions.findMany({
    where: (q, { eq: eqOp }) => eqOp(q.quizId, session.quizId),
    with: { choices: true },
    orderBy: (q, { asc }) => asc(q.position),
  })

  const isStudentLed = session.pacingMode === 'student_led'
  // student_led has no per-participant 'reveal' phase — reveal happens
  // client-side from the submit-answer response, never from polling here,
  // so this path must never carry is_correct through currentQuestion.
  const myQuestionIndex = isStudentLed ? participant.currentQuestionIndex : session.currentQuestionIndex
  const currentQuestionRow = questions[myQuestionIndex] ?? null
  // student_led normally derives its own pace from participant.finishedAt,
  // but the host's "End Game" button (or the natural all-finished
  // auto-transition) sets session.status='finished' directly — a
  // participant who hasn't answered their last question yet has no other
  // signal that the session ended, so session.status='finished' must win
  // here even though nothing else in this branch reads it.
  const myStatus: PlayerGameState['status'] =
    session.status === 'lobby'
      ? 'lobby'
      : isStudentLed
        ? participant.finishedAt || session.status === 'finished'
          ? 'finished'
          : 'question'
        : session.status

  let hasAnsweredCurrent = false
  let myLastAnswer: { isCorrect: boolean; pointsAwarded: number } | null = null
  if (currentQuestionRow && !isStudentLed) {
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
  const revealAnswers = !isStudentLed && (session.status === 'reveal' || session.status === 'finished')
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

  let leaderboard: Array<{ id: string; nickname: string; score: number; sprites: Record<string, string> }> = []
  let lobbyParticipants: Array<{ id: string; nickname: string; sprites: Record<string, string> }> = []
  if (session.status === 'lobby') {
    const all = await tx.query.gameParticipants.findMany({ where: (gp, { eq: eqOp }) => eqOp(gp.sessionId, session.id) })
    const spritesByStudent = await getBulkEquippedSprites(tx, all.flatMap((p) => (p.studentId ? [p.studentId] : [])))
    lobbyParticipants = all.map((p) => ({ id: p.id, nickname: p.nickname, sprites: p.studentId ? (spritesByStudent[p.studentId] ?? {}) : {} }))
  } else {
    const all = await tx.query.gameParticipants.findMany({
      where: (gp, { eq: eqOp }) => eqOp(gp.sessionId, session.id),
      orderBy: (gp, { desc }) => desc(gp.score),
    })
    const spritesByStudent = await getBulkEquippedSprites(tx, all.flatMap((p) => (p.studentId ? [p.studentId] : [])))
    leaderboard = all.map((p) => ({ id: p.id, nickname: p.nickname, score: p.score, sprites: p.studentId ? (spritesByStudent[p.studentId] ?? {}) : {} }))
  }

  return {
    status: myStatus,
    pacingMode: session.pacingMode,
    currentQuestionIndex: myQuestionIndex,
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

      return buildPlayerGameState(tx, session, participant)
    })
  })

// Guest read path: no requireUser() — authorized purely by presenting the
// exact participantId issued at join time (an unguessable uuid, never
// broadcast to other clients), scoped to a row that's actually a guest
// (studentId is null) in this exact session.
export const getGuestPlayerStateFn = createServerFn({ method: 'POST' })
  .validator(guestParticipantSchema)
  .handler(async ({ data }): Promise<PlayerGameState> => {
    const session = await adminDb.query.gameSessions.findFirst({
      where: (gs, { eq: eqOp }) => eqOp(gs.id, data.sessionId),
    })
    if (!session) throw new Error('Game session not found')

    const participant = await adminDb.query.gameParticipants.findFirst({
      where: (gp, { eq: eqOp, and: andOp, isNull }) =>
        andOp(eqOp(gp.id, data.participantId), eqOp(gp.sessionId, data.sessionId), isNull(gp.studentId)),
    })
    if (!participant) throw new Error('You are not in this game')

    return buildPlayerGameState(adminDb, session, participant)
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
    mutationFn: (input: {
      quizId: string
      questionDurationSeconds?: number
      accessMode?: 'class' | 'public'
      pacingMode?: 'teacher_led' | 'student_led'
    }) =>
      createGameSessionFn({
        data: {
          quizId: input.quizId,
          questionDurationSeconds: input.questionDurationSeconds ?? 20,
          accessMode: input.accessMode ?? 'class',
          pacingMode: input.pacingMode ?? 'teacher_led',
        },
      }),
  })
}

export function useJoinGame() {
  return useMutation({
    mutationFn: (pin: string) => joinGameFn({ data: { pin } }),
    // joinGameFn returns { sessionId, participantId }
  })
}

export function useGameSessionAccessMode() {
  return useMutation({
    mutationFn: (pin: string) => getGameSessionAccessModeFn({ data: { pin } }),
  })
}

export function useJoinGameAsGuest() {
  return useMutation({
    mutationFn: (input: { pin: string; officialName: string }) => joinGameAsGuestFn({ data: input }),
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

export function usePlayerGameState(sessionId: string, enabled = true) {
  return useQuery({
    queryKey: ['games', 'play', sessionId],
    queryFn: () => getPlayerStateFn({ data: { sessionId } }),
    refetchInterval: 1200,
    retry: false,
    enabled,
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

export function useEndGame() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => endGameFn({ data: { sessionId } }),
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

export function useSubmitGameAnswerAsGuest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { sessionId: string; participantId: string; questionId: string; selectedChoiceId: string | null }) =>
      submitGameAnswerAsGuestFn({ data: input }),
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ['games', 'play-guest', variables.sessionId] }),
  })
}

// Historically this consumed the WS broadcast payload directly (setState
// from the raw message) instead of refetching — worked while every
// host-visible change (start/advance/join) reliably called
// broadcastGameState, but student_led's per-participant progress changes
// on every answer, not on any host action, so nothing ever re-broadcast
// and the host's view froze on its very first snapshot forever (state,
// once non-null, permanently shadowed the polling fallback below — there
// was no path back to polling). Fixed to match usePlayerGameStateRealtime's
// already-correct pattern: WS is purely a "refetch now" nudge, polling
// (1200ms) is the only source of truth, so a missed broadcast just means
// a slightly slower update instead of a permanently stale one.
export function useHostGameStateRealtime(sessionId: string) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fallbackQuery = useHostGameState(sessionId)
  const refetchRef = useRef(fallbackQuery.refetch)
  refetchRef.current = fallbackQuery.refetch

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
  }, [sessionId])

  return {
    data: fallbackQuery.data,
    isLoading: fallbackQuery.isLoading,
    error: error ?? fallbackQuery.error,
    connected,
    refetch: fallbackQuery.refetch,
  }
}

// This never accepts a raw state payload over the
// socket — the server only ever sends a player {type: 'state:changed'}
// notification (see ws-server.ts), never the host-shaped broadcast state,
// because a player's correct view (myScore, hasAnsweredCurrent, the
// answer key hidden until reveal) can only be computed per-player by
// getPlayerStateFn. The socket's only job here is to trigger an immediate
// refetch instead of waiting out the polling interval.
// Guests skip the WebSocket entirely — the WS layer is cookie-session-auth
// only (see app/lib/ws-server.ts) and player state is already fully
// correct via polling alone (usePlayerGameStateRealtime itself only ever
// treats WS messages as a "refetch now" nudge, never a data source). A
// guest gets ~1.2s of extra latency instead of an instant push; same
// shape as usePlayerGameStateRealtime so callers don't need to branch.
export function useGuestPlayerState(sessionId: string, participantId: string) {
  const query = useQuery({
    queryKey: ['games', 'play-guest', sessionId, participantId],
    queryFn: () => getGuestPlayerStateFn({ data: { sessionId, participantId } }),
    refetchInterval: 1200,
    retry: false,
    enabled: !!sessionId && !!participantId,
  })
  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    connected: true,
    refetch: query.refetch,
  }
}

export function usePlayerGameStateRealtime(sessionId: string, participantId: string, enabled = true) {
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fallbackQuery = usePlayerGameState(sessionId, enabled)
  const refetchRef = useRef(fallbackQuery.refetch)
  refetchRef.current = fallbackQuery.refetch

  useEffect(() => {
    if (!enabled || !sessionId || !participantId) return
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
  }, [sessionId, participantId, enabled])

  return {
    data: fallbackQuery.data,
    isLoading: fallbackQuery.isLoading,
    error: error ?? fallbackQuery.error,
    connected,
    refetch: fallbackQuery.refetch,
  }
}
