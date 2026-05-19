import { NextResponse } from "next/server";
import { enrichStudentsWithGrade } from "@/lib/academic/studentGrade";
import { listGradeOptions } from "@/lib/academicYears/options";
import { parseGradeLevel } from "@/lib/academicYears/labels";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import type { GradeLevel } from "@/lib/academicYears/types";
import { asStudentRows } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { notDeleted } from "@/lib/db/softDelete";
import { dbSchemaHint } from "@/lib/db/schemaHint";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const gradeLevelRaw = (searchParams.get("grade_level") ?? "").trim();
    const classId = (searchParams.get("class_id") ?? "").trim();
    const specializationId = (searchParams.get("specialization_id") ?? "").trim();
    const trackId = (searchParams.get("track_id") ?? "").trim();
    const psychology = (searchParams.get("is_psychology") ?? "").trim();
    const teachingType = (searchParams.get("teaching_track_type") ?? "").trim();

    const supabase = createSupabaseAdminClient();
    const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
    const grades = await listGradeOptions(supabase, scope.year.id);

    const studentSelect = await getStudentWithLookupsSelect();
    let query = notDeleted(supabase.from("students").select(studentSelect))
      .eq("academic_year_id", scope.year.id)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true })
      .limit(500);

    const gl = parseGradeLevel(gradeLevelRaw);
    if (gl) query = query.eq("grade_level", gl);

    if (classId) query = query.eq("class_id", classId);
    if (specializationId) query = query.eq("specialization_id", specializationId);
    if (trackId) query = query.eq("track_id", trackId);
    if (psychology === "1" || psychology === "true") query = query.eq("is_psychology", true);
    if (psychology === "0" || psychology === "false") query = query.eq("is_psychology", false);
    if (teachingType === "full" || teachingType === "short") {
      query = query.eq("teaching_track_type", teachingType);
    }

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
    if (error) return NextResponse.json({ error: dbSchemaHint(error.message) }, { status: 500 });

    const students = enrichStudentsWithGrade(asStudentRows(data));

    return NextResponse.json({
      students,
      readOnly: scope.readOnly,
      academicYear: scope.year,
      grades,
    });
  } catch (e) {
    return NextResponse.json({ error: dbSchemaHint((e as Error).message), students: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supabase = createSupabaseAdminClient();
    const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
    if (scope.readOnly) {
      return NextResponse.json(readOnlyResponse(), { status: 403 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const grade_level = parseGradeLevel(String(body.grade_level ?? ""));
    if (!grade_level) {
      return NextResponse.json({ error: "שכבה חובה" }, { status: 400 });
    }

    const extra = await import("@/lib/students/patch").then((m) =>
      m.normalizeStudentFields(supabase, {
        specialization_id: body.specialization_id as string | null,
        secondary_specialization_id: body.secondary_specialization_id as string | null,
        track_id: body.track_id as string | null,
        is_psychology: Boolean(body.is_psychology),
        teaching_track_type: body.teaching_track_type as "full" | "short" | null | "",
      }),
    );
    if (extra.error) return NextResponse.json({ error: extra.error }, { status: 400 });

    const { data, error } = await supabase
      .from("students")
      .insert({
        academic_year_id: scope.year.id,
        first_name: String(body.first_name ?? "").trim(),
        last_name: String(body.last_name ?? "").trim(),
        tz: String(body.tz ?? "").trim(),
        grade_level: grade_level as GradeLevel,
        class_id: String(body.class_id ?? "").trim(),
        ...extra.patch,
      })
      .select(await getStudentWithLookupsSelect())
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ student: data });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
