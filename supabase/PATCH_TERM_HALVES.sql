alter table public.academic_years
  add column if not exists active_term text;

update public.academic_years
set active_term = 'ב'
where active_term is null and is_active = true;

update public.academic_years
set active_term = 'א'
where active_term is null;

alter table public.academic_years drop constraint if exists academic_years_active_term_check;
alter table public.academic_years
  add constraint academic_years_active_term_check
  check (active_term in ('א', 'ב'));

alter table public.academic_years
  alter column active_term set default 'א';

alter table public.exams add column if not exists term text;

update public.exams set term = 'ב' where term is null;

alter table public.exams drop constraint if exists exams_term_check;
alter table public.exams
  add constraint exams_term_check check (term in ('א', 'ב'));

alter table public.exams alter column term set default 'א';

create index if not exists idx_exams_year_term
  on public.exams (academic_year_id, term)
  where deleted_at is null;

alter table public.exam_tracking add column if not exists term text;

update public.exam_tracking et
set term = coalesce(
  (select e.term from public.exams e where e.id = et.exam_id),
  'ב'
)
where et.term is null;

update public.exam_tracking set term = 'ב' where term is null;

alter table public.exam_tracking drop constraint if exists exam_tracking_term_check;
alter table public.exam_tracking
  add constraint exam_tracking_term_check check (term in ('א', 'ב'));

alter table public.exam_tracking alter column term set default 'א';

create index if not exists idx_exam_tracking_year_term
  on public.exam_tracking (academic_year_id, term);

alter table public.makeup_exams add column if not exists term text;

update public.makeup_exams me
set term = coalesce(
  (select e.term from public.exams e where e.id = me.exam_id),
  'ב'
)
where me.term is null;

update public.makeup_exams set term = 'ב' where term is null;

alter table public.makeup_exams drop constraint if exists makeup_exams_term_check;
alter table public.makeup_exams
  add constraint makeup_exams_term_check check (term in ('א', 'ב'));

alter table public.makeup_exams alter column term set default 'א';

create index if not exists idx_makeup_exams_year_term
  on public.makeup_exams (academic_year_id, term)
  where deleted_at is null;

alter table public.makeup_tracking add column if not exists term text;

update public.makeup_tracking mt
set term = coalesce(
  (select e.term from public.exams e where e.id = mt.exam_id),
  'ב'
)
where mt.term is null;

update public.makeup_tracking set term = 'ב' where term is null;

alter table public.makeup_tracking drop constraint if exists makeup_tracking_term_check;
alter table public.makeup_tracking
  add constraint makeup_tracking_term_check check (term in ('א', 'ב'));

alter table public.makeup_tracking alter column term set default 'א';

create index if not exists idx_makeup_tracking_year_term
  on public.makeup_tracking (academic_year_id, term);

create or replace function public.exam_tracking_fill_academic_year()
returns trigger language plpgsql as $$
begin
  if new.academic_year_id is null or new.term is null then
    select e.academic_year_id, e.term
      into new.academic_year_id, new.term
    from public.exams e
    where e.id = new.exam_id;
  end if;
  if new.academic_year_id is null then
    raise exception 'exam_tracking: exam not found';
  end if;
  if new.term is null then
    new.term := 'א';
  end if;
  return new;
end;
$$;

create or replace function public.makeup_exams_fill_academic_year()
returns trigger language plpgsql as $$
begin
  if new.academic_year_id is null or new.term is null then
    select e.academic_year_id, e.term
      into new.academic_year_id, new.term
    from public.exams e
    where e.id = new.exam_id;
  end if;
  if new.academic_year_id is null then
    raise exception 'makeup_exams: exam not found';
  end if;
  if new.term is null then
    new.term := 'א';
  end if;
  return new;
end;
$$;

create or replace function public.makeup_tracking_fill_academic_year()
returns trigger language plpgsql as $$
begin
  if new.academic_year_id is null or new.term is null then
    select e.academic_year_id, e.term
      into new.academic_year_id, new.term
    from public.exams e
    where e.id = new.exam_id;
  end if;
  if new.academic_year_id is null then
    raise exception 'makeup_tracking: exam not found';
  end if;
  if new.term is null then
    new.term := 'א';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
