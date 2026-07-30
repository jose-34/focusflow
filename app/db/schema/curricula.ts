import { index, pgPolicy, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

// Reference data, not enums: a new curriculum or subject must be a plain INSERT,
// never a migration touching an enum type referenced across the schema — this
// is what actually lets new curricula be added later without breaking anything.
export const curricula = pgTable(
  'curricula',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    country: text('country'),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  () => [pgPolicy('curricula_select', { for: 'select' })],
).enableRLS()

export const subjects = pgTable(
  'subjects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    curriculumId: uuid('curriculum_id')
      .notNull()
      .references(() => curricula.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    code: text('code'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('subjects_curriculum_name_idx').on(table.curriculumId, table.name),
    index('subjects_curriculum_id_idx').on(table.curriculumId),
    pgPolicy('subjects_select', { for: 'select' }),
  ],
).enableRLS()

export type Curriculum = typeof curricula.$inferSelect
export type NewCurriculum = typeof curricula.$inferInsert
export type Subject = typeof subjects.$inferSelect
export type NewSubject = typeof subjects.$inferInsert
