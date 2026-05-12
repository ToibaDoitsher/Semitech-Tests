import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** מוחק את כל המבחנים — CASCADE מסיר exam_students, makeup_exams, exam_tracking */
export async function POST() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("exams").delete().not("id", "is", null).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: data?.length ?? 0 });
}
