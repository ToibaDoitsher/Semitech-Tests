import Link from "next/link";
import { redirect } from "next/navigation";
import { TeacherFormFields } from "@/components/teachers/TeacherFormFields";
import { getActiveAcademicYear } from "@/lib/academicYears/years";
import { hasAppSession } from "@/lib/auth/passwordSession";
import { notDeleted } from "@/lib/db/softDelete";
import { TEACHER_COLUMNS } from "@/lib/teachers/db";
import { parseTeacherBody } from "@/lib/teachers/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function EditTeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: teacher, error } = await notDeleted(supabase.from("teachers").select(TEACHER_COLUMNS))
    .eq("id", id)
    .single();
  if (error || !teacher) redirect("/teachers");

  async function updateTeacher(formData: FormData) {
    "use server";
    if (!(await hasAppSession())) redirect("/login");
    const parsed = parseTeacherBody({
      first_name: formData.get("first_name"),
      last_name: formData.get("last_name"),
      tz: formData.get("tz"),
      email: formData.get("email"),
      notes: formData.get("notes"),
    });
    if (parsed.error) throw new Error(parsed.error);

    const sb = createSupabaseAdminClient();
    const active = await getActiveAcademicYear(sb);
    const { data: current } = await sb.from("teachers").select("academic_year_id").eq("id", id).maybeSingle();
    if (!current) throw new Error("מורה לא נמצאה");
    if (!active || current.academic_year_id !== active.id) {
      throw new Error("שנה בארכיון — צפייה בלבד");
    }
    const { error: uErr } = await sb
      .from("teachers")
      .update({
        first_name: parsed.first_name,
        last_name: parsed.last_name,
        tz: parsed.tz,
        email: parsed.email,
        notes: parsed.notes,
      })
      .eq("id", id);
    if (uErr) throw new Error(uErr.message);
    redirect("/teachers");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">עריכת מורה</h1>
        </div>
        <Link href="/teachers" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50">
          חזרה
        </Link>
      </div>

      <form
        action={updateTeacher}
        className="grid max-w-2xl gap-4 rounded-2xl border border-zinc-200 bg-white p-6 md:grid-cols-2"
      >
        <TeacherFormFields defaults={teacher} />
        <div className="flex justify-end md:col-span-2">
          <button type="submit" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
            שמירה
          </button>
        </div>
      </form>
    </div>
  );
}
