-- =====================================================================
-- PATCH: שדות רישום להשלמה — makeup_exams
-- =====================================================================
-- מה זה עושה?
--   מוסיף שתי עמודות:
--   • starting_grade — מאיזה ציון מתחיל המבחן (0–100, אופציונלי)
--   • is_paid — בתשלום (כן/לא, ברירת מחדל: לא)
--
--   תאריך השלמה (completed_at) כבר קיים ברוב המסדים.
--
-- מה זה לא עושה?
--   * לא מוחק שום נתון
--   * לא משנה עמודות קיימות
--
-- בטיחות: IF NOT EXISTS — מותר להריץ כמה פעמים.
-- איך: Supabase Dashboard → SQL Editor → Run.
-- =====================================================================

alter table public.makeup_exams
  add column if not exists starting_grade numeric;

alter table public.makeup_exams
  add column if not exists is_paid boolean not null default false;

comment on column public.makeup_exams.starting_grade is
  'מאיזה ציון מתחיל המבחן (0–100). מוזן בעת סימון «נרשמה להשלמה».';

comment on column public.makeup_exams.is_paid is
  'האם ההשלמה בתשלום. מוזן בעת סימון «נרשמה להשלמה».';
