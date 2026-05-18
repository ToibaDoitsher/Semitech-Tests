alter table public.cohorts add column if not exists is_active boolean not null default false;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'cohorts' and column_name = 'is_current'
  ) then
    update public.cohorts set is_active = is_current where is_current = true;
  end if;
end $$;

alter table public.cohorts drop column if exists grade_level;
alter table public.cohorts drop column if exists is_current;
alter table public.cohorts drop column if exists is_archived;

alter table public.exams add column if not exists teacher_assignment_id uuid references public.teacher_assignments (id) on delete restrict;

do $$
declare
  r record;
begin
  for r in
    select e.id as exam_id, ta.id as assignment_id
    from public.exams e
    join public.teacher_assignments ta
      on ta.teacher_id = e.teacher_id
      and ta.subject = e.subject
      and ta.target_type = e.target_type
      and ta.target_id = e.target_id
      and ta.cohort_id = e.cohort_id
      and ta.active = true
    where e.teacher_assignment_id is null
    limit 500
  loop
    update public.exams set teacher_assignment_id = r.assignment_id where id = r.exam_id;
  end loop;
end $$;

create index if not exists idx_cohorts_active on public.cohorts (is_active) where is_active = true;
create index if not exists idx_cohorts_number on public.cohorts (number);
create index if not exists idx_exams_teacher_assignment on public.exams (teacher_assignment_id);

notify pgrst, 'reload schema';
