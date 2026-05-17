import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveAcademicYear } from "@/lib/academic/year";
import { hasAppSession } from "@/lib/auth/passwordSession";
import { resolveGradeForCohortInYear } from "@/lib/students/gradeLevel";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  const supabase = createSupabaseAdminClient();
  const activeYear = await getActiveAcademicYear(supabase);
  if (!activeYear) throw new Error("לא הוגדרה שנת לימודים פעילה");

  const [cl, sp, tr] = await Promise.all([
    supabase.from("classes").select("id,name").order("name"),
    supabase.from("specializations").select("id,name").order("name"),
    supabase.from("tracks").select("id,name").order("name"),
  ]);
  if (cl.error || sp.error || tr.error) throw new Error("שגיאת טעינה");

  async function createStudent(formData: FormData) {
    "use server";
    if (!(await hasAppSession())) redirect("/login");
    const sb = createSupabaseAdminClient();
    const year = await getActiveAcademicYear(sb);
    if (!year) throw new Error("לא הוגדרה שנת לימודים פעילה");
    const cohort_number = Number.parseInt(String(formData.get("cohort_number") ?? ""), 10);
    if (!Number.isFinite(cohort_number)) throw new Error("מחזור חובה");
    const grade_level = await resolveGradeForCohortInYear(sb, year.id, cohort_number);
    const { error } = await sb.from("students").insert({
      first_name: String(formData.get("first_name") ?? "").trim(),
      last_name: String(formData.get("last_name") ?? "").trim(),
      tz: String(formData.get("tz") ?? "").trim(),
      cohort_number,
      grade_level,
      academic_year_id: year.id,
      class_id: String(formData.get("class_id") ?? "").trim(),
      specialization_id: String(formData.get("specialization_id") ?? "").trim() || null,
      track_id: String(formData.get("track_id") ?? "").trim() || null,
    });
    if (error) throw new Error(error.message);
    redirect("/students");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">הוספת תלמידה</h1>
      <p className="text-sm text-zinc-600">שנה: {activeYear.name} · שכבה לפי מחזור</p>
      <form action={createStudent} className="grid gap-4 rounded-2xl border bg-white p-6 md:grid-cols-2">
        <Field name="first_name" label="שם פרטי" required />
        <Field name="last_name" label="שם משפחה" required />
        <Field name="tz" label="ת״ז" required dir="ltr" />
        <Field name="cohort_number" label="מחזור" required type="number" />
        <SelectLookup name="class_id" label="כיתה" required options={cl.data ?? []} />
        <SelectLookup name="specialization_id" label="התמחות" options={sp.data ?? []} allowEmpty />
        <SelectLookup name="track_id" label="מסלול" options={tr.data ?? []} allowEmpty />
        <div className="md:col-span-2 flex justify-end">
          <button type="submit" className="rounded-xl bg-violet-600 px-5 py-2 text-white">שמירה</button>
        </div>
      </form>
      <Link href="/students">חזרה</Link>
    </div>
  );
}

function Field({ name, label, required, dir, type }: { name: string; label: string; required?: boolean; dir?: string; type?: string }) {
  return (
    <label className="block">
      <div className="text-sm font-medium">{label}</div>
      <input name={name} required={required} dir={dir} type={type ?? "text"} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" />
    </label>
  );
}

function SelectLookup({ name, label, required, options, allowEmpty }: { name: string; label: string; required?: boolean; options: { id: string; name: string }[]; allowEmpty?: boolean }) {
  return (
    <label className="block">
      <div className="text-sm font-medium">{label}</div>
      <select name={name} required={required} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">
        {allowEmpty ? <option value="">—</option> : <option value="">בחרי</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </label>
  );
}
