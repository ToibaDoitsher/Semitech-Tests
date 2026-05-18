alter type public.exam_target_type add value if not exists 'psychology';

alter table public.students
  add column if not exists secondary_specialization_id uuid references public.specializations (id) on delete restrict,
  add column if not exists is_psychology boolean not null default false,
  add column if not exists teaching_track_type text;

alter table public.exams
  add column if not exists teaching_track_type text;

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

drop trigger if exists trg_students_validate_teaching on public.students;
create trigger trg_students_validate_teaching
  before insert or update on public.students
  for each row execute function public.students_validate_teaching_fields();

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
  elsif new.target_type = 'psychology' then
    if new.target_id <> new.cohort_id then
      raise exception 'psychology assignment target_id must equal cohort_id';
    end if;
  end if;
  return new;
end;
$$;

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
  elsif new.target_type = 'psychology' then
    if new.target_id <> new.cohort_id then
      raise exception 'psychology exam target_id must equal cohort_id';
    end if;
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
