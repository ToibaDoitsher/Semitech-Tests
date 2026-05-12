import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** מוחק את כל המורות — חייב למחוק מבחנים קודם (RESTRICT על teacher ב־exams) */
export async function POST() {
  const supabase = createSupabaseAdminClient();

  const { error: e1 } = await supabase.from("exams").delete().not("id", "is", null);
  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });

  const { data, error } = await supabase.from("teachers").delete().not("id", "is", null).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ deleted: data?.length ?? 0 });
}
