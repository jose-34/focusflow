import { useEffect, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, LoaderCircle } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useWellness } from '@/features/wellness/hooks/useWellness'
import { BreathingExercise } from '@/features/wellness/components/BreathingExercise'
import { CRISIS_RESOURCES } from '@/features/wellness/crisisResources'
import { HeartHandshake } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/wellness')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: WellnessPage,
})

const MOODS = [
  { value: 1, emoji: '😞', label: 'Struggling' },
  { value: 2, emoji: '😕', label: 'Not great' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

const TIPS = [
  'Taking a 5-minute break every 25 minutes helps your brain consolidate what you just learned.',
  'Drinking water before a study session improves concentration — dehydration shows up as fatigue first.',
  'Writing down tomorrow\'s top 3 tasks tonight reduces the mental load of remembering them.',
  'A short walk between study sessions can boost creative thinking more than staying seated.',
  'Naming how you feel (even just to yourself) measurably reduces the intensity of stress.',
  'Studying the same material in two different places helps you remember it more easily later.',
]

function WellnessPage() {
  const { checkIn, isCheckingIn, todaysLog, logs } = useWellness()
  const [selectedMood, setSelectedMood] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  async function handleCheckIn() {
    if (!selectedMood) return
    try {
      await checkIn({ mood: selectedMood, notes: notes || undefined })
      toast.success('Check-in saved')
      setNotes('')
    } catch {
      toast.error('Failed to save check-in')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 font-heading text-2xl font-semibold text-foreground">Wellness</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">How are you feeling today?</CardTitle>
          {todaysLog && <CardDescription>You already checked in today — you can update it below.</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between gap-2">
            {MOODS.map((mood) => (
              <button
                key={mood.value}
                type="button"
                onClick={() => setSelectedMood(mood.value)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-1 rounded-lg border px-2 py-3 transition-colors',
                  selectedMood === mood.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border bg-background hover:bg-secondary',
                )}
              >
                <span className="text-2xl">{mood.emoji}</span>
                <span className="text-[10px] text-muted-foreground">{mood.label}</span>
              </button>
            ))}
          </div>
          <Textarea
            placeholder="Anything on your mind? (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
          <Button
            onClick={handleCheckIn}
            disabled={!selectedMood || isCheckingIn}
            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isCheckingIn && <LoaderCircle className="size-4 animate-spin" />}
            Save Check-in
          </Button>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="font-heading text-base text-foreground">Wellness Tip</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setTipIndex((i) => (i + 1) % TIPS.length)} aria-label="Next tip">
            <ChevronRight className="size-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <AnimatePresence mode="wait">
            <motion.p
              key={tipIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="text-sm text-muted-foreground"
            >
              {TIPS[tipIndex]}
            </motion.p>
          </AnimatePresence>
        </CardContent>
      </Card>

      <Card className="mb-6 border-accent/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-base text-foreground">
            <HeartHandshake className="size-4 text-accent" />
            If you need to talk to someone
          </CardTitle>
          <CardDescription>
            Your check-ins here are private — not even your teacher sees them. If something is seriously wrong, please reach out directly:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {CRISIS_RESOURCES.map((resource) => (
            <div key={resource.name} className="rounded-md border border-border bg-background px-3 py-2">
              <p className="text-sm font-medium text-foreground">{resource.name}</p>
              <p className="text-sm text-accent">{resource.contact}</p>
              <p className="text-xs text-muted-foreground">{resource.description}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-heading text-base text-foreground">4-7-8 Breathing</CardTitle>
          <CardDescription>Inhale for 4 seconds, hold for 7, exhale for 8. Repeat a few times.</CardDescription>
        </CardHeader>
        <CardContent>
          <BreathingExercise />
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base text-foreground">Recent Check-ins</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
                <span className="text-lg">{MOODS.find((m) => m.value === log.mood)?.emoji}</span>
                <span className="flex-1 px-3 text-xs text-muted-foreground">{log.notes}</span>
                <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
