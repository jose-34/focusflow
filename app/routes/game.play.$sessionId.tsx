import { useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, Trophy, XCircle } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useGuestPlayerState, usePlayerGameStateRealtime, useSubmitGameAnswer, useSubmitGameAnswerAsGuest } from '@/features/games/hooks/useGames'
import { useTranslation } from '@/features/i18n/I18nContext'
import { AvatarDisplay } from '@/features/economy/components/AvatarDisplay'
import { CountdownTimer } from '@/features/games/components/CountdownTimer'
import { LiveLeaderboard } from '@/features/games/components/LiveLeaderboard'
import { PodiumScene } from '@/features/games/components/PodiumScene'
import { GameCountdown } from '@/features/games/components/GameCountdown'
import { GameSettingsPanel, speakText } from '@/features/games/components/GameSettingsPanel'
import { getStoredGameTheme, type GameThemeKey } from '@/features/games/gameThemes'
import { PlatformerQuestionScene } from '@/features/gameplay/components/PlatformerQuestionScene'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/game/play/$sessionId')({
  // Deliberately no beforeLoad auth gate — a public-session guest has no
  // account at all. Authorization instead happens per-request: registered
  // students via the normal cookie session, guests via participantId
  // ownership of a guest row (see getGuestPlayerStateFn/
  // submitGameAnswerAsGuestFn in useGames.ts).
  validateSearch: (search: Record<string, unknown>) => ({
    participantId: typeof search.participantId === 'string' ? search.participantId : undefined,
  }),
  component: PlayGamePage,
})

function PlayGamePage() {
  const { sessionId } = Route.useParams()
  const { participantId } = Route.useSearch()
  const navigate = useNavigate()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && !isAuthenticated && !participantId) {
      navigate({ to: '/game/join' })
    }
  }, [authLoading, isAuthenticated, participantId, navigate])

  const registeredState = usePlayerGameStateRealtime(sessionId, participantId ?? '', !authLoading && isAuthenticated)
  const guestState = useGuestPlayerState(sessionId, !authLoading && !isAuthenticated ? (participantId ?? '') : '')
  const { data: game, isLoading: dataLoading, error } = isAuthenticated ? registeredState : guestState
  const isLoading = authLoading || dataLoading
  const submitAnswer = useSubmitGameAnswer()
  const submitAnswerAsGuest = useSubmitGameAnswerAsGuest()
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)
  // student_led has no shared 'reveal' phase — the server already advanced
  // this participant to their next question by the time the mutation
  // resolves, so the reveal (green/red) has to be held locally for a beat
  // before letting the next poll's already-advanced question take over.
  const [studentLedReveal, setStudentLedReveal] = useState<{ correctChoiceId: string | null } | null>(null)
  const { t, language } = useTranslation()
  const [gameTheme, setGameTheme] = useState<GameThemeKey>(() => getStoredGameTheme())
  const [readAloudEnabled, setReadAloudEnabled] = useState(false)
  const [showCountdown, setShowCountdown] = useState(false)
  const hasShownCountdownRef = useRef(false)
  const lastSpokenQuestionIdRef = useRef<string | null>(null)

  useEffect(() => {
    setSelectedChoiceId(null)
  }, [game?.currentQuestionIndex])

  // The 3-2-1-Go overlay plays exactly once, on the very first question of
  // the game — not on every subsequent question transition.
  useEffect(() => {
    if (game?.status === 'question' && game.currentQuestionIndex === 0 && !hasShownCountdownRef.current) {
      hasShownCountdownRef.current = true
      setShowCountdown(true)
    }
  }, [game?.status, game?.currentQuestionIndex])

  useEffect(() => {
    if (!readAloudEnabled || !game?.currentQuestion) return
    if (lastSpokenQuestionIdRef.current === game.currentQuestion.id) return
    lastSpokenQuestionIdRef.current = game.currentQuestion.id
    speakText(game.currentQuestion.questionText, language)
  }, [readAloudEnabled, game?.currentQuestion, language])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
      </div>
    )
  }

  if (error || !game) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">{t('play.notFound')}</p>
        <Button variant="outline" className="mt-4 gap-2" asChild>
          <Link to="/game/join">
            <ArrowLeft className="size-4" />
            {t('play.backToJoin')}
          </Link>
        </Button>
      </div>
    )
  }

  async function handleAnswer(choiceId: string) {
    if (!game || game.hasAnsweredCurrent || !game.currentQuestion || studentLedReveal) return
    setSelectedChoiceId(choiceId)
    try {
      const result = isAuthenticated
        ? await submitAnswer.mutateAsync({ sessionId, questionId: game.currentQuestion.id, selectedChoiceId: choiceId })
        : await submitAnswerAsGuest.mutateAsync({ sessionId, participantId: participantId ?? '', questionId: game.currentQuestion.id, selectedChoiceId: choiceId })

      if (game.pacingMode === 'student_led') {
        setStudentLedReveal({ correctChoiceId: result.correctChoiceId })
        setTimeout(() => {
          setStudentLedReveal(null)
          setSelectedChoiceId(null)
        }, 1300)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('taking.failedToSubmit'))
    }
  }

  return (
    <div data-game-theme={gameTheme} className="game-theme-surface min-h-[calc(100vh-3.5rem)]">
      {showCountdown && <GameCountdown onDone={() => setShowCountdown(false)} />}
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-2 flex justify-end">
          <GameSettingsPanel onThemeChange={setGameTheme} readAloudEnabled={readAloudEnabled} onReadAloudChange={setReadAloudEnabled} />
        </div>

        <AnimatePresence mode="wait">
        {game.status === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-center">
            <div className="mb-6 flex justify-center">
              <motion.div
                animate={{ rotate: [0, 8, -8, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                className="flex size-20 items-center justify-center rounded-full bg-primary/10 text-primary"
              >
                <Trophy className="size-10" />
              </motion.div>
            </div>
            <h2 className="mb-2 font-heading text-xl font-bold text-foreground">{t('play.lobbyTitle')}</h2>
            <p className="mb-6 text-sm text-muted-foreground">{t('play.lobbyWaiting')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {game.lobbyParticipants.map((p) => (
                <Badge key={p.id} variant="outline" className="gap-1.5 px-3 py-1.5 text-sm">
                  <AvatarDisplay sprites={p.sprites} size="sm" />
                  {p.nickname}
                </Badge>
              ))}
            </div>
          </motion.div>
        )}

        {game.status === 'question' && game.pacingMode === 'student_led' && game.currentQuestion && (
          <motion.div key="student-led-question" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <PlatformerQuestionScene
              questionText={game.currentQuestion.questionText}
              choices={game.currentQuestion.choices.map((c) => ({ id: c.id, text: c.choiceText }))}
              questionNumber={game.currentQuestionIndex + 1}
              totalQuestions={game.totalQuestions}
              history={[]}
              selectedChoiceId={selectedChoiceId}
              locked={!!studentLedReveal}
              correctChoiceId={studentLedReveal?.correctChoiceId}
              onSelect={handleAnswer}
              score={game.myScore}
            />
          </motion.div>
        )}

        {game.status === 'question' && game.pacingMode === 'teacher_led' && game.currentQuestion && (
          <motion.div key="question" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mb-3 flex justify-end">
              <CountdownTimer phaseStartedAt={game.phaseStartedAt} durationSeconds={game.questionDurationSeconds} />
            </div>
            <PlatformerQuestionScene
              questionText={game.currentQuestion.questionText}
              choices={game.currentQuestion.choices.map((c) => ({ id: c.id, text: c.choiceText }))}
              questionNumber={game.currentQuestionIndex + 1}
              totalQuestions={game.totalQuestions}
              history={[]}
              selectedChoiceId={selectedChoiceId}
              locked={game.hasAnsweredCurrent}
              onSelect={handleAnswer}
              score={game.myScore}
            />
            {game.hasAnsweredCurrent && <p className="mt-3 text-center text-sm text-muted-foreground">{t('play.answerLocked')}</p>}
          </motion.div>
        )}

        {game.status === 'reveal' && game.currentQuestion && (
          <motion.div key="reveal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {game.myLastAnswer ? (
              <div className="mb-4 flex flex-col items-center gap-2 text-center">
                {game.myLastAnswer.isCorrect ? (
                  <>
                    <CheckCircle2 className="size-14 text-primary" />
                    <p className="font-heading text-2xl font-bold text-primary">{t('play.pointsEarned', { points: game.myLastAnswer.pointsAwarded })}</p>
                  </>
                ) : (
                  <>
                    <XCircle className="size-14 text-destructive" />
                    <p className="font-heading text-xl font-bold text-destructive">{t('play.notQuite')}</p>
                  </>
                )}
              </div>
            ) : (
              <p className="mb-4 text-center text-sm text-muted-foreground">{t('play.timeUp')}</p>
            )}

            <div className="mb-6">
              <PlatformerQuestionScene
                questionText={game.currentQuestion.questionText}
                choices={game.currentQuestion.choices.map((c) => ({ id: c.id, text: c.choiceText }))}
                questionNumber={game.currentQuestionIndex + 1}
                totalQuestions={game.totalQuestions}
                history={[]}
                selectedChoiceId={selectedChoiceId}
                locked
                correctChoiceId={game.currentQuestion.choices.find((c) => c.isCorrect)?.id ?? null}
                onSelect={() => {}}
                score={game.myScore}
              />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-base text-foreground">{t('play.leaderboard')}</CardTitle>
              </CardHeader>
              <CardContent>
                <LiveLeaderboard entries={game.leaderboard} highlightId={game.myParticipantId} limit={5} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {game.status === 'finished' && (
          <motion.div key="finished" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="mb-4 text-center font-heading text-2xl font-bold text-foreground">{t('play.gameOver')}</h2>
            <div className="mx-auto mb-6 h-56 w-full max-w-md">
              <PodiumScene topThree={game.leaderboard.slice(0, 3)} />
            </div>
            <p className="mb-4 text-center text-sm text-muted-foreground">
              {t('play.finalScore')} <span className="font-semibold text-foreground">{game.myScore.toLocaleString()}</span>
            </p>
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-base text-foreground">{t('play.finalResults')}</CardTitle>
              </CardHeader>
              <CardContent>
                <LiveLeaderboard entries={game.leaderboard} highlightId={game.myParticipantId} />
              </CardContent>
            </Card>
            <Button variant="outline" className="mt-6 w-full gap-2" asChild>
              <Link to={isAuthenticated ? '/classes' : '/'}>
                <ArrowLeft className="size-4" />
                {isAuthenticated ? t('play.backToClasses') : 'Back to Home'}
              </Link>
            </Button>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  )
}
