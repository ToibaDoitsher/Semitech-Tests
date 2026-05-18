import Link from "next/link";
import { redirect } from "next/navigation";
import { StudentFormExtras } from "@/components/students/StudentFormExtras";
import { formatCohortGradeLabel } from "@/lib/academic/studentGrade";
import { enrichStudentsWithGradeForYear } from "@/lib/academic/studentGrade.server";
import { parseGradeLevel } from "@/lib/academicYears/labels";
import { hasAppSession } from "@/lib/auth/passwordSession";
import { asStudentRow } from "@/lib/db/studentRow";
import { getStudentWithLookupsSelect } from "@/lib/db/studentSelect";
import { normalizeStudentFields } from "@/lib/students/patch";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const studentSelect = await getStudentWithLookupsSelect();
  const { data: student, error } = await supabase.from("students").select(studentSelect).eq("id", id).single();
  if (error || !student) redirect("/students");
  const s = asStudentRow(student);
  const enriched = (await enrichStudentsWithGradeForYear(supabase, [s]))[0];

  const [cl, sp, tr] = await Promise.all([
    supabase.from("classes").select("id,name").order("name"),
    supabase.from("specializations").select("id,name").order("name"),
    supabase.from("tracks").select("id,name").order("name"),
  ]);

  async function updateStudent(formData: FormData) {
    "use server";
    if (!(await hasAppSession())) redirect("/login");
    const sb = createSupabaseAdminClient();
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

    const { error: uErr } = await sb
      .from("students")
      .update({
        first_name: String(formData.get("first_name") ?? "").trim(),
        last_name: String(formData.get("last_name") ?? "").trim(),
        tz: String(formData.get("tz") ?? "").trim(),
        year_group,
        grade_level,
        class_id: String(formData.get("class_id") ?? "").trim(),
        ...extra.patch,
      })
      .eq("id", id);
    if (uErr) throw new Error(uErr.message);
    redirect(`/students/${id}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">עריכת תלמידה</h1>
      <p className="text-sm text-zinc-600">
        {enriched.year_label ?? `שנתון ${s.year_group} — שכבה ${formatCohortGradeLabel(s.grade_level)}`}
      </p>
      <form action={updateStudent} className="grid gap-3 rounded border bg-white p-4 md:grid-cols-2">
        <label className="block text-sm">
          שם פרטי
          <input name="first_name" defaultValue={s.first_name} required className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label className="block text-sm">
          שם משפחה
          <input name="last_name" defaultValue={s.last_name} required className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label className="block text-sm">
          ת״ז
          <input name="tz" defaultValue={s.tz} required dir="ltr" className="mt-1 w-full rounded border px-2 py-1" />
        </label>
        <label className="block text-sm">
          שנתון
          <input
            name="year_group"
            type="number"
            defaultValue={String(s.year_group)}
            required
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
        <label className="block text-sm">
          שכבה
          <select name="grade_level" defaultValue={s.grade_level} required className="mt-1 w-full rounded border px-2 py-1">
            <option value="א">א</option>
            <option value="ב">ב</option>
            <option value="ג">ג</option>
          </select>
        </label>
        <label className="block text-sm">
          כיתה
          <select name="class_id" defaultValue={s.class_id} required className="mt-1 w-full rounded border px-2 py-1">
            {(cl.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          התמחות
          <select name="specialization_id" defaultValue={s.specialization_id ?? ""} className="mt-1 w-full rounded border px-2 py-1">
            <option value="">—</option>
            {(sp.data ?? []).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <StudentFormExtras
          specializations={sp.data ?? []}
          tracks={tr.data ?? []}
          defaultSecondarySpecId={s.secondary_specialization_id ?? ""}
          defaultIsPsychology={Boolean(s.is_psychology)}
          defaultTeachingType={s.teaching_track_type ?? ""}
          defaultTrackId={s.track_id ?? ""}
        />
        <div className="flex gap-2 justify-end md:col-span-2">
          <Link href={`/students/${id}`}>ביטול</Link>
          <button type="submit" className="rounded bg-violet-600 px-3 py-1 text-white">
            שמירה
          </button>
        </div>
      </form>
    </div>
  );
}
