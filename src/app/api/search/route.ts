import { NextResponse } from "next/server";
import { notDeleted } from "@/lib/db/softDelete";
import { selectedCohortIdList } from "@/lib/cohorts/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const supabase = createSupabaseAdminClient();
  const cohortIds = await selectedCohortIdList(supabase);
  const escape = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  const pattern = `%${escape}%`;

  let studentsQ = notDeleted(
    supabase
      .from("students")
      .select("id, first_name, last_name, tz, full_name_generated")
      .or(`full_name_generated.ilike.${pattern},first_name.ilike.${pattern},last_name.ilike.${pattern},tz.ilike.${pattern}`)
      .limit(8),
  );
  if (cohortIds.length) studentsQ = studentsQ.in("cohort_id", cohortIds);

  const teachersQ = notDeleted(
    supabase.from("teachers").select("id, name").ilike("name", pattern).limit(5),
  );

  let examsQ = notDeleted(
    supabase.from("exams").select("id, subject, exam_date, teachers(name)"),
  )
    .ilike("subject", pattern)
    .limit(8);
  if (cohortIds.length) examsQ = examsQ.in("cohort_id", cohortIds);

  const [students, teachers, exams] = await Promise.all([studentsQ, teachersQ, examsQ]);

  type Result = { type: string; id: string; label: string; href: string };

  const results: Result[] = [];

  for (const s of students.data ?? []) {
    const row = s as { id: string; first_name: string; last_name: string; tz: string };
    results.push({
      type: "תלמידה",
      id: row.id,
      label: `${row.last_name} ${row.first_name} (${row.tz})`,
      href: `/students/${row.id}`,
    });
  }

  for (const t of teachers.data ?? []) {
    const row = t as { id: string; name: string };
    results.push({
      type: "מורה",
      id: row.id,
      label: row.name,
      href: `/teachers/${row.id}/edit`,
    });
  }

  for (const e of exams.data ?? []) {
    const row = e as { id: string; subject: string; exam_date: string; teachers: unknown };
    const tn = row.teachers as { name?: string } | { name?: string }[] | null;
    const teacherName = Array.isArray(tn) ? tn[0]?.name : tn && typeof tn === "object" && "name" in tn ? tn.name : "";
    results.push({
      type: "מבחן",
      id: row.id,
      label: `${row.subject} · ${row.exam_date}${teacherName ? ` · ${teacherName}` : ""}`,
      href: `/exams/${row.id}`,
    });
  }

  const { data: makeups } = await supabase
    .from("makeup_exams")
    .select("id, status, students(first_name, last_name), exams(subject)")
    .eq("status", "open")
    .limit(20);

  for (const m of makeups ?? []) {
    const raw = m as {
      id: string;
      students: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null;
      exams: { subject: string } | { subject: string }[] | null;
    };
    const st = Array.isArray(raw.students) ? raw.students[0] : raw.students;
    const ex = Array.isArray(raw.exams) ? raw.exams[0] : raw.exams;
    const name = st ? `${st.last_name} ${st.first_name}` : "";
    if (!name.includes(q) && !(ex?.subject ?? "").includes(q)) continue;
    results.push({
      type: "השלמה",
      id: raw.id,
      label: `${name} · ${ex?.subject ?? "מבחן"}`,
      href: "/makeups",
    });
  }

  return NextResponse.json({ results: results.slice(0, 20) });
}
