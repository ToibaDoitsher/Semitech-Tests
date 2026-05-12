import Link from "next/link";
import { redirect } from "next/navigation";
import { hasAppSession } from "@/lib/auth/passwordSession";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  const supabase = createSupabaseAdminClient();
  const [gl, cl, sp, tr] = await Promise.all([
    supabase.from("grade_levels").select("id,name").order("name", { ascending: true }),
    supabase.from("classes").select("id,name").order("name", { ascending: true }),
    supabase.from("specializations").select("id,name").order("name", { ascending: true }),
    supabase.from("tracks").select("id,name").order("name", { ascending: true }),
  ]);

  if (gl.error) throw new Error(gl.error.message);
  if (cl.error) throw new Error(cl.error.message);
  if (sp.error) throw new Error(sp.error.message);
  if (tr.error) throw new Error(tr.error.message);

  async function createStudent(formData: FormData) {
    "use server";
    if (!(await hasAppSession())) redirect("/login");
    const sb = createSupabaseAdminClient();

    const first_name = String(formData.get("first_name") ?? "").trim();
    const last_name = String(formData.get("last_name") ?? "").trim();
    const tz = String(formData.get("tz") ?? "").trim();
    const grade_level_id = String(formData.get("grade_level_id") ?? "").trim();
    const class_id = String(formData.get("class_id") ?? "").trim();
    const specialization_id = String(formData.get("specialization_id") ?? "").trim() || null;
    const track_id = String(formData.get("track_id") ?? "").trim() || null;

    if (!grade_level_id || !class_id) {
      throw new Error("שכבה וכיתה חובה");
    }

    const { error } = await sb.from("students").insert({
      first_name,
      last_name,
      tz,
      grade_level_id,
      class_id,
      specialization_id,
      track_id,
    });
    if (error) throw new Error(error.message);

    redirect("/students");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">הוספת תלמידה</h1>
          <p className="mt-1 text-sm text-zinc-600">בחירה מתוך רשימות בלבד — ניתן לערוך רשימות ב&quot;הגדרות&quot;</p>
        </div>
        <Link
          href="/students"
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-zinc-50"
        >
          חזרה
        </Link>
      </div>

      <form
        action={createStudent}
        className="grid gap-4 rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-md md:grid-cols-2"
      >
        <Field name="first_name" label="שם פרטי" required />
        <Field name="last_name" label="שם משפחה" required />
        <Field name="tz" label="ת״ז" required dir="ltr" />

        <SelectLookup
          name="grade_level_id"
          label="שכבה"
          required
          options={gl.data ?? []}
        />
        <SelectLookup name="class_id" label="כיתה" required options={cl.data ?? []} />
        <SelectLookup
          name="specialization_id"
          label="התמחות"
          options={sp.data ?? []}
          allowEmpty
          defaultValue=""
        />
        <SelectLookup name="track_id" label="מסלול" options={tr.data ?? []} allowEmpty defaultValue="" />

        <div className="md:col-span-2 flex justify-end pt-2">
          <button
            type="submit"
            className="rounded-xl bg-gradient-to-l from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-md hover:opacity-95"
          >
            שמירה
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  name,
  label,
  required,
  dir,
}: {
  name: string;
  label: string;
  required?: boolean;
  dir?: "rtl" | "ltr";
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-zinc-700">{label}</div>
      <input
        name={name}
        required={required}
        dir={dir}
        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner outline-none focus:border-violet-400"
      />
    </label>
  );
}

function SelectLookup({
  name,
  label,
  required,
  options,
  allowEmpty,
  defaultValue,
}: {
  name: string;
  label: string;
  required?: boolean;
  options: { id: string; name: string }[];
  allowEmpty?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-zinc-700">{label}</div>
      <select
        name={name}
        required={required}
        defaultValue={defaultValue ?? (allowEmpty ? "" : undefined)}
        className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-inner outline-none focus:border-violet-400"
      >
        {allowEmpty ? <option value="">— ללא —</option> : <option value="">— בחרי —</option>}
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
