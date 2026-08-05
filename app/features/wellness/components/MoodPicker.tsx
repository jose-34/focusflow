import { cn } from '@/lib/utils'

export const MOODS = [
  { value: 1, emoji: '😞', label: 'Struggling' },
  { value: 2, emoji: '😕', label: 'Not great' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

// Compact variant of the emoji row from app/routes/wellness.tsx, for
// embedding a quick optional mood check inside another flow (e.g. before/
// after a quiz) without pulling in that whole page's notes/history UI.
export function MoodPicker({ value, onChange }: { value: number | null; onChange: (mood: number) => void }) {
  return (
    <div className="flex justify-center gap-1.5">
      {MOODS.map((mood) => (
        <button
          key={mood.value}
          type="button"
          onClick={() => onChange(mood.value)}
          title={mood.label}
          aria-label={mood.label}
          aria-pressed={value === mood.value}
          className={cn(
            'flex size-9 items-center justify-center rounded-full border text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            value === mood.value ? 'border-primary bg-primary/10' : 'border-border bg-background hover:bg-secondary',
          )}
        >
          {mood.emoji}
        </button>
      ))}
    </div>
  )
}
