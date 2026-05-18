import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExamTargetType } from "@/lib/types/db";

export async function resolveExamTargetLabels(
  supabase: SupabaseClient,
  rows: { id: string; target_type: ExamTargetType; target_id: string }[],
): Promise<Record<string, string>> {
  const byClass = new Set<string>();
  const bySpec = new Set<string>();
  const byTrack = new Set<string>();

  for (const r of rows) {
    if (r.target_type === "class") byClass.add(r.target_id);
    else if (r.target_type === "specialization") bySpec.add(r.target_id);
    else if (r.target_type === "track") byTrack.add(r.target_id);
  }

  const out: Record<string, string> = {};

  if (byClass.size) {
    const { data } = await supabase.from("classes").select("id,name").in("id", [...byClass]);
    for (const x of data ?? []) out[`class:${(x as { id: string }).id}`] = (x as { name: string }).name;
  }
  if (bySpec.size) {
    const { data } = await supabase.from("specializations").select("id,name").in("id", [...bySpec]);
    for (const x of data ?? []) {
      out[`specialization:${(x as { id: string }).id}`] = (x as { name: string }).name;
    }
  }
  if (byTrack.size) {
    const { data } = await supabase.from("tracks").select("id,name").in("id", [...byTrack]);
    for (const x of data ?? []) out[`track:${(x as { id: string }).id}`] = (x as { name: string }).name;
  }

  const labels: Record<string, string> = {};
  for (const r of rows) {
    if (r.target_type === "psychology") {
      labels[r.id] = "פסיכולוגיה";
      continue;
    }
    const key = `${r.target_type}:${r.target_id}`;
    labels[r.id] = out[key] ?? r.target_id;
  }
  return labels;
}
