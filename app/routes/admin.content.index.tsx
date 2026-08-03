import { useMemo, useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { BookOpen, Plus, Sparkles } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { useAdminContent, type AdminContentSummary } from '@/features/quizzes/hooks/useQuizzes'
import { gradeSortIndex } from '@/features/curricula/gradeOptions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export const Route = createFileRoute('/admin/content/')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'admin') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: AdminContentPage,
})

interface CurriculumGroup {
  curriculumCode: string
  curriculumName: string
  quizzes: Array<AdminContentSummary>
}

function groupByCurriculum(quizzes: Array<AdminContentSummary>): Array<CurriculumGroup> {
  const groups = new Map<string, CurriculumGroup>()
  for (const quiz of quizzes) {
    const key = quiz.curriculumCode || quiz.curriculumName
    const existing = groups.get(key)
    if (existing) {
      existing.quizzes.push(quiz)
    } else {
      groups.set(key, { curriculumCode: quiz.curriculumCode, curriculumName: quiz.curriculumName, quizzes: [quiz] })
    }
  }
  return Array.from(groups.values()).sort((a, b) => a.curriculumName.localeCompare(b.curriculumName))
}

interface GradeGroup {
  gradeLabel: string | null
  quizzes: Array<AdminContentSummary>
}

function groupByGrade(curriculumCode: string, quizzes: Array<AdminContentSummary>): Array<GradeGroup> {
  const groups = new Map<string | null, Array<AdminContentSummary>>()
  for (const quiz of quizzes) {
    const list = groups.get(quiz.gradeLabel) ?? []
    list.push(quiz)
    groups.set(quiz.gradeLabel, list)
  }
  return Array.from(groups.entries())
    .map(([gradeLabel, list]) => ({ gradeLabel, quizzes: list }))
    .sort((a, b) => gradeSortIndex(curriculumCode, a.gradeLabel) - gradeSortIndex(curriculumCode, b.gradeLabel))
}

function QuizCard({ quiz }: { quiz: AdminContentSummary }) {
  return (
    <Link to="/admin/content/$quizId" params={{ quizId: quiz.id }}>
      <Card className="h-full transition-colors hover:bg-secondary/50">
        <CardHeader>
          <CardTitle className="font-heading text-foreground">{quiz.title}</CardTitle>
          <div className="flex flex-wrap gap-1.5 pt-1">
            <Badge variant="secondary" className="text-[10px]">
              {quiz.subjectName}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <Badge variant={quiz.isPublished ? 'default' : 'outline'}>{quiz.isPublished ? 'Live' : 'Draft'}</Badge>
          <span className="text-xs text-muted-foreground">
            {quiz.questionCount} question{quiz.questionCount === 1 ? '' : 's'}
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}

function CurriculumContent({ group }: { group: CurriculumGroup }) {
  const gradeGroups = useMemo(() => groupByGrade(group.curriculumCode, group.quizzes), [group])

  return (
    <div className="space-y-8">
      {gradeGroups.map((gradeGroup) => (
        <div key={gradeGroup.gradeLabel ?? 'ungraded'}>
          <h3 className="mb-3 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            {gradeGroup.gradeLabel ?? 'No grade set'}
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {gradeGroup.quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AdminContentPage() {
  const { data: quizzes, isLoading } = useAdminContent()
  const curriculumGroups = useMemo(() => groupByCurriculum(quizzes ?? []), [quizzes])
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined)
  const currentTab = activeTab ?? curriculumGroups[0]?.curriculumCode

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold text-foreground">Content Library</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" asChild>
            <Link to="/admin/content/new">
              <Plus className="size-4" />
              New Quiz
            </Link>
          </Button>
          <Button className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90" asChild>
            <Link to="/admin/content/generate">
              <Sparkles className="size-4" />
              Generate with AI
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-secondary" />
      ) : curriculumGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <BookOpen className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No public content yet — create your first quiz for the landing page and student dashboards.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={currentTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 h-auto flex-wrap">
            {curriculumGroups.map((group) => (
              <TabsTrigger key={group.curriculumCode} value={group.curriculumCode} className="gap-1.5 px-3 py-1.5">
                {group.curriculumName}
                <Badge variant="secondary" className="ml-1 text-[10px]">
                  {group.quizzes.length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          {curriculumGroups.map((group) => (
            <TabsContent key={group.curriculumCode} value={group.curriculumCode}>
              <CurriculumContent group={group} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}
