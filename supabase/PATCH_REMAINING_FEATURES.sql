-- כלול ב-RUN_FULL_DATABASE_RESET.sql | להרצה נפרדת: מסד קיים בלבד (או PATCH_ALL_FOR_EXISTING_DB.sql)
-- makeup_locked, snapshots, התראות, חיפוש pg_trgm — אל תריצי על מסד חדש אחרי RUN_FULL.

alter table public.exams add column if not exists makeup_locked_at timestamptz;

alter table public.exam_students add column if not exists subject_snapshot text;
alter table public.exam_students add column if not exists target_name_snapshot text;

alter table public.audit_logs add column if not exists entity_name_snapshot text;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete set null,
  title text not null,
  body text,
  href text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread on public.notifications (user_id, created_at desc) where read_at is null;

create extension if not exists pg_trgm;
create index if not exists idx_students_full_name_trgm on public.students using gin (full_name_generated gin_trgm_ops);
create index if not exists idx_teachers_full_name_trgm on public.teachers using gin (full_name_generated gin_trgm_ops);

alter table public.notifications enable row level security;

notify pgrst, 'reload schema';
