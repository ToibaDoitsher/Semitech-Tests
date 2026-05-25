import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchStudentIdsForMultiTarget, rowToMultiTarget } from "@/lib/assignments/multiTarget";
import { resolveExamTargetLabels } from "@/lib/exams/resolveTargetNames";
import { buildExamStudentRows } from "@/lib/exams/snapshots";
import {
  fetchTeachingTrackIds,
  studentMatchesExamTarget,
  type ExamTargetForMatch,
  type StudentForMatch,
} from "@/lib/exams/studentMatch";
import { teacherEmbedDisplayName } from "@/lib/teachers/display";
import type { AssignmentCategory, TeachingTrackType } from "@/lib/types/db";

type ExamMatchRow = ExamTargetForMatch & {
  id: string;
  academic_year_id: string;
  teacher_id: string;
  subject: string;
  exam_date: string;
  makeup_locked_at: string | null;
};

export type SyncExamStudentsResult = {
  added: number;
  removedExamStudents: number;
  removedMakeups: number;
  removedTracking: number;
};

/**
 * מסנכרן את שורות exam_students של מבחן ליעד הנוכחי שלו.
 * - מוסיף תלמידות חדשות שמתאימות (עם snapshot מלא)
 * - מסיר תלמידות שאינן מתאימות עוד (כולל cascade ל-makeup_exams ו-makeup_tracking)
 * - מעדכן את target_name_snapshot על שורות שנשארות
 */
export async function syncExamStudentsToTarget(
  supabase: SupabaseClient,
  examId: string,
): Promise<SyncExamStudentsResult | { error: string }> {
  const { data: exam, error: examErr } = await supabase
    .from("exams")
    .select(
      "id, academic_year_id, teacher_id, subject, exam_date, assignment_category, grade_levels, class_ids, track_ids, specialization_ids, psychology_enabled, applies_to_all_in_grade, teaching_track_type",
    )
    .eq("id", examId)
    .is("deleted_at", null)
    .maybeSingle();
  if (examErr || !exam) return { error: examErr?.message ?? "מבחן לא נמצא" };

  const examRow = exam as {
    academic_year_id: string;
    teacher_id: string;
    subject: string;
    exam_date: string;
    assignment_category: AssignmentCategory;
    teaching_track_type: TeachingTrackType | null;
  };

  const multiTarget = rowToMultiTarget(exam);

  const { ids: desiredIds, error: mtErr } = await fetchStudentIdsForMultiTarget(
    supabase,
    multiTarget,
    { academic_year_id: examRow.academic_year_id },
    {
      teachingTrackType: examRow.teaching_track_type,
      category: examRow.assignment_category,
    },
  );
  if (mtErr) return { error: mtErr };

  const desiredSet = new Set(desiredIds);

  const { data: currentLines, error: linesErr } = await supabase
    .from("exam_students")
    .select("id, student_id")
    .eq("exam_id", examId);
  if (linesErr) return { error: linesErr.message };

  const currentSet = new Set(
    (currentLines ?? []).map((r) => (r as { student_id: string }).student_id),
  );

  const toRemove = (currentLines ?? [])
    .filter((r) => !desiredSet.has((r as { student_id: string }).student_id))
    .map((r) => (r as { id: string; student_id: string }));
  const toAddIds = desiredIds.filter((sid) => !currentSet.has(sid));

  let removedMakeups = 0;
  let removedTracking = 0;
  let removedExamStudents = 0;

  if (toRemove.length) {
    const removeStudentIds = toRemove.map((r) => r.student_id);

    const { count: makeupTrackingCount } = await supabase
      .from("makeup_tracking")
      .delete({ count: "exact" })
      .eq("exam_id", examId)
      .in("student_id", removeStudentIds);
    removedTracking = makeupTrackingCount ?? 0;

    const { count: makeupCount } = await supabase
      .from("makeup_exams")
      .delete({ count: "exact" })
      .eq("exam_id", examId)
      .in("student_id", removeStudentIds);
    removedMakeups = makeupCount ?? 0;

    const { count: esCount, error: esDelErr } = await supabase
      .from("exam_students")
      .delete({ count: "exact" })
      .eq("exam_id", examId)
      .in("student_id", removeStudentIds);
    if (esDelErr) return { error: esDelErr.message };
    removedExamStudents = esCount ?? 0;
  }

  let added = 0;
  if (toAddIds.length) {
    const { data: teacherRow } = await supabase
      .from("teachers")
      .select("first_name, last_name, full_name_generated")
      .eq("id", examRow.teacher_id)
      .maybeSingle();
    const teacherName = teacherEmbedDisplayName(teacherRow);

    const { data: yearRow } = await supabase
      .from("academic_years")
      .select("year_name")
      .eq("id", examRow.academic_year_id)
      .maybeSingle();
    const yearName = (yearRow as { year_name?: string } | null)?.year_name ?? null;

    const targetLabels = await resolveExamTargetLabels(supabase, [
      { id: examId, ...multiTarget },
    ]);

    const fallbackGrade = multiTarget.grade_levels[0] ?? "א";
    const rows = await buildExamStudentRows(supabase, {
      examId,
      studentIds: toAddIds,
      teacherName,
      subject: examRow.subject,
      fallbackGradeLevel: fallbackGrade,
      academicYearName: yearName,
      targetName: targetLabels[examId] ?? null,
    });

    const { error: insErr } = await supabase.from("exam_students").insert(rows);
    if (insErr) return { error: insErr.message };
    added = rows.length;
  }

  if (currentLines && currentLines.length && desiredSet.size) {
    const targetLabels = await resolveExamTargetLabels(supabase, [
      { id: examId, ...multiTarget },
    ]);
    const newTargetLabel = targetLabels[examId] ?? null;
    await supabase
      .from("exam_students")
      .update({ target_name_snapshot: newTargetLabel })
      .eq("exam_id", examId);
  }

  return { added, removedExamStudents, removedMakeups, removedTracking };
}

export type StudentPropagationResult = {
  addedExams: number;
  removedExams: number;
  removedMakeups: number;
  removedTracking: number;
  affectedExamIds: string[];
};

/**
 * עדכון תלמידה ספציפית בכל המבחנים העתידיים של אותה שנה.
 * - מוסיף לשורות exam_students אם היא מתאימה כעת ולא הייתה
 * - מסיר אם היא לא מתאימה יותר (+ cascade ל-makeup_exams ו-makeup_tracking)
 *
 * רק מבחנים עם exam_date >= היום, באותה שנת לימודים, ושלא נעולים להשלמות.
 */
export async function propagateStudentChangeToFutureExams(
  supabase: SupabaseClient,
  studentId: string,
  academicYearId: string,
): Promise<StudentPropagationResult | { error: string }> {
  const { data: studentRow, error: stErr } = await supabase
    .from("students")
    .select(
      "id, grade_level, class_id, track_id, specialization_id, secondary_specialization_id, is_psychology, teaching_track_type",
    )
    .eq("id", studentId)
    .maybeSingle();
  if (stErr || !studentRow) return { error: stErr?.message ?? "תלמידה לא נמצאה" };

  const student = studentRow as StudentForMatch;

  const today = new Date().toISOString().slice(0, 10);

  const { data: exams, error: exErr } = await supabase
    .from("exams")
    .select(
      "id, academic_year_id, teacher_id, subject, exam_date, assignment_category, grade_levels, class_ids, track_ids, specialization_ids, psychology_enabled, applies_to_all_in_grade, teaching_track_type, makeup_locked_at",
    )
    .eq("academic_year_id", academicYearId)
    .is("deleted_at", null)
    .gte("exam_date", today);
  if (exErr) return { error: exErr.message };

  const futureExams = (exams ?? []) as ExamMatchRow[];
  if (!futureExams.length) {
    return {
      addedExams: 0,
      removedExams: 0,
      removedMakeups: 0,
      removedTracking: 0,
      affectedExamIds: [],
    };
  }

  const examIds = futureExams.map((e) => e.id);
  const { data: existingLines, error: linesErr } = await supabase
    .from("exam_students")
    .select("id, exam_id, status")
    .eq("student_id", studentId)
    .in("exam_id", examIds);
  if (linesErr) return { error: linesErr.message };

  const existingByExam = new Map<string, { id: string; status: string }>();
  for (const r of existingLines ?? []) {
    const row = r as { id: string; exam_id: string; status: string };
    existingByExam.set(row.exam_id, { id: row.id, status: row.status });
  }

  const teachingTrackIds = await fetchTeachingTrackIds(supabase);

  const toAdd: ExamMatchRow[] = [];
  const toRemoveLines: { lineId: string; examId: string }[] = [];
  const affected: string[] = [];

  for (const exam of futureExams) {
    const shouldBeIn = studentMatchesExamTarget(student, exam, teachingTrackIds);
    const currentLine = existingByExam.get(exam.id);
    const isIn = Boolean(currentLine);

    if (shouldBeIn && !isIn) {
      toAdd.push(exam);
      affected.push(exam.id);
    } else if (!shouldBeIn && isIn) {
      if (exam.makeup_locked_at) continue;
      toRemoveLines.push({ lineId: currentLine!.id, examId: exam.id });
      affected.push(exam.id);
    }
  }

  let removedExams = 0;
  let removedMakeups = 0;
  let removedTracking = 0;
  if (toRemoveLines.length) {
    const examIdsToClean = toRemoveLines.map((r) => r.examId);

    const { count: mtCount } = await supabase
      .from("makeup_tracking")
      .delete({ count: "exact" })
      .eq("student_id", studentId)
      .in("exam_id", examIdsToClean);
    removedTracking = mtCount ?? 0;

    const { count: mCount } = await supabase
      .from("makeup_exams")
      .delete({ count: "exact" })
      .eq("student_id", studentId)
      .in("exam_id", examIdsToClean);
    removedMakeups = mCount ?? 0;

    const lineIds = toRemoveLines.map((r) => r.lineId);
    const { count: esCount, error: delErr } = await supabase
      .from("exam_students")
      .delete({ count: "exact" })
      .in("id", lineIds);
    if (delErr) return { error: delErr.message };
    removedExams = esCount ?? 0;
  }

  let addedExams = 0;
  if (toAdd.length) {
    const teacherIds = [...new Set(toAdd.map((e) => e.teacher_id))];
    const { data: teacherRows } = await supabase
      .from("teachers")
      .select("id, first_name, last_name, full_name_generated")
      .in("id", teacherIds);
    type TeacherEmbedRow = Parameters<typeof teacherEmbedDisplayName>[0];
    const teacherById = new Map<string, TeacherEmbedRow>(
      (teacherRows ?? []).map((t) => {
        const row = t as { id: string } & NonNullable<TeacherEmbedRow>;
        return [row.id, row];
      }),
    );

    const { data: yearRow } = await supabase
      .from("academic_years")
      .select("year_name")
      .eq("id", academicYearId)
      .maybeSingle();
    const yearName = (yearRow as { year_name?: string } | null)?.year_name ?? null;

    const targetRows = toAdd.map((e) => ({ id: e.id, ...rowToMultiTarget(e) }));
    const targetLabels = await resolveExamTargetLabels(supabase, targetRows);

    for (const exam of toAdd) {
      const multiTarget = rowToMultiTarget(exam);
      const teacherName = teacherEmbedDisplayName(teacherById.get(exam.teacher_id) ?? null);
      const fallbackGrade = multiTarget.grade_levels[0] ?? "א";
      const rows = await buildExamStudentRows(supabase, {
        examId: exam.id,
        studentIds: [studentId],
        teacherName,
        subject: exam.subject,
        fallbackGradeLevel: fallbackGrade,
        academicYearName: yearName,
        targetName: targetLabels[exam.id] ?? null,
      });
      const { error: insErr } = await supabase.from("exam_students").insert(rows);
      if (insErr) return { error: insErr.message };
      addedExams += 1;
    }
  }

  return {
    addedExams,
    removedExams,
    removedMakeups,
    removedTracking,
    affectedExamIds: [...new Set(affected)],
  };
}
