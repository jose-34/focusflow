export interface DemoQuestion {
  id: string
  question: string
  choices: Array<string>
  correctIndex: number
}

export type DemoSubject = 'mathematics' | 'english' | 'science' | 'social_studies'
export type GradeBand = 'early_years' | 'lower_primary' | 'upper_primary' | 'junior_secondary'

export const DEMO_SUBJECTS: Array<{ id: DemoSubject; label: string }> = [
  { id: 'mathematics', label: 'Mathematics' },
  { id: 'english', label: 'English' },
  { id: 'science', label: 'Integrated Science' },
  { id: 'social_studies', label: 'Social Studies' },
]

// CBC's actual grade sequence — Pre-Primary 1/2, then Grade 1-9.
export const DEMO_GRADES = ['PP1', 'PP2', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9'] as const

export function bandForGrade(grade: string): GradeBand {
  if (grade === 'PP1' || grade === 'PP2') return 'early_years'
  const n = Number(grade.replace('Grade ', ''))
  if (n <= 3) return 'lower_primary'
  if (n <= 6) return 'upper_primary'
  return 'junior_secondary'
}

// Deliberately generic, curriculum-flavored sample content — never real
// class/quiz data, which is private and RLS-protected. This is the only
// question content an anonymous landing-page visitor is ever shown.
// Bucketed by grade *band* rather than one set per exact grade — honest
// difficulty targeting without needing 11 separately-authored sets per
// subject.
export const DEMO_QUESTION_BANK: Record<DemoSubject, Record<GradeBand, Array<DemoQuestion>>> = {
  mathematics: {
    early_years: [
      { id: 'math-ey-1', question: 'How many apples? 🍎🍎🍎', choices: ['2', '3', '4', '5'], correctIndex: 1 },
      { id: 'math-ey-2', question: 'What comes after 4?', choices: ['3', '5', '6', '7'], correctIndex: 1 },
      { id: 'math-ey-3', question: 'Which shape has no corners?', choices: ['Circle', 'Square', 'Triangle', 'Star'], correctIndex: 0 },
      { id: 'math-ey-4', question: '2 + 1 = ?', choices: ['2', '3', '4', '5'], correctIndex: 1 },
    ],
    lower_primary: [
      { id: 'math-lp-1', question: 'What is 5 + 7?', choices: ['10', '11', '12', '13'], correctIndex: 2 },
      { id: 'math-lp-2', question: 'What is 9 − 4?', choices: ['4', '5', '6', '3'], correctIndex: 1 },
      { id: 'math-lp-3', question: 'Which number is even?', choices: ['7', '9', '8', '11'], correctIndex: 2 },
      { id: 'math-lp-4', question: 'How many sides does a triangle have?', choices: ['2', '3', '4', '5'], correctIndex: 1 },
    ],
    upper_primary: [
      { id: 'math-up-1', question: 'What is 7 × 8?', choices: ['54', '56', '64', '48'], correctIndex: 1 },
      { id: 'math-up-2', question: 'What is half of 20?', choices: ['5', '8', '10', '15'], correctIndex: 2 },
      { id: 'math-up-3', question: 'What is 100 ÷ 4?', choices: ['20', '25', '30', '40'], correctIndex: 1 },
      { id: 'math-up-4', question: 'A square has sides of 5cm. What is its perimeter?', choices: ['15cm', '20cm', '25cm', '10cm'], correctIndex: 1 },
    ],
    junior_secondary: [
      { id: 'math-js-1', question: 'Solve: 3x = 12. What is x?', choices: ['3', '4', '5', '6'], correctIndex: 1 },
      { id: 'math-js-2', question: 'What is 15% of 200?', choices: ['20', '25', '30', '40'], correctIndex: 2 },
      { id: 'math-js-3', question: 'What is the square root of 81?', choices: ['7', '8', '9', '10'], correctIndex: 2 },
      { id: 'math-js-4', question: 'Simplify: 2(x + 3)', choices: ['2x + 3', '2x + 6', 'x + 6', '2x + 5'], correctIndex: 1 },
    ],
  },
  english: {
    early_years: [
      { id: 'eng-ey-1', question: "Which letter comes after 'B'?", choices: ['A', 'C', 'D', 'E'], correctIndex: 1 },
      { id: 'eng-ey-2', question: 'What sound does a cat make?', choices: ['Moo', 'Meow', 'Woof', 'Baa'], correctIndex: 1 },
      { id: 'eng-ey-3', question: "Which word rhymes with 'cat'?", choices: ['Dog', 'Hat', 'Sun', 'Cup'], correctIndex: 1 },
      { id: 'eng-ey-4', question: "What is the opposite of 'up'?", choices: ['Down', 'Left', 'Big', 'Fast'], correctIndex: 0 },
    ],
    lower_primary: [
      { id: 'eng-lp-1', question: 'Which word is a noun?', choices: ['Run', 'Happy', 'Dog', 'Quickly'], correctIndex: 2 },
      { id: 'eng-lp-2', question: "What is the plural of 'child'?", choices: ['Childs', 'Children', 'Childes', 'Child'], correctIndex: 1 },
      { id: 'eng-lp-3', question: 'Choose the correct spelling.', choices: ['Freind', 'Friend', 'Frend', 'Friand'], correctIndex: 1 },
      { id: 'eng-lp-4', question: "What is the opposite of 'big'?", choices: ['Tall', 'Small', 'Wide', 'Long'], correctIndex: 1 },
    ],
    upper_primary: [
      { id: 'eng-up-1', question: "What is the past tense of 'go'?", choices: ['Goed', 'Went', 'Gone', 'Going'], correctIndex: 1 },
      { id: 'eng-up-2', question: "Which is a synonym for 'happy'?", choices: ['Sad', 'Joyful', 'Angry', 'Tired'], correctIndex: 1 },
      { id: 'eng-up-3', question: "Identify the verb: 'She quickly ran home.'", choices: ['Quickly', 'Ran', 'Home', 'She'], correctIndex: 1 },
      { id: 'eng-up-4', question: 'What punctuation mark ends a question?', choices: ['Period', 'Comma', 'Question mark', 'Exclamation'], correctIndex: 2 },
    ],
    junior_secondary: [
      { id: 'eng-js-1', question: "What is a synonym for 'enormous'?", choices: ['Tiny', 'Huge', 'Quiet', 'Fast'], correctIndex: 1 },
      { id: 'eng-js-2', question: 'What is a metaphor?', choices: ["A comparison using 'like'", 'A direct comparison without "like"', 'A question', 'A rhyme'], correctIndex: 1 },
      { id: 'eng-js-3', question: "What is the antonym of 'ancient'?", choices: ['Old', 'Modern', 'Historic', 'Broken'], correctIndex: 1 },
      { id: 'eng-js-4', question: 'Which word is an adverb?', choices: ['Quick', 'Quickly', 'Quickness', 'Quicker'], correctIndex: 1 },
    ],
  },
  science: {
    early_years: [
      { id: 'sci-ey-1', question: 'What do plants need to grow?', choices: ['Water', 'Rocks', 'Sand', 'Ice'], correctIndex: 0 },
      { id: 'sci-ey-2', question: "Which animal says 'moo'?", choices: ['Cat', 'Cow', 'Dog', 'Duck'], correctIndex: 1 },
      { id: 'sci-ey-3', question: 'What color is the clear daytime sky?', choices: ['Green', 'Blue', 'Red', 'Yellow'], correctIndex: 1 },
      { id: 'sci-ey-4', question: 'How many legs does a bird have?', choices: ['2', '4', '6', '8'], correctIndex: 0 },
    ],
    lower_primary: [
      { id: 'sci-lp-1', question: 'What do we call a baby dog?', choices: ['Kitten', 'Puppy', 'Cub', 'Calf'], correctIndex: 1 },
      { id: 'sci-lp-2', question: 'Which part of a plant absorbs water?', choices: ['Leaves', 'Roots', 'Flowers', 'Stem'], correctIndex: 1 },
      { id: 'sci-lp-3', question: 'What is ice made of?', choices: ['Sand', 'Water', 'Salt', 'Air'], correctIndex: 1 },
      { id: 'sci-lp-4', question: 'Which sense do we use to hear?', choices: ['Eyes', 'Ears', 'Nose', 'Skin'], correctIndex: 1 },
    ],
    upper_primary: [
      { id: 'sci-up-1', question: 'What gas do plants absorb to make food?', choices: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correctIndex: 2 },
      { id: 'sci-up-2', question: 'What is the center of our solar system?', choices: ['Earth', 'Moon', 'Sun', 'Mars'], correctIndex: 2 },
      { id: 'sci-up-3', question: 'Which organ pumps blood in the body?', choices: ['Lungs', 'Heart', 'Brain', 'Liver'], correctIndex: 1 },
      { id: 'sci-up-4', question: 'What state of matter is steam?', choices: ['Solid', 'Liquid', 'Gas', 'Plasma'], correctIndex: 2 },
    ],
    junior_secondary: [
      { id: 'sci-js-1', question: 'What is the chemical symbol for water?', choices: ['H2O', 'CO2', 'O2', 'NaCl'], correctIndex: 0 },
      { id: 'sci-js-2', question: 'What force pulls objects toward Earth?', choices: ['Friction', 'Gravity', 'Magnetism', 'Tension'], correctIndex: 1 },
      { id: 'sci-js-3', question: "Which organelle is the cell's powerhouse?", choices: ['Nucleus', 'Mitochondria', 'Ribosome', 'Chloroplast'], correctIndex: 1 },
      { id: 'sci-js-4', question: "What is water's boiling point in Celsius?", choices: ['90', '100', '110', '120'], correctIndex: 1 },
    ],
  },
  social_studies: {
    early_years: [
      { id: 'soc-ey-1', question: 'Who teaches you at school?', choices: ['Doctor', 'Teacher', 'Farmer', 'Driver'], correctIndex: 1 },
      { id: 'soc-ey-2', question: 'What do we call the place we live in?', choices: ['Home', 'Shop', 'School', 'Park'], correctIndex: 0 },
      { id: 'soc-ey-3', question: 'Which of these is a family member?', choices: ['Teacher', 'Mother', 'Doctor', 'Police officer'], correctIndex: 1 },
      { id: 'soc-ey-4', question: 'What should you say when someone helps you?', choices: ['Sorry', 'Thank you', 'Goodbye', 'Wait'], correctIndex: 1 },
    ],
    lower_primary: [
      { id: 'soc-lp-1', question: 'What is the capital of Kenya?', choices: ['Mombasa', 'Nairobi', 'Kisumu', 'Eldoret'], correctIndex: 1 },
      { id: 'soc-lp-2', question: "What is Kenya's national animal symbol?", choices: ['Elephant', 'Lion', 'Zebra', 'Giraffe'], correctIndex: 1 },
      { id: 'soc-lp-3', question: 'Which ocean borders Kenya?', choices: ['Atlantic', 'Pacific', 'Indian', 'Arctic'], correctIndex: 2 },
      { id: 'soc-lp-4', question: 'What do we call people who grow crops?', choices: ['Teachers', 'Farmers', 'Doctors', 'Drivers'], correctIndex: 1 },
    ],
    upper_primary: [
      { id: 'soc-up-1', question: 'How many counties does Kenya have?', choices: ['37', '45', '47', '50'], correctIndex: 2 },
      { id: 'soc-up-2', question: 'What is the currency of Kenya?', choices: ['Dollar', 'Shilling', 'Rand', 'Naira'], correctIndex: 1 },
      { id: 'soc-up-3', question: 'Which continent is Kenya located in?', choices: ['Asia', 'Africa', 'Europe', 'South America'], correctIndex: 1 },
      { id: 'soc-up-4', question: 'Who leads county government in Kenya?', choices: ['Senator', 'Governor', 'President', 'Chief'], correctIndex: 1 },
    ],
    junior_secondary: [
      { id: 'soc-js-1', question: 'In what year did Kenya gain independence?', choices: ['1960', '1963', '1965', '1970'], correctIndex: 1 },
      { id: 'soc-js-2', question: "What are Kenya's arms of government?", choices: ['Executive, Legislature, Judiciary', 'Only Parliament', 'Only the President', 'Counties only'], correctIndex: 0 },
      { id: 'soc-js-3', question: "What is Kenya's Parliament made up of?", choices: ['Senate only', 'National Assembly and Senate', 'Congress', 'County Council'], correctIndex: 1 },
      { id: 'soc-js-4', question: "Who was Kenya's first president?", choices: ['Daniel Moi', 'Jomo Kenyatta', 'Mwai Kibaki', 'Uhuru Kenyatta'], correctIndex: 1 },
    ],
  },
}

export function getDemoQuestions(subject: DemoSubject, grade: string): Array<DemoQuestion> {
  return DEMO_QUESTION_BANK[subject][bandForGrade(grade)]
}
