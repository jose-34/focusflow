import { useEffect, useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, Trophy, XCircle } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { usePlayerGameStateRealtime, useSubmitGameAnswer } from '@/features/games/hooks/useGames'
import { AnswerButton } from '@/features/games/components/AnswerButton'
import { CountdownTimer } from '@/features/games/components/CountdownTimer'
import { LiveLeaderboard } from '@/features/games/components/LiveLeaderboard'
import { PodiumScene } from '@/features/games/components/PodiumScene'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/game/play/$sessionId')({
  validateSearch: (search: Record<string, unknown>) => ({
    participantId: typeof search.participantId === 'string' ? search.participantId : undefined,
  }),
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: PlayGamePage,
})

function PlayGamePage() {
  const { sessionId } = Route.useParams()
  const { participantId } = Route.useSearch()
  const { data: game, isLoading, error } = usePlayerGameStateRealtime(sessionId, participantId ?? '')
  const submitAnswer = useSubmitGameAnswer()
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedChoiceId(null)
  }, [game?.currentQuestionIndex])

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
        <p className="text-sm text-muted-foreground">Game not found, or it has already ended.</p>
        <Button variant="outline" className="mt-4 gap-2" asChild>
          <Link to="/game/join">
            <ArrowLeft className="size-4" />
            Join Another Game
          </Link>
        </Button>
      </div>
    )
  }

  async function handleAnswer(choiceId: string) {
    if (!game || game.hasAnsweredCurrent || !game.currentQuestion) return
    setSelectedChoiceId(choiceId)
    try {
      await submitAnswer.mutateAsync({ sessionId, questionId: game.currentQuestion.id, selectedChoiceId: choiceId })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit answer')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
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
            <h2 className="mb-2 font-heading text-xl font-bold text-foreground">You&apos;re in!</h2>
            <p className="mb-6 text-sm text-muted-foreground">Waiting for the host to start the game…</p>
            <div className="flex flex-wrap justify-center gap-2">
              {game.lobbyParticipants.map((p) => (
                <Badge key={p.id} variant="outline" className="px-3 py-1.5 text-sm">
                  {p.nickname}
                </Badge>
              ))}
            </div>
          </motion.div>
        )}

        {game.status === 'question' && game.currentQuestion && (
          <motion.div key="question" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mb-4 flex items-center justify-between">
              <Badge variant="outline">Question {game.currentQuestionIndex + 1} / {game.totalQuestions}</Badge>
              <CountdownTimer phaseStartedAt={game.phaseStartedAt} durationSeconds={game.questionDurationSeconds} />
            </div>
            <h2 className="mb-6 text-center font-heading text-xl font-bold text-foreground">{game.currentQuestion.questionText}</h2>

            {game.hasAnsweredCurrent ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">Answer locked in — waiting for other players…</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {game.currentQuestion.choices.map((choice, i) => (
                  <AnswerButton
                    key={choice.id}
                    index={i}
                    label={choice.choiceText}
                    selected={selectedChoiceId === choice.id}
                    onClick={() => handleAnswer(choice.id)}
                    disabled={submitAnswer.isPending}
                  />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {game.status === 'reveal' && game.currentQuestion && (
          <motion.div key="reveal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {game.myLastAnswer ? (
              <div className="mb-6 flex flex-col items-center gap-2 text-center">
                {game.myLastAnswer.isCorrect ? (
                  <>
                    <CheckCircle2 className="size-14 text-primary" />
                    <p className="font-heading text-2xl font-bold text-primary">+{game.myLastAnswer.pointsAwarded} points!</p>
                  </>
                ) : (
                  <>
                    <XCircle className="size-14 text-destructive" />
                    <p className="font-heading text-xl font-bold text-destructive">Not quite</p>
                  </>
                )}
              </div>
            ) : (
              <p className="mb-6 text-center text-sm text-muted-foreground">Time&apos;s up — no answer submitted.</p>
            )}

            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {game.currentQuestion.choices.map((choice, i) => (
                <AnswerButton
                  key={choice.id}
                  index={i}
                  label={choice.choiceText}
                  disabled
                  reveal={choice.isCorrect ? 'correct' : 'neutral'}
                />
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-base text-foreground">Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <LiveLeaderboard entries={game.leaderboard} highlightId={game.myParticipantId} limit={5} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {game.status === 'finished' && (
          <motion.div key="finished" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="mb-4 text-center font-heading text-2xl font-bold text-foreground">Game Over!</h2>
            <div className="mx-auto mb-6 h-56 w-full max-w-md">
              <PodiumScene />
            </div>
            <p className="mb-4 text-center text-sm text-muted-foreground">
              Your final score: <span className="font-semibold text-foreground">{game.myScore.toLocaleString()}</span>
            </p>
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-base text-foreground">Final Results</CardTitle>
              </CardHeader>
              <CardContent>
                <LiveLeaderboard entries={game.leaderboard} highlightId={game.myParticipantId} />
              </CardContent>
            </Card>
            <Button variant="outline" className="mt-6 w-full gap-2" asChild>
              <Link to="/classes">
                <ArrowLeft className="size-4" />
                Back to Classes
              </Link>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
