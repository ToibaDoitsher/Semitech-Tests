import { NextResponse } from "next/server";
import { enrichStudentsWithGrade } from "@/lib/academic/studentGrade";
import { gradeInPair } from "@/lib/cohorts/grades";
import { listAllCohorts } from "@/lib/cohorts/active";
import { resolveSelectedCohortPair, selectedCohortIdList } from "@/lib/cohorts/server";
import { asStudentRows } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { notDeleted } from "@/lib/db/softDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const gradeLevel = (searchParams.get("grade_level") ?? searchParams.get("cohort_grade") ?? "").trim();
    const cohortId = (searchParams.get("cohort_id") ?? "").trim();
    const classId = (searchParams.get("class_id") ?? "").trim();
    const specializationId = (searchParams.get("specialization_id") ?? "").trim();
    const trackId = (searchParams.get("track_id") ?? "").trim();

    const supabase = createSupabaseAdminClient();
    const pair = await resolveSelectedCohortPair(supabase);
    const cohortIds = await selectedCohortIdList(supabase);

    const studentSelect = await getStudentWithLookupsSelect();
    let query = notDeleted(
      supabase.from("students").select(studentSelect),
    )
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .limit(500);

    if (cohortIds.length) query = query.in("cohort_id", cohortIds);

    const gl = gradeLevel === "A" ? "א" : gradeLevel === "B" ? "ב" : gradeLevel;
    if (pair && gl === "א") query = query.eq("cohort_id", pair.cohortA.id);
    if (pair && gl === "ב") query = query.eq("cohort_id", pair.cohortB.id);
    if (cohortId) query = query.eq("cohort_id", cohortId);
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

    const students = enrichStudentsWithGrade(asStudentRows(data), pair);
    const cohorts = await listAllCohorts(supabase);

    return NextResponse.json({
      students,
      pair: pair
        ? {
            label: `${pair.cohortA.number} + ${pair.cohortB.number}`,
            cohortA: { id: pair.cohortA.id, number: pair.cohortA.number, grade: gradeInPair(pair.cohortA.id, pair) },
            cohortB: { id: pair.cohortB.id, number: pair.cohortB.number, grade: gradeInPair(pair.cohortB.id, pair) },
          }
        : null,
      cohorts,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, students: [] }, { status: 500 });
  }
}
