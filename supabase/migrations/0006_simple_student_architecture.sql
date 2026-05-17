-- ארכיטקטורה פשוטה: שנה + מחזור + שכבה ישירות על students

do $$ begin
  create type public.student_grade_level as enum ('א', 'ב');
exception when duplicate_object then null;
end $$;

alter table public.students add column if not exists cohort_number int;
alter table public.students add column if not exists grade_level public.student_grade_level;

-- מילוי cohort_number מטבלת cohorts
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'students' and column_name = 'cohort_id'
  ) then
    update public.students s
    set cohort_number = coalesce(
      (select c.cohort_number from public.cohorts c where c.id = s.cohort_id),
      (select nullif(regexp_replace(c.name, '[^0-9]', '', 'g'), '')::int from public.cohorts c where c.id = s.cohort_id)
    )
    where s.cohort_number is null and s.cohort_id is not null;
  end if;
end $$;

-- מילוי grade_level ממיפוי שנה (cohort_a/b או placements)
do $$
declare
  has_cols boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'academic_years' and column_name = 'cohort_a_id'
  ) into has_cols;

  if has_cols then
    update public.students s
    set grade_level = 'א'::public.student_grade_level
    from public.academic_years y
    where s.academic_year_id = y.id and y.cohort_a_id = s.cohort_id and s.grade_level is null;

    update public.students s
    set grade_level = 'ב'::public.student_grade_level
    from public.academic_years y
    where s.academic_year_id = y.id and y.cohort_b_id = s.cohort_id and s.grade_level is null;
  elsif exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'cohort_year_placements'
  ) then
    update public.students s
    set grade_level = 'א'::public.student_grade_level
    from public.cohort_year_placements p
    where p.academic_year_id = s.academic_year_id
      and p.cohort_id = s.cohort_id
      and p.grade_level = 'A'::public.cohort_grade_level
      and s.grade_level is null;

    update public.students s
    set grade_level = 'ב'::public.student_grade_level
    from public.cohort_year_placements p
    where p.academic_year_id = s.academic_year_id
      and p.cohort_id = s.cohort_id
      and p.grade_level = 'B'::public.cohort_grade_level
      and s.grade_level is null;
  end if;
end $$;

update public.students
set grade_level = 'א'::public.student_grade_level
where grade_level is null;

update public.students
set cohort_number = 1
where cohort_number is null;

alter table public.students alter column cohort_number set not null;
alter table public.students alter column grade_level set not null;

alter table public.students drop constraint if exists students_cohort_id_fkey;
alter table public.students drop column if exists cohort_id;

alter table public.academic_years drop constraint if exists academic_years_cohort_a_id_fkey;
alter table public.academic_years drop constraint if exists academic_years_cohort_b_id_fkey;
alter table public.academic_years drop column if exists cohort_a_id;
alter table public.academic_years drop column if exists cohort_b_id;

drop table if exists public.cohort_year_placements cascade;

alter table public.teacher_assignments drop constraint if exists teacher_assignments_grade_level_id_fkey;
alter table public.teacher_assignments drop column if exists grade_level_id;

alter table public.exam_tracking add column if not exists photocopied boolean not null default false;
alter table public.exam_tracking add column if not exists notes text;

alter table public.users drop column if exists role;

create index if not exists idx_students_tz on public.students (tz);
create index if not exists idx_students_academic_year on public.students (academic_year_id);
create index if not exists idx_students_cohort_number on public.students (cohort_number);

notify pgrst, 'reload schema';
