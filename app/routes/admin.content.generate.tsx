import { useMemo, useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, LoaderCircle, Sparkles, Upload } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useGenerateAdminQuizFromDocument } from '@/features/quizzes/hooks/useQuizzes'
import { useCurricula } from '@/features/curricula/hooks/useCurricula'
import { getGradeOptions } from '@/features/curricula/gradeOptions'
import { ACCEPTED_EXTENSIONS, fileToBase64, validateDocumentFile } from '@/features/quizzes/documentUpload'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  const [file, setFile] = useState<File | null>(null)
  const [questionCount, setQuestionCount] = useState('5')
  const { mutateAsync: generate, isPending } = useGenerateAdminQuizFromDocument()

  const selectedCurriculum = useMemo(() => curricula?.find((c) => c.id === curriculumId), [curricula, curriculumId])
  const subjectsForCurriculum = selectedCurriculum?.subjects ?? []
  const gradeOptions = useMemo(() => getGradeOptions(selectedCurriculum?.code), [selectedCurriculum])

  const canSubmit = !!curriculumId && !!subjectId && !!file

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
    if (!canSubmit || !file) return
    try {
      const fileBase64 = await fileToBase64(file)
      const quiz = await generate({
        curriculumId,
        subjectId,
        gradeLabel: gradeLabel.trim() || undefined,
        mimeType: file.type as 'application/pdf',
        fileBase64,
        questionCount: Number(questionCount) || 5,
      })
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
              Upload a document — AI reads it, writes a title, and generates the questions in one step.
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
              disabled={!canSubmit || isPending}
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
