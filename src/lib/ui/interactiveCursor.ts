/** מחלקות עכבר מותאמות — מוגדרות ב־globals.css */
export const interactiveCursor = {
  student: "cursor-entity-student",
  exam: "cursor-entity-exam",
  note: "cursor-entity-note",
  edit: "cursor-entity-edit",
  nav: "cursor-entity-nav",
} as const;

/** עכבר לפי נתיב קישור (התראות, חיפוש וכו') */
export function cursorClassForHref(href: string): string {
  if (href.startsWith("/students")) return interactiveCursor.student;
  if (href.startsWith("/exams")) return interactiveCursor.exam;
  if (href.includes("/edit")) return interactiveCursor.edit;
  return interactiveCursor.nav;
}
