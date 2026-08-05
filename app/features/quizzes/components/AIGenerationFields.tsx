import { FileText, Type } from 'lucide-react'
import { AI_GENERATABLE_QUESTION_TYPES, type AiGeneratableQuestionType } from '@/lib/ai'
import { ACCEPTED_EXTENSIONS } from '@/features/quizzes/documentUpload'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<AiGeneratableQuestionType, string> = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True/False',
  multi_select: 'Multi-Select',
  fill_blank: 'Fill in the Blank',
  match: 'Match',
  reorder: 'Reorder',
  categorize: 'Categorize',
  table_fill: 'Table Fill-in',
}

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'Kiswahili', label: 'Kiswahili' },
  { value: 'French', label: 'French' },
  { value: 'Spanish', label: 'Spanish' },
]

export interface AIGenerationValues {
  mode: 'document' | 'topic'
  file: File | null
  topic: string
  questionCount: string
  dokLevel: '' | '1' | '2' | '3'
  language: string
  questionTypes: Array<AiGeneratableQuestionType>
}

export const defaultAIGenerationValues: AIGenerationValues = {
  mode: 'document',
  file: null,
  topic: '',
  questionCount: '5',
  dokLevel: '',
  language: 'en',
  questionTypes: ['multiple_choice'],
}

function toggleType(current: Array<AiGeneratableQuestionType>, type: AiGeneratableQuestionType): Array<AiGeneratableQuestionType> {
  if (current.includes(type)) {
    const next = current.filter((t) => t !== type)
    return next.length > 0 ? next : current // never allow zero selected
  }
  return [...current, type]
}

// Shared by the admin and teacher "generate a quiz with AI" routes — the
// mode toggle, document/topic input, and generation options (DOK level,
// language, question types) are identical either way; only the
// curriculum/subject/grade context around this differs per caller.
export function AIGenerationFields({
  values,
  onChange,
  disabled,
  onFileChange,
}: {
  values: AIGenerationValues
  onChange: (patch: Partial<AIGenerationValues>) => void
  disabled: boolean
  onFileChange: (file: File | null) => void
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 rounded-md bg-secondary p-1">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ mode: 'document' })}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-sm py-1.5 text-sm font-medium transition-colors',
            values.mode === 'document' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          <FileText className="size-3.5" />
          Upload a document
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ mode: 'topic' })}
          className={cn(
            'flex items-center justify-center gap-1.5 rounded-sm py-1.5 text-sm font-medium transition-colors',
            values.mode === 'topic' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
          )}
        >
          <Type className="size-3.5" />
          Describe a topic
        </button>
      </div>

      {values.mode === 'document' ? (
        <div className="space-y-2">
          <Label htmlFor="ai-doc-upload">Document</Label>
          <Input
            id="ai-doc-upload"
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            disabled={disabled}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="ai-topic">Topic</Label>
          <Textarea
            id="ai-topic"
            value={values.topic}
            onChange={(e) => onChange({ topic: e.target.value })}
            placeholder="e.g. Photosynthesis and the light-dependent reactions"
            rows={2}
            disabled={disabled}
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="ai-question-count">Questions</Label>
          <Input
            id="ai-question-count"
            type="number"
            min={1}
            max={20}
            value={values.questionCount}
            onChange={(e) => onChange({ questionCount: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <Label>Difficulty (DOK level)</Label>
          <Select value={values.dokLevel || undefined} onValueChange={(v) => onChange({ dokLevel: v as '1' | '2' | '3' })} disabled={disabled}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Automatic" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Level 1: Recall</SelectItem>
              <SelectItem value="2">Level 2: Application</SelectItem>
              <SelectItem value="3">Level 3: Strategic thinking</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Output language</Label>
        <Select value={values.language} onValueChange={(v) => onChange({ language: v })} disabled={disabled}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {values.language !== 'en' && (
          <p className="text-xs text-muted-foreground">
            AI-generated non-English content can have translation quirks, so review the questions before publishing.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Question types</Label>
        <div className="flex flex-wrap gap-2">
          {AI_GENERATABLE_QUESTION_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ questionTypes: toggleType(values.questionTypes, type) })}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                values.questionTypes.includes(type)
                  ? 'border-accent bg-accent text-accent-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-secondary/50',
              )}
            >
              {TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
