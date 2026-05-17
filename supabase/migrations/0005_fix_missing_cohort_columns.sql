-- הריצי ב-Supabase SQL Editor אם מופיעה השגיאה: column academic_years.cohort_a_id does not exist
-- בטוח להרצה חוזרת (IF NOT EXISTS)

alter table public.academic_years add column if not exists cohort_a_id uuid references public.cohorts (id) on delete restrict;
alter table public.academic_years add column if not exists cohort_b_id uuid references public.cohorts (id) on delete restrict;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'cohort_year_placements'
  ) then
    update public.academic_years y
    set cohort_a_id = p.cohort_id
    from public.cohort_year_placements p
    where p.academic_year_id = y.id
      and p.grade_level = 'A'::public.cohort_grade_level
      and y.cohort_a_id is null;

    update public.academic_years y
    set cohort_b_id = p.cohort_id
    from public.cohort_year_placements p
    where p.academic_year_id = y.id
      and p.grade_level = 'B'::public.cohort_grade_level
      and y.cohort_b_id is null;
  end if;
end $$;

alter table public.academic_years drop constraint if exists academic_years_cohorts_different;
alter table public.academic_years add constraint academic_years_cohorts_different
  check (cohort_a_id is distinct from cohort_b_id);

create index if not exists idx_academic_years_cohort_a on public.academic_years (cohort_a_id);
create index if not exists idx_academic_years_cohort_b on public.academic_years (cohort_b_id);

-- רענון מטמון ה-API של Supabase (חשוב אחרי הוספת עמודות)
notify pgrst, 'reload schema';
