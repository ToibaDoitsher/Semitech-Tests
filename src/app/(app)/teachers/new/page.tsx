import Link from "next/link";
import { redirect } from "next/navigation";
import { hasAppSession } from "@/lib/auth/passwordSession";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default function NewTeacherPage() {
  async function createTeacher(formData: FormData) {
    "use server";
    if (!(await hasAppSession())) redirect("/login");
    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new Error("שם חובה");
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("teachers").insert({ name });
    if (error) throw new Error(error.message);
    redirect("/teachers");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">הוספת מורה</h1>
          <p className="mt-1 text-sm text-zinc-600">שם מלא כפי שמופיע במערכת</p>
        </div>
        <Link href="/teachers" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50">
          חזרה
        </Link>
      </div>

      <form action={createTeacher} className="max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
        <label className="block">
          <div className="text-sm font-medium">שם</div>
          <input
            name="name"
            required
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
          />
        </label>
        <div className="flex justify-end pt-2">
          <button type="submit" className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white">
            שמירה
          </button>
        </div>
      </form>
    </div>
  );
}
