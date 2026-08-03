import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Upload } from 'lucide-react'
import { useGenerateQuestionsFromDocument } from '@/features/quizzes/hooks/useQuizzes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const ACCEPTED_EXTENSIONS = '.pdf,.docx,.txt,.png,.jpg,.jpeg,.webp'
const MAX_FILE_BYTES = 8 * 1024 * 1024

const ACCEPTED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/webp',
])

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // FileReader's data URL is "data:<mime>;base64,<data>" — the API
      // wants just the base64 payload.
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// Shared by both the teacher and admin quiz editors — upload a document,
// AI reads it and generates ready-to-review multiple-choice questions
// straight into the quiz's question list.
export function AIQuestionGenerator({ quizId }: { quizId: string }) {
  const [file, setFile] = useState<File | null>(null)
  const [questionCount, setQuestionCount] = useState('5')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { mutateAsync: generate, isPending } = useGenerateQuestionsFromDocument(quizId)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (!ACCEPTED_MIME_TYPES.has(selected.type)) {
      toast.error('Unsupported file type — use PDF, DOCX, TXT, PNG, JPG, or WEBP')
      e.target.value = ''
      return
    }
    if (selected.size > MAX_FILE_BYTES) {
      toast.error('File is too large — please upload a document under 8MB')
      e.target.value = ''
      return
    }
    setFile(selected)
  }

  async function handleGenerate() {
    if (!file) return
    try {
      const fileBase64 = await fileToBase64(file)
      const result = await generate({
        mimeType: file.type as 'application/pdf',
        fileBase64,
        questionCount: Number(questionCount) || 5,
      })
      toast.success(`Added ${result.createdCount} question${result.createdCount === 1 ? '' : 's'} from ${file.name}`)
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate questions')
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-dashed border-accent/40 bg-accent/5 p-3">
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        <Sparkles className="size-4 text-accent" />
        Generate questions from a document
      </div>
      <p className="text-xs text-muted-foreground">
        Upload a PDF, Word doc, text file, or image — AI reads it and adds multiple-choice questions to this quiz.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 space-y-2" style={{ minWidth: 200 }}>
          <Label htmlFor="ai-doc-upload">Document</Label>
          <Input
            id="ai-doc-upload"
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileChange}
            disabled={isPending}
          />
        </div>
        <div className="w-24 space-y-2">
          <Label htmlFor="ai-question-count">Questions</Label>
          <Input
            id="ai-question-count"
            type="number"
            min={1}
            max={20}
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
            disabled={isPending}
          />
        </div>
        <Button
          size="sm"
          className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={handleGenerate}
          disabled={!file || isPending}
        >
          <Upload className="size-3.5" />
          {isPending ? 'Generating…' : 'Generate Questions'}
        </Button>
      </div>
      {isPending && <p className="text-xs text-muted-foreground">This can take up to 30 seconds for longer documents.</p>}
    </div>
  )
}
