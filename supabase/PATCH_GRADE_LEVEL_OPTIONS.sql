-- הרצה בטוחה על מסד קיים (לא מוחק נתונים).
-- לוקאפ שכבות ליצירת מבחנים (כולל אפשרות «א+ב»).

create table if not exists public.grade_level_options (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  grade_levels text[] not null,
  is_active boolean not null default true,
  constraint grade_level_options_levels_check check (
    cardinality(grade_levels) >= 1
    and grade_levels <@ array['א', 'ב', 'ג']::text[]
  )
);

create index if not exists idx_grade_level_options_active on public.grade_level_options (is_active) where is_active = true;

alter table public.grade_level_options enable row level security;

insert into public.grade_level_options (name, grade_levels) values
  ('א', array['א']::text[]),
  ('ב', array['ב']::text[]),
  ('ג', array['ג']::text[]),
  ('א+ב', array['א', 'ב']::text[])
on conflict (name) do nothing;

notify pgrst, 'reload schema';
