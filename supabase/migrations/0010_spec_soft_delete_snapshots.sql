alter table public.students add column if not exists deleted_at timestamptz;
alter table public.teachers add column if not exists deleted_at timestamptz;
alter table public.teachers add column if not exists notes text;
alter table public.teacher_assignments add column if not exists deleted_at timestamptz;
alter table public.exams add column if not exists deleted_at timestamptz;
alter table public.exams add column if not exists notes text;
alter table public.makeup_exams add column if not exists deleted_at timestamptz;
alter table public.users add column if not exists deleted_at timestamptz;

alter table public.classes add column if not exists is_active boolean not null default true;
alter table public.specializations add column if not exists is_active boolean not null default true;
alter table public.tracks add column if not exists is_active boolean not null default true;

alter table public.exam_students add column if not exists class_snapshot text;
alter table public.exam_students add column if not exists track_snapshot text;
alter table public.exam_students add column if not exists specialization_snapshot text;
alter table public.exam_students add column if not exists teacher_snapshot text;

create index if not exists idx_students_tz on public.students (tz);
create index if not exists idx_students_cohort_id on public.students (cohort_id);
create index if not exists idx_teacher_assignments_cohort_id on public.teacher_assignments (cohort_id);
create index if not exists idx_exams_cohort_id on public.exams (cohort_id);
create index if not exists idx_exams_exam_date on public.exams (exam_date);
create index if not exists idx_exam_students_exam_id on public.exam_students (exam_id);
create index if not exists idx_exam_students_student_id on public.exam_students (student_id);
create index if not exists idx_makeup_exams_student_id on public.makeup_exams (student_id);
create index if not exists idx_students_deleted on public.students (deleted_at) where deleted_at is null;
create index if not exists idx_exams_deleted on public.exams (deleted_at) where deleted_at is null;

create or replace function public.cohorts_enforce_max_two_active()
returns trigger language plpgsql as $$
declare active_count int;
begin
  if coalesce(NEW.is_active, false) then
    select count(*)::int into active_count
    from public.cohorts
    where is_active = true and id is distinct from NEW.id;
    if active_count >= 2 then
      raise exception 'לא יכולים להיות יותר משני מחזורים פעילים';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_cohorts_max_two_active on public.cohorts;
create trigger trg_cohorts_max_two_active
  before insert or update of is_active on public.cohorts
  for each row execute function public.cohorts_enforce_max_two_active();

notify pgrst, 'reload schema';
