import { adminDb } from './admin'
import { curricula, subjects } from './schema'

/**
 * Idempotent — safe to re-run. Reference data only, so this is the sole
 * writer for these tables (RLS grants no insert/update/delete policy to
 * any application role).
 */
const CURRICULA = [
  {
    code: 'cbc',
    name: 'Competency-Based Curriculum (CBC)',
    country: 'Kenya',
    description: "Kenya's competency-based curriculum for junior and senior school.",
    subjectNames: [
      'English',
      'Kiswahili',
      'Mathematics',
      'Integrated Science',
      'Social Studies',
      'Agriculture and Nutrition',
      'Pre-Technical Studies',
      'Creative Arts and Sports',
      'Christian Religious Education',
      'Islamic Religious Education',
    ],
  },
  {
    code: 'cambridge',
    name: 'Cambridge International',
    country: null,
    description: 'Cambridge Lower/Upper Secondary international curriculum.',
    subjectNames: [
      'English',
      'Mathematics',
      'Biology',
      'Chemistry',
      'Physics',
      'Global Perspectives',
      'Information and Communication Technology',
      'Geography',
      'History',
      'Business Studies',
    ],
  },
] as const

async function main() {
  for (const { code, name, country, description, subjectNames } of CURRICULA) {
    const [curriculum] = await adminDb
      .insert(curricula)
      .values({ code, name, country, description })
      .onConflictDoUpdate({
        target: curricula.code,
        set: { name, country, description },
      })
      .returning()

    for (const subjectName of subjectNames) {
      await adminDb
        .insert(subjects)
        .values({ curriculumId: curriculum.id, name: subjectName })
        .onConflictDoUpdate({
          target: [subjects.curriculumId, subjects.name],
          set: { name: subjectName },
        })
    }

    console.log(`✅ ${curriculum.name}: ${subjectNames.length} subjects`)
  }

  console.log('Done seeding curricula.')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
