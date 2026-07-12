import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "@/lib/db/softDelete";
import type { GradeLevel } from "@/lib/academicYears/types";

export type ScopedDeletePreview = {
  students: number;
  exams: number;
  assignments: number;
  makeups: number;
};

export type GradeDeleteBreakdown = {
  grade_level: GradeLevel;
  students: number;
  exams: number;
  assignments: number;
};

export async function previewScopedDeletes(
  supabase: SupabaseClient,
  academicYearId: string,
): Promise<ScopedDeletePreview> {
  const [students, exams, assignments, makeups] = await Promise.all([
    notDeleted(supabase.from("students").select("id", { count: "exact", head: true })).eq(
      "academic_year_id",
      academicYearId,
    ),
    notDeleted(supabase.from("exams").select("id", { count: "exact", head: true })).eq(
      "academic_year_id",
      academicYearId,
    ),
    notDeleted(supabase.from("teacher_assignments").select("id", { count: "exact", head: true })).eq(
      "academic_year_id",
      academicYearId,
    ),
    supabase
      .from("makeup_exams")
      .select("id", { count: "exact", head: true })
      .eq("academic_year_id", academicYearId),
  ]);

  return {
    students: students.count ?? 0,
    exams: exams.count ?? 0,
    assignments: assignments.count ?? 0,
    makeups: makeups.count ?? 0,
  };
}

export async function previewScopedDeletesDetailed(
  supabase: SupabaseClient,
  academicYearId: string,
  grades: { grade_level: GradeLevel }[],
): Promise<{ preview: ScopedDeletePreview; byGrade: GradeDeleteBreakdown[] }> {
  const preview = await previewScopedDeletes(supabase, academicYearId);
  const byGrade: GradeDeleteBreakdown[] = [];

  for (const grade of grades) {
    const [st, ex, asg] = await Promise.all([
      notDeleted(supabase.from("students").select("id", { count: "exact", head: true }))
        .eq("academic_year_id", academicYearId)
        .eq("grade_level", grade.grade_level),
      notDeleted(supabase.from("exams").select("id", { count: "exact", head: true }))
        .eq("academic_year_id", academicYearId)
        .contains("grade_levels", [grade.grade_level]),
      notDeleted(supabase.from("teacher_assignments").select("id", { count: "exact", head: true }))
        .eq("academic_year_id", academicYearId)
        .contains("grade_levels", [grade.grade_level]),
    ]);
    byGrade.push({
      grade_level: grade.grade_level,
      students: st.count ?? 0,
      exams: ex.count ?? 0,
      assignments: asg.count ?? 0,
    });
  }

  return { preview, byGrade };
}

async function softDeleteScoped(
  supabase: SupabaseClient,
  table: "students" | "exams" | "teacher_assignments",
  academicYearId: string,
  term?: string,
): Promise<number> {
  const now = new Date().toISOString();
  let q = supabase
    .from(table)
    .update({ deleted_at: now })
    .eq("academic_year_id", academicYearId)
    .is("deleted_at", null);
  if (term && table === "exams") q = q.eq("term", term);
  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function softDeleteStudentsInYear(
  supabase: SupabaseClient,
  academicYearId: string,
): Promise<number> {
  return softDeleteScoped(supabase, "students", academicYearId);
}

export async function softDeleteExamsInYear(
  supabase: SupabaseClient,
  academicYearId: string,
  term?: string,
): Promise<number> {
  return softDeleteScoped(supabase, "exams", academicYearId, term);
}

export async function softDeleteAssignmentsInYear(
  supabase: SupabaseClient,
  academicYearId: string,
): Promise<number> {
  return softDeleteScoped(supabase, "teacher_assignments", academicYearId);
}

export async function softDeleteMakeupsInYear(
  supabase: SupabaseClient,
  academicYearId: string,
  term?: string,
): Promise<number> {
  const now = new Date().toISOString();
  let q = supabase
    .from("makeup_exams")
    .update({ deleted_at: now })
    .eq("academic_year_id", academicYearId)
    .is("deleted_at", null);
  if (term) q = q.eq("term", term);
  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
