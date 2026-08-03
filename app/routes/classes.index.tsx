import { useMemo, useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { toast } from 'sonner'
import { GraduationCap, LoaderCircle, Plus, Users } from 'lucide-react'
import { getCurrentUserFn, useAuth } from '@/features/auth/hooks/useAuth'
import { useClasses } from '@/features/classes/hooks/useClasses'
import { useCurricula } from '@/features/curricula/hooks/useCurricula'
import { getGradeOptions } from '@/features/curricula/gradeOptions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export const Route = createFileRoute('/classes/')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
  },
  component: ClassesPage,
})

function ClassesPage() {
  const { isTeacher } = useAuth()
  const { classes, isLoading, createClass, joinClass, isCreating, isJoining } = useClasses()
  const { data: curricula } = useCurricula()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [curriculumId, setCurriculumId] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [gradeLabel, setGradeLabel] = useState('')
  const [code, setCode] = useState('')

  const selectedCurriculum = useMemo(() => curricula?.find((c) => c.id === curriculumId), [curricula, curriculumId])
  const subjectsForCurriculum = selectedCurriculum?.subjects ?? []
  const gradeOptions = useMemo(() => getGradeOptions(selectedCurriculum?.code), [selectedCurriculum])

  function resetCreateForm() {
    setName('')
    setCurriculumId('')
    setSubjectId('')
    setGradeLabel('')
  }

  async function handleCreate() {
    if (!name.trim() || !curriculumId || !subjectId) return
    try {
      await createClass({ name: name.trim(), curriculumId, subjectId, gradeLabel: gradeLabel.trim() || undefined })
      toast.success('Class created')
      resetCreateForm()
      setDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create class')
    }
  }

  async function handleJoin() {
    if (code.trim().length !== 6) return
    try {
      const result = await joinClass(code.trim())
      toast.success(`Joined ${result.className}`)
      setCode('')
      setDialogOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to join class')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-foreground">My Classes</h1>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetCreateForm()
          }}
        >
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="size-4" />
              {isTeacher ? 'Create Class' : 'Join Class'}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{isTeacher ? 'Create a new class' : 'Join a class'}</DialogTitle>
              <DialogDescription>
                {isTeacher
                  ? 'Give your class a name, curriculum, and subject — students will join with a 6-character code we generate for you.'
                  : 'Enter the 6-character code your teacher shared with you.'}
              </DialogDescription>
            </DialogHeader>
            {isTeacher ? (
              <div className="space-y-3">
                <Input placeholder="e.g. Grade 9 Homeroom" value={name} onChange={(e) => setName(e.target.value)} />

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

                <Select value={gradeLabel} onValueChange={setGradeLabel} disabled={!curriculumId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Grade (optional)" />
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
            ) : (
              <Input
                placeholder="ABC123"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono tracking-widest uppercase"
              />
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={isTeacher ? handleCreate : handleJoin}
                disabled={isTeacher ? isCreating || !name.trim() || !curriculumId || !subjectId : isJoining}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {(isTeacher ? isCreating : isJoining) && <LoaderCircle className="size-4 animate-spin" />}
                {isTeacher ? 'Create' : 'Join'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-secondary" />
      ) : classes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <GraduationCap className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isTeacher ? "You haven't created any classes yet." : "You're not enrolled in any classes yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((cls) => (
            <Link key={cls.id} to="/classes/$classId" params={{ classId: cls.id }}>
              <Card className="h-full transition-colors hover:bg-secondary/50">
                <CardHeader>
                  <CardTitle className="font-heading text-foreground">{cls.name}</CardTitle>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <Badge variant="secondary" className="text-[10px]">
                      {cls.curriculumName}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {cls.subjectName}
                    </Badge>
                    {cls.gradeLabel && (
                      <Badge variant="outline" className="text-[10px]">
                        {cls.gradeLabel}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <Badge variant="outline">{cls.code}</Badge>
                  {isTeacher ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="size-3.5" />
                      {cls.studentCount ?? 0} students
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{cls.teacherName}</span>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
