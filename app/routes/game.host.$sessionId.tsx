import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { ArrowLeft, ClipboardList, LoaderCircle, Play, Users } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useAdvancePhase, useHostGameStateRealtime, useStartGame } from '@/features/games/hooks/useGames'
import { AnswerButton } from '@/features/games/components/AnswerButton'
import { CountdownTimer } from '@/features/games/components/CountdownTimer'
import { LiveLeaderboard } from '@/features/games/components/LiveLeaderboard'
import { PodiumScene } from '@/features/games/components/PodiumScene'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/game/host/$sessionId')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'teacher') {
      throw redirect({ to: '/classes' })
    }
  },
  component: HostGamePage,
})

function HostGamePage() {
  const { sessionId } = Route.useParams()
  const { data: game, isLoading, error, connected } = useHostGameStateRealtime(sessionId)
  const startGame = useStartGame()
  const advancePhase = useAdvancePhase()

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
        <p className="text-sm text-muted-foreground">Game session not found.</p>
        <Button variant="outline" className="mt-4 gap-2" asChild>
          <Link to="/classes">
            <ArrowLeft className="size-4" />
            Back to Classes
          </Link>
        </Button>
      </div>
    )
  }

  async function handleStart() {
    try {
      await startGame.mutateAsync(sessionId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start game')
    }
  }

  async function handleAdvance() {
    try {
      await advancePhase.mutateAsync(sessionId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to advance')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-foreground">Hosting Live Game</h2>
        <span className={`flex items-center gap-1.5 text-xs ${connected ? 'text-primary' : 'text-muted-foreground'}`}>
          <span className={`size-2 rounded-full ${connected ? 'bg-primary' : 'bg-muted-foreground'}`} />
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
      </div>
      <AnimatePresence mode="wait">
        {game.status === 'lobby' && (
          <motion.div key="lobby" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mb-8 text-center">
              <p className="text-sm text-muted-foreground">Game PIN</p>
              <p className="font-heading text-6xl font-bold tracking-[0.2em] text-primary">{game.pin}</p>
              <p className="mt-2 text-sm text-muted-foreground">Students go to Play &rarr; enter this PIN</p>
            </div>

            <Card className="mb-6">
              <CardHeader className="flex flex-row items-center gap-2">
                <Users className="size-4 text-accent" />
                <CardTitle className="font-heading text-base text-foreground">
                  Players joined ({game.participants.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {game.participants.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">Waiting for players to join…</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <AnimatePresence>
                      {game.participants.map((p) => (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                        >
                          <Badge variant="outline" className="px-3 py-1.5 text-sm">
                            {p.nickname}
                          </Badge>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>

            <Button
              onClick={handleStart}
              disabled={game.participants.length === 0 || startGame.isPending}
              size="lg"
              className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {startGame.isPending ? <LoaderCircle className="size-5 animate-spin" /> : <Play className="size-5" />}
              Start Game
            </Button>
          </motion.div>
        )}

        {game.status === 'question' && game.currentQuestion && (
          <motion.div key="question" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mb-4 flex items-center justify-between">
              <Badge variant="outline">
                Question {game.currentQuestionIndex + 1} / {game.totalQuestions}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {game.answeredCount} / {game.participants.length} answered
              </span>
              <CountdownTimer phaseStartedAt={game.phaseStartedAt} durationSeconds={game.questionDurationSeconds} />
            </div>
            <Card className="mb-6">
              <CardContent className="py-8 text-center">
                <h2 className="font-heading text-2xl font-bold text-foreground">{game.currentQuestion.questionText}</h2>
              </CardContent>
            </Card>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {game.currentQuestion.choices.map((choice, i) => (
                <AnswerButton key={choice.id} index={i} label={choice.choiceText} disabled />
              ))}
            </div>
            <Button variant="outline" className="mt-6 w-full" onClick={handleAdvance} disabled={advancePhase.isPending}>
              Skip to Reveal
            </Button>
          </motion.div>
        )}

        {game.status === 'reveal' && game.currentQuestion && (
          <motion.div key="reveal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mb-4 flex items-center justify-between">
              <Badge variant="outline">
                Question {game.currentQuestionIndex + 1} / {game.totalQuestions}
              </Badge>
              <span className="text-sm text-muted-foreground">{game.answeredCount} answered</span>
            </div>
            <Card className="mb-6">
              <CardContent className="py-6 text-center">
                <h2 className="font-heading text-xl font-bold text-foreground">{game.currentQuestion.questionText}</h2>
              </CardContent>
            </Card>
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {game.currentQuestion.choices.map((choice, i) => (
                <div key={choice.id} className="relative">
                  <AnswerButton
                    index={i}
                    label={choice.choiceText}
                    disabled
                    reveal={choice.isCorrect ? 'correct' : 'neutral'}
                  />
                  <span className="absolute right-3 bottom-1 text-xs font-semibold text-white/80">
                    {game.choiceCounts[choice.id] ?? 0}
                  </span>
                </div>
              ))}
            </div>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="font-heading text-base text-foreground">Leaderboard</CardTitle>
              </CardHeader>
              <CardContent>
                <LiveLeaderboard entries={game.participants} limit={5} />
              </CardContent>
            </Card>
            <Button
              onClick={handleAdvance}
              disabled={advancePhase.isPending}
              size="lg"
              className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {advancePhase.isPending && <LoaderCircle className="size-4 animate-spin" />}
              {game.currentQuestionIndex + 1 >= game.totalQuestions ? 'Finish Game' : 'Next Question'}
            </Button>
          </motion.div>
        )}

        {game.status === 'finished' && (
          <motion.div key="finished" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <h2 className="mb-4 text-center font-heading text-2xl font-bold text-foreground">Game Over!</h2>
            <div className="mx-auto mb-6 h-64 w-full max-w-md">
              <PodiumScene />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="font-heading text-base text-foreground">Final Results</CardTitle>
              </CardHeader>
              <CardContent>
                <LiveLeaderboard entries={game.participants} />
              </CardContent>
            </Card>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1 gap-2" asChild>
                <Link to="/classes">
                  <ArrowLeft className="size-4" />
                  Back to Classes
                </Link>
              </Button>
              <Button className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                <Link to="/reports/$sessionId" params={{ sessionId }}>
                  <ClipboardList className="size-4" />
                  View Full Report
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
