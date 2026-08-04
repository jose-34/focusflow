import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, LoaderCircle, Sparkles, Upload } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useGenerateClassQuizFromDocument, useGenerateClassQuizFromTopic } from '@/features/quizzes/hooks/useQuizzes'
import { fileToBase64, validateDocumentFile } from '@/features/quizzes/documentUpload'
import { AIGenerationFields, defaultAIGenerationValues, type AIGenerationValues } from '@/features/quizzes/components/AIGenerationFields'
import { AIProcessingScreen } from '@/features/quizzes/components/AIProcessingScreen'
import { Button } from '@/components/ui/button'
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
  const [values, setValues] = useState<AIGenerationValues>(defaultAIGenerationValues)
  const { mutateAsync: generateFromDocument, isPending: isGeneratingFromDocument } = useGenerateClassQuizFromDocument(classId)
  const { mutateAsync: generateFromTopic, isPending: isGeneratingFromTopic } = useGenerateClassQuizFromTopic(classId)
  const isPending = isGeneratingFromDocument || isGeneratingFromTopic

  function handleFileChange(file: File | null) {
    if (!file) {
      setValues((v) => ({ ...v, file: null }))
      return
    }
    const error = validateDocumentFile(file)
    if (error) {
      toast.error(error)
      return
    }
    setValues((v) => ({ ...v, file }))
  }

  const canSubmit = values.mode === 'document' ? !!values.file : values.topic.trim().length >= 3

  async function handleGenerate() {
    if (!canSubmit) return
    const shared = {
      questionCount: Number(values.questionCount) || 5,
      dokLevel: values.dokLevel ? (Number(values.dokLevel) as 1 | 2 | 3) : undefined,
      language: values.language,
      questionTypes: values.questionTypes,
    }
    try {
      const quiz =
        values.mode === 'document'
          ? await generateFromDocument({ mimeType: values.file!.type as 'application/pdf', fileBase64: await fileToBase64(values.file!), ...shared })
          : await generateFromTopic({ topic: values.topic.trim(), ...shared })
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
              Upload a document or describe a topic — AI writes a title and generates the questions in one step.
            </p>

            {isPending ? (
              <AIProcessingScreen />
            ) : (
              <>
                <AIGenerationFields values={values} onChange={(patch) => setValues((v) => ({ ...v, ...patch }))} disabled={isPending} onFileChange={handleFileChange} />
                <Button onClick={handleGenerate} disabled={!canSubmit || isPending} className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  {isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  Generate Quiz
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
