import Link from "next/link";
import { redirect } from "next/navigation";
import { TeacherFormFields } from "@/components/teachers/TeacherFormFields";
import { hasAppSession } from "@/lib/auth/passwordSession";
import { parseTeacherBody } from "@/lib/teachers/validation";
import { getActiveAcademicYear } from "@/lib/academicYears/years";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default function NewTeacherPage() {
  async function createTeacher(formData: FormData) {
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

    const supabase = createSupabaseAdminClient();
    const year = await getActiveAcademicYear(supabase);
    if (!year) throw new Error("לא הוגדרה שנה פעילה — צרי שנה בהגדרות");

    const { error } = await supabase.from("teachers").insert({
      academic_year_id: year.id,
      first_name: parsed.first_name,
      last_name: parsed.last_name,
      tz: parsed.tz,
      email: parsed.email,
      notes: parsed.notes,
    });
    if (error) throw new Error(error.message);
    redirect("/teachers?flash=teacher_added");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">הוספת מורה</h1>
          <p className="mt-1 text-sm text-zinc-600">
            המורה נשמרת לשנת הלימודים הפעילה — כל שנה היא מערכת נפרדת
          </p>
        </div>
        <Link
          href="/teachers"
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
        >
          חזרה
        </Link>
      </div>
      <form
        action={createTeacher}
        className="grid max-w-2xl gap-4 rounded-2xl border border-zinc-200 bg-white p-6 md:grid-cols-2"
      >
        <TeacherFormFields />
        <div className="flex justify-end md:col-span-2">
          <button type="submit" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
            שמירה
          </button>
        </div>
      </form>
    </div>
  );
}
