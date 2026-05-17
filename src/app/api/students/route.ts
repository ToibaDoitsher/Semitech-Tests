import { NextResponse } from "next/server";
import { resolveAcademicYearId } from "@/lib/academic/year";
import { asStudentRows } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import type { GradeLevel } from "@/lib/students/gradeLevel";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const gradeLevel = (searchParams.get("grade_level") ?? searchParams.get("cohort_grade") ?? "").trim();
    const cohortNumber = (searchParams.get("cohort_number") ?? "").trim();
    const classId = (searchParams.get("class_id") ?? "").trim();
    const specializationId = (searchParams.get("specialization_id") ?? "").trim();
    const trackId = (searchParams.get("track_id") ?? "").trim();

    const supabase = createSupabaseAdminClient();
    const yearId = await resolveAcademicYearId(supabase);
    if (!yearId) {
      return NextResponse.json({ students: [], error: "לא נבחרה שנת לימודים" }, { status: 400 });
    }

    const studentSelect = await getStudentWithLookupsSelect();
    let query = supabase
      .from("students")
      .select(studentSelect)
      .eq("academic_year_id", yearId)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .limit(300);

    if (gradeLevel === "א" || gradeLevel === "ב" || gradeLevel === "A") {
      const gl: GradeLevel = gradeLevel === "A" ? "א" : (gradeLevel as GradeLevel);
      query = query.eq("grade_level", gl);
    }
    if (cohortNumber) {
      const n = Number.parseInt(cohortNumber, 10);
      if (Number.isFinite(n)) query = query.eq("cohort_number", n);
    }
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

    return NextResponse.json({ students: asStudentRows(data) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, students: [] }, { status: 500 });
  }
}
