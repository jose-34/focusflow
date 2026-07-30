import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { LoaderCircle, Gamepad2 } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useJoinGame } from '@/features/games/hooks/useGames'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export const Route = createFileRoute('/game/join')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: JoinGamePage,
})

function JoinGamePage() {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const joinMutation = useJoinGame()

  async function handleJoin() {
    if (pin.trim().length !== 6) return
    try {
      const result = await joinMutation.mutateAsync(pin.trim())
      navigate({ to: '/game/play/$sessionId', params: { sessionId: result.sessionId }, search: { participantId: result.participantId } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to join game')
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Gamepad2 className="size-7" />
          </div>
          <CardTitle className="font-heading text-xl text-foreground">Join a Live Game</CardTitle>
          <CardDescription>Enter the PIN your teacher shared</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="000000"
            value={pin}
            maxLength={6}
            inputMode="numeric"
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            className="h-14 text-center font-mono text-2xl tracking-[0.3em]"
          />
          <Button
            onClick={handleJoin}
            disabled={pin.length !== 6 || joinMutation.isPending}
            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {joinMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
            Join Game
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
