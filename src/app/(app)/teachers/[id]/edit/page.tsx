import Link from "next/link";
import { redirect } from "next/navigation";
import { hasAppSession } from "@/lib/auth/passwordSession";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function EditTeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createSupabaseAdminClient();
  const { data: teacher, error } = await supabase.from("teachers").select("*").eq("id", id).single();
  if (error || !teacher) redirect("/teachers");

  async function updateTeacher(formData: FormData) {
    "use server";
    if (!(await hasAppSession())) redirect("/login");
    const name = String(formData.get("name") ?? "").trim();
    if (!name) throw new Error("שם חובה");
    const sb = createSupabaseAdminClient();
    const { error: uErr } = await sb.from("teachers").update({ name }).eq("id", id);
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

      <form action={updateTeacher} className="max-w-md space-y-4 rounded-2xl border border-zinc-200 bg-white p-6">
        <label className="block">
          <div className="text-sm font-medium">שם</div>
          <input
            name="name"
            required
            defaultValue={teacher.name}
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
