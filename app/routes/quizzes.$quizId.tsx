import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { getCurrentUserFn } from '@/features/auth/hooks/useAuth'
import { QuizTakingView } from '@/features/quizzes/components/QuizTakingView'
import { Button } from '@/components/ui/button'

// Classless entry point for public content (admin-authored, or a
// teacher's quiz explicitly published to public) — any logged-in student
// can reach this regardless of class enrollment, unlike
// /classes/$classId/quizzes/$quizId which requires class context. RLS's
// quizzes_select policy already permits this (visibility = 'public' AND
// is_published), so quiz-taking here needs no special-casing.
export const Route = createFileRoute('/quizzes/$quizId')({
  beforeLoad: async () => {
    const user = await getCurrentUserFn()
    if (!user) {
      throw redirect({ to: '/login' })
    }
    if (user.role !== 'student') {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: PublicQuizPage,
})

function PublicQuizPage() {
  const { quizId } = Route.useParams()

  return (
    <QuizTakingView
      quizId={quizId}
      backLink={
        <Button variant="ghost" className="mb-4 gap-2 pl-0" asChild>
          <Link to="/dashboard">
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
        </Button>
      }
    />
  )
}
