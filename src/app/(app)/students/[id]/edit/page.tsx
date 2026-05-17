import Link from "next/link";
import { redirect } from "next/navigation";
import { formatCohortGradeLabel } from "@/lib/academic/studentGrade";
import { hasAppSession } from "@/lib/auth/passwordSession";
import { asStudentRow } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { resolveGradeForCohortInYear } from "@/lib/students/gradeLevel";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const studentSelect = await getStudentWithLookupsSelect();
  const { data: student, error } = await supabase.from("students").select(studentSelect).eq("id", id).single();
  if (error || !student) redirect("/students");
  const s = asStudentRow(student);
  const grade = await resolveGradeForCohortInYear(supabase, s.academic_year_id, s.cohort_number);
  const [cl, sp, tr] = await Promise.all([
    supabase.from("classes").select("id,name").order("name"),
    supabase.from("specializations").select("id,name").order("name"),
    supabase.from("tracks").select("id,name").order("name"),
  ]);

  async function updateStudent(formData: FormData) {
    "use server";
    if (!(await hasAppSession())) redirect("/login");
    const sb = createSupabaseAdminClient();
    const cohort_number = Number.parseInt(String(formData.get("cohort_number") ?? ""), 10);
    const grade_level = await resolveGradeForCohortInYear(sb, s.academic_year_id, cohort_number);
    const { error: uErr } = await sb.from("students").update({
      first_name: String(formData.get("first_name") ?? "").trim(),
      last_name: String(formData.get("last_name") ?? "").trim(),
      tz: String(formData.get("tz") ?? "").trim(),
      cohort_number,
      grade_level,
      class_id: String(formData.get("class_id") ?? "").trim(),
      specialization_id: String(formData.get("specialization_id") ?? "").trim() || null,
      track_id: String(formData.get("track_id") ?? "").trim() || null,
    }).eq("id", id);
    if (uErr) throw new Error(uErr.message);
    redirect(`/students/${id}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">עריכת תלמידה</h1>
      <p className="text-sm text-zinc-600">שכבה {formatCohortGradeLabel(grade)} · מחזור {s.cohort_number}</p>
      <form action={updateStudent} className="grid gap-3 rounded border bg-white p-4 md:grid-cols-2">
        <label className="block text-sm">שם פרטי<input name="first_name" defaultValue={s.first_name} required className="mt-1 w-full border rounded px-2 py-1" /></label>
        <label className="block text-sm">שם משפחה<input name="last_name" defaultValue={s.last_name} required className="mt-1 w-full border rounded px-2 py-1" /></label>
        <label className="block text-sm">ת״ז<input name="tz" defaultValue={s.tz} required dir="ltr" className="mt-1 w-full border rounded px-2 py-1" /></label>
        <label className="block text-sm">מחזור<input name="cohort_number" type="number" defaultValue={s.cohort_number} required className="mt-1 w-full border rounded px-2 py-1" /></label>
        <label className="block text-sm">כיתה<select name="class_id" defaultValue={s.class_id} required className="mt-1 w-full border rounded px-2 py-1">{(cl.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="block text-sm">התמחות<select name="specialization_id" defaultValue={s.specialization_id ?? ""} className="mt-1 w-full border rounded px-2 py-1"><option value="">—</option>{(sp.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="block text-sm">מסלול<select name="track_id" defaultValue={s.track_id ?? ""} className="mt-1 w-full border rounded px-2 py-1"><option value="">—</option>{(tr.data ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <div className="md:col-span-2 flex gap-2 justify-end">
          <Link href={`/students/${id}`}>ביטול</Link>
          <button type="submit" className="rounded bg-violet-600 text-white px-3 py-1">שמירה</button>
        </div>
      </form>
    </div>
  );
}
