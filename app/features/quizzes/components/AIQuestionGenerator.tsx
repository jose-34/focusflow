import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Sparkles, Upload } from 'lucide-react'
import { useGenerateQuestionsFromDocument } from '@/features/quizzes/hooks/useQuizzes'
import { ACCEPTED_EXTENSIONS, fileToBase64, validateDocumentFile } from '@/features/quizzes/documentUpload'
import { AIProcessingScreen } from '@/features/quizzes/components/AIProcessingScreen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
    const error = validateDocumentFile(selected)
    if (error) {
      toast.error(error)
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
        Upload a PDF, Word doc, text file, or image, and AI reads it and adds multiple-choice questions to this quiz.
      </p>
      {isPending ? (
        <AIProcessingScreen />
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 space-y-2" style={{ minWidth: 200 }}>
            <Label htmlFor="ai-doc-upload">Document</Label>
            <Input id="ai-doc-upload" ref={fileInputRef} type="file" accept={ACCEPTED_EXTENSIONS} onChange={handleFileChange} />
          </div>
          <div className="w-24 space-y-2">
            <Label htmlFor="ai-question-count">Questions</Label>
            <Input id="ai-question-count" type="number" min={1} max={20} value={questionCount} onChange={(e) => setQuestionCount(e.target.value)} />
          </div>
          <Button size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleGenerate} disabled={!file}>
            <Upload className="size-3.5" />
            Generate Questions
          </Button>
        </div>
      )}
    </div>
  )
}
