/** מיזוג הערות השלמה + הערות מהמבחן (כללי + לתלמידה במבחן) לתצוגה */
export function combinedMakeupDisplayNotes(input: {
  makeupNotes?: string | null;
  examNotes?: string | null;
  examStudentNotes?: string | null;
}): string {
  const makeup = (input.makeupNotes ?? "").trim();
  const examStudent = (input.examStudentNotes ?? "").trim();
  const exam = (input.examNotes ?? "").trim();

  const parts: string[] = [];
  if (makeup) parts.push(makeup);
  if (examStudent && examStudent !== makeup) {
    parts.push(parts.length ? `מבחן (תלמידה): ${examStudent}` : examStudent);
  }
  if (exam && exam !== makeup && exam !== examStudent) {
    parts.push(parts.length ? `הערת מבחן: ${exam}` : exam);
  }
  return parts.join("\n");
}

export function hasAnyMakeupDisplayNote(input: {
  makeupNotes?: string | null;
  examNotes?: string | null;
  examStudentNotes?: string | null;
}): boolean {
  return combinedMakeupDisplayNotes(input).length > 0;
}
