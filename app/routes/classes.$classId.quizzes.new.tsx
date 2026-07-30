import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { createQuizFn } from '@/features/quizzes/hooks/useQuizzes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/classes/$classId/quizzes/new')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'teacher') {
      throw redirect({ to: '/classes' })
    }
  },
  component: NewQuizPage,
})

function NewQuizPage() {
  const { classId } = Route.useParams()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('')
  const [dueDate, setDueDate] = useState('')

  const createMutation = useMutation({
    mutationFn: () =>
      createQuizFn({
        data: {
          classId,
          title: title.trim(),
          description: description.trim() || undefined,
          timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : undefined,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        },
      }),
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    try {
      const quiz = await createMutation.mutateAsync()
      toast.success('Quiz created — now add some questions')
      navigate({ to: '/classes/$classId/quizzes/$quizId', params: { classId, quizId: quiz.id } })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create quiz')
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
          <CardTitle className="font-heading text-xl text-foreground">Create a Quiz</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Photosynthesis Basics"
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
            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date (optional)</Label>
              <Input id="dueDate" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Setting a due date turns this into an assignment — it will automatically appear as a task in each
                enrolled student&apos;s task list.
              </p>
            </div>
            <Button
              type="submit"
              disabled={!title.trim() || createMutation.isPending}
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
