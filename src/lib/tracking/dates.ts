/** תאריך יעד לפי תאריך מבחן (YYYY-MM-DD) ± ימים — מוצג כ-DD/MM/YYYY */
export function examTrackingDueDate(examDate: string | null | undefined, dayOffset: number): string {
  if (!examDate?.trim()) return "—";
  const base = new Date(`${examDate.trim()}T12:00:00`);
  if (Number.isNaN(base.getTime())) return "—";
  base.setDate(base.getDate() + dayOffset);
  return base.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export const EXAM_SUBMISSION_DUE_OFFSET = -7;
export const GRADES_SUBMISSION_DUE_OFFSET = 7;
