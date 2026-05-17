import { NextResponse } from "next/server";
import { enrichStudentsWithGrade } from "@/lib/academic/studentGrade";
import { loadYearCohortConfig } from "@/lib/academic/yearCohorts";
import { resolveAcademicYearId } from "@/lib/academic/year";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const cohortGrade = (searchParams.get("cohort_grade") ?? "").trim();
  const classId = (searchParams.get("class_id") ?? "").trim();
  const specializationId = (searchParams.get("specialization_id") ?? "").trim();
  const trackId = (searchParams.get("track_id") ?? "").trim();

  const supabase = createSupabaseAdminClient();
  const yearId = await resolveAcademicYearId(supabase);
  if (!yearId) {
    return NextResponse.json({ students: [], error: "לא נבחרה שנת לימודים" }, { status: 400 });
  }

  const year = await loadYearCohortConfig(supabase, yearId);
  if (!year) {
    return NextResponse.json({ students: [], error: "שנת לימודים לא נמצאה" }, { status: 400 });
  }

  let cohortFilterIds: string[] | null = null;
  if (cohortGrade === "A" && year.cohort_a_id) cohortFilterIds = [year.cohort_a_id];
  if (cohortGrade === "B" && year.cohort_b_id) cohortFilterIds = [year.cohort_b_id];

  const studentSelect = await getStudentWithLookupsSelect(supabase);
  let query = supabase
    .from("students")
    .select(studentSelect)
    .eq("academic_year_id", yearId)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .limit(300);

  if (cohortFilterIds) query = query.in("cohort_id", cohortFilterIds);
  if (classId) query = query.eq("class_id", classId);
  if (specializationId) query = query.eq("specialization_id", specializationId);
  if (trackId) query = query.eq("track_id", trackId);

  if (q) {
    const escapeIlike = (s: string) => s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const parts = q.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      const p0 = escapeIlike(parts[0]);
      const pRest = escapeIlike(parts.slice(1).join(" "));
      const pLast = escapeIlike(parts[parts.length - 1]);
      const pHead = escapeIlike(parts.slice(0, -1).join(" "));
      query = query.or(
        `and(first_name.ilike.%${p0}%,last_name.ilike.%${pRest}%),and(first_name.ilike.%${pHead}%,last_name.ilike.%${pLast}%)`,
      );
    } else {
      const escaped = escapeIlike(parts[0] ?? q);
      query = query.or(
        `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,tz.ilike.%${escaped}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const students = enrichStudentsWithGrade(data ?? [], year);

  return NextResponse.json({ students });
  } catch (e) {
    const msg = (e as Error).message ?? "שגיאת שרת";
    return NextResponse.json({ error: msg, students: [] }, { status: 500 });
  }
}
