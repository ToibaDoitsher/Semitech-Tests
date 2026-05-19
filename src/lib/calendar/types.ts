export type CalendarExamProps = {
  examId: string;
  subject: string;
  examDate: string;
  teacherId: string;
  teacherName: string;
  targetType: string;
  targetTypeLabel: string;
  targetLabel: string;
  gradeLevelName: string | null;
  counts: { total: number; took: number; missing: number; makeup: number; completed: number; pending: number };
  tone: string;
  classConflict: boolean;
  teacherOverlap: boolean;
  dayExamCount: number;
  heavyDay: boolean;
};
