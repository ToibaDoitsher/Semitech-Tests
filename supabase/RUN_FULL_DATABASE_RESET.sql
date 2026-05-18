-- הרצה אחת ב-Supabase SQL Editor: מוחק את כל הטבלאות ויוצר מחדש.
-- מערכת שנים עצמאיות: כל נתון שייך ל-academic_year_id + grade_level (א/ב/ג) בלבד.
-- ללא מחזורים, ללא year_group, ללא system_settings.
-- חשוב: להריץ את הקובץ מהשורה הראשונה עד האחרונה.

drop view if exists public.active_cohorts_view;

drop table if exists public.student_history cascade;
drop table if exists public.audit_logs cascade;
drop table if exists public.notifications cascade;
drop table if exists public.makeup_tracking cascade;
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
drop table if exists public.year_layers cascade;
drop table if exists public.classes cascade;
drop table if exists public.specializations cascade;
drop table if exists public.tracks cascade;
drop table if exists public.grade_levels cascade;
drop table if exists public.academic_years cascade;

drop function if exists public.cohorts_enforce_max_two_active() cascade;
drop function if exists public.set_updated_at() cascade;
drop function if exists public.exams_validate_target() cascade;
drop function if exists public.exams_validate_assignment_cohort() cascade;
drop function if exists public.exams_validate_assignment_year() cascade;
drop function if exists public.exams_validate_assignment_scope() cascade;
drop function if exists public.assignments_validate_target() cascade;
drop function if exists public.students_validate_teaching_fields() cascade;
drop function if exists public.students_validate_year_grade() cascade;
drop function if exists public.academic_years_single_active() cascade;
drop function if exists public.teachers_validate_fields() cascade;
drop function if exists public.assignments_validate_teaching_mode() cascade;
drop function if exists public.exam_tracking_fill_academic_year() cascade;
drop function if exists public.student_history_fill_academic_year() cascade;
drop function if exists public.makeup_exams_fill_academic_year() cascade;

drop type if exists public.student_status cascade;
drop type if exists public.exam_student_status cascade;
drop type if exists public.makeup_exam_status cascade;
drop type if exists public.cohort_grade_level cascade;
drop type if exists public.student_grade_level cascade;
drop type if exists public.user_role cascade;

create extension if not exists "pgcrypto";

create type public.exam_student_status as enum ('pending', 'took', 'missing', 'makeup', 'completed');
create type public.makeup_exam_status as enum ('open', 'completed');
create type public.student_status as enum ('active', 'left', 'graduated');

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  year_name text not null unique,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index uq_academic_years_one_active on public.academic_years (is_active) where is_active = true;

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

create table public.grade_level_options (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  grade_levels text[] not null,
  is_active boolean not null default true,
  constraint grade_level_options_levels_check check (
    cardinality(grade_levels) >= 1
    and grade_levels <@ array['א', 'ב', 'ג']::text[]
  )
);

create index idx_grade_level_options_active on public.grade_level_options (is_active) where is_active = true;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  password_hash text not null,
  full_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (username)
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  full_name_generated text generated always as (trim(first_name || ' ' || last_name)) stored,
  tz text,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.teachers add constraint teachers_tz_format_check
  check (tz is null or tz ~ '^\d{1,9}$');

alter table public.teachers add constraint teachers_email_format_check
  check (email is null or email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

create index idx_teachers_name on public.teachers (first_name, last_name);
create index idx_teachers_email on public.teachers (email) where email is not null;

create table public.students (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  first_name text not null,
  last_name text not null,
  tz text not null,
  full_name_generated text generated always as (first_name || ' ' || last_name) stored,
  grade_level text not null check (grade_level in ('א', 'ב', 'ג')),
  class_id uuid not null references public.classes (id) on delete restrict,
  track_id uuid references public.tracks (id) on delete restrict,
  specialization_id uuid references public.specializations (id) on delete restrict,
  secondary_specialization_id uuid references public.specializations (id) on delete restrict,
  is_psychology boolean not null default false,
  teaching_track_type text,
  notes text,
  status public.student_status not null default 'active',
  import_batch_id uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index uq_students_tz_per_year on public.students (academic_year_id, tz) where deleted_at is null;
create index idx_students_academic_year on public.students (academic_year_id);
create index idx_students_grade on public.students (academic_year_id, grade_level);

alter table public.students add constraint students_teaching_track_type_check
  check (teaching_track_type is null or teaching_track_type in ('full', 'short'));

alter table public.students add constraint students_secondary_spec_distinct
  check (
    secondary_specialization_id is null
    or specialization_id is null
    or secondary_specialization_id <> specialization_id
  );

create table public.teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  teacher_id uuid not null references public.teachers (id) on delete restrict,
  grade_level text not null check (grade_level in ('א', 'ב', 'ג')),
  subject text not null,
  lesson_name text,
  assignment_category text not null,
  class_id uuid references public.classes (id) on delete restrict,
  specialization_id uuid references public.specializations (id) on delete restrict,
  track_id uuid references public.tracks (id) on delete restrict,
  psychology_enabled boolean not null default false,
  teaching_mode text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.teacher_assignments add constraint teacher_assignments_category_check
  check (assignment_category in ('חובה', 'התמחות'));

alter table public.teacher_assignments add constraint teacher_assignments_teaching_mode_check
  check (teaching_mode is null or teaching_mode in ('full', 'short'));

alter table public.teacher_assignments add constraint teacher_assignments_category_target_check
  check (
    (
      assignment_category = 'התמחות'
      and specialization_id is not null
      and class_id is null
      and track_id is null
      and not psychology_enabled
    )
    or (
      assignment_category = 'חובה'
      and specialization_id is null
      and (
        (case when class_id is not null then 1 else 0 end) +
        (case when track_id is not null then 1 else 0 end) +
        (case when psychology_enabled then 1 else 0 end)
      ) = 1
      and (
        not psychology_enabled
        or (class_id is null and track_id is null)
      )
    )
  );

create unique index uq_teacher_assignment on public.teacher_assignments (
  academic_year_id,
  teacher_id,
  grade_level,
  subject,
  coalesce(lesson_name, ''),
  assignment_category,
  coalesce(class_id::text, ''),
  coalesce(specialization_id::text, ''),
  coalesce(track_id::text, ''),
  psychology_enabled,
  coalesce(teaching_mode, '')
) where deleted_at is null;

create index idx_teacher_assignments_category on public.teacher_assignments (assignment_category);

create index idx_teacher_assignments_teacher on public.teacher_assignments (teacher_id);

create table public.exams (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  teacher_assignment_id uuid not null references public.teacher_assignments (id) on delete restrict,
  grade_level text not null check (grade_level in ('א', 'ב', 'ג')),
  teacher_id uuid not null references public.teachers (id) on delete restrict,
  subject text not null,
  exam_date date not null,
  assignment_category text not null,
  class_id uuid references public.classes (id) on delete restrict,
  specialization_id uuid references public.specializations (id) on delete restrict,
  track_id uuid references public.tracks (id) on delete restrict,
  psychology_enabled boolean not null default false,
  notes text,
  makeup_locked_at timestamptz,
  teaching_track_type text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.exams add constraint exams_category_check
  check (assignment_category in ('חובה', 'התמחות'));

alter table public.exams add constraint exams_teaching_track_type_check
  check (teaching_track_type is null or teaching_track_type in ('full', 'short'));

alter table public.exams add constraint exams_category_target_check
  check (
    (
      assignment_category = 'התמחות'
      and specialization_id is not null
      and class_id is null
      and track_id is null
      and not psychology_enabled
    )
    or (
      assignment_category = 'חובה'
      and specialization_id is null
      and (
        (case when class_id is not null then 1 else 0 end) +
        (case when track_id is not null then 1 else 0 end) +
        (case when psychology_enabled then 1 else 0 end)
      ) = 1
      and (
        not psychology_enabled
        or (class_id is null and track_id is null)
      )
    )
  );

create unique index uq_exams_unique on public.exams (
  academic_year_id, grade_level, teacher_assignment_id, exam_date
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
  subject_snapshot text,
  grade_level_snapshot text,
  academic_year_name_snapshot text,
  target_name_snapshot text,
  secondary_specialization_snapshot text,
  is_psychology_snapshot boolean,
  teaching_track_type_snapshot text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

create table public.makeup_exams (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  exam_id uuid not null references public.exams (id) on delete restrict,
  status public.makeup_exam_status not null default 'open',
  grade numeric,
  notes text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  unique (student_id, exam_id)
);

create table public.makeup_tracking (
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

create index idx_makeup_tracking_exam_id on public.makeup_tracking (exam_id);
create index idx_makeup_tracking_teacher_id on public.makeup_tracking (teacher_id);
create index idx_makeup_tracking_student_id on public.makeup_tracking (student_id);

create table public.exam_tracking (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
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
  academic_year_id uuid not null references public.academic_years (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  old_grade_level text,
  new_grade_level text,
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
  entity_name_snapshot text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.academic_years_single_active()
returns trigger language plpgsql as $$
begin
  if new.is_active then
    update public.academic_years set is_active = false where id <> new.id and is_active;
  end if;
  return new;
end;
$$;

create trigger trg_academic_years_single_active
  after insert or update of is_active on public.academic_years
  for each row execute function public.academic_years_single_active();

create or replace function public.assignments_validate_target()
returns trigger language plpgsql as $$
begin
  if new.class_id is not null then
    if not exists (select 1 from public.classes c where c.id = new.class_id and c.is_active) then
      raise exception 'class_id invalid or inactive';
    end if;
  end if;
  if new.specialization_id is not null then
    if not exists (select 1 from public.specializations s where s.id = new.specialization_id and s.is_active) then
      raise exception 'specialization_id invalid or inactive';
    end if;
  end if;
  if new.track_id is not null then
    if not exists (select 1 from public.tracks t where t.id = new.track_id and t.is_active) then
      raise exception 'track_id invalid or inactive';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_assignments_validate_target
  before insert or update of class_id, specialization_id, track_id, psychology_enabled on public.teacher_assignments
  for each row execute function public.assignments_validate_target();

create or replace function public.students_validate_teaching_fields()
returns trigger language plpgsql as $$
declare
  track_name text;
begin
  if new.secondary_specialization_id is not null
     and new.specialization_id is not null
     and new.secondary_specialization_id = new.specialization_id then
    raise exception 'התמחות נוספת חייבת להיות שונה מהראשית';
  end if;

  if new.track_id is null then
    if new.teaching_track_type is not null then
      raise exception 'סוג הוראה מותר רק במסלול הוראה';
    end if;
    return new;
  end if;

  select t.name into track_name from public.tracks t where t.id = new.track_id;
  if coalesce(track_name, '') = 'הוראה' then
    return new;
  end if;

  if new.teaching_track_type is not null then
    raise exception 'סוג הוראה מותר רק במסלול הוראה';
  end if;
  return new;
end;
$$;

create trigger trg_students_validate_teaching
  before insert or update on public.students
  for each row execute function public.students_validate_teaching_fields();

create or replace function public.exams_validate_target()
returns trigger language plpgsql as $$
begin
  if new.class_id is not null then
    if not exists (select 1 from public.classes c where c.id = new.class_id) then
      raise exception 'exam class_id invalid';
    end if;
  end if;
  if new.specialization_id is not null then
    if not exists (select 1 from public.specializations s where s.id = new.specialization_id) then
      raise exception 'exam specialization_id invalid';
    end if;
  end if;
  if new.track_id is not null then
    if not exists (select 1 from public.tracks t where t.id = new.track_id) then
      raise exception 'exam track_id invalid';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_exams_validate_target
  before insert or update of class_id, specialization_id, track_id, psychology_enabled on public.exams
  for each row execute function public.exams_validate_target();

create or replace function public.exams_validate_assignment_scope()
returns trigger language plpgsql as $$
declare
  a_year_id uuid;
  a_grade text;
begin
  select ta.academic_year_id, ta.grade_level
  into a_year_id, a_grade
  from public.teacher_assignments ta
  where ta.id = new.teacher_assignment_id
    and ta.deleted_at is null;

  if a_year_id is null then
    raise exception 'teacher_assignment not found or deleted';
  end if;

  if a_year_id <> new.academic_year_id or a_grade <> new.grade_level then
    raise exception 'exam scope must match teacher_assignment';
  end if;

  return new;
end;
$$;

create trigger trg_exams_validate_assignment_scope
  before insert or update of teacher_assignment_id, academic_year_id, grade_level on public.exams
  for each row execute function public.exams_validate_assignment_scope();

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

create or replace function public.assignments_validate_teaching_mode()
returns trigger language plpgsql as $$
declare
  track_name text;
begin
  if new.teaching_mode is null then
    return new;
  end if;
  if new.track_id is null then
    raise exception 'סוג הוראה מותר רק בשיבוץ מסלול';
  end if;
  select t.name into track_name from public.tracks t where t.id = new.track_id;
  if coalesce(track_name, '') <> 'הוראה' then
    raise exception 'סוג הוראה מותר רק במסלול הוראה';
  end if;
  return new;
end;
$$;

create trigger trg_assignments_validate_teaching_mode
  before insert or update on public.teacher_assignments
  for each row execute function public.assignments_validate_teaching_mode();

-- ממלא academic_year_id כשהאפליקציה לא שולחת (מעקב, היסטוריה, השלמות)
create or replace function public.exam_tracking_fill_academic_year()
returns trigger language plpgsql as $$
begin
  if new.academic_year_id is null then
    select e.academic_year_id into new.academic_year_id
    from public.exams e
    where e.id = new.exam_id;
  end if;
  if new.academic_year_id is null then
    raise exception 'exam_tracking: exam not found';
  end if;
  return new;
end;
$$;

create trigger trg_exam_tracking_fill_year
  before insert on public.exam_tracking
  for each row execute function public.exam_tracking_fill_academic_year();

create or replace function public.student_history_fill_academic_year()
returns trigger language plpgsql as $$
begin
  if new.academic_year_id is null then
    select s.academic_year_id into new.academic_year_id
    from public.students s
    where s.id = new.student_id;
  end if;
  if new.academic_year_id is null then
    raise exception 'student_history: student not found';
  end if;
  return new;
end;
$$;

create trigger trg_student_history_fill_year
  before insert on public.student_history
  for each row execute function public.student_history_fill_academic_year();

create or replace function public.makeup_exams_fill_academic_year()
returns trigger language plpgsql as $$
begin
  if new.academic_year_id is null then
    select e.academic_year_id into new.academic_year_id
    from public.exams e
    where e.id = new.exam_id;
  end if;
  if new.academic_year_id is null then
    raise exception 'makeup_exams: exam not found';
  end if;
  return new;
end;
$$;

create trigger trg_makeup_exams_fill_year
  before insert on public.makeup_exams
  for each row execute function public.makeup_exams_fill_academic_year();

create index idx_students_tz on public.students (tz);
create index idx_students_full_name on public.students (full_name_generated);
create index idx_students_deleted on public.students (deleted_at) where deleted_at is null;
create index idx_students_import_batch on public.students (import_batch_id);
create index idx_teacher_assignments_grade on public.teacher_assignments (academic_year_id, grade_level);
create index idx_teacher_assignments_class_id on public.teacher_assignments (class_id) where class_id is not null;
create index idx_teacher_assignments_specialization_id on public.teacher_assignments (specialization_id) where specialization_id is not null;
create index idx_teacher_assignments_track_id on public.teacher_assignments (track_id) where track_id is not null;
create index idx_exams_academic_year on public.exams (academic_year_id);
create index idx_exams_exam_date on public.exams (exam_date);
create index idx_exams_deleted on public.exams (deleted_at) where deleted_at is null;
create index idx_exam_students_exam_id on public.exam_students (exam_id);
create index idx_exam_students_student_id on public.exam_students (student_id);
create index idx_exam_students_status on public.exam_students (status);
create index idx_makeup_exams_academic_year on public.makeup_exams (academic_year_id);
create index idx_makeup_exams_student_id on public.makeup_exams (student_id);
create index idx_makeup_status on public.makeup_exams (status);
create index idx_exam_tracking_academic_year on public.exam_tracking (academic_year_id);
create index idx_exam_tracking_deleted on public.exam_tracking (deleted_at) where deleted_at is null;
create index idx_audit_entity on public.audit_logs (entity_type, entity_id);
create index idx_student_history_student on public.student_history (student_id, changed_at desc);
create index idx_notifications_user_unread on public.notifications (user_id, created_at desc) where read_at is null;

create extension if not exists pg_trgm;
create index idx_students_full_name_trgm on public.students using gin (full_name_generated gin_trgm_ops);
create index idx_teachers_full_name_trgm on public.teachers using gin (full_name_generated gin_trgm_ops);

alter table public.notifications enable row level security;
alter table public.academic_years enable row level security;
alter table public.classes enable row level security;
alter table public.specializations enable row level security;
alter table public.tracks enable row level security;
alter table public.grade_level_options enable row level security;
alter table public.users enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.teacher_assignments enable row level security;
alter table public.exams enable row level security;
alter table public.exam_students enable row level security;
alter table public.makeup_exams enable row level security;
alter table public.makeup_tracking enable row level security;
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

insert into public.grade_level_options (name, grade_levels) values
  ('א', array['א']::text[]),
  ('ב', array['ב']::text[]),
  ('ג', array['ג']::text[]),
  ('א+ב', array['א', 'ב']::text[])
on conflict (name) do nothing;

insert into public.academic_years (year_name, is_active) values
  ('2026', true)
on conflict (year_name) do nothing;

notify pgrst, 'reload schema';
