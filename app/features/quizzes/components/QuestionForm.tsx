import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { questionTypeValues } from '@/features/quizzes/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Shared by both the teacher (class-owned) and admin (classless, public)
// quiz editors — question/choice authoring is identical either way, only
// what the parent quiz is attached to differs.
export function QuestionForm({
  onSubmit,
  isSubmitting,
  onCancel,
}: {
  onSubmit: (input: {
    questionText: string
    questionType: (typeof questionTypeValues)[number]
    points: number
    choices: Array<{ choiceText: string; isCorrect: boolean }>
  }) => Promise<void>
  isSubmitting: boolean
  onCancel: () => void
}) {
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState<(typeof questionTypeValues)[number]>('multiple_choice')
  const [points, setPoints] = useState('1')
  const [choices, setChoices] = useState([
    { choiceText: '', isCorrect: true },
    { choiceText: '', isCorrect: false },
  ])

  function updateChoiceText(index: number, text: string) {
    setChoices((prev) => prev.map((c, i) => (i === index ? { ...c, choiceText: text } : c)))
  }

  function setCorrectChoice(index: number) {
    setChoices((prev) => prev.map((c, i) => ({ ...c, isCorrect: i === index })))
  }

  function addChoice() {
    if (choices.length >= 6) return
    setChoices((prev) => [...prev, { choiceText: '', isCorrect: false }])
  }

  function removeChoice(index: number) {
    if (choices.length <= 2) return
    setChoices((prev) => {
      const next = prev.filter((_, i) => i !== index)
      if (!next.some((c) => c.isCorrect)) next[0].isCorrect = true
      return next
    })
  }

  async function handleSubmit() {
    if (!questionText.trim() || choices.some((c) => !c.choiceText.trim())) {
      toast.error('Fill in the question and all choice fields')
      return
    }
    await onSubmit({
      questionText: questionText.trim(),
      questionType,
      points: Number(points) || 1,
      choices,
    })
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-3">
      <div className="space-y-2">
        <Label>Question</Label>
        <Input value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Question text" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={questionType} onValueChange={(v) => setQuestionType(v as typeof questionType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
              <SelectItem value="true_false">True / False</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Points</Label>
          <Input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Choices (select the correct one)</Label>
        {choices.map((choice, index) => (
          <div key={index} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCorrectChoice(index)}
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                choice.isCorrect ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent',
              )}
            >
              <CheckCircle2 className="size-4" />
            </button>
            <Input
              value={choice.choiceText}
              onChange={(e) => updateChoiceText(index, e.target.value)}
              placeholder={`Choice ${index + 1}`}
            />
            {choices.length > 2 && (
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => removeChoice(index)}>
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}
        {choices.length < 6 && (
          <Button variant="outline" size="sm" className="gap-1" onClick={addChoice}>
            <Plus className="size-3.5" />
            Add choice
          </Button>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isSubmitting && <LoaderCircle className="size-3.5 animate-spin" />}
          Save Question
        </Button>
      </div>
    </div>
  )
}
