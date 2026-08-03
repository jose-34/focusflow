import { useMemo, useState } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { BookOpen, Library as LibraryIcon } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { usePublicQuizzes, type PublicQuizSummary } from '@/features/quizzes/hooks/usePublicQuizzes'
import { gradeSortIndex } from '@/features/curricula/gradeOptions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

// Wayground-inspired "Browse by Subject" library — content discovery for
// public quizzes (admin-authored, or a teacher's quiz explicitly published
// to public), filterable by curriculum then subject. Deliberately
// student-scoped for now, same as /quizzes/$quizId and dashboard's
// DiscoverSection — teachers get their own future public-bank browse (see
// build plan Phase 5), not this page.
export const Route = createFileRoute('/library')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'student') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: LibraryPage,
})

interface CurriculumGroup {
  curriculumCode: string
  curriculumName: string
  quizzes: Array<PublicQuizSummary>
}

function groupByCurriculum(quizzes: Array<PublicQuizSummary>): Array<CurriculumGroup> {
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

function QuizCard({ quiz }: { quiz: PublicQuizSummary }) {
  return (
    <Link to="/quizzes/$quizId" params={{ quizId: quiz.id }}>
      <Card className="h-full transition-colors hover:bg-secondary/50">
        <CardHeader>
          <CardTitle className="font-heading text-foreground">{quiz.title}</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <Badge variant="secondary" className="text-[10px]">
              {quiz.subjectName}
            </Badge>
            {quiz.gradeLabel && (
              <Badge variant="outline" className="text-[10px]">
                {quiz.gradeLabel}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">by {quiz.authorName}</span>
          <span className="text-xs text-muted-foreground">
            {quiz.questions.length} question{quiz.questions.length === 1 ? '' : 's'}
          </span>
        </CardContent>
      </Card>
    </Link>
  )
}

function CurriculumContent({ group }: { group: CurriculumGroup }) {
  const [activeSubject, setActiveSubject] = useState<string | null>(null)

  const subjects = useMemo(() => {
    const names = new Set(group.quizzes.map((q) => q.subjectName))
    return Array.from(names).sort((a, b) => a.localeCompare(b))
  }, [group])

  const filteredQuizzes = useMemo(() => {
    const list = activeSubject ? group.quizzes.filter((q) => q.subjectName === activeSubject) : group.quizzes
    return list
      .slice()
      .sort((a, b) => gradeSortIndex(group.curriculumCode, a.gradeLabel) - gradeSortIndex(group.curriculumCode, b.gradeLabel))
  }, [group, activeSubject])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveSubject(null)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
            activeSubject === null
              ? 'border-accent bg-accent text-accent-foreground'
              : 'border-border bg-background text-muted-foreground hover:bg-secondary/50'
          }`}
        >
          All Subjects
        </button>
        {subjects.map((subject) => (
          <button
            key={subject}
            onClick={() => setActiveSubject(subject)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeSubject === subject
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border bg-background text-muted-foreground hover:bg-secondary/50'
            }`}
          >
            {subject}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredQuizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} />
        ))}
      </div>
    </div>
  )
}

function LibraryPage() {
  const { data: quizzes, isLoading } = usePublicQuizzes()
  const curriculumGroups = useMemo(() => groupByCurriculum(quizzes ?? []), [quizzes])
  const [activeTab, setActiveTab] = useState<string | undefined>(undefined)
  const currentTab = activeTab ?? curriculumGroups[0]?.curriculumCode

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold text-foreground">
          <LibraryIcon className="size-6 text-accent" />
          Library
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse public quizzes from FocusFlow and teachers, organized by curriculum and subject.
        </p>
      </div>

      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-secondary" />
      ) : curriculumGroups.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <BookOpen className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No public content yet — check back soon.</p>
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
