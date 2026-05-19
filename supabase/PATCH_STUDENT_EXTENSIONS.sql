-- כלול ב-RUN_FULL_DATABASE_RESET.sql | להרצה נפרדת: מסד קיים בלבד (או PATCH_ALL_FOR_EXISTING_DB.sql)
-- התמחות שנייה, פסיכולוגיה, סוג הוראה — אל תריצי על מסד חדש אחרי RUN_FULL.

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

notify pgrst, 'reload schema';
