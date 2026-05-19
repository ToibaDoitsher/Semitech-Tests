/** הודעות בעברית לשגיאות סכמה נפוצות ב-Supabase */
export function dbSchemaHint(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("academic_year_id") && (m.includes("does not exist") || m.includes("column"))) {
    return "סכמת שנות לימוד לא מעודכנת — הריצי supabase/PATCH_ALL_FOR_EXISTING_DB.sql ב-Supabase SQL Editor";
  }
  if (
    (m.includes("start_date") || m.includes("end_date")) &&
    (m.includes("does not exist") || m.includes("column"))
  ) {
    return "עמודות תאריך בשנות לימוד חסרות — הריצי supabase/PATCH_ALL_FOR_EXISTING_DB.sql ב-Supabase SQL Editor";
  }
  if (m.includes("makeup_tracking") && (m.includes("does not exist") || m.includes("schema cache"))) {
    return "טבלת מעקב השלמות חסרה — הריצי supabase/PATCH_MAKEUP_TRACKING.sql ב-Supabase SQL Editor";
  }
  if (m.includes("deleted_at") && (m.includes("does not exist") || m.includes("column"))) {
    return "עמודת מחיקה רכה חסרה — הריצי supabase/PATCH_ALL_FOR_EXISTING_DB.sql ב-Supabase SQL Editor";
  }
  if (m.includes("grade_level_options") && (m.includes("does not exist") || m.includes("schema cache"))) {
    return "טבלת אפשרויות שכבה חסרה — הריצי supabase/PATCH_GRADE_LEVEL_OPTIONS.sql או RUN_FULL_DATABASE_RESET.sql";
  }
  return message;
}
