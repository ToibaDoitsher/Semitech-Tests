import type { GradeLevel } from "@/lib/students/gradeLevel";

export type ExamTargetType = "class" | "specialization" | "track";
export type ExamStudentStatus = "pending" | "took" | "missing" | "makeup" | "completed";
export type MakeupExamStatus = "open" | "completed";
export type StudentStatus = "active" | "left" | "graduated";

export type LookupRow = {
  id: string;
  name: string;
};

export type Student = {
  id: string;
  first_name: string;
  last_name: string;
  tz: string;
  cohort_number: number;
  grade_level: GradeLevel;
  academic_year_id: string;
  class_id: string;
  specialization_id: string | null;
  track_id: string | null;
  notes?: string | null;
  status?: StudentStatus;
  created_at: string;
  classes?: LookupRow | null;
  specializations?: LookupRow | null;
  tracks?: LookupRow | null;
};

export type Teacher = {
  id: string;
  name: string;
  created_at: string;
};

export type TeacherAssignment = {
  id: string;
  teacher_id: string;
  subject: string;
  academic_year_id: string;
  target_type: ExamTargetType;
  target_id: string;
  active: boolean;
  teachers?: { name: string } | null;
};

export type Exam = {
  id: string;
  teacher_id: string;
  subject: string;
  exam_date: string;
  target_type: ExamTargetType;
  target_id: string;
  created_at: string;
};

export type ExamStudent = {
  id: string;
  exam_id: string;
  student_id: string;
  status: ExamStudentStatus;
  updated_at: string;
};

export type MakeupExam = {
  id: string;
  student_id: string;
  exam_id: string;
  status: MakeupExamStatus;
  created_at: string;
  completed_at: string | null;
};

export type ExamTracking = {
  id: string;
  exam_id: string;
  teacher_id: string;
  submitted_exam: string | null;
  approved_by_coordinator: boolean;
  sent_for_review: boolean;
  grades_submitted: boolean;
  grades_approved: boolean;
  transferred_to_system: boolean;
  photocopied: boolean;
  notes: string | null;
};

export type AppUser = {
  id: string;
  username: string;
  full_name: string;
  active: boolean;
};
