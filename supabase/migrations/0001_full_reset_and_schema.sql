/*
  קובץ יחיד — להריץ ב-Supabase SQL Editor מההתחלה עד הסוף.
  1) מוחק טבלאות/טיפוסים של האפליקציה
  2) יוצר מחדש את כל הסכימה + נתוני לוקאפ בסיסיים
*/

/* ========== איפוס ========== */

drop table if exists public.exam_tracking cascade;
drop table if exists public.exam_students cascade;
drop table if exists public.makeup_exams cascade;
drop table if exists public.exams cascade;
drop table if exists public.teacher_assignments cascade;
drop table if exists public.students cascade;
drop table if exists public.teachers cascade;

drop table if exists public.grade_levels cascade;
drop table if exists public.classes cascade;
drop table if exists public.specializations cascade;
drop table if exists public.tracks cascade;

drop function if exists public.assignments_validate_target() cascade;
drop function if exists public.exams_validate_target() cascade;
drop function if exists public.set_updated_at() cascade;

drop type if exists public.exam_target_type cascade;
drop type if exists public.exam_student_status cascade;
drop type if exists public.makeup_exam_status cascade;

/* ========== סכימה ========== */

create extension if not exists "pgcrypto";

do $$ begin
  create type public.exam_target_type as enum ('class', 'specialization', 'track');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.exam_student_status as enum ('pending', 'took', 'missing', 'makeup', 'completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.makeup_exam_status as enum ('open', 'completed');
exception when duplicate_object then null;
end $$;

create table if not exists public.grade_levels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.specializations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  tz text not null unique,
  grade_level_id uuid not null references public.grade_levels (id) on delete restrict,
  class_id uuid not null references public.classes (id) on delete restrict,
  specialization_id uuid references public.specializations (id) on delete restrict,
  track_id uuid references public.tracks (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  subject text not null,
  grade_level_id uuid not null references public.grade_levels (id) on delete restrict,
  target_type public.exam_target_type not null,
  target_id uuid not null,
  active boolean not null default true,
  unique (teacher_id, subject, target_type, target_id)
);

create or replace function public.assignments_validate_target()
returns trigger language plpgsql as $$
begin
  if new.target_type = 'class' then
    if not exists (select 1 from public.classes c where c.id = new.target_id) then
      raise exception 'assignment target_id invalid for class';
    end if;
  elsif new.target_type = 'specialization' then
    if not exists (select 1 from public.specializations s where s.id = new.target_id) then
      raise exception 'assignment target_id invalid for specialization';
    end if;
  elsif new.target_type = 'track' then
    if not exists (select 1 from public.tracks t where t.id = new.target_id) then
      raise exception 'assignment target_id invalid for track';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_assignments_validate_target on public.teacher_assignments;
create trigger trg_assignments_validate_target
  before insert or update of target_type, target_id on public.teacher_assignments
  for each row execute procedure public.assignments_validate_target();

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers (id) on delete restrict,
  subject text not null,
  exam_date date not null,
  target_type public.exam_target_type not null,
  target_id uuid not null,
  created_at timestamptz not null default now()
);

create or replace function public.exams_validate_target()
returns trigger language plpgsql as $$
begin
  if new.target_type = 'class' then
    if not exists (select 1 from public.classes c where c.id = new.target_id) then
      raise exception 'target_id invalid for class';
    end if;
  elsif new.target_type = 'specialization' then
    if not exists (select 1 from public.specializations s where s.id = new.target_id) then
      raise exception 'target_id invalid for specialization';
    end if;
  elsif new.target_type = 'track' then
    if not exists (select 1 from public.tracks t where t.id = new.target_id) then
      raise exception 'target_id invalid for track';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_exams_validate_target on public.exams;
create trigger trg_exams_validate_target
  before insert or update of target_type, target_id on public.exams
  for each row execute procedure public.exams_validate_target();

create table if not exists public.exam_students (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status public.exam_student_status not null default 'pending',
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

create table if not exists public.makeup_exams (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  status public.makeup_exam_status not null default 'open',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (student_id, exam_id)
);

create table if not exists public.exam_tracking (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  teacher_id uuid not null references public.teachers (id) on delete cascade,
  submitted_exam timestamptz,
  approved_by_coordinator boolean not null default false,
  sent_for_review boolean not null default false,
  grades_submitted boolean not null default false,
  grades_approved boolean not null default false,
  transferred_to_system boolean not null default false,
  unique (exam_id, teacher_id)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_exam_students_updated on public.exam_students;
create trigger trg_exam_students_updated
  before update on public.exam_students
  for each row execute procedure public.set_updated_at();

alter table public.grade_levels enable row level security;
alter table public.classes enable row level security;
alter table public.specializations enable row level security;
alter table public.tracks enable row level security;
alter table public.students enable row level security;
alter table public.teachers enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.exams enable row level security;
alter table public.exam_students enable row level security;
alter table public.makeup_exams enable row level security;
alter table public.exam_tracking enable row level security;

create index if not exists idx_students_names on public.students (last_name, first_name);
create index if not exists idx_students_tz on public.students (tz);
create index if not exists idx_students_class on public.students (class_id);
create index if not exists idx_students_spec on public.students (specialization_id);
create index if not exists idx_students_track on public.students (track_id);
create index if not exists idx_exam_students_exam on public.exam_students (exam_id);
create index if not exists idx_makeup_open on public.makeup_exams (status) where status = 'open';
create index if not exists idx_exams_target on public.exams (target_type, target_id);
create index if not exists idx_teacher_assignments_lookup on public.teacher_assignments (teacher_id, target_type, target_id);

insert into public.grade_levels (name) values ('A'), ('B'), ('A+B')
  on conflict (name) do nothing;
insert into public.classes (name) values ('יא1'), ('יא2'), ('יב1')
  on conflict (name) do nothing;
insert into public.specializations (name) values ('Graphics'), ('Programming'), ('Accounting')
  on conflict (name) do nothing;
insert into public.tracks (name) values ('Teaching'), ('Short Teaching'), ('No Teaching')
  on conflict (name) do nothing;
