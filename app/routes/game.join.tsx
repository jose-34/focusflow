import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { LoaderCircle, Gamepad2, LogIn } from 'lucide-react'
import { useAuth } from '@/features/auth/hooks/useAuth'
import { useGameSessionAccessMode, useJoinGame, useJoinGameAsGuest } from '@/features/games/hooks/useGames'
import { useTranslation } from '@/features/i18n/I18nContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

// Deliberately reachable while logged out — a public-session guest has no
// account at all, so this route can't gate on auth the way every other
// dashboard route does.
export const Route = createFileRoute('/game/join')({
  component: JoinGamePage,
})

type Step = 'pin' | 'name' | 'needs-account'

function JoinGamePage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [pin, setPin] = useState('')
  const [officialName, setOfficialName] = useState('')
  const [step, setStep] = useState<Step>('pin')
  const accessModeMutation = useGameSessionAccessMode()
  const joinMutation = useJoinGame()
  const joinAsGuestMutation = useJoinGameAsGuest()
  const { t } = useTranslation()

  async function handlePinSubmit() {
    if (pin.trim().length !== 6) return

    if (isAuthenticated) {
      try {
        const result = await joinMutation.mutateAsync(pin.trim())
        navigate({ to: '/game/play/$sessionId', params: { sessionId: result.sessionId }, search: { participantId: result.participantId } })
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t('join.errorDefault'))
      }
      return
    }

    try {
      const result = await accessModeMutation.mutateAsync(pin.trim())
      if (!result.exists) {
        toast.error('No game found with that PIN — it may not have started yet or has already begun')
        return
      }
      setStep(result.accessMode === 'public' ? 'name' : 'needs-account')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('join.errorDefault'))
    }
  }

  async function handleNameSubmit() {
    if (!officialName.trim()) return
    try {
      const result = await joinAsGuestMutation.mutateAsync({ pin: pin.trim(), officialName: officialName.trim() })
      navigate({ to: '/game/play/$sessionId', params: { sessionId: result.sessionId }, search: { participantId: result.participantId } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('join.errorDefault'))
    }
  }

  const pinPending = joinMutation.isPending || accessModeMutation.isPending

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Gamepad2 className="size-7" />
          </div>
          <CardTitle className="font-heading text-xl text-foreground">{t('join.title')}</CardTitle>
          <CardDescription>
            {step === 'name' ? "Enter your official name as your teacher will recognize it." : t('join.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 'pin' && (
            <>
              <Input
                placeholder="000000"
                value={pin}
                maxLength={6}
                inputMode="numeric"
                autoFocus
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
                className="h-14 text-center font-mono text-2xl tracking-[0.3em]"
              />
              <Button
                onClick={handlePinSubmit}
                disabled={pin.length !== 6 || pinPending}
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {pinPending && <LoaderCircle className="size-4 animate-spin" />}
                {t('join.button')}
              </Button>
            </>
          )}

          {step === 'name' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="officialName">Official Name</Label>
                <Input
                  id="officialName"
                  placeholder="First and Last Name"
                  value={officialName}
                  autoFocus
                  onChange={(e) => setOfficialName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
                />
              </div>
              <Button
                onClick={handleNameSubmit}
                disabled={!officialName.trim() || joinAsGuestMutation.isPending}
                className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {joinAsGuestMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
                Start Game
              </Button>
              <button type="button" onClick={() => setStep('pin')} className="w-full text-center text-xs text-muted-foreground underline underline-offset-2">
                Use a different PIN
              </button>
            </>
          )}

          {step === 'needs-account' && (
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-sm text-muted-foreground">
                This game requires a FocusFlow account — log in, or ask your teacher for a public join code.
              </p>
              <Button asChild className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                <Link to="/login">
                  <LogIn className="size-4" />
                  Log In
                </Link>
              </Button>
              <button type="button" onClick={() => setStep('pin')} className="w-full text-center text-xs text-muted-foreground underline underline-offset-2">
                Use a different PIN
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
