import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'framer-motion'
import { RotateCcw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { isSoundMuted, setSoundMuted } from '@/lib/sound'
import { usePublicQuizzes } from '@/features/quizzes/hooks/usePublicQuizzes'
import { PLATFORMER_SCENE_HEIGHT, PlatformerQuestionScene } from '@/features/gameplay/components/PlatformerQuestionScene'
import { DEMO_GRADES, DEMO_SUBJECTS, getDemoQuestions, type DemoQuestion, type DemoSubject } from './demoQuestions'

const NUDGE_AFTER_CORRECT = 2
const ADVANCE_DELAY_MS = 1300
const GAME_HEIGHT = PLATFORMER_SCENE_HEIGHT

type AnswerState = 'idle' | 'correct' | 'wrong'

function SetupScreen({ onStart }: { onStart: (subject: DemoSubject, grade: string) => void }) {
  const [subject, setSubject] = useState<DemoSubject | null>(null)
  const [grade, setGrade] = useState<string>('')

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 bg-linear-to-b from-accent/10 via-background to-role-teacher/10 px-6 text-center">
      <div>
        <p className="font-heading text-xl font-semibold text-foreground md:text-2xl">Choose what to play</p>
        <p className="mt-1 text-sm text-muted-foreground">Pick a subject and grade, and the questions match.</p>
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-2">
        {DEMO_SUBJECTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSubject(s.id)}
            className={cn(
              'rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors',
              subject === s.id ? 'border-accent bg-accent/15 text-accent' : 'border-border bg-card text-foreground hover:border-accent/40',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="w-full max-w-xs">
        <Select value={grade} onValueChange={setGrade}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Grade" />
          </SelectTrigger>
          <SelectContent>
            {DEMO_GRADES.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        size="lg"
        disabled={!subject || !grade}
        onClick={() => subject && grade && onStart(subject, grade)}
        className="bg-accent px-10 text-accent-foreground hover:bg-accent/90"
      >
        Play
      </Button>
    </div>
  )
}

export function ArcadeDemoGame() {
  const [subject, setSubject] = useState<DemoSubject | null>(null)
  const [grade, setGrade] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Array<DemoQuestion> | null>(null)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answerState, setAnswerState] = useState<AnswerState>('idle')
  const [nudgeDismissed, setNudgeDismissed] = useState(false)
  const [finished, setFinished] = useState(false)
  const [pathTaken, setPathTaken] = useState<Array<boolean>>([])
  const [muted, setMuted] = useState(isSoundMuted())
  const [contentAuthor, setContentAuthor] = useState<string | null>(null)

  // Real admin/teacher-authored public content, when any exists for the
  // chosen subject+grade, takes priority over the generic static bank —
  // that's the whole point of the content-library feature: a landing-page
  // visitor sees real authored content and who made it, not just filler.
  const { data: publicQuizzes } = usePublicQuizzes()

  const question = questions ? questions[questionIndex] : null
  const showNudge = score >= NUDGE_AFTER_CORRECT && !nudgeDismissed && !finished

  function handleStart(chosenSubject: DemoSubject, chosenGrade: string) {
    setSubject(chosenSubject)
    setGrade(chosenGrade)
    const subjectLabel = DEMO_SUBJECTS.find((s) => s.id === chosenSubject)?.label
    const match = publicQuizzes?.find((q) => q.subjectName === subjectLabel && q.gradeLabel === chosenGrade)
    if (match) {
      setQuestions(match.questions)
      setContentAuthor(match.authorName)
    } else {
      setQuestions(getDemoQuestions(chosenSubject, chosenGrade))
      setContentAuthor(null)
    }
  }

  function toggleMute() {
    const next = !muted
    setMuted(next)
    setSoundMuted(next)
  }

  function handleSelect(choiceIndex: number) {
    if (answerState !== 'idle' || !question) return
    const isCorrect = choiceIndex === question.correctIndex
    setSelected(choiceIndex)
    setAnswerState(isCorrect ? 'correct' : 'wrong')
    if (isCorrect) setScore((s) => s + 1)

    setTimeout(() => {
      setPathTaken((p) => [...p, isCorrect])
      if (questionIndex + 1 >= (questions?.length ?? 0)) {
        setFinished(true)
      } else {
        setQuestionIndex((i) => i + 1)
        setSelected(null)
        setAnswerState('idle')
      }
    }, ADVANCE_DELAY_MS)
  }

  function handleReplay() {
    setQuestionIndex(0)
    setScore(0)
    setSelected(null)
    setAnswerState('idle')
    setFinished(false)
    setNudgeDismissed(false)
    setPathTaken([])
  }

  function handleChangeSubject() {
    handleReplay()
    setQuestions(null)
    setSubject(null)
    setGrade(null)
    setContentAuthor(null)
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
      <div className="relative overflow-hidden" style={{ height: GAME_HEIGHT }}>
        {!questions ? (
          <SetupScreen onStart={handleStart} />
        ) : !finished && question ? (
          <PlatformerQuestionScene
            questionText={question.question}
            choices={question.choices.map((text, index) => ({ id: String(index), text }))}
            questionNumber={questionIndex + 1}
            totalQuestions={questions.length}
            history={pathTaken}
            selectedChoiceId={selected !== null ? String(selected) : null}
            locked={answerState !== 'idle'}
            correctChoiceId={answerState !== 'idle' ? String(question.correctIndex) : undefined}
            onSelect={(choiceId) => handleSelect(Number(choiceId))}
            score={score}
            muted={muted}
            onToggleMute={toggleMute}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex h-full flex-col items-center justify-center gap-3 bg-linear-to-b from-sky-300 via-sky-100 to-accent/20 text-center"
          >
            <p className="font-heading text-3xl font-bold text-foreground">
              {score} / {questions?.length ?? 0} correct
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">That's just a taste. Sign up free to track real progress, streaks, and achievements.</p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Button size="lg" asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/register">Sign Up Free to Save Progress</Link>
              </Button>
              <Button size="lg" variant="outline" onClick={handleReplay} className="gap-2">
                <RotateCcw className="size-4" />
                Play Again
              </Button>
              <Button size="lg" variant="ghost" onClick={handleChangeSubject}>
                Try Another Subject
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {subject && grade && (
        <div className="flex items-center justify-between border-t border-border bg-card px-4 py-1.5 text-xs text-muted-foreground">
          <span>
            {DEMO_SUBJECTS.find((s) => s.id === subject)?.label} · {grade}
            {contentAuthor && <> · by {contentAuthor}</>}
          </span>
          {!finished && (
            <button type="button" onClick={handleChangeSubject} className="underline hover:text-foreground">
              Change
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {showNudge && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col items-center justify-between gap-3 border-t border-accent/30 bg-accent/10 px-4 py-3 sm:flex-row"
          >
            <p className="text-sm text-foreground">
              <span className="font-semibold">Nice going!</span> Create a free account to save this progress and keep playing.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="sm" asChild className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Link to="/register">Sign Up Free</Link>
              </Button>
              <button
                type="button"
                onClick={() => setNudgeDismissed(true)}
                aria-label="Dismiss"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
