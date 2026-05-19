-- =============================================================================
-- כל ה-PATCHים ברצף — למסד קיים בלבד (לא מוחק נתונים)
-- =============================================================================
-- אם מתחילים מאפס: הריצי רק RUN_FULL_DATABASE_RESET.sql (כולל הכל).
-- סדר: AUTH → SCHOOL_YEARS → GRADE_OPTIONS → STUDENT_EXT → REMAINING → MAKEUP
-- אחרי ההרצה: רענון קשיח + npm run dev
-- =============================================================================

-- ─── PATCH_AUTH_USERS ───────────────────────────────────────────────────────
alter table public.users drop column if exists role;
alter table public.users add column if not exists deleted_at timestamptz;
alter table public.users alter column full_name set default '';

alter table public.users drop constraint if exists users_username_key;
drop index if exists public.users_username_active_key;
drop index if exists users_username_active_key;
create unique index if not exists users_username_active_key
  on public.users (username)
  where deleted_at is null;

-- ─── PATCH_SCHOOL_YEARS_ISOLATED ────────────────────────────────────────────
alter table public.academic_years add column if not exists start_date date;
alter table public.academic_years add column if not exists end_date date;

comment on table public.academic_years is
  'שנת לימודים עצמאית (school year) — כל הנתונים מקושרים לשנה; אין סנכרון בין שנים';

drop view if exists public.school_years;
create view public.school_years as
  select id, year_name as name, start_date, end_date, is_active, created_at
  from public.academic_years;

alter table public.classes add column if not exists academic_year_id uuid references public.academic_years (id) on delete restrict;
alter table public.classes add column if not exists deleted_at timestamptz;
alter table public.classes add column if not exists created_at timestamptz not null default now();

alter table public.specializations add column if not exists academic_year_id uuid references public.academic_years (id) on delete restrict;
alter table public.specializations add column if not exists deleted_at timestamptz;
alter table public.specializations add column if not exists created_at timestamptz not null default now();

alter table public.tracks add column if not exists academic_year_id uuid references public.academic_years (id) on delete restrict;
alter table public.tracks add column if not exists deleted_at timestamptz;
alter table public.tracks add column if not exists created_at timestamptz not null default now();

alter table public.teachers add column if not exists academic_year_id uuid references public.academic_years (id) on delete restrict;

do $$
declare active_id uuid;
begin
  select id into active_id from public.academic_years where is_active = true limit 1;
  if active_id is null then
    select id into active_id from public.academic_years order by created_at desc nulls last limit 1;
  end if;
  if active_id is null then
    insert into public.academic_years (year_name, is_active) values ('תשפ״ו', true) returning id into active_id;
  end if;
  update public.classes c set academic_year_id = s.academic_year_id
  from (
    select distinct on (class_id) class_id, academic_year_id from public.students
    where deleted_at is null order by class_id, academic_year_id
  ) s where c.id = s.class_id and c.academic_year_id is null;
  update public.classes set academic_year_id = active_id where academic_year_id is null;
  update public.specializations set academic_year_id = active_id where academic_year_id is null;
  update public.tracks set academic_year_id = active_id where academic_year_id is null;
  update public.teachers set academic_year_id = active_id where academic_year_id is null;
end $$;

alter table public.classes alter column academic_year_id set not null;
alter table public.specializations alter column academic_year_id set not null;
alter table public.tracks alter column academic_year_id set not null;
alter table public.teachers alter column academic_year_id set not null;

alter table public.classes drop constraint if exists classes_name_key;
drop index if exists public.classes_name_key;
drop index if exists public.uq_classes_name_per_year;
create unique index uq_classes_name_per_year on public.classes (academic_year_id, name) where deleted_at is null;

alter table public.specializations drop constraint if exists specializations_name_key;
drop index if exists public.specializations_name_key;
drop index if exists public.uq_specializations_name_per_year;
create unique index uq_specializations_name_per_year on public.specializations (academic_year_id, name) where deleted_at is null;

alter table public.tracks drop constraint if exists tracks_name_key;
drop index if exists public.tracks_name_key;
drop index if exists public.uq_tracks_name_per_year;
create unique index uq_tracks_name_per_year on public.tracks (academic_year_id, name) where deleted_at is null;

create index if not exists idx_classes_year on public.classes (academic_year_id);
create index if not exists idx_specializations_year on public.specializations (academic_year_id);
create index if not exists idx_tracks_year on public.tracks (academic_year_id);
create index if not exists idx_teachers_year on public.teachers (academic_year_id);

drop index if exists public.uq_teachers_tz_per_year;
create unique index uq_teachers_tz_per_year on public.teachers (academic_year_id, tz)
  where deleted_at is null and tz is not null;

create or replace function public.assignments_validate_target()
returns trigger language plpgsql as $$
begin
  if new.class_id is not null and not exists (
    select 1 from public.classes c where c.id = new.class_id and c.academic_year_id = new.academic_year_id
      and c.is_active and c.deleted_at is null
  ) then raise exception 'class_id invalid, inactive, or wrong school year'; end if;
  if new.specialization_id is not null and not exists (
    select 1 from public.specializations s where s.id = new.specialization_id and s.academic_year_id = new.academic_year_id
      and s.is_active and s.deleted_at is null
  ) then raise exception 'specialization_id invalid, inactive, or wrong school year'; end if;
  if new.track_id is not null and not exists (
    select 1 from public.tracks t where t.id = new.track_id and t.academic_year_id = new.academic_year_id
      and t.is_active and t.deleted_at is null
  ) then raise exception 'track_id invalid, inactive, or wrong school year'; end if;
  return new;
end; $$;

create or replace function public.exams_validate_target()
returns trigger language plpgsql as $$
begin
  if new.class_id is not null and not exists (
    select 1 from public.classes c where c.id = new.class_id and c.academic_year_id = new.academic_year_id
  ) then raise exception 'exam class_id invalid or wrong school year'; end if;
  if new.specialization_id is not null and not exists (
    select 1 from public.specializations s where s.id = new.specialization_id and s.academic_year_id = new.academic_year_id
  ) then raise exception 'exam specialization_id invalid or wrong school year'; end if;
  if new.track_id is not null and not exists (
    select 1 from public.tracks t where t.id = new.track_id and t.academic_year_id = new.academic_year_id
  ) then raise exception 'exam track_id invalid or wrong school year'; end if;
  return new;
end; $$;

create or replace function public.teachers_validate_year_scope()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.teacher_assignments ta
    where ta.teacher_id = new.id and ta.academic_year_id <> new.academic_year_id and ta.deleted_at is null
  ) then raise exception 'teacher has assignments in another school year'; end if;
  return new;
end; $$;

drop trigger if exists trg_teachers_validate_year on public.teachers;
create trigger trg_teachers_validate_year
  before update of academic_year_id on public.teachers
  for each row execute function public.teachers_validate_year_scope();

drop view if exists public.active_cohorts_view;
drop table if exists public.year_cohorts cascade;
drop table if exists public.cohort_year_placements cascade;
drop table if exists public.cohorts cascade;
drop table if exists public.year_layers cascade;

-- ─── PATCH_GRADE_LEVEL_OPTIONS ──────────────────────────────────────────────
create table if not exists public.grade_level_options (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  grade_levels text[] not null,
  is_active boolean not null default true,
  constraint grade_level_options_levels_check check (
    cardinality(grade_levels) >= 1 and grade_levels <@ array['א', 'ב', 'ג']::text[]
  )
);
create index if not exists idx_grade_level_options_active on public.grade_level_options (is_active) where is_active = true;
alter table public.grade_level_options enable row level security;
insert into public.grade_level_options (name, grade_levels) values
  ('א', array['א']::text[]), ('ב', array['ב']::text[]), ('ג', array['ג']::text[]), ('א+ב', array['א', 'ב']::text[])
on conflict (name) do nothing;

-- ─── PATCH_MAKEUP_TRACKING ──────────────────────────────────────────────────
alter table public.makeup_exams add column if not exists grade numeric;

create table if not exists public.makeup_tracking (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  exam_id uuid not null references public.exams (id) on delete restrict,
  teacher_id uuid not null references public.teachers (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  makeup_exam_id uuid references public.makeup_exams (id) on delete set null,
  sent_to_teacher_at timestamptz,
  grade_received_at timestamptz,
  grade numeric,
  notes text,
  created_at timestamptz not null default now(),
  unique (exam_id, student_id)
);
create index if not exists idx_makeup_tracking_exam_id on public.makeup_tracking (exam_id);
create index if not exists idx_makeup_tracking_teacher_id on public.makeup_tracking (teacher_id);
create index if not exists idx_makeup_tracking_student_id on public.makeup_tracking (student_id);
create index if not exists idx_makeup_tracking_makeup_exam_id on public.makeup_tracking (makeup_exam_id);
alter table public.makeup_tracking enable row level security;

insert into public.makeup_tracking (
  academic_year_id, exam_id, teacher_id, student_id, makeup_exam_id, grade, notes
)
select me.academic_year_id, me.exam_id, e.teacher_id, me.student_id, me.id, me.grade, me.notes
from public.makeup_exams me
join public.exams e on e.id = me.exam_id
where me.deleted_at is null
on conflict (exam_id, student_id) do update set
  makeup_exam_id = coalesce(public.makeup_tracking.makeup_exam_id, excluded.makeup_exam_id),
  grade = coalesce(public.makeup_tracking.grade, excluded.grade);

create index if not exists idx_makeup_tracking_academic_year on public.makeup_tracking (academic_year_id);

create or replace function public.makeup_tracking_fill_academic_year()
returns trigger language plpgsql as $$
begin
  if new.academic_year_id is null then
    select e.academic_year_id into new.academic_year_id from public.exams e where e.id = new.exam_id;
  end if;
  if new.academic_year_id is null then raise exception 'makeup_tracking: exam not found'; end if;
  return new;
end; $$;

drop trigger if exists trg_makeup_tracking_fill_year on public.makeup_tracking;
create trigger trg_makeup_tracking_fill_year
  before insert on public.makeup_tracking
  for each row execute function public.makeup_tracking_fill_academic_year();

-- ─── PATCH_STUDENT_EXTENSIONS ─────────────────────────────────────────────
alter table public.students
  add column if not exists secondary_specialization_id uuid references public.specializations (id) on delete restrict,
  add column if not exists is_psychology boolean not null default false,
  add column if not exists teaching_track_type text;

alter table public.exams add column if not exists teaching_track_type text;

alter table public.exam_students
  add column if not exists secondary_specialization_snapshot text,
  add column if not exists is_psychology_snapshot boolean,
  add column if not exists teaching_track_type_snapshot text;

alter table public.students drop constraint if exists students_teaching_track_type_check;
alter table public.students add constraint students_teaching_track_type_check
  check (teaching_track_type is null or teaching_track_type in ('full', 'short'));

alter table public.students drop constraint if exists students_secondary_spec_distinct;
alter table public.students add constraint students_secondary_spec_distinct
  check (
    secondary_specialization_id is null
    or specialization_id is null
    or secondary_specialization_id <> specialization_id
  );

alter table public.exams drop constraint if exists exams_teaching_track_type_check;
alter table public.exams add constraint exams_teaching_track_type_check
  check (teaching_track_type is null or teaching_track_type in ('full', 'short'));

create or replace function public.students_validate_teaching_fields()
returns trigger language plpgsql as $$
declare track_name text;
begin
  if new.secondary_specialization_id is not null and new.specialization_id is not null
     and new.secondary_specialization_id = new.specialization_id then
    raise exception 'התמחות נוספת חייבת להיות שונה מהראשית';
  end if;
  if new.track_id is null then
    if new.teaching_track_type is not null then raise exception 'סוג הוראה מותר רק במסלול הוראה'; end if;
    return new;
  end if;
  select t.name into track_name from public.tracks t where t.id = new.track_id;
  if coalesce(track_name, '') = 'הוראה' then return new; end if;
  if new.teaching_track_type is not null then raise exception 'סוג הוראה מותר רק במסלול הוראה'; end if;
  return new;
end; $$;

drop trigger if exists trg_students_validate_teaching on public.students;
create trigger trg_students_validate_teaching
  before insert or update on public.students
  for each row execute function public.students_validate_teaching_fields();

-- ─── PATCH_REMAINING_FEATURES ───────────────────────────────────────────────
alter table public.exams add column if not exists makeup_locked_at timestamptz;

alter table public.exam_students add column if not exists subject_snapshot text;
alter table public.exam_students add column if not exists target_name_snapshot text;

alter table public.audit_logs add column if not exists entity_name_snapshot text;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread on public.notifications (user_id, created_at desc) where read_at is null;

create extension if not exists pg_trgm;
create index if not exists idx_students_full_name_trgm on public.students using gin (full_name_generated gin_trgm_ops);
create index if not exists idx_teachers_full_name_trgm on public.teachers using gin (full_name_generated gin_trgm_ops);

alter table public.notifications enable row level security;

insert into public.users (username, password_hash, full_name, active)
select
  'admin',
  '$2b$10$Te.XsoCRqDvBk462gYoLC.BCBgUbifAEj4GRpyMBMnhEa8/kt9ole',
  'מנהלת מערכת',
  true
where not exists (
  select 1 from public.users where username = 'admin' and deleted_at is null
);

notify pgrst, 'reload schema';
