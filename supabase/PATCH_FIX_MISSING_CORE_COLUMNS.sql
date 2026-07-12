-- PATCH: תיקון עמודות חסרות בלי מחיקת נתונים
-- מתי: כשהאפליקציה מציגה "column students.grade_level does not exist"
--      או "column teachers_1.first_name does not exist" / makeup deleted_at
-- מה זה לא עושה: לא מוחק טבלאות ולא מוחק שורות קיימות

-- ─── תלמידות: שכבה ─────────────────────────────────────────────────────────
alter table public.students
  add column if not exists grade_level text;

update public.students
set grade_level = 'א'
where grade_level is null or btrim(grade_level) = '';

alter table public.students drop constraint if exists students_grade_level_check;
alter table public.students
  add constraint students_grade_level_check
  check (grade_level in ('א', 'ב', 'ג'));

create index if not exists idx_students_grade
  on public.students (academic_year_id, grade_level);

-- ─── מורות: שם פרטי / משפחה ────────────────────────────────────────────────
alter table public.teachers add column if not exists first_name text;
alter table public.teachers add column if not exists last_name text;

update public.teachers
set first_name = coalesce(nullif(btrim(first_name), ''), 'מורה')
where first_name is null or btrim(first_name) = '';

update public.teachers
set last_name = coalesce(nullif(btrim(last_name), ''), '')
where last_name is null;

-- ─── השלמות: מחיקה רכה ─────────────────────────────────────────────────────
alter table public.makeup_exams
  add column if not exists deleted_at timestamptz;

-- ─── לוקאפים: soft-delete אם חסר ───────────────────────────────────────────
alter table public.classes add column if not exists deleted_at timestamptz;
alter table public.specializations add column if not exists deleted_at timestamptz;
alter table public.tracks add column if not exists deleted_at timestamptz;
alter table public.teachers add column if not exists deleted_at timestamptz;
alter table public.students add column if not exists deleted_at timestamptz;

notify pgrst, 'reload schema';
