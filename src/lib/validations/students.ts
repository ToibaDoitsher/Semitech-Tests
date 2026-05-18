import type { SupabaseClient } from "@supabase/supabase-js";
import { notDeleted } from "@/lib/db/softDelete";

export async function assertUniqueStudentTz(
  supabase: SupabaseClient,
  tz: string,
  excludeStudentId?: string,
): Promise<{ ok: boolean; error: string | null }> {
  let q = notDeleted(supabase.from("students").select("id")).eq("tz", tz.trim()).limit(1);
  if (excludeStudentId) q = q.neq("id", excludeStudentId);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  if (data?.length) return { ok: false, error: "תעודת זהות כבר קיימת במערכת" };
  return { ok: true, error: null };
}
