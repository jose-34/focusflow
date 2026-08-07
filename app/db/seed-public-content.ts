import { eq } from 'drizzle-orm'
import { adminDb } from './admin'
import { classes, curricula, quizChoices, quizQuestions, quizzes, users } from './schema'

// Real public quiz content across 10 subjects, so /library, the landing
// page's usePublicQuizzes()-backed demo, and public live-game hosting all
// have something genuine to show — not just whatever a teacher happens to
// have published. Idempotent: re-running deletes-then-recreates by title.
// Ownership is mixed on purpose ("published by admin or random teachers"):
// the first 4 are admin-authored (classId null, matches the existing
// admin.content.new.tsx pattern); the rest are attached to one of two
// existing pilot teachers' real classes, so each is simultaneously a
// normal class quiz *and* publicly visible.

type QuestionSpec = [text: string, choices: Array<string>, correctIndex: number]

interface QuizSpec {
  title: string
  curriculumCode: 'cbc' | 'cambridge'
  subjectName: string
  gradeLabel: string
  owner: 'admin' | { teacherEmail: string; classNameContains: string }
  questions: Array<QuestionSpec>
}

const QUIZ_SPECS: Array<QuizSpec> = [
  {
    title: 'Fractions & Percentages Challenge',
    curriculumCode: 'cbc',
    subjectName: 'Mathematics',
    gradeLabel: 'Grade 7',
    owner: 'admin',
    questions: [
      ['What is 3/4 expressed as a percentage?', ['34%', '75%', '43%', '25%'], 1],
      ['Simplify 8/12 to its lowest terms.', ['4/6', '2/3', '3/4', '1/2'], 1],
      ['What is 20% of 150?', ['20', '30', '25', '15'], 1],
      ['Which fraction is equivalent to 0.5?', ['1/3', '1/4', '1/2', '2/5'], 2],
      ['What is 5/8 + 1/8?', ['6/16', '3/4', '6/8', '5/9'], 1],
    ],
  },
  {
    title: 'Cells and Living Things',
    curriculumCode: 'cbc',
    subjectName: 'Integrated Science',
    gradeLabel: 'Grade 8',
    owner: 'admin',
    questions: [
      ['What is the basic unit of life?', ['Tissue', 'Organ', 'Cell', 'Atom'], 2],
      ['Which part of the cell controls its activities?', ['Cytoplasm', 'Nucleus', 'Cell wall', 'Vacuole'], 1],
      ['Plant cells have a rigid structure outside the cell membrane called the:', ['Cell wall', 'Nucleus', 'Chloroplast', 'Ribosome'], 0],
      ['Which organelle is responsible for photosynthesis?', ['Mitochondria', 'Chloroplast', 'Nucleus', 'Vacuole'], 1],
      ['Which of these is NOT a characteristic of living things?', ['Growth', 'Reproduction', 'Respiration', 'Rusting'], 3],
    ],
  },
  {
    title: 'Kenya: Government and Citizenship',
    curriculumCode: 'cbc',
    subjectName: 'Social Studies',
    gradeLabel: 'Grade 7',
    owner: 'admin',
    questions: [
      ['How many counties does Kenya have?', ['37', '45', '47', '50'], 2],
      ["What are Kenya's three arms of government?", ['Executive, Legislature, Judiciary', 'Only Parliament', 'Only the President', 'County governments only'], 0],
      ['Who is the head of the Executive in Kenya?', ['The Chief Justice', 'The Speaker', 'The President', 'The Governor'], 2],
      ['What is the supreme law of Kenya called?', ['The Bill of Rights', 'The Constitution', 'The Gazette', 'The Charter'], 1],
      ['Which house of Parliament represents the counties?', ['National Assembly', 'Senate', 'County Assembly', 'Cabinet'], 1],
    ],
  },
  {
    title: 'Grammar and Comprehension Basics',
    curriculumCode: 'cbc',
    subjectName: 'English',
    gradeLabel: 'Grade 8',
    owner: 'admin',
    questions: [
      ["Choose the correctly spelled word.", ['Recieve', 'Receive', 'Receve', 'Receeve'], 1],
      ["What is the past tense of 'write'?", ['Writed', 'Wrote', 'Written', 'Writting'], 1],
      ['Identify the noun in this sentence: "The teacher explained the lesson clearly."', ['explained', 'clearly', 'teacher', 'the'], 2],
      ["Which word is a synonym for 'happy'?", ['Joyful', 'Angry', 'Tired', 'Sad'], 0],
      ['What punctuation mark ends a question?', ['Full stop', 'Comma', 'Question mark', 'Exclamation mark'], 2],
    ],
  },
  {
    title: 'Msamiati na Sarufi',
    curriculumCode: 'cbc',
    subjectName: 'Kiswahili',
    gradeLabel: 'Grade 7',
    owner: { teacherEmail: 'pilot-grace.mwangi@kitengela.demo', classNameContains: 'Mathematics' },
    questions: [
      ["Nomino ni neno linalotaja:", ['Kitendo', 'Kitu au mtu', 'Hali', 'Wakati'], 1],
      ["Kinyume cha neno 'kubwa' ni:", ['Ndogo', 'Nzuri', 'Refu', 'Nyeusi'], 0],
      ["'Wanafunzi wanasoma vitabu.' Ni sentensi ya wakati gani?", ['Uliopita', 'Uliopo', 'Ujao', 'Hakuna wakati'], 1],
      ["Neno 'haraka' ni aina gani ya neno?", ['Nomino', 'Kitenzi', 'Kielezi', 'Kivumishi'], 2],
      ["Umoja wa 'vitabu' ni:", ['Kitabu', 'Vitabu', 'Chitabu', 'Kitabuu'], 0],
    ],
  },
  {
    title: 'Soil, Crops and Farm Animals',
    curriculumCode: 'cbc',
    subjectName: 'Agriculture and Nutrition',
    gradeLabel: 'Grade 8',
    owner: { teacherEmail: 'pilot-grace.mwangi@kitengela.demo', classNameContains: 'Mathematics' },
    questions: [
      ['Which soil type retains the most water?', ['Sandy soil', 'Clay soil', 'Loam soil', 'Rocky soil'], 1],
      ['What is the process of loosening soil before planting called?', ['Harvesting', 'Tilling', 'Weeding', 'Mulching'], 1],
      ['Which of these is a legume crop?', ['Maize', 'Beans', 'Wheat', 'Rice'], 1],
      ['What do we call animals kept for milk, meat, or labour on a farm?', ['Wildlife', 'Livestock', 'Pests', 'Parasites'], 1],
      ['Which nutrient do legumes add back to the soil?', ['Nitrogen', 'Carbon', 'Potassium', 'Iron'], 0],
    ],
  },
  {
    title: 'Forces and Energy Basics',
    curriculumCode: 'cambridge',
    subjectName: 'Physics',
    gradeLabel: 'Grade 8',
    owner: { teacherEmail: 'pilot-peter.otieno@kitengela.demo', classNameContains: 'Pre-Technical' },
    questions: [
      ['What force pulls objects toward the Earth?', ['Friction', 'Gravity', 'Magnetism', 'Tension'], 1],
      ['What is the SI unit of force?', ['Joule', 'Watt', 'Newton', 'Pascal'], 2],
      ['Which type of energy does a moving object have?', ['Potential energy', 'Kinetic energy', 'Chemical energy', 'Thermal energy'], 1],
      ['What happens to the speed of an object when unbalanced forces act on it?', ['It stays the same', 'It changes', 'It becomes zero', 'It reverses instantly'], 1],
      ['Which of these is a renewable energy source?', ['Coal', 'Natural gas', 'Wind', 'Petroleum'], 2],
    ],
  },
  {
    title: 'Human Biology Foundations',
    curriculumCode: 'cambridge',
    subjectName: 'Biology',
    gradeLabel: 'Grade 9',
    owner: { teacherEmail: 'pilot-peter.otieno@kitengela.demo', classNameContains: 'Pre-Technical' },
    questions: [
      ['Which organ pumps blood around the body?', ['Lungs', 'Heart', 'Liver', 'Kidney'], 1],
      ['What is the main function of red blood cells?', ['Fight infection', 'Carry oxygen', 'Clot blood', 'Digest food'], 1],
      ['Which gas do we breathe out in greater amounts than we breathe in?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 2],
      ['Where does digestion of food begin?', ['Stomach', 'Small intestine', 'Mouth', 'Large intestine'], 2],
      ['Which system in the body fights disease?', ['Circulatory system', 'Immune system', 'Skeletal system', 'Nervous system'], 1],
    ],
  },
  {
    title: 'Map Skills and Physical Geography',
    curriculumCode: 'cambridge',
    subjectName: 'Geography',
    gradeLabel: 'Grade 8',
    owner: 'admin',
    questions: [
      ['What do contour lines on a map show?', ['Rainfall', 'Elevation', 'Temperature', 'Population'], 1],
      ['What is the imaginary line that divides the Earth into Northern and Southern Hemispheres?', ['Equator', 'Prime Meridian', 'Tropic of Cancer', 'International Date Line'], 0],
      ['Which instrument is used to measure atmospheric pressure?', ['Thermometer', 'Barometer', 'Anemometer', 'Hygrometer'], 1],
      ['What is a large area of flat land at a high elevation called?', ['Valley', 'Plateau', 'Basin', 'Delta'], 1],
      ['Which of these is a renewable source of energy?', ['Coal', 'Natural gas', 'Solar power', 'Petroleum'], 2],
    ],
  },
  {
    title: 'World History: Key Turning Points',
    curriculumCode: 'cambridge',
    subjectName: 'History',
    gradeLabel: 'Grade 9',
    owner: 'admin',
    questions: [
      ['In what year did the Second World War end?', ['1943', '1945', '1948', '1950'], 1],
      ['Which country was the first to industrialize in the 18th-19th century?', ['France', 'Britain', 'Germany', 'USA'], 1],
      ['What was the main aim of the United Nations when founded?', ['Trade', 'World peace', 'Sport', 'Education'], 1],
      ['The Berlin Wall fell in which year?', ['1985', '1989', '1991', '1995'], 1],
      ['Which ancient civilization built the pyramids of Giza?', ['Roman', 'Greek', 'Egyptian', 'Persian'], 2],
    ],
  },
]

async function findClassId(teacherEmail: string, classNameContains: string): Promise<{ classId: string; teacherId: string }> {
  const teacher = await adminDb.query.users.findFirst({ where: eq(users.email, teacherEmail) })
  if (!teacher) throw new Error(`Seed teacher not found: ${teacherEmail} — run npm run db:seed-pilot-demo first`)
  const teacherClasses = await adminDb.query.classes.findMany({ where: eq(classes.teacherId, teacher.id) })
  const match = teacherClasses.find((c) => c.name.includes(classNameContains))
  if (!match) throw new Error(`No class containing "${classNameContains}" found for ${teacherEmail}`)
  return { classId: match.id, teacherId: teacher.id }
}

async function main() {
  const admin = await adminDb.query.users.findFirst({ where: eq(users.role, 'admin') })
  if (!admin) throw new Error('No admin account found — run npm run db:seed-admin first')

  // Idempotent: clear any prior run's rows by title before recreating.
  for (const spec of QUIZ_SPECS) {
    const existing = await adminDb.query.quizzes.findMany({ where: eq(quizzes.title, spec.title) })
    for (const q of existing) {
      const qs = await adminDb.query.quizQuestions.findMany({ where: eq(quizQuestions.quizId, q.id) })
      for (const question of qs) {
        await adminDb.delete(quizChoices).where(eq(quizChoices.questionId, question.id))
      }
      await adminDb.delete(quizQuestions).where(eq(quizQuestions.quizId, q.id))
      await adminDb.delete(quizzes).where(eq(quizzes.id, q.id))
    }
  }

  let created = 0
  for (const spec of QUIZ_SPECS) {
    const curriculum = await adminDb.query.curricula.findFirst({ where: eq(curricula.code, spec.curriculumCode) })
    if (!curriculum) throw new Error(`Curriculum not seeded: ${spec.curriculumCode} — run npm run db:seed-curricula first`)
    const subject = await adminDb.query.subjects.findFirst({
      where: (s, { eq: eqOp, and: andOp }) => andOp(eqOp(s.curriculumId, curriculum.id), eqOp(s.name, spec.subjectName)),
    })
    if (!subject) throw new Error(`Subject not seeded: ${spec.subjectName} (${spec.curriculumCode})`)

    let classId: string | null = null
    let authorId: string = admin.id
    if (spec.owner !== 'admin') {
      const found = await findClassId(spec.owner.teacherEmail, spec.owner.classNameContains)
      classId = found.classId
      authorId = found.teacherId
    }

    const [quiz] = await adminDb
      .insert(quizzes)
      .values({
        classId,
        authorId,
        visibility: 'public',
        isPublished: true,
        curriculumId: curriculum.id,
        subjectId: subject.id,
        gradeLabel: spec.gradeLabel,
        title: spec.title,
        description: `A public ${spec.subjectName} quiz for ${spec.gradeLabel}.`,
      })
      .returning()

    for (let i = 0; i < spec.questions.length; i++) {
      const [text, choiceTexts, correctIndex] = spec.questions[i]
      const [question] = await adminDb
        .insert(quizQuestions)
        .values({ quizId: quiz.id, questionText: text, position: i, points: 1 })
        .returning()
      await adminDb.insert(quizChoices).values(
        choiceTexts.map((choiceText, idx) => ({
          questionId: question.id,
          choiceText,
          isCorrect: idx === correctIndex,
          position: idx,
        })),
      )
    }

    created += 1
    console.log(`✅ ${spec.title} (${spec.subjectName}, ${spec.gradeLabel}) — ${spec.owner === 'admin' ? 'admin' : spec.owner.teacherEmail}`)
  }

  console.log(`\nSeeded ${created} public quizzes across ${new Set(QUIZ_SPECS.map((s) => s.subjectName)).size} subjects.`)
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
