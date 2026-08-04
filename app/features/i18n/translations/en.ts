// English strings for the student play experience (live game + async quiz
// taking) — the only surface this i18n layer covers. Admin/teacher UI,
// dashboards, and everything else stays English-only by design; see
// app/features/i18n/I18nContext.tsx.
const en = {
  'join.title': 'Join a Live Game',
  'join.subtitle': 'Enter the PIN your teacher shared',
  'join.button': 'Join Game',
  'join.errorDefault': 'Failed to join game',

  'play.notFound': 'Game not found, or it has already ended.',
  'play.backToJoin': 'Join Another Game',
  'play.lobbyTitle': "You're in!",
  'play.lobbyWaiting': 'Waiting for the host to start the game…',
  'play.question': 'Question',
  'play.answerLocked': 'Answer locked in — waiting for other players…',
  'play.pointsEarned': '+{points} points!',
  'play.notQuite': 'Not quite',
  'play.timeUp': "Time's up — no answer submitted.",
  'play.leaderboard': 'Leaderboard',
  'play.gameOver': 'Game Over!',
  'play.finalScore': 'Your final score:',
  'play.finalResults': 'Final Results',
  'play.backToClasses': 'Back to Classes',

  'taking.notFound': "Quiz not found, or it hasn't been published yet.",
  'taking.startQuiz': 'Start Quiz',
  'taking.submitQuiz': 'Submit Quiz',
  'taking.yourScore': 'Your score',
  'taking.readyWhenYouAre': 'ready when you are',
  'taking.challengeMode': 'Challenge Mode',
  'taking.due': 'Due',
  'taking.question': 'question',
  'taking.questions': 'questions',
  'taking.focusModeActive': 'Focus mode active',
  'taking.minVerified': 'min verified',
  'taking.focusSyncError': 'Focus session sync error:',
  'taking.yourAnswerPlaceholder': 'Your answer',
  'taking.manualGradingPlaceholder': 'Your teacher will grade this response manually.',
  'taking.chooseMatch': 'Choose a match…',
  'taking.chooseCategory': 'Choose a category…',
  'taking.pollThanks': 'Thanks for your response.',
  'taking.awaitingReview': 'Submitted — awaiting teacher review.',
  'taking.failedToStart': 'Failed to start quiz',
  'taking.failedToSubmit': 'Failed to submit quiz',
  'taking.minLimit': 'min limit',
  'taking.left': 'left',
  'taking.pt': 'pt',
  'taking.pts': 'pts',
}

export default en
export type TranslationKey = keyof typeof en
