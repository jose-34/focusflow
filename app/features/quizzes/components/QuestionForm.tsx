import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, LoaderCircle, Plus, Square, SquareCheck, Trash2 } from 'lucide-react'
import { isChoiceBasedType, isManualGradingType, type QuestionAnswerConfig, type QuestionTypeValue } from '@/features/quizzes/questionTypes'
import type { CreateQuestionInput } from '@/features/quizzes/schemas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const TYPE_LABELS: Record<QuestionTypeValue, string> = {
  multiple_choice: 'Multiple Choice',
  true_false: 'True / False',
  multi_select: 'Multi-Select',
  fill_blank: 'Fill in the Blank',
  poll: 'Poll (no correct answer)',
  open_ended: 'Open-Ended',
  match: 'Match',
  reorder: 'Reorder',
  categorize: 'Categorize',
  dropdown: 'Dropdown',
  table_fill: 'Table Fill-in',
  audio_response: 'Audio Response',
  video_response: 'Video Response',
  draw: 'Draw',
  hotspot: 'Hotspot',
  math_response: 'Math Response',
  graphing: 'Graphing',
}

type Choice = { choiceText: string; isCorrect: boolean }

function ChoiceEditor({ questionType, choices, setChoices }: { questionType: QuestionTypeValue; choices: Array<Choice>; setChoices: (c: Array<Choice>) => void }) {
  const isPoll = questionType === 'poll'
  const isMulti = questionType === 'multi_select'
  const isTrueFalse = questionType === 'true_false'
  const maxChoices = isTrueFalse ? 2 : 6
  const minChoices = 2

  function toggleCorrect(index: number) {
    if (isMulti) {
      setChoices(choices.map((c, i) => (i === index ? { ...c, isCorrect: !c.isCorrect } : c)))
    } else {
      setChoices(choices.map((c, i) => ({ ...c, isCorrect: i === index })))
    }
  }

  return (
    <div className="space-y-2">
      <Label>{isPoll ? 'Options' : isMulti ? 'Choices (select all correct)' : 'Choices (select the correct one)'}</Label>
      {choices.map((choice, index) => (
        <div key={index} className="flex items-center gap-2">
          {!isPoll && (
            <button
              type="button"
              onClick={() => toggleCorrect(index)}
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                choice.isCorrect ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent',
              )}
            >
              {isMulti ? (choice.isCorrect ? <SquareCheck className="size-4" /> : <Square className="size-4" />) : <CheckCircle2 className="size-4" />}
            </button>
          )}
          <Input
            value={choice.choiceText}
            onChange={(e) => setChoices(choices.map((c, i) => (i === index ? { ...c, choiceText: e.target.value } : c)))}
            placeholder={isTrueFalse ? (index === 0 ? 'True' : 'False') : `Choice ${index + 1}`}
            disabled={isTrueFalse}
          />
          {!isTrueFalse && choices.length > minChoices && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={() => {
                const next = choices.filter((_, i) => i !== index)
                if (!isMulti && !isPoll && !next.some((c) => c.isCorrect)) next[0].isCorrect = true
                setChoices(next)
              }}
            >
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      ))}
      {!isTrueFalse && choices.length < maxChoices && (
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setChoices([...choices, { choiceText: '', isCorrect: false }])}>
          <Plus className="size-3.5" />
          Add {isPoll ? 'option' : 'choice'}
        </Button>
      )}
    </div>
  )
}

function FillBlankEditor({ answers, setAnswers, caseSensitive, setCaseSensitive }: { answers: Array<string>; setAnswers: (a: Array<string>) => void; caseSensitive: boolean; setCaseSensitive: (v: boolean) => void }) {
  return (
    <div className="space-y-2">
      <Label>Accepted answers</Label>
      {answers.map((answer, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input value={answer} onChange={(e) => setAnswers(answers.map((a, i) => (i === index ? e.target.value : a)))} placeholder={`Accepted answer ${index + 1}`} />
          {answers.length > 1 && (
            <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setAnswers(answers.filter((_, i) => i !== index))}>
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setAnswers([...answers, ''])}>
          <Plus className="size-3.5" />
          Add accepted answer
        </Button>
        <button type="button" onClick={() => setCaseSensitive(!caseSensitive)} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {caseSensitive ? <SquareCheck className="size-3.5" /> : <Square className="size-3.5" />}
          Case-sensitive
        </button>
      </div>
    </div>
  )
}

function MatchEditor({ pairs, setPairs }: { pairs: Array<{ left: string; right: string }>; setPairs: (p: Array<{ left: string; right: string }>) => void }) {
  return (
    <div className="space-y-2">
      <Label>Pairs to match</Label>
      {pairs.map((pair, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input value={pair.left} onChange={(e) => setPairs(pairs.map((p, i) => (i === index ? { ...p, left: e.target.value } : p)))} placeholder="Left" />
          <Input value={pair.right} onChange={(e) => setPairs(pairs.map((p, i) => (i === index ? { ...p, right: e.target.value } : p)))} placeholder="Right" />
          {pairs.length > 2 && (
            <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setPairs(pairs.filter((_, i) => i !== index))}>
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1" onClick={() => setPairs([...pairs, { left: '', right: '' }])}>
        <Plus className="size-3.5" />
        Add pair
      </Button>
    </div>
  )
}

function ReorderEditor({ items, setItems }: { items: Array<string>; setItems: (i: Array<string>) => void }) {
  return (
    <div className="space-y-2">
      <Label>Steps, in the correct order</Label>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs text-muted-foreground">{index + 1}</span>
          <Input value={item} onChange={(e) => setItems(items.map((it, i) => (i === index ? e.target.value : it)))} placeholder={`Step ${index + 1}`} />
          {items.length > 2 && (
            <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setItems(items.filter((_, i) => i !== index))}>
              <Trash2 className="size-3.5 text-muted-foreground" />
            </Button>
          )}
        </div>
      ))}
      <Button variant="outline" size="sm" className="gap-1" onClick={() => setItems([...items, ''])}>
        <Plus className="size-3.5" />
        Add step
      </Button>
    </div>
  )
}

function CategorizeEditor({
  categories,
  setCategories,
  items,
  setItems,
}: {
  categories: Array<string>
  setCategories: (c: Array<string>) => void
  items: Array<{ text: string; category: string }>
  setItems: (i: Array<{ text: string; category: string }>) => void
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Categories</Label>
        {categories.map((category, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input value={category} onChange={(e) => setCategories(categories.map((c, i) => (i === index ? e.target.value : c)))} placeholder={`Category ${index + 1}`} />
            {categories.length > 2 && (
              <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setCategories(categories.filter((_, i) => i !== index))}>
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            )}
          </div>
        ))}
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setCategories([...categories, ''])}>
          <Plus className="size-3.5" />
          Add category
        </Button>
      </div>
      <div className="space-y-2">
        <Label>Items to sort</Label>
        {items.map((item, index) => (
          <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input value={item.text} onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, text: e.target.value } : it)))} placeholder="Item" />
            <div className="flex items-center gap-2">
              <Select value={item.category} onValueChange={(v) => setItems(items.map((it, i) => (i === index ? { ...it, category: v } : it)))}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.filter(Boolean).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {items.length > 1 && (
                <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                  <Trash2 className="size-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setItems([...items, { text: '', category: categories[0] ?? '' }])}>
          <Plus className="size-3.5" />
          Add item
        </Button>
      </div>
    </div>
  )
}

function TableFillEditor({
  rows,
  setRows,
  columns,
  setColumns,
  answers,
  setAnswers,
}: {
  rows: Array<string>
  setRows: (r: Array<string>) => void
  columns: Array<string>
  setColumns: (c: Array<string>) => void
  answers: Record<string, string>
  setAnswers: (a: Record<string, string>) => void
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Rows</Label>
          {rows.map((row, index) => (
            <Input key={index} value={row} onChange={(e) => setRows(rows.map((r, i) => (i === index ? e.target.value : r)))} placeholder={`Row ${index + 1}`} />
          ))}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setRows([...rows, ''])}>
            <Plus className="size-3.5" />
            Add row
          </Button>
        </div>
        <div className="space-y-2">
          <Label>Columns</Label>
          {columns.map((col, index) => (
            <Input key={index} value={col} onChange={(e) => setColumns(columns.map((c, i) => (i === index ? e.target.value : c)))} placeholder={`Column ${index + 1}`} />
          ))}
          <Button variant="outline" size="sm" className="gap-1" onClick={() => setColumns([...columns, ''])}>
            <Plus className="size-3.5" />
            Add column
          </Button>
        </div>
      </div>
      {rows.filter(Boolean).length > 0 && columns.filter(Boolean).length > 0 && (
        <div className="space-y-2">
          <Label>Correct answer per cell</Label>
          {rows
            .filter(Boolean)
            .map((row) =>
              columns
                .filter(Boolean)
                .map((col) => (
                  <div key={`${row}|${col}`} className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-2">
                    <span className="text-xs text-muted-foreground sm:w-32 sm:shrink-0 sm:truncate sm:text-sm">
                      {row} × {col}
                    </span>
                    <Input
                      value={answers[`${row}|${col}`] ?? ''}
                      onChange={(e) => setAnswers({ ...answers, [`${row}|${col}`]: e.target.value })}
                      placeholder="Correct answer"
                    />
                  </div>
                )),
            )}
        </div>
      )}
    </div>
  )
}

// Shared by both the teacher (class-owned) and admin (classless, public)
// quiz editors — one dispatcher rendering per-type-family fields, keyed on
// the selected questionType. Choice-based types (multiple_choice,
// true_false, multi_select) share ChoiceEditor; manual-grading types
// (audio/video response, draw, hotspot, math response, graphing) need only
// the question text itself — the teacher grades the actual submission.
export function QuestionForm({
  onSubmit,
  isSubmitting,
  onCancel,
}: {
  onSubmit: (input: Omit<CreateQuestionInput, 'quizId'>) => Promise<void>
  isSubmitting: boolean
  onCancel: () => void
}) {
  const [questionText, setQuestionText] = useState('')
  const [questionType, setQuestionType] = useState<QuestionTypeValue>('multiple_choice')
  const [points, setPoints] = useState('1')
  const [choices, setChoices] = useState<Array<Choice>>([
    { choiceText: '', isCorrect: true },
    { choiceText: '', isCorrect: false },
  ])
  const [fillAnswers, setFillAnswers] = useState([''])
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [sampleAnswer, setSampleAnswer] = useState('')
  const [pairs, setPairs] = useState([
    { left: '', right: '' },
    { left: '', right: '' },
  ])
  const [reorderItems, setReorderItems] = useState(['', ''])
  const [categories, setCategories] = useState(['', ''])
  const [categorizeItems, setCategorizeItems] = useState<Array<{ text: string; category: string }>>([])
  const [tableRows, setTableRows] = useState([''])
  const [tableColumns, setTableColumns] = useState([''])
  const [tableAnswers, setTableAnswers] = useState<Record<string, string>>({})

  function changeType(next: QuestionTypeValue) {
    setQuestionType(next)
    if (next === 'true_false') {
      setChoices([
        { choiceText: 'True', isCorrect: true },
        { choiceText: 'False', isCorrect: false },
      ])
    } else if (next === 'multi_select' || next === 'poll') {
      // Neither should carry over a stale "first choice correct" default
      // from multiple_choice — multi_select needs the teacher to
      // explicitly pick every correct choice, and poll has no correct
      // choice at all.
      setChoices(choices.map((c) => ({ ...c, isCorrect: false })))
    } else if (isChoiceBasedType(next) && choices.length < 2) {
      setChoices([
        { choiceText: '', isCorrect: true },
        { choiceText: '', isCorrect: false },
      ])
    }
  }

  function buildAnswerConfig(): QuestionAnswerConfig | undefined {
    switch (questionType) {
      case 'fill_blank':
        return { kind: 'fill_blank', acceptedAnswers: fillAnswers.filter((a) => a.trim()), caseSensitive }
      case 'open_ended':
        return { kind: 'open_ended', sampleAnswer: sampleAnswer.trim() || undefined }
      case 'match':
        return { kind: 'match', pairs: pairs.filter((p) => p.left.trim() && p.right.trim()) }
      case 'reorder':
        return { kind: 'reorder', correctOrder: reorderItems.filter((i) => i.trim()) }
      case 'categorize':
        return { kind: 'categorize', categories: categories.filter((c) => c.trim()), items: categorizeItems.filter((i) => i.text.trim() && i.category.trim()) }
      case 'table_fill':
        return { kind: 'table_fill', rows: tableRows.filter(Boolean), columns: tableColumns.filter(Boolean), answers: tableAnswers }
      default:
        return isManualGradingType(questionType) ? { kind: 'manual' } : undefined
    }
  }

  async function handleSubmit() {
    if (!questionText.trim()) {
      toast.error('Fill in the question text')
      return
    }
    if (isChoiceBasedType(questionType) && choices.some((c) => !c.choiceText.trim())) {
      toast.error('Fill in all choice fields')
      return
    }

    await onSubmit({
      questionText: questionText.trim(),
      questionType,
      points: Number(points) || 1,
      choices: isChoiceBasedType(questionType) ? choices : undefined,
      answerConfig: buildAnswerConfig(),
    })
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-secondary/30 p-3">
      <div className="space-y-2">
        <Label>Question</Label>
        <Textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="Question text or instructions" rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={questionType} onValueChange={(v) => changeType(v as QuestionTypeValue)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Points</Label>
          <Input type="number" min={1} max={100} value={points} onChange={(e) => setPoints(e.target.value)} />
        </div>
      </div>

      {isChoiceBasedType(questionType) && <ChoiceEditor questionType={questionType} choices={choices} setChoices={setChoices} />}
      {questionType === 'fill_blank' && <FillBlankEditor answers={fillAnswers} setAnswers={setFillAnswers} caseSensitive={caseSensitive} setCaseSensitive={setCaseSensitive} />}
      {questionType === 'open_ended' && (
        <div className="space-y-2">
          <Label>Sample answer (optional, for your reference when grading)</Label>
          <Textarea value={sampleAnswer} onChange={(e) => setSampleAnswer(e.target.value)} rows={2} />
        </div>
      )}
      {questionType === 'match' && <MatchEditor pairs={pairs} setPairs={setPairs} />}
      {questionType === 'reorder' && <ReorderEditor items={reorderItems} setItems={setReorderItems} />}
      {questionType === 'categorize' && (
        <CategorizeEditor categories={categories} setCategories={setCategories} items={categorizeItems} setItems={setCategorizeItems} />
      )}
      {questionType === 'table_fill' && (
        <TableFillEditor rows={tableRows} setRows={setTableRows} columns={tableColumns} setColumns={setTableColumns} answers={tableAnswers} setAnswers={setTableAnswers} />
      )}
      {questionType === 'dropdown' && (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Dropdown authoring isn't available yet in the manual editor — use AI generation for this type, or pick a different question type.
        </p>
      )}
      {isManualGradingType(questionType) && (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Students submit a {TYPE_LABELS[questionType].toLowerCase()} response — you'll grade it yourself from the quiz's grading queue after they submit.
        </p>
      )}

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
