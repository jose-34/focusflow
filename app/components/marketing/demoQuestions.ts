export interface DemoQuestion {
  id: string
  question: string
  choices: Array<string>
  correctIndex: number
}

// Deliberately generic, curriculum-flavored sample content — never real
// class/quiz data, which is private and RLS-protected. This is the only
// question set an anonymous landing-page visitor is ever shown.
export const DEMO_QUESTIONS: Array<DemoQuestion> = [
  { id: 'q1', question: 'What is 7 × 8?', choices: ['54', '56', '64', '48'], correctIndex: 1 },
  { id: 'q2', question: 'Which planet is known as the Red Planet?', choices: ['Venus', 'Jupiter', 'Mars', 'Mercury'], correctIndex: 2 },
  { id: 'q3', question: "What is the past tense of 'go'?", choices: ['Goed', 'Went', 'Gone', 'Going'], correctIndex: 1 },
  { id: 'q4', question: 'How many continents are there on Earth?', choices: ['5', '6', '7', '8'], correctIndex: 2 },
  { id: 'q5', question: 'What gas do plants absorb from the air to make food?', choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correctIndex: 2 },
  { id: 'q6', question: 'What is the capital of Kenya?', choices: ['Mombasa', 'Nairobi', 'Kisumu', 'Eldoret'], correctIndex: 1 },
  { id: 'q7', question: 'Solve: 12 ÷ 4 + 3 = ?', choices: ['3', '6', '9', '15'], correctIndex: 1 },
  { id: 'q8', question: 'Which shape has exactly 3 sides?', choices: ['Square', 'Pentagon', 'Triangle', 'Hexagon'], correctIndex: 2 },
]
