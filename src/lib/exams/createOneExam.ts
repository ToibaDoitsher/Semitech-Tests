import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAudit } from "@/lib/audit/log";
import {
  normalizeTargetInput,
  validateAssignmentWithCategory,
} from "@/lib/assignments/target";
import type { AssignmentCategory } from "@/lib/types/db";
import {
  assertTeacherAssignmentMatchesExam,
  fetchStudentIdsForTarget,
  isTeachingTrackId,
  targetColumnsFromAssignment,
} from "@/lib/exams/logic";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { buildExamStudentRows } from "@/lib/exams/snapshots";
import { assertNoDuplicateExam } from "@/lib/validations/exams";
import type { GradeLevel, TeachingTrackType } from "@/lib/types/db";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";

export type CreateOneExamParams = {
  supabase: SupabaseClient;
  academicYearId: string;
  academicYearName: string;
  teacherId: string;
  subject: string;
  examDate: string;
  gradeLevel: GradeLevel;
  assignmentId: string;
  teachingTrackType: TeachingTrackType | null;
  auditUserId: string | null;
};

export async function createOneExam(
  params: CreateOneExamParams,
): Promise<{ exam: Record<string, unknown>; students_count: number } | { error: string }> {
  const {
    supabase,
    academicYearId,
    academicYearName,
    teacherId,
    subject,
    examDate,
    gradeLevel,
    assignmentId,
    teachingTrackType: teachingTrackTypeIn,
    auditUserId,
  } = params;

  const { data: ta } = await supabase
    .from("teacher_assignments")
    .select(
      "id, academic_year_id, grade_level, teacher_id, subject, assignment_category, class_id, specialization_id, track_id, psychology_enabled, teaching_mode, lesson_name",
    )
    .eq("id", assignmentId)
    .maybeSingle();

  if (!ta) return { error: "שיבוץ לא נמצא" };
  if (ta.academic_year_id !== academicYearId) {
    return { error: "שיבוץ לא שייך לשנה הנוכחית" };
  }
  if (ta.grade_level !== gradeLevel) {
    return { error: `שיבוץ לא תואם לשכבה ${gradeLevel}` };
  }
  if (ta.teacher_id !== teacherId || ta.subject !== subject) {
    return { error: "שיבוץ לא תואם למורה/מקצוע" };
  }

  const examTarget = targetColumnsFromAssignment(ta);
  const examCategory = ta.assignment_category as AssignmentCategory;
  const scope = { academic_year_id: academicYearId, grade_level: gradeLevel };

  const targetErr = validateAssignmentWithCategory(examCategory, examTarget);
  if (targetErr) return { error: targetErr };

  const dup = await assertNoDuplicateExam(supabase, {
    gradeLevel,
    teacherId,
    subject,
    target: examTarget,
    examDate,
  });
  if (!dup.ok) return { error: dup.error ?? "מבחן כפול" };

  const check = await assertTeacherAssignmentMatchesExam(
    supabase,
    teacherId,
    subject,
    examTarget,
    scope,
  );
  if (!check.ok) return { error: check.error ?? "שיבוץ לא תואם" };

  let teaching_track_type = teachingTrackTypeIn;
  const assignmentTeachingMode = (ta.teaching_mode as "full" | "short" | null) ?? null;
  if (assignmentTeachingMode && !teaching_track_type) {
    teaching_track_type = assignmentTeachingMode;
  }

  if (examTarget.track_id) {
    const teachingTrack = await isTeachingTrackId(supabase, examTarget.track_id);
    if (teachingTrack && !teaching_track_type) {
      return { error: "במסלול הוראה — בחרי סוג הוראה (מלא / מקוצר)" };
    }
    if (!teachingTrack) teaching_track_type = null;
  } else {
    teaching_track_type = null;
  }

  const { ids: studentIds, error: stErr } = await fetchStudentIdsForTarget(
    supabase,
    examTarget,
    scope,
    { teachingTrackType: teaching_track_type, category: examCategory },
  );
  if (stErr) return { error: stErr };
  if (!studentIds.length) {
    return { error: "לא נמצאו תלמידות לפי היעד והשכבה" };
  }

  const insertRow: Record<string, unknown> = {
    academic_year_id: academicYearId,
    teacher_id: teacherId,
    subject,
    exam_date: examDate,
    assignment_category: examCategory,
    class_id: examTarget.class_id,
    specialization_id: examTarget.specialization_id,
    track_id: examTarget.track_id,
    psychology_enabled: examTarget.psychology_enabled,
    grade_level: gradeLevel,
    teacher_assignment_id: assignmentId,
  };
  if (teaching_track_type) insertRow.teaching_track_type = teaching_track_type;

  const { data: exam, error: eErr } = await supabase.from("exams").insert(insertRow).select("*").single();
  if (eErr || !exam) return { error: eErr?.message ?? "שגיאה ביצירת מבחן" };

  const examId = exam.id as string;

  const { error: trErr } = await supabase.from("exam_tracking").insert({
    exam_id: examId,
    teacher_id: teacherId,
  });
  if (trErr) {
    await supabase.from("exams").delete().eq("id", examId);
    return { error: trErr.message };
  }

  const { data: teacherRow } = await supabase
    .from("teachers")
    .select("first_name, last_name, full_name_generated")
    .eq("id", teacherId)
    .single();
  const teacherName = teacherEmbedDisplayName(teacherRow);

  const targetLabels = await resolveExamTargetLabels(supabase, [{ id: examId, ...examTarget }]);

  const rows = await buildExamStudentRows(supabase, {
    examId,
    studentIds,
    teacherName,
    subject,
    gradeLevel,
    academicYearName,
    targetName: targetLabels[examId] ?? null,
  });

  const { error: esErr } = await supabase.from("exam_students").insert(rows);
  if (esErr) {
    await supabase.from("exams").delete().eq("id", examId);
    return { error: esErr.message };
  }

  await writeAudit(supabase, {
    userId: auditUserId,
    entityType: "exam",
    entityId: examId,
    actionType: "create",
    entityNameSnapshot: subject,
    newValue: {
      teacher_id: teacherId,
      subject,
      exam_date: examDate,
      ...examTarget,
      grade_level: gradeLevel,
      teacher_assignment_id: assignmentId,
    },
  });

  return { exam: exam as Record<string, unknown>, students_count: studentIds.length };
}
