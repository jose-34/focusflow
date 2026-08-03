import { sql } from 'drizzle-orm'
import { adminDb } from './admin'

// One-off backfill for quizzes created before quizzes.authorId existed —
// every quiz at that point was class-owned, so its author is simply that
// class's teacher. New quizzes always set authorId at insert time.
async function main() {
  const result = await adminDb.execute(sql`
    UPDATE quizzes
    SET author_id = classes.teacher_id
    FROM classes
    WHERE quizzes.class_id = classes.id
      AND quizzes.author_id IS NULL
  `)
  console.log(`Backfilled authorId on ${result.length ?? 'some'} quiz row(s).`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
