import { NextResponse } from "next/server";
import { formatGradeLabel, parseGradeLevel } from "@/lib/academicYears/labels";
import { resolveAcademicYearScope, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { examGradeLevelsLabel } from "@/lib/assignments/multiTarget";
import { notDeleted } from "@/lib/db/softDelete";
import { teacherDisplayName } from "@/lib/teachers/display";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type SearchResult = { type: string; id: string; label: string; href: string };

const BROWSE_LIMIT = 6;
const SEARCH_LIMIT = 8;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const browse = q.length < 2;

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
  const yearId = scope.year.id;

  let studentsQ = notDeleted(
    supabase
      .from("students")
      .select("id, first_name, last_name, tz, grade_level")
      .eq("academic_year_id", yearId)
      .order("last_name")
      .order("first_name")
      .limit(browse ? BROWSE_LIMIT : SEARCH_LIMIT),
  );

  let teachersQ = notDeleted(
    supabase
      .from("teachers")
      .select("id, first_name, last_name, full_name_generated, tz")
      .eq("academic_year_id", yearId)
      .order("last_name")
      .order("first_name")
      .limit(browse ? BROWSE_LIMIT : SEARCH_LIMIT),
  );

  let examsQ = notDeleted(
    supabase
      .from("exams")
      .select("id, subject, exam_date, grade_levels")
      .eq("academic_year_id", yearId)
      .limit(browse ? BROWSE_LIMIT : SEARCH_LIMIT),
  );

  if (browse) {
    examsQ = examsQ.order("exam_date", { ascending: false });
  } else {
    const escaped = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    studentsQ = studentsQ.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,tz.ilike.%${escaped}%`,
    );
    teachersQ = teachersQ.or(
      `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,full_name_generated.ilike.%${escaped}%,tz.ilike.%${escaped}%`,
    );
    examsQ = examsQ.ilike("subject", `%${escaped}%`).order("exam_date", { ascending: false });
  }

  const [{ data: students, error: sErr }, { data: teachers, error: tErr }, { data: exams, error: eErr }] =
    await Promise.all([studentsQ, teachersQ, examsQ]);

  if (sErr || tErr || eErr) {
    return NextResponse.json({ error: (sErr ?? tErr ?? eErr)?.message }, { status: 500 });
  }

  const results: SearchResult[] = [];

  for (const s of students ?? []) {
    const name = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "תלמידה";
    const grade = s.grade_level ? ` · ${formatGradeLabel(parseGradeLevel(String(s.grade_level)))}` : "";
    results.push({
      type: "תלמידה",
      id: s.id,
      label: `${name}${grade}`,
      href: `/students/${s.id}`,
    });
  }

  for (const t of teachers ?? []) {
    results.push({
      type: "מורה",
      id: t.id,
      label: teacherDisplayName(t),
      href: `/teachers/${t.id}/edit`,
    });
  }

  for (const e of exams ?? []) {
    const date =
      typeof e.exam_date === "string" && e.exam_date.length >= 10
        ? e.exam_date.slice(0, 10)
        : String(e.exam_date ?? "");
    const gradeLabel = examGradeLevelsLabel({ grade_levels: e.grade_levels ?? [] });
    const grade = gradeLabel ? ` · ${gradeLabel}` : "";
    results.push({
      type: "מבחן",
      id: e.id,
      label: `${e.subject ?? "מבחן"}${date ? ` · ${date}` : ""}${grade}`,
      href: `/exams/${e.id}`,
    });
  }

  return NextResponse.json({ results });
}
