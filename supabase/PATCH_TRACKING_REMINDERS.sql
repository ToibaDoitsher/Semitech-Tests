-- =====================================================================
-- PATCH: תזכורות מעקב מבחנים (הינדי / בילר)
-- =====================================================================
-- מה זה עושה?
--   מוסיף שתי עמודות date אופציונליות לטבלת exam_tracking:
--     * reminder_1_hindi  — תזכורת 1 ע"י הינדי
--     * reminder_2_biller — תזכורת 2 ע"י בילר
--
-- מה זה לא עושה?
--   * לא מוחק שום נתון
--   * לא מוחק שום טבלה
--   * לא משנה שום עמודה קיימת
--   * לא נוגע ב-RLS, ב-foreign keys, או במדיניות גישה
--
-- בטיחות:
--   הפקודות מוגנות ב-`IF NOT EXISTS` — מותר להריץ כמה פעמים.
--
-- איך מריצים?
--   Supabase Dashboard → SQL Editor → New query → להדביק → Run.
-- =====================================================================

alter table public.exam_tracking
  add column if not exists reminder_1_hindi date;

alter table public.exam_tracking
  add column if not exists reminder_2_biller date;

comment on column public.exam_tracking.reminder_1_hindi is
  'תאריך תזכורת 1 ע"י הינדי (אופציונלי).';

comment on column public.exam_tracking.reminder_2_biller is
  'תאריך תזכורת 2 ע"י בילר (אופציונלי).';
