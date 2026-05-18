-- הרצה בטוחה על מסד קיים (לא מוחק נתונים)

alter table public.makeup_exams add column if not exists grade numeric;
-- completed_at כבר קיים ברוב המסדים

create table if not exists public.makeup_tracking (
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

create index if not exists idx_makeup_tracking_exam_id on public.makeup_tracking (exam_id);
create index if not exists idx_makeup_tracking_teacher_id on public.makeup_tracking (teacher_id);
create index if not exists idx_makeup_tracking_student_id on public.makeup_tracking (student_id);
create index if not exists idx_makeup_tracking_makeup_exam_id on public.makeup_tracking (makeup_exam_id);

alter table public.makeup_tracking enable row level security;

-- מילוי רטרואקטיבי לרשומות השלמה קיימות
insert into public.makeup_tracking (
  academic_year_id,
  exam_id,
  teacher_id,
  student_id,
  makeup_exam_id,
  grade,
  notes
)
select
  me.academic_year_id,
  me.exam_id,
  e.teacher_id,
  me.student_id,
  me.id,
  me.grade,
  me.notes
from public.makeup_exams me
join public.exams e on e.id = me.exam_id
where me.deleted_at is null
on conflict (exam_id, student_id) do update set
  makeup_exam_id = coalesce(public.makeup_tracking.makeup_exam_id, excluded.makeup_exam_id),
  grade = coalesce(public.makeup_tracking.grade, excluded.grade);

notify pgrst, 'reload schema';
