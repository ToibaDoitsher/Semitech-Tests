-- הריצי ב-Supabase SQL Editor אם המסד כבר קיים

alter table public.teacher_assignments drop constraint if exists teacher_assignments_teaching_mode_check;
alter table public.teacher_assignments add constraint teacher_assignments_teaching_mode_check
  check (teaching_mode is null or teaching_mode in ('full', 'short', 'both'));

alter table public.exams drop constraint if exists exams_teaching_track_type_check;
alter table public.exams add constraint exams_teaching_track_type_check
  check (teaching_track_type is null or teaching_track_type in ('full', 'short', 'both'));
