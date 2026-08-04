import { sql } from 'drizzle-orm'
import { adminDb } from './admin'

/**
 * drizzle-kit push does not emit the USING/WITH CHECK bodies from
 * pgPolicy() definitions in app/db/schema (confirmed by inspecting
 * pg_policies after a push: qual/with_check come back NULL) — schema.ts
 * keeps `.enableRLS()` and policy *names* for documentation, but the real
 * enforced policy body lives here, applied directly via the admin
 * (superuser) connection. Run this (`npm run db:rls`) after every
 * `drizzle-kit push`.
 *
 * Cross-table checks (e.g. "is this user the teacher who owns this
 * class?") are wrapped in SECURITY DEFINER functions rather than inlined
 * as EXISTS subqueries directly in policy bodies. This isn't a style
 * choice — `classes`'s policy needs to check `enrollments`, and
 * `enrollments`'s policy needs to check `classes` right back, which
 * causes Postgres to report "infinite recursion detected in policy for
 * relation classes" if both checks are plain subqueries (each table's RLS
 * evaluation re-triggers the other table's RLS evaluation). A SECURITY
 * DEFINER function owned by the superuser runs its internal query with
 * the *owner's* privileges, bypassing RLS for that lookup entirely, which
 * breaks the cycle.
 */
const CU = "nullif(current_setting('app.user_id', true), '')::uuid"

const functions = [
  {
    name: 'fn_has_role',
    sql: `
      create or replace function fn_has_role(p_role text)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (select 1 from users u where u.id = ${CU} and u.role::text = p_role)
      $$;
    `,
  },
  {
    name: 'fn_is_class_teacher',
    sql: `
      create or replace function fn_is_class_teacher(p_class_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (select 1 from classes c where c.id = p_class_id and c.teacher_id = ${CU})
      $$;
    `,
  },
  {
    name: 'fn_is_class_student',
    sql: `
      create or replace function fn_is_class_student(p_class_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from enrollments e
          where e.class_id = p_class_id and e.student_id = ${CU} and e.status = 'active'
        )
      $$;
    `,
  },
  {
    // Despite the name (kept stable — used by ~10 downstream policies),
    // this now also covers an admin's own classless public content: "owned
    // by whoever is allowed to manage this quiz's questions," not literally
    // limited to a class-teacher relationship anymore.
    name: 'fn_quiz_owned_by_teacher',
    sql: `
      create or replace function fn_quiz_owned_by_teacher(p_quiz_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from quizzes q
          where q.id = p_quiz_id and (
            fn_is_class_teacher(q.class_id)
            or (q.class_id is null and q.author_id = ${CU} and fn_has_role('admin'))
          )
        )
      $$;
    `,
  },
  {
    // Extended for the admin content system: a published quiz with
    // visibility = 'public' is visible to any authenticated student, not
    // just one enrolled in its (possibly nonexistent, for admin content)
    // class. Anonymous/landing-page access is a separate adminDb-backed
    // read path (getPublicQuizzesFn) — this function only ever runs inside
    // an authenticated RLS context.
    name: 'fn_quiz_visible_to_student',
    sql: `
      create or replace function fn_quiz_visible_to_student(p_quiz_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from quizzes q
          where q.id = p_quiz_id and q.is_published
            and (fn_is_class_student(q.class_id) or q.visibility = 'public')
        )
      $$;
    `,
  },
  {
    name: 'fn_question_quiz_owned_by_teacher',
    sql: `
      create or replace function fn_question_quiz_owned_by_teacher(p_question_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from quiz_questions qq
          where qq.id = p_question_id and fn_quiz_owned_by_teacher(qq.quiz_id)
        )
      $$;
    `,
  },
  {
    name: 'fn_question_quiz_visible_to_student',
    sql: `
      create or replace function fn_question_quiz_visible_to_student(p_question_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from quiz_questions qq
          where qq.id = p_question_id and fn_quiz_visible_to_student(qq.quiz_id)
        )
      $$;
    `,
  },
  {
    name: 'fn_attempt_owned_by_student',
    sql: `
      create or replace function fn_attempt_owned_by_student(p_attempt_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (select 1 from quiz_attempts a where a.id = p_attempt_id and a.student_id = ${CU})
      $$;
    `,
  },
  {
    name: 'fn_related_via_class',
    sql: `
      create or replace function fn_related_via_class(p_user_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          -- p_user_id teaches a class the current user is enrolled in
          select 1 from classes c
          join enrollments e on e.class_id = c.id
          where c.teacher_id = p_user_id and e.student_id = ${CU} and e.status = 'active'
        ) or exists (
          -- p_user_id is a student enrolled in a class the current user teaches
          select 1 from enrollments e
          join classes c on c.id = e.class_id
          where e.student_id = p_user_id and c.teacher_id = ${CU} and e.status = 'active'
        )
      $$;
    `,
  },
  {
    name: 'fn_attempt_visible_to_teacher',
    sql: `
      create or replace function fn_attempt_visible_to_teacher(p_attempt_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from quiz_attempts a
          where a.id = p_attempt_id and fn_quiz_owned_by_teacher(a.quiz_id)
        )
      $$;
    `,
  },
  {
    // quiz_answer_choices (multi_select) has no attempt_id column of its
    // own — joins through quiz_answers to reuse the same ownership check
    // as quiz_answers itself, rather than duplicating the join logic in
    // every policy that needs it.
    name: 'fn_answer_owned_by_student',
    sql: `
      create or replace function fn_answer_owned_by_student(p_answer_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from quiz_answers qa
          where qa.id = p_answer_id and fn_attempt_owned_by_student(qa.attempt_id)
        )
      $$;
    `,
  },
  {
    name: 'fn_answer_visible_to_teacher',
    sql: `
      create or replace function fn_answer_visible_to_teacher(p_answer_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from quiz_answers qa
          where qa.id = p_answer_id and fn_attempt_visible_to_teacher(qa.attempt_id)
        )
      $$;
    `,
  },
  {
    name: 'fn_game_session_owned_by_teacher',
    sql: `
      create or replace function fn_game_session_owned_by_teacher(p_session_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from game_sessions gs
          where gs.id = p_session_id and fn_quiz_owned_by_teacher(gs.quiz_id)
        )
      $$;
    `,
  },
  {
    // Deliberately does NOT check is_published: the live-game PIN is its own
    // access gate, independent of whether the quiz is published for async
    // take-anytime play. A teacher can host a draft quiz live; a student who
    // is enrolled in that quiz's class and has the PIN can join either way.
    name: 'fn_can_join_game_session',
    sql: `
      create or replace function fn_can_join_game_session(p_session_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from game_sessions gs
          join quizzes q on q.id = gs.quiz_id
          where gs.id = p_session_id and fn_is_class_student(q.class_id)
        )
      $$;
    `,
  },
  {
    name: 'fn_is_game_participant',
    sql: `
      create or replace function fn_is_game_participant(p_session_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from game_participants gp
          where gp.session_id = p_session_id and gp.student_id = ${CU}
        )
      $$;
    `,
  },
  {
    // A live-hosted game is its own access gate (see fn_can_join_game_session)
    // independent of is_published — so question/choice visibility for a
    // student must also have a path that doesn't depend on is_published, or a
    // player in a draft quiz's live game would see zero questions.
    name: 'fn_quiz_visible_via_game',
    sql: `
      create or replace function fn_quiz_visible_via_game(p_quiz_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from game_sessions gs
          where gs.quiz_id = p_quiz_id and fn_is_game_participant(gs.id)
        )
      $$;
    `,
  },
  {
    name: 'fn_question_quiz_visible_via_game',
    sql: `
      create or replace function fn_question_quiz_visible_via_game(p_question_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from quiz_questions qq
          where qq.id = p_question_id and fn_quiz_visible_via_game(qq.quiz_id)
        )
      $$;
    `,
  },
  {
    name: 'fn_participant_owned_by_student',
    sql: `
      create or replace function fn_participant_owned_by_student(p_participant_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (select 1 from game_participants gp where gp.id = p_participant_id and gp.student_id = ${CU})
      $$;
    `,
  },
  {
    name: 'fn_participant_session_owned_by_teacher',
    sql: `
      create or replace function fn_participant_session_owned_by_teacher(p_participant_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from game_participants gp
          where gp.id = p_participant_id and fn_game_session_owned_by_teacher(gp.session_id)
        )
      $$;
    `,
  },
  {
    // Queries `tasks` (a different table than focus_sessions), so calling
    // this from focus_sessions' own select policy is safe under
    // INSERT/UPDATE ... RETURNING — no self-reference on focus_sessions.
    name: 'fn_task_is_quiz_owned_by_teacher',
    sql: `
      create or replace function fn_task_is_quiz_owned_by_teacher(p_task_id uuid)
      returns boolean
      language sql
      security definer
      set search_path = public
      stable
      as $$
        select exists (
          select 1 from tasks t
          where t.id = p_task_id and t.quiz_id is not null and fn_quiz_owned_by_teacher(t.quiz_id)
        )
      $$;
    `,
  },
]

interface RlsPolicy {
  table: string
  name: string
  for: 'all' | 'select' | 'insert' | 'update' | 'delete'
  using?: string
  withCheck?: string
}

const policies: Array<RlsPolicy> = [
  // --- Simple self-access tables ---
  { table: 'users', name: 'users_self_access', for: 'all', using: `${CU} = id`, withCheck: `${CU} = id` },
  // A teacher and their enrolled students need each other's basic profile info
  // (name shown on rosters/quiz results, teacher name shown on class cards).
  // Without this, the nested Drizzle query (enrollments -> classes -> users)
  // silently comes back with a null related user under the self-access-only
  // policy above, crashing on `.firstName` at the application layer.
  { table: 'users', name: 'users_class_relation_select', for: 'select', using: `fn_related_via_class(id)` },
  {
    table: 'sessions',
    name: 'sessions_self_access',
    for: 'all',
    using: `${CU} = user_id`,
    withCheck: `${CU} = user_id`,
  },
  { table: 'tasks', name: 'tasks_self_access', for: 'all', using: `${CU} = user_id`, withCheck: `${CU} = user_id` },
  // Additive: lets a teacher see (only) the assignment tasks their own
  // quiz auto-created — never a student's other private personal tasks.
  // quiz_id is never client-settable on the regular create-task path, so a
  // student can't fabricate a row here to spoof the teacher-visible signal.
  {
    table: 'tasks',
    name: 'tasks_teacher_select',
    for: 'select',
    // Sprint 1: OR'd with the Practice Task case — class_id is likewise
    // never client-settable on the personal-task create path (only the
    // server's fan-out sets it), so this can't be spoofed the same way
    // quiz_id can't be.
    using: `(quiz_id is not null and fn_quiz_owned_by_teacher(quiz_id)) or (class_id is not null and fn_is_class_teacher(class_id))`,
  },
  // Sprint 1, found by testing (not assumed): tasks_self_access's WITH CHECK
  // (user_id = CU) blocks the practice-task fan-out entirely — a teacher's
  // session inserting a row on a STUDENT's behalf fails RLS, since the
  // inserted row's user_id is the student's, not the teacher's. This is a
  // second, additive INSERT policy narrowly scoped to exactly that one
  // case: only 'practice'-typed rows, only into a class the inserting user
  // teaches — it can never be used to insert a personal or quiz-linked task
  // for someone else.
  {
    table: 'tasks',
    name: 'tasks_teacher_insert_practice',
    for: 'insert',
    withCheck: `task_type = 'practice' and class_id is not null and fn_is_class_teacher(class_id)`,
  },
  // Sprint 1: task_templates is the teacher's own object end-to-end — no
  // separate student-visibility case needed here, since a student never
  // reads a template directly, only their own fanned-out `tasks` row.
  { table: 'task_templates', name: 'task_templates_all', for: 'all', using: `fn_is_class_teacher(class_id)`, withCheck: `fn_is_class_teacher(class_id)` },
  {
    table: 'focus_sessions',
    name: 'focus_sessions_self_access',
    for: 'all',
    using: `${CU} = user_id`,
    withCheck: `${CU} = user_id`,
  },
  // Additive: lets a teacher see (only) focus sessions linked to a task tied
  // to their own quiz assignment — never a student's other private sessions.
  {
    table: 'focus_sessions',
    name: 'focus_sessions_teacher_select',
    for: 'select',
    using: `task_id is not null and fn_task_is_quiz_owned_by_teacher(task_id)`,
  },
  {
    table: 'distraction_events',
    name: 'distraction_events_self_access',
    for: 'all',
    using: `${CU} = user_id`,
    withCheck: `${CU} = user_id`,
  },
  {
    table: 'login_events',
    name: 'login_events_self_access',
    for: 'all',
    using: `${CU} = user_id`,
    withCheck: `${CU} = user_id`,
  },
  {
    table: 'missions',
    name: 'missions_self_access',
    for: 'all',
    using: `${CU} = student_id`,
    withCheck: `${CU} = student_id`,
  },
  {
    table: 'user_achievements',
    name: 'user_achievements_self_access',
    for: 'all',
    using: `${CU} = user_id`,
    withCheck: `${CU} = user_id`,
  },
  {
    // Deliberately no teacher visibility: mood/notes are private mental-health data.
    table: 'wellness_logs',
    name: 'wellness_logs_self_access',
    for: 'all',
    using: `${CU} = user_id`,
    withCheck: `${CU} = user_id`,
  },
  {
    // Fix, 09_Database_Design.md: this policy's body was defined inline in
    // xp_ledger.ts but silently dropped by drizzle-kit push (never applied
    // here before) — confirmed live: INSERT through withRlsContext failed.
    table: 'xp_ledger',
    name: 'xp_ledger_self_access',
    for: 'all',
    using: `${CU} = user_id`,
    withCheck: `${CU} = user_id`,
  },
  {
    // Sprint 4: start_events table deleted, folded into focus_sessions —
    // this policy no longer applies to anything and was removed alongside
    // it (its fix is preserved in focus_sessions_self_access instead).
    table: 'focus_heartbeats',
    name: 'focus_heartbeats_self_access',
    for: 'all',
    using: `${CU} = user_id`,
    withCheck: `${CU} = user_id`,
  },

  // --- Curricula/subjects: world-readable reference data for any authenticated
  // connection. No insert/update/delete policy exists (default-deny), so these
  // are only ever written by the seed script via adminDb. ---
  { table: 'curricula', name: 'curricula_select', for: 'select', using: 'true' },
  { table: 'subjects', name: 'subjects_select', for: 'select', using: 'true' },

  // --- Classes: teacher owns; enrolled students can read ---
  {
    table: 'classes',
    name: 'classes_select',
    for: 'select',
    using: `teacher_id = ${CU} OR fn_is_class_student(id)`,
  },
  {
    table: 'classes',
    name: 'classes_insert',
    for: 'insert',
    // The EXISTS check queries `subjects` (a different table with its own
    // open select policy), evaluated against the new row's own columns — not
    // a self-referential re-query of `classes` by its own id, so this is safe
    // from the INSERT...RETURNING self-reference gotcha documented elsewhere
    // in this file (see game_sessions_select).
    withCheck: `teacher_id = ${CU} AND fn_has_role('teacher') AND exists (select 1 from subjects s where s.id = subject_id and s.curriculum_id = curriculum_id)`,
  },
  { table: 'classes', name: 'classes_update', for: 'update', using: `teacher_id = ${CU}`, withCheck: `teacher_id = ${CU}` },
  { table: 'classes', name: 'classes_delete', for: 'delete', using: `teacher_id = ${CU}` },

  // --- Enrollments: student sees their own; teacher sees rosters for their classes ---
  {
    table: 'enrollments',
    name: 'enrollments_select',
    for: 'select',
    using: `student_id = ${CU} OR fn_is_class_teacher(class_id)`,
  },
  {
    table: 'enrollments',
    name: 'enrollments_insert',
    for: 'insert',
    withCheck: `student_id = ${CU} OR fn_is_class_teacher(class_id)`,
  },
  {
    table: 'enrollments',
    name: 'enrollments_delete',
    for: 'delete',
    using: `student_id = ${CU} OR fn_is_class_teacher(class_id)`,
  },
  // Sprint 1: didn't exist before — roster removal is a soft-delete
  // (status = 'dropped', the schema's existing enum already has this value
  // unused until now) rather than a hard delete, preserving historical
  // enrollment data. Same actors as delete: the student themselves, or the
  // teacher of that class.
  {
    table: 'enrollments',
    name: 'enrollments_update',
    for: 'update',
    using: `student_id = ${CU} OR fn_is_class_teacher(class_id)`,
    withCheck: `student_id = ${CU} OR fn_is_class_teacher(class_id)`,
  },

  // --- Quizzes: teacher owns via class; students see only published quizzes
  // for classes they're in; PLUS any authenticated user can see any
  // published, visibility='public' quiz (admin content, or a teacher's
  // quiz they've explicitly published beyond their own class); PLUS an
  // author can always see their own quiz regardless of publish state. ---
  {
    table: 'quizzes',
    name: 'quizzes_select',
    for: 'select',
    using: `fn_is_class_teacher(class_id) OR (is_published AND fn_is_class_student(class_id)) OR (is_published AND visibility = 'public') OR (author_id = ${CU})`,
  },
  {
    table: 'quizzes',
    name: 'quizzes_insert',
    for: 'insert',
    withCheck: `(class_id is not null AND fn_is_class_teacher(class_id) AND author_id = ${CU}) OR (class_id is null AND fn_has_role('admin') AND author_id = ${CU})`,
  },
  {
    table: 'quizzes',
    name: 'quizzes_update',
    for: 'update',
    using: `fn_is_class_teacher(class_id) OR (class_id is null AND author_id = ${CU} AND fn_has_role('admin'))`,
    withCheck: `fn_is_class_teacher(class_id) OR (class_id is null AND author_id = ${CU} AND fn_has_role('admin'))`,
  },
  {
    table: 'quizzes',
    name: 'quizzes_delete',
    for: 'delete',
    using: `fn_is_class_teacher(class_id) OR (class_id is null AND author_id = ${CU} AND fn_has_role('admin'))`,
  },

  // --- Quiz questions: same visibility as parent quiz ---
  {
    table: 'quiz_questions',
    name: 'quiz_questions_select',
    for: 'select',
    using: `fn_quiz_owned_by_teacher(quiz_id) OR fn_quiz_visible_to_student(quiz_id) OR fn_quiz_visible_via_game(quiz_id)`,
  },
  { table: 'quiz_questions', name: 'quiz_questions_insert', for: 'insert', withCheck: `fn_quiz_owned_by_teacher(quiz_id)` },
  {
    table: 'quiz_questions',
    name: 'quiz_questions_update',
    for: 'update',
    using: `fn_quiz_owned_by_teacher(quiz_id)`,
    withCheck: `fn_quiz_owned_by_teacher(quiz_id)`,
  },
  { table: 'quiz_questions', name: 'quiz_questions_delete', for: 'delete', using: `fn_quiz_owned_by_teacher(quiz_id)` },

  // --- Quiz choices: same visibility as parent question's quiz. NOTE: RLS only
  // guards which ROWS are visible, not the is_correct COLUMN — server functions
  // must strip is_correct from any payload sent to a student while a quiz is in
  // progress, or the answer key leaks over the wire regardless of RLS.
  {
    table: 'quiz_choices',
    name: 'quiz_choices_select',
    for: 'select',
    using: `fn_question_quiz_owned_by_teacher(question_id) OR fn_question_quiz_visible_to_student(question_id) OR fn_question_quiz_visible_via_game(question_id)`,
  },
  {
    table: 'quiz_choices',
    name: 'quiz_choices_insert',
    for: 'insert',
    withCheck: `fn_question_quiz_owned_by_teacher(question_id)`,
  },
  {
    table: 'quiz_choices',
    name: 'quiz_choices_update',
    for: 'update',
    using: `fn_question_quiz_owned_by_teacher(question_id)`,
    withCheck: `fn_question_quiz_owned_by_teacher(question_id)`,
  },
  {
    table: 'quiz_choices',
    name: 'quiz_choices_delete',
    for: 'delete',
    using: `fn_question_quiz_owned_by_teacher(question_id)`,
  },

  // --- Quiz attempts: student owns theirs; teacher can read attempts for their quizzes ---
  {
    table: 'quiz_attempts',
    name: 'quiz_attempts_select',
    for: 'select',
    using: `student_id = ${CU} OR fn_quiz_owned_by_teacher(quiz_id)`,
  },
  {
    table: 'quiz_attempts',
    name: 'quiz_attempts_insert',
    for: 'insert',
    withCheck: `student_id = ${CU} AND fn_quiz_visible_to_student(quiz_id)`,
  },
  {
    table: 'quiz_attempts',
    name: 'quiz_attempts_update',
    for: 'update',
    using: `student_id = ${CU}`,
    withCheck: `student_id = ${CU}`,
  },

  // --- Quiz answers: visible/writable via the owning attempt ---
  {
    table: 'quiz_answers',
    name: 'quiz_answers_select',
    for: 'select',
    using: `fn_attempt_owned_by_student(attempt_id) OR fn_attempt_visible_to_teacher(attempt_id)`,
  },
  {
    table: 'quiz_answers',
    name: 'quiz_answers_insert',
    for: 'insert',
    withCheck: `fn_attempt_owned_by_student(attempt_id)`,
  },
  {
    table: 'quiz_answers',
    name: 'quiz_answers_update',
    for: 'update',
    using: `fn_attempt_owned_by_student(attempt_id)`,
    withCheck: `fn_attempt_owned_by_student(attempt_id)`,
  },
  {
    table: 'quiz_answer_choices',
    name: 'quiz_answer_choices_select',
    for: 'select',
    using: `fn_answer_owned_by_student(answer_id) OR fn_answer_visible_to_teacher(answer_id)`,
  },
  {
    table: 'quiz_answer_choices',
    name: 'quiz_answer_choices_insert',
    for: 'insert',
    withCheck: `fn_answer_owned_by_student(answer_id)`,
  },

  // --- Live game sessions: teacher owns via quiz; students see sessions they've joined ---
  // NOTE: select/update use fn_quiz_owned_by_teacher(quiz_id) directly (a column
  // on this row) rather than fn_game_session_owned_by_teacher(id), which
  // re-queries game_sessions BY ITS OWN id. That self-reference breaks under
  // INSERT ... RETURNING: Postgres checks the SELECT policy against the row
  // being returned, and a row a command is still inserting isn't visible to a
  // nested query against the same table within that same command (command
  // counters only advance between statements) — the insert fails with "new row
  // violates row-level security policy" even though every disjunct is true a
  // moment later. Referencing the row's own columns sidesteps the self-query
  // entirely, so this class of bug can't occur.
  {
    table: 'game_sessions',
    name: 'game_sessions_select',
    for: 'select',
    using: `fn_quiz_owned_by_teacher(quiz_id) OR fn_is_game_participant(id)`,
  },
  {
    table: 'game_sessions',
    name: 'game_sessions_insert',
    for: 'insert',
    withCheck: `host_id = ${CU} AND fn_quiz_owned_by_teacher(quiz_id)`,
  },
  {
    table: 'game_sessions',
    name: 'game_sessions_update',
    for: 'update',
    using: `fn_quiz_owned_by_teacher(quiz_id)`,
    withCheck: `fn_quiz_owned_by_teacher(quiz_id)`,
  },

  // --- Game participants: visible to the host and to fellow participants (for the live leaderboard) ---
  // student_id = CU is listed before the self-referential fn_is_game_participant
  // check for the same reason as above: it lets a student see their OWN
  // just-inserted row (e.g. joinGameFn's `.returning()`) via a direct column
  // comparison, without needing a nested self-query that can't see its own
  // mid-command insert. fn_is_game_participant still covers seeing OTHER
  // participants' rows for the leaderboard, which is only ever read via plain
  // SELECTs (never combined with an INSERT ... RETURNING on this table), so it
  // isn't affected by the same timing issue.
  {
    table: 'game_participants',
    name: 'game_participants_select',
    for: 'select',
    using: `fn_game_session_owned_by_teacher(session_id) OR student_id = ${CU} OR fn_is_game_participant(session_id)`,
  },
  {
    table: 'game_participants',
    name: 'game_participants_insert',
    for: 'insert',
    withCheck: `student_id = ${CU} AND fn_can_join_game_session(session_id)`,
  },
  {
    table: 'game_participants',
    name: 'game_participants_update',
    for: 'update',
    using: `student_id = ${CU}`,
    withCheck: `student_id = ${CU}`,
  },

  // --- Game answers: visible/writable via the owning participant row ---
  {
    table: 'game_answers',
    name: 'game_answers_select',
    for: 'select',
    using: `fn_participant_owned_by_student(participant_id) OR fn_participant_session_owned_by_teacher(participant_id)`,
  },
  {
    table: 'game_answers',
    name: 'game_answers_insert',
    for: 'insert',
    withCheck: `fn_participant_owned_by_student(participant_id)`,
  },
]

async function main() {
  for (const fn of functions) {
    await adminDb.execute(sql.raw(fn.sql))
    await adminDb.execute(sql.raw(`grant execute on function ${fn.name} to focusflow_app`))
    console.log(`🔧 function applied: ${fn.name}`)
  }

  const tables = [...new Set(policies.map((p) => p.table))]
  for (const table of tables) {
    await adminDb.execute(sql.raw(`alter table "${table}" enable row level security`))
  }

  for (const policy of policies) {
    await adminDb.execute(sql.raw(`drop policy if exists "${policy.name}" on "${policy.table}"`))
    const usingClause = policy.using ? ` using (${policy.using})` : ''
    const withCheckClause = policy.withCheck ? ` with check (${policy.withCheck})` : ''
    await adminDb.execute(
      sql.raw(`create policy "${policy.name}" on "${policy.table}" for ${policy.for}${usingClause}${withCheckClause}`),
    )
    console.log(`✅ ${policy.table}.${policy.name} (${policy.for})`)
  }

  console.log(`\nApplied ${functions.length} helper functions and ${policies.length} policies across ${tables.length} tables.`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed to apply RLS policies:', error)
    process.exit(1)
  })
