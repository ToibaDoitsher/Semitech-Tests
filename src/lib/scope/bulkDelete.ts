import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "@/lib/db/softDelete";

export type ScopedDeletePreview = {
  students: number;
  exams: number;
  assignments: number;
  makeups: number;
};

export async function previewScopedDeletes(
  supabase: SupabaseClient,
  cohortIds: string[],
): Promise<ScopedDeletePreview> {
  if (!cohortIds.length) {
    return { students: 0, exams: 0, assignments: 0, makeups: 0 };
  }

  const [students, exams, assignments, makeups] = await Promise.all([
    notDeleted(supabase.from("students").select("id", { count: "exact", head: true })).in(
      "cohort_id",
      cohortIds,
    ),
    notDeleted(supabase.from("exams").select("id", { count: "exact", head: true })).in(
      "cohort_id",
      cohortIds,
    ),
    notDeleted(supabase.from("teacher_assignments").select("id", { count: "exact", head: true })).in(
      "cohort_id",
      cohortIds,
    ),
    notDeleted(
      supabase
        .from("makeup_exams")
        .select("id, exams!inner(cohort_id)", { count: "exact", head: true })
        .in("exams.cohort_id", cohortIds),
    ),
  ]);

  return {
    students: students.count ?? 0,
    exams: exams.count ?? 0,
    assignments: assignments.count ?? 0,
    makeups: makeups.count ?? 0,
  };
}

export async function softDeleteStudentsInCohorts(
  supabase: SupabaseClient,
  cohortIds: string[],
): Promise<number> {
  if (!cohortIds.length) return 0;
  const now = new Date().toISOString();
  const { data, error } = await notDeleted(supabase.from("students").update({ deleted_at: now }))
    .in("cohort_id", cohortIds)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function softDeleteExamsInCohorts(
  supabase: SupabaseClient,
  cohortIds: string[],
): Promise<number> {
  if (!cohortIds.length) return 0;
  const now = new Date().toISOString();
  const { data, error } = await notDeleted(supabase.from("exams").update({ deleted_at: now }))
    .in("cohort_id", cohortIds)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function softDeleteAssignmentsInCohorts(
  supabase: SupabaseClient,
  cohortIds: string[],
): Promise<number> {
  if (!cohortIds.length) return 0;
  const now = new Date().toISOString();
  const { data, error } = await notDeleted(
    supabase.from("teacher_assignments").update({ deleted_at: now }),
  )
    .in("cohort_id", cohortIds)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function softDeleteMakeupsInCohorts(
  supabase: SupabaseClient,
  cohortIds: string[],
): Promise<number> {
  if (!cohortIds.length) return 0;
  const { data: examRows } = await notDeleted(supabase.from("exams").select("id")).in(
    "cohort_id",
    cohortIds,
  );
  const examIds = (examRows ?? []).map((r) => r.id as string);
  if (!examIds.length) return 0;
  const now = new Date().toISOString();
  const { data, error } = await notDeleted(supabase.from("makeup_exams").update({ deleted_at: now }))
    .in("exam_id", examIds)
    .select("id");
  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
