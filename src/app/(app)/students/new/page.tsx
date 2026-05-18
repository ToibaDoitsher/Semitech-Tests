import Link from "next/link";
import { redirect } from "next/navigation";
import { StudentFormExtras } from "@/components/students/StudentFormExtras";
import { parseGradeLevel } from "@/lib/academicYears/labels";
import { getActiveAcademicYear } from "@/lib/academicYears/years";
import { hasAppSession } from "@/lib/auth/passwordSession";
import { normalizeStudentFields } from "@/lib/students/patch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  const supabase = createSupabaseAdminClient();
  const activeYear = await getActiveAcademicYear(supabase);
  if (!activeYear) throw new Error("לא הוגדרה שנה פעילה");

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
    if (!year) throw new Error("לא הוגדרה שנה פעילה");

    const year_group = Number(formData.get("year_group"));
    const grade_level = parseGradeLevel(String(formData.get("grade_level") ?? ""));
    if (!Number.isFinite(year_group) || !grade_level) throw new Error("שנתון ושכבה חובה");

    const extra = await normalizeStudentFields(sb, {
      specialization_id: String(formData.get("specialization_id") ?? "").trim() || null,
      secondary_specialization_id: String(formData.get("secondary_specialization_id") ?? "").trim() || null,
      track_id: String(formData.get("track_id") ?? "").trim() || null,
      is_psychology: formData.get("is_psychology") === "1",
      teaching_track_type: String(formData.get("teaching_track_type") ?? "") as "" | "full" | "short",
    });
    if (extra.error) throw new Error(extra.error);

    const { error } = await sb.from("students").insert({
      academic_year_id: year.id,
      first_name: String(formData.get("first_name") ?? "").trim(),
      last_name: String(formData.get("last_name") ?? "").trim(),
      tz: String(formData.get("tz") ?? "").trim(),
      year_group,
      grade_level,
      class_id: String(formData.get("class_id") ?? "").trim(),
      ...extra.patch,
    });
    if (error) throw new Error(error.message);
    redirect("/students");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">הוספת תלמידה</h1>
      <p className="text-sm text-zinc-600">שנה פעילה: {activeYear.year_name}</p>
      <form action={createStudent} className="grid gap-4 rounded-2xl border bg-white p-6 md:grid-cols-2">
        <label className="block text-sm">
          שם פרטי
          <input name="first_name" required className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label className="block text-sm">
          שם משפחה
          <input name="last_name" required className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label className="block text-sm">
          ת״ז
          <input name="tz" required dir="ltr" className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label className="block text-sm">
          שנתון
          <input name="year_group" required type="number" min={1} className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label className="block text-sm">
          שכבה
          <select name="grade_level" required className="mt-1 w-full rounded border px-2 py-1">
            <option value="א">א</option>
            <option value="ב">ב</option>
            <option value="ג">ג</option>
          </select>
        </label>
        <label className="block text-sm">
          כיתה
          <select name="class_id" required className="mt-1 w-full rounded border px-2 py-1">
            {(cl.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          התמחות
          <select name="specialization_id" className="mt-1 w-full rounded border px-2 py-1">
            <option value="">—</option>
            {(sp.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <StudentFormExtras specializations={sp.data ?? []} tracks={tr.data ?? []} />
        <div className="flex justify-end md:col-span-2">
          <button type="submit" className="rounded-xl bg-violet-600 px-4 py-2 text-white">
            שמירה
          </button>
        </div>
      </form>
      <Link href="/students">חזרה</Link>
    </div>
  );
}
