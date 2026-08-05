import { useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, CheckCircle2, ClipboardList, LoaderCircle, Mail, Plus, Sparkles, Trash2, UserMinus, Users } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useClassDetail } from '@/features/classes/hooks/useClasses'
import { usePracticeTasks } from '@/features/classes/hooks/usePracticeTasks'
import { useClassQuizzes } from '@/features/quizzes/hooks/useQuizzes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export const Route = createFileRoute('/classes/$classId/')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: ClassDetailPage,
})

function ClassDetailPage() {
  const { classId } = Route.useParams()
  const { data: classDetail, isLoading, error, removeStudent } = useClassDetail(classId)
  const { data: quizzes, isLoading: quizzesLoading } = useClassQuizzes(classId)
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="h-8 w-48 animate-pulse rounded bg-secondary" />
      </div>
    )
  }

  if (error || !classDetail) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">Class not found, or you don&apos;t have access to it.</p>
        <Button variant="outline" className="mt-4 gap-2" asChild>
          <Link to="/classes">
            <ArrowLeft className="size-4" />
            Back to Classes
          </Link>
        </Button>
      </div>
    )
  }

  async function handleRemove(studentId: string) {
    setRemovingStudentId(studentId)
    try {
      await removeStudent(studentId)
      toast.success('Student removed from class')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove student')
    } finally {
      setRemovingStudentId(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Button variant="ghost" className="mb-4 gap-2 pl-0" asChild>
        <Link to="/classes">
          <ArrowLeft className="size-4" />
          Back to Classes
        </Link>
      </Button>

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">{classDetail.name}</h1>
          {!classDetail.isTeacher && <p className="text-sm text-muted-foreground">Taught by {classDetail.teacherName}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {classDetail.curriculumName}
            </Badge>
            <Badge variant="secondary" className="text-[10px]">
              {classDetail.subjectName}
            </Badge>
            {classDetail.gradeLabel && (
              <Badge variant="outline" className="text-[10px]">
                {classDetail.gradeLabel}
              </Badge>
            )}
          </div>
        </div>
        <Badge variant="outline" className="font-mono">
          {classDetail.code}
        </Badge>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="font-heading text-base text-foreground">Quizzes</CardTitle>
            <CardDescription>
              {classDetail.isTeacher ? 'Create and publish quizzes for your class.' : 'Published quizzes from your teacher.'}
            </CardDescription>
          </div>
          {classDetail.isTeacher && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-2" asChild>
                <Link to="/classes/$classId/quizzes/new" params={{ classId }}>
                  <Plus className="size-4" />
                  Create Quiz
                </Link>
              </Button>
              <Button size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" asChild>
                <Link to="/classes/$classId/quizzes/generate" params={{ classId }}>
                  <Sparkles className="size-4" />
                  Generate with AI
                </Link>
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {quizzesLoading ? (
            <div className="h-16 animate-pulse rounded-md bg-secondary" />
          ) : !quizzes || quizzes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {classDetail.isTeacher ? 'No quizzes yet. Create one to get started.' : 'No quizzes have been published yet.'}
            </p>
          ) : (
            quizzes.map((quiz) => (
              <Link
                key={quiz.id}
                to="/classes/$classId/quizzes/$quizId"
                params={{ classId, quizId: quiz.id }}
                className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 transition-colors hover:bg-secondary/50"
              >
                <span className="text-sm font-medium text-foreground">{quiz.title}</span>
                <span className="flex items-center gap-2">
                  {classDetail.isTeacher ? (
                    <>
                      <Badge variant="outline" className="text-xs">
                        {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}
                      </Badge>
                      <Badge variant={quiz.isPublished ? 'default' : 'outline'} className="text-xs">
                        {quiz.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                    </>
                  ) : quiz.attempted ? (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <CheckCircle2 className="size-3 text-primary" />
                      {quiz.score}/{quiz.maxScore}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Not started
                    </Badge>
                  )}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      {classDetail.isTeacher && <ManagePracticeTasks classId={classId} />}

      {classDetail.isTeacher && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-heading text-base text-foreground">
              <Users className="size-4" />
              Roster ({classDetail.roster.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {classDetail.roster.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No students yet. Share the code <span className="font-mono font-semibold">{classDetail.code}</span> with your class.
              </p>
            ) : (
              classDetail.roster.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                >
                  <span className="text-sm font-medium text-foreground">
                    {student.firstName} {student.lastName}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Mail className="size-3" />
                      {student.email}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${student.firstName} ${student.lastName}`}
                      disabled={removingStudentId === student.id}
                      onClick={() => handleRemove(student.id)}
                    >
                      {removingStudentId === student.id ? (
                        <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
                      ) : (
                        <UserMinus className="size-4 text-muted-foreground" />
                      )}
                    </Button>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ManagePracticeTasks({ classId }: { classId: string }) {
  const { practiceTasks, isLoading, createPracticeTask, isCreating, deletePracticeTask } = usePracticeTasks(classId)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')

  async function handleCreate() {
    if (!title.trim()) return
    try {
      await createPracticeTask({ title: title.trim(), description: description.trim() || undefined, dueDate: dueDate || undefined })
      toast.success('Practice task assigned')
      setTitle('')
      setDescription('')
      setDueDate('')
      setDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to assign practice task')
    }
  }

  async function handleDelete(templateId: string) {
    try {
      await deletePracticeTask(templateId)
      toast.success('Practice task removed')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove practice task')
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 font-heading text-base text-foreground">
            <ClipboardList className="size-4" />
            Practice Tasks
          </CardTitle>
          <CardDescription>Ungraded rehearsal work, assigned to every student currently in this class.</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="size-4" />
              Assign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign a practice task</DialogTitle>
              <DialogDescription>
                Every student actively enrolled right now will get a copy. Students who join later won&apos;t receive it retroactively.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Input placeholder="e.g. Practice: quadratic equations" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Instructions (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={isCreating || !title.trim()}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {isCreating && <LoaderCircle className="size-4 animate-spin" />}
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-md bg-secondary" />
        ) : practiceTasks.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No practice tasks assigned yet.</p>
        ) : (
          practiceTasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{task.title}</p>
                {task.dueDate && (
                  <p className="text-xs text-muted-foreground">Due {new Date(task.dueDate).toLocaleDateString()}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {task.completedCount} of {task.totalStudents} done
                </Badge>
                <Button variant="ghost" size="icon" aria-label="Remove practice task" onClick={() => handleDelete(task.id)}>
                  <Trash2 className="size-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
