import { useMemo, useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, LoaderCircle, Sparkles, Upload } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useGenerateAdminQuizFromDocument, useGenerateAdminQuizFromTopic } from '@/features/quizzes/hooks/useQuizzes'
import { useCurricula } from '@/features/curricula/hooks/useCurricula'
import { getGradeOptions } from '@/features/curricula/gradeOptions'
import { fileToBase64, validateDocumentFile } from '@/features/quizzes/documentUpload'
import { AIGenerationFields, defaultAIGenerationValues, type AIGenerationValues } from '@/features/quizzes/components/AIGenerationFields'
import { AIProcessingScreen } from '@/features/quizzes/components/AIProcessingScreen'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const Route = createFileRoute('/admin/content/generate')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: GenerateAdminQuizPage,
})

function GenerateAdminQuizPage() {
  const navigate = useNavigate()
  const { data: curricula } = useCurricula()
  const [curriculumId, setCurriculumId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [gradeLabel, setGradeLabel] = useState('')
  const [values, setValues] = useState<AIGenerationValues>(defaultAIGenerationValues)
  const { mutateAsync: generateFromDocument, isPending: isGeneratingFromDocument } = useGenerateAdminQuizFromDocument()
  const { mutateAsync: generateFromTopic, isPending: isGeneratingFromTopic } = useGenerateAdminQuizFromTopic()
  const isPending = isGeneratingFromDocument || isGeneratingFromTopic

  const selectedCurriculum = useMemo(() => curricula?.find((c) => c.id === curriculumId), [curricula, curriculumId])
  const subjectsForCurriculum = selectedCurriculum?.subjects ?? []
  const gradeOptions = useMemo(() => getGradeOptions(selectedCurriculum?.code), [selectedCurriculum])

  const canSubmit = !!curriculumId && !!subjectId && (values.mode === 'document' ? !!values.file : values.topic.trim().length >= 3)

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

  async function handleGenerate() {
    if (!canSubmit) return
    const shared = {
      curriculumId,
      subjectId,
      gradeLabel: gradeLabel.trim() || undefined,
      // The already-selected grade badge doubles as the AI's writing-level
      // hint — no need for a second, separate "grade level" field.
      gradeLevel: gradeLabel.trim() || undefined,
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
      navigate({ to: '/admin/content/$quizId', params: { quizId: quiz.id } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to generate quiz')
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Button variant="ghost" className="mb-4 gap-2 pl-0" asChild>
        <Link to="/admin/content">
          <ArrowLeft className="size-4" />
          Back to Content Library
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

            <div className="space-y-2">
              <Label>Curriculum</Label>
              <Select
                value={curriculumId}
                onValueChange={(value) => {
                  setCurriculumId(value)
                  setSubjectId('')
                  setGradeLabel('')
                }}
                disabled={isPending}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Curriculum" />
                </SelectTrigger>
                <SelectContent>
                  {curricula?.map((curriculum) => (
                    <SelectItem key={curriculum.id} value={curriculum.id}>
                      {curriculum.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId} disabled={!curriculumId || isPending}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjectsForCurriculum.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Grade (optional)</Label>
              <Select value={gradeLabel} onValueChange={setGradeLabel} disabled={!curriculumId || isPending}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Grade" />
                </SelectTrigger>
                <SelectContent>
                  {gradeOptions.map((grade) => (
                    <SelectItem key={grade} value={grade}>
                      {grade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
