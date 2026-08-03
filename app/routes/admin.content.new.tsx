import { useMemo, useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { createAdminQuizFn } from '@/features/quizzes/hooks/useQuizzes'
import { useCurricula } from '@/features/curricula/hooks/useCurricula'
import { getGradeOptions } from '@/features/curricula/gradeOptions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export const Route = createFileRoute('/admin/content/new')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: NewAdminQuizPage,
})

function NewAdminQuizPage() {
  const navigate = useNavigate()
  const { data: curricula } = useCurricula()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [curriculumId, setCurriculumId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [gradeLabel, setGradeLabel] = useState('')
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('')

  const selectedCurriculum = useMemo(() => curricula?.find((c) => c.id === curriculumId), [curricula, curriculumId])
  const subjectsForCurriculum = selectedCurriculum?.subjects ?? []
  const gradeOptions = useMemo(() => getGradeOptions(selectedCurriculum?.code), [selectedCurriculum])

  const createMutation = useMutation({
    mutationFn: () =>
      createAdminQuizFn({
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          curriculumId,
          subjectId,
          gradeLabel: gradeLabel.trim() || undefined,
          timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : undefined,
        },
      }),
  })

  const canSubmit = !!title.trim() && !!curriculumId && !!subjectId

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    try {
      const quiz = await createMutation.mutateAsync()
      toast.success('Quiz created — now add some questions')
      navigate({ to: '/admin/content/$quizId', params: { quizId: quiz.id } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create quiz')
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
          <CardTitle className="font-heading text-xl text-foreground">Create Public Content</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Grade 7 Photosynthesis Basics"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What this quiz covers"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Curriculum</Label>
              <Select
                value={curriculumId}
                onValueChange={(value) => {
                  setCurriculumId(value)
                  setSubjectId('')
                  setGradeLabel('')
                }}
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
              <Select value={subjectId} onValueChange={setSubjectId} disabled={!curriculumId}>
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
              <Select value={gradeLabel} onValueChange={setGradeLabel} disabled={!curriculumId}>
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

            <div className="space-y-2">
              <Label htmlFor="timeLimit">Time limit in minutes (optional)</Label>
              <Input
                id="timeLimit"
                type="number"
                min={1}
                max={180}
                placeholder="e.g. 15"
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={!canSubmit || createMutation.isPending}
              className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {createMutation.isPending && <LoaderCircle className="size-4 animate-spin" />}
              Create Quiz &amp; Add Questions
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
