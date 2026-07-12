import type { GradeLevel, Term } from "@/lib/academicYears/types";

export type { GradeLevel, Term };
/** סוג הוראה על תלמידה / teaching_track_type במבחן — full או short בלבד */
export type TeachingTrackType = "full" | "short";

/** סוג הוראה בשיבוץ — כולל «מלא + מקוצר» */
export type TeachingMode = "full" | "short" | "both";

export type AssignmentTargetFields = {
  class_id: string | null;
  specialization_id: string | null;
  track_id: string | null;
  psychology_enabled: boolean;
};
export type ExamStudentStatus = "pending" | "took" | "missing" | "makeup" | "completed";
export type MakeupExamStatus = "open" | "completed";
export type StudentStatus = "active" | "left" | "graduated";

export type LookupRow = {
  id: string;
  name: string;
};

export type Student = {
  id: string;
  academic_year_id: string;
  first_name: string;
  last_name: string;
  tz: string;
  grade_level: GradeLevel;
  class_id: string;
  specialization_id: string | null;
  secondary_specialization_id?: string | null;
  track_id: string | null;
  is_psychology?: boolean;
  teaching_track_type?: TeachingTrackType | null;
  notes?: string | null;
  status?: StudentStatus;
  created_at: string;
  classes?: LookupRow | null;
  specializations?: LookupRow | null;
  secondary_specializations?: LookupRow | null;
  tracks?: LookupRow | null;
};

export type Teacher = {
  id: string;
  first_name: string;
  last_name: string;
  full_name_generated?: string;
  tz?: string | null;
  email?: string | null;
  notes?: string | null;
  created_at: string;
};

export type AssignmentCategory = "חובה" | "התמחות";

export type TeacherAssignment = {
  id: string;
  academic_year_id: string;
  teacher_id: string;
  subject: string;
  lesson_name?: string | null;
  assignment_category: AssignmentCategory;
  grade_levels: GradeLevel[];
  class_ids: string[];
  track_ids: string[];
  specialization_ids: string[];
  psychology_enabled: boolean;
  applies_to_all_in_grade: boolean;
  teaching_mode?: TeachingTrackType | null;
  teachers?: Teacher | null;
};

export type Exam = {
  id: string;
  academic_year_id: string;
  term?: Term;
  teacher_id: string;
  subject: string;
  exam_date: string;
  assignment_category: AssignmentCategory;
  grade_levels: GradeLevel[];
  class_ids: string[];
  track_ids: string[];
  specialization_ids: string[];
  psychology_enabled: boolean;
  applies_to_all_in_grade: boolean;
  created_at: string;
};

export type AppUser = {
  id: string;
  username: string;
  full_name: string;
  active: boolean;
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
  term?: Term;
  status: MakeupExamStatus;
  created_at: string;
  completed_at: string | null;
};

export type ExamTracking = {
  id: string;
  exam_id: string;
  teacher_id: string;
  term?: Term;
  submitted_exam: string | null;
  approved_by_coordinator: boolean;
  sent_for_review: boolean;
  grades_submitted: boolean;
  grades_approved: boolean;
  transferred_to_system: boolean;
  photocopied: boolean;
  notes: string | null;
  student_submission_date?: string | null;
  reminder_1_hindi?: string | null;
  reminder_2_biller?: string | null;
};
