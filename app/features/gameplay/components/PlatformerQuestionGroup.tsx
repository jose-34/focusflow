import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlatformerQuestionScene } from './PlatformerQuestionScene'

export interface PlatformerQuestionGroupEntry {
  id: string
  questionText: string
  choices: Array<{ id: string; text: string }>
  points: number
  selectedChoiceId: string | null
  locked: boolean
  /** undefined = not revealed yet; null = revealed but no correct answer (poll) */
  correctChoiceId?: string | null
}

// Consolidates every platformer-type question in a list-based quiz surface
// (QuizTakingView, QuizPreview) into the ONE shared, persistent
// PlatformerQuestionScene the component was actually designed around —
// see PlatformerQuestionScene.tsx's own top comment. Mounting a fresh scene
// per question (each with its own sky/mountains/ground) was the bug this
// component fixes; live games and the landing-page demo never had it.
export function PlatformerQuestionGroup({
  entries,
  activeStep,
  onStepChange,
  onSelect,
  navDisabled,
  muted,
  onToggleMute,
}: {
  entries: Array<PlatformerQuestionGroupEntry>
  activeStep: number
  onStepChange: (step: number) => void
  onSelect: (entryId: string, choiceId: string) => void
  navDisabled?: boolean
  muted?: boolean
  onToggleMute?: () => void
}) {
  if (entries.length === 0) return null

  const clampedStep = Math.min(Math.max(activeStep, 0), entries.length - 1)
  const current = entries[clampedStep]
  const history = entries.slice(0, clampedStep).map((entry) => entry.locked && entry.correctChoiceId != null && entry.selectedChoiceId === entry.correctChoiceId)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium text-muted-foreground">
          Game question {clampedStep + 1} of {entries.length}
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          ({current.points} pt{current.points === 1 ? '' : 's'})
        </span>
      </div>
      <PlatformerQuestionScene
        questionText={current.questionText}
        choices={current.choices}
        questionNumber={clampedStep + 1}
        totalQuestions={entries.length}
        history={history}
        selectedChoiceId={current.selectedChoiceId}
        locked={current.locked}
        correctChoiceId={current.correctChoiceId}
        onSelect={(choiceId) => onSelect(current.id, choiceId)}
        muted={muted}
        onToggleMute={onToggleMute}
      />
      {entries.length > 1 && (
        <div className="flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => onStepChange(clampedStep - 1)}
            disabled={navDisabled || clampedStep === 0}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            <ChevronLeft className="size-3.5" />
            Previous
          </button>
          <div className="flex items-center gap-1.5">
            {entries.map((entry, index) => (
              <button
                key={entry.id}
                type="button"
                aria-label={`Game question ${index + 1}`}
                onClick={() => onStepChange(index)}
                disabled={navDisabled}
                className={cn(
                  'size-2 rounded-full transition-colors',
                  index === clampedStep ? 'bg-primary' : entry.selectedChoiceId ? 'bg-primary/40' : 'bg-border',
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => onStepChange(clampedStep + 1)}
            disabled={navDisabled || clampedStep === entries.length - 1}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
          >
            Next
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
