import type { SupabaseClient } from "@supabase/supabase-js";

type StudentSnapRow = {
  id: string;
  classes: { name: string } | { name: string }[] | null;
  tracks: { name: string } | { name: string }[] | null;
  specializations: { name: string } | { name: string }[] | null;
};

function lookupName(v: { name: string } | { name: string }[] | null | undefined): string | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0]?.name ?? null;
  return v.name ?? null;
}

export async function buildExamStudentRows(
  supabase: SupabaseClient,
  params: {
    examId: string;
    studentIds: string[];
    teacherName: string;
  },
): Promise<Record<string, unknown>[]> {
  if (!params.studentIds.length) return [];

  const { data, error } = await supabase
    .from("students")
    .select("id, classes(name), tracks(name), specializations(name)")
    .in("id", params.studentIds);

  if (error) throw new Error(error.message);

  const byId = new Map((data ?? []).map((r) => [r.id as string, r as StudentSnapRow]));

  return params.studentIds.map((student_id) => {
    const s = byId.get(student_id);
    return {
      exam_id: params.examId,
      student_id,
      status: "pending",
      class_snapshot: lookupName(s?.classes),
      track_snapshot: lookupName(s?.tracks),
      specialization_snapshot: lookupName(s?.specializations),
      teacher_snapshot: params.teacherName,
    };
  });
}
