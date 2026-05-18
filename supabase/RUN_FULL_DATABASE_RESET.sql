drop trigger if exists trg_cohorts_max_two_active on public.cohorts;
drop trigger if exists trg_exam_students_updated on public.exam_students;
drop trigger if exists trg_exams_validate_target on public.exams;
drop trigger if exists trg_exams_validate_assignment_cohort on public.exams;
drop trigger if exists trg_assignments_validate_target on public.teacher_assignments;

drop view if exists public.active_cohorts_view;

drop table if exists public.student_history cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.exam_tracking cascade;
drop table if exists public.makeup_exams cascade;
drop table if exists public.exam_students cascade;
drop table if exists public.exams cascade;
drop table if exists public.teacher_assignments cascade;
drop table if exists public.students cascade;
drop table if exists public.teachers cascade;
drop table if exists public.users cascade;
drop table if exists public.year_cohorts cascade;
drop table if exists public.cohort_year_placements cascade;
drop table if exists public.cohorts cascade;
drop table if exists public.academic_years cascade;
drop table if exists public.system_settings cascade;
drop table if exists public.classes cascade;
drop table if exists public.specializations cascade;
drop table if exists public.tracks cascade;
drop table if exists public.grade_levels cascade;

drop function if exists public.cohorts_enforce_max_two_active() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.exams_validate_target() cascade;
drop function if exists public.exams_validate_assignment_cohort() cascade;
drop function if exists public.assignments_validate_target() cascade;

drop type if exists public.student_status cascade;
drop type if exists public.exam_target_type cascade;
drop type if exists public.exam_student_status cascade;
drop type if exists public.makeup_exam_status cascade;
drop type if exists public.cohort_grade_level cascade;
drop type if exists public.student_grade_level cascade;
drop type if exists public.user_role cascade;

create extension if not exists "pgcrypto";

create type public.exam_target_type as enum ('class', 'specialization', 'track');
create type public.exam_student_status as enum ('pending', 'took', 'missing', 'makeup', 'completed');
create type public.makeup_exam_status as enum ('open', 'completed');
create type public.student_status as enum ('active', 'left', 'graduated');

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),
  number int not null,
  name text not null,
  display_order int,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint cohorts_display_order_positive check (
    display_order is null or display_order in (1, 2)
  )
);

create unique index uq_cohorts_number on public.cohorts (number) where deleted_at is null;
create unique index uq_cohorts_display_order on public.cohorts (display_order) where display_order is not null and deleted_at is null;

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  unique (name)
);

create table public.specializations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  unique (name)
);

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  unique (name)
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  full_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (username)
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  tz text not null,
  full_name_generated text generated always as (first_name || ' ' || last_name) stored,
  cohort_id uuid not null references public.cohorts (id) on delete restrict,
  class_id uuid not null references public.classes (id) on delete restrict,
  track_id uuid references public.tracks (id) on delete restrict,
  specialization_id uuid references public.specializations (id) on delete restrict,
  notes text,
  status public.student_status not null default 'active',
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index uq_students_tz on public.students (tz) where deleted_at is null;

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete restrict,
  cohort_id uuid not null references public.cohorts (id) on delete restrict,
  subject text not null,
  target_type public.exam_target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index uq_teacher_assignment on public.teacher_assignments (
  teacher_id, cohort_id, subject, target_type, target_id
) where deleted_at is null;

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  teacher_assignment_id uuid not null references public.teacher_assignments (id) on delete restrict,
  cohort_id uuid not null references public.cohorts (id) on delete restrict,
  teacher_id uuid not null references public.teachers (id) on delete restrict,
  subject text not null,
  exam_date date not null,
  target_type public.exam_target_type not null,
  target_id uuid not null,
  notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index uq_exams_unique on public.exams (
  cohort_id, teacher_assignment_id, exam_date
) where deleted_at is null;

create table public.exam_students (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  status public.exam_student_status not null default 'pending',
  class_snapshot text,
  track_snapshot text,
  specialization_snapshot text,
  teacher_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

create table public.makeup_exams (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  exam_id uuid not null references public.exams (id) on delete restrict,
  status public.makeup_exam_status not null default 'open',
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  unique (student_id, exam_id)
);

create table public.exam_tracking (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete restrict,
  teacher_id uuid not null references public.teachers (id) on delete restrict,
  submitted_exam timestamptz,
  approved_by_coordinator boolean not null default false,
  sent_for_review boolean not null default false,
  grades_submitted boolean not null default false,
  grades_approved boolean not null default false,
  transferred_to_system boolean not null default false,
  photocopied boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (exam_id, teacher_id)
);

create table public.student_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete restrict,
  cohort_id uuid references public.cohorts (id) on delete set null,
  old_class_id uuid references public.classes (id) on delete set null,
  new_class_id uuid references public.classes (id) on delete set null,
  old_specialization_id uuid references public.specializations (id) on delete set null,
  new_specialization_id uuid references public.specializations (id) on delete set null,
  old_track_id uuid references public.tracks (id) on delete set null,
  new_track_id uuid references public.tracks (id) on delete set null,
  changed_at timestamptz not null default now(),
  changed_by uuid references public.users (id) on delete set null
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action_type text not null,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create or replace view public.active_cohorts_view as
select id, number, name, display_order, created_at, deleted_at
from public.cohorts
where deleted_at is null
  and display_order in (1, 2);

create or replace function public.assignments_validate_target()
returns trigger language plpgsql as $$
begin
  if new.target_type = 'class' then
    if not exists (select 1 from public.classes c where c.id = new.target_id and c.is_active) then
      raise exception 'assignment target_id invalid for class';
    end if;
  elsif new.target_type = 'specialization' then
    if not exists (select 1 from public.specializations s where s.id = new.target_id and s.is_active) then
      raise exception 'assignment target_id invalid for specialization';
    end if;
  elsif new.target_type = 'track' then
    if not exists (select 1 from public.tracks t where t.id = new.target_id and t.is_active) then
      raise exception 'assignment target_id invalid for track';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_assignments_validate_target
  before insert or update of target_type, target_id on public.teacher_assignments
  for each row execute function public.assignments_validate_target();

create or replace function public.exams_validate_target()
returns trigger language plpgsql as $$
begin
  if new.target_type = 'class' then
    if not exists (select 1 from public.classes c where c.id = new.target_id) then
      raise exception 'exam target_id invalid for class';
    end if;
  elsif new.target_type = 'specialization' then
    if not exists (select 1 from public.specializations s where s.id = new.target_id) then
      raise exception 'exam target_id invalid for specialization';
    end if;
  elsif new.target_type = 'track' then
    if not exists (select 1 from public.tracks t where t.id = new.target_id) then
      raise exception 'exam target_id invalid for track';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_exams_validate_target
  before insert or update of target_type, target_id on public.exams
  for each row execute function public.exams_validate_target();

create or replace function public.exams_validate_assignment_cohort()
returns trigger language plpgsql as $$
declare
  assignment_cohort uuid;
begin
  select ta.cohort_id into assignment_cohort
  from public.teacher_assignments ta
  where ta.id = new.teacher_assignment_id
    and ta.deleted_at is null;

  if assignment_cohort is null then
    raise exception 'teacher_assignment not found or deleted';
  end if;

  if assignment_cohort <> new.cohort_id then
    raise exception 'exam cohort_id must match teacher_assignment cohort_id';
  end if;

  return new;
end;
$$;

create trigger trg_exams_validate_assignment_cohort
  before insert or update of teacher_assignment_id, cohort_id on public.exams
  for each row execute function public.exams_validate_assignment_cohort();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_exam_students_updated
  before update on public.exam_students
  for each row execute function public.set_updated_at();

create index idx_students_tz on public.students (tz);
create index idx_students_cohort_id on public.students (cohort_id);
create index idx_students_full_name on public.students (full_name_generated);
create index idx_students_deleted on public.students (deleted_at) where deleted_at is null;
create index idx_students_import_batch on public.students (import_batch_id);
create index idx_teachers_name on public.teachers (name);
create index idx_teacher_assignments_cohort_id on public.teacher_assignments (cohort_id);
create index idx_teacher_assignments_target_id on public.teacher_assignments (target_id);
create index idx_exams_cohort_id on public.exams (cohort_id);
create index idx_exams_exam_date on public.exams (exam_date);
create index idx_exams_deleted on public.exams (deleted_at) where deleted_at is null;
create index idx_exam_students_exam_id on public.exam_students (exam_id);
create index idx_exam_students_student_id on public.exam_students (student_id);
create index idx_exam_students_status on public.exam_students (status);
create index idx_makeup_exams_student_id on public.makeup_exams (student_id);
create index idx_makeup_status on public.makeup_exams (status);
create index idx_exam_tracking_deleted on public.exam_tracking (deleted_at) where deleted_at is null;
create index idx_audit_entity on public.audit_logs (entity_type, entity_id);
create index idx_student_history_student on public.student_history (student_id, changed_at desc);

alter table public.system_settings enable row level security;
alter table public.cohorts enable row level security;
alter table public.classes enable row level security;
alter table public.specializations enable row level security;
alter table public.tracks enable row level security;
alter table public.users enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.exams enable row level security;
alter table public.exam_students enable row level security;
alter table public.makeup_exams enable row level security;
alter table public.exam_tracking enable row level security;
alter table public.student_history enable row level security;
alter table public.audit_logs enable row level security;

insert into public.classes (name) values
  ('יא1'), ('יא2'), ('יב1'), ('יב2')
on conflict (name) do nothing;

insert into public.specializations (name) values
  ('גרפיקה'), ('תכנות'), ('חשבונאות')
on conflict (name) do nothing;

insert into public.tracks (name) values
  ('הוראה'), ('הוראה קצרה'), ('ללא הוראה')
on conflict (name) do nothing;

insert into public.cohorts (number, name, display_order) values
  (10, '10', 1),
  (9, '9', 2);

insert into public.system_settings (key, value)
select
  'selected_cohorts',
  jsonb_build_object(
    'selected_cohort_ids',
    jsonb_build_array(
      (select id from public.cohorts where number = 10 and deleted_at is null limit 1),
      (select id from public.cohorts where number = 9 and deleted_at is null limit 1)
    )
  );

notify pgrst, 'reload schema';
