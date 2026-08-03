import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, LoaderCircle, Sparkles, Upload } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useGenerateClassQuizFromDocument } from '@/features/quizzes/hooks/useQuizzes'
import { ACCEPTED_EXTENSIONS, fileToBase64, validateDocumentFile } from '@/features/quizzes/documentUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/classes/$classId/quizzes/generate')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'teacher') {
      throw redirect({ to: '/classes' })
    }
  },
  component: GenerateQuizPage,
})

function GenerateQuizPage() {
  const { classId } = Route.useParams()
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [questionCount, setQuestionCount] = useState('5')
  const { mutateAsync: generate, isPending } = useGenerateClassQuizFromDocument(classId)

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
      const quiz = await generate({
        mimeType: file.type as 'application/pdf',
        fileBase64,
        questionCount: Number(questionCount) || 5,
      })
      toast.success('Quiz generated — review the questions below')
      navigate({ to: '/classes/$classId/quizzes/$quizId', params: { classId, quizId: quiz.id } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate quiz')
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Button variant="ghost" className="mb-4 gap-2 pl-0" asChild>
        <Link to="/classes/$classId" params={{ classId }}>
          <ArrowLeft className="size-4" />
          Back to Class
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-xl text-foreground">
            <Sparkles className="size-5 text-accent" />
            Generate a Quiz with AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a document — AI reads it, writes a title, and generates the questions in one step.
            </p>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 space-y-2" style={{ minWidth: 200 }}>
                <Label htmlFor="ai-doc-upload">Document</Label>
                <Input id="ai-doc-upload" type="file" accept={ACCEPTED_EXTENSIONS} onChange={handleFileChange} disabled={isPending} />
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
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!file || isPending}
              className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {isPending ? 'Generating…' : 'Generate Quiz'}
            </Button>
            {isPending && <p className="text-center text-xs text-muted-foreground">This can take up to 30 seconds for longer documents.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
