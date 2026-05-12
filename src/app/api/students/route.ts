import { NextResponse } from "next/server";
import { STUDENT_WITH_LOOKUPS } from "@/lib/db/studentSelect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  const gradeLevelId = (searchParams.get("grade_level_id") ?? "").trim();
  const classId = (searchParams.get("class_id") ?? "").trim();
  const specializationId = (searchParams.get("specialization_id") ?? "").trim();
  const trackId = (searchParams.get("track_id") ?? "").trim();

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("students")
    .select(STUDENT_WITH_LOOKUPS)
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true })
    .limit(300);

  if (gradeLevelId) query = query.eq("grade_level_id", gradeLevelId);
  if (classId) query = query.eq("class_id", classId);
  if (specializationId) query = query.eq("specialization_id", specializationId);
  if (trackId) query = query.eq("track_id", trackId);

  if (q) {
    const escapeIlike = (s: string) => s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const parts = q.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      const p0 = escapeIlike(parts[0]);
      const pRest = escapeIlike(parts.slice(1).join(" "));
      const pLast = escapeIlike(parts[parts.length - 1]);
      const pHead = escapeIlike(parts.slice(0, -1).join(" "));
      query = query.or(
        `and(first_name.ilike.%${p0}%,last_name.ilike.%${pRest}%),and(first_name.ilike.%${pHead}%,last_name.ilike.%${pLast}%)`,
      );
    } else {
      const escaped = escapeIlike(parts[0] ?? q);
      query = query.or(
        `first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%,tz.ilike.%${escaped}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ students: data ?? [] });
}
