import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: examId } = await ctx.params;
  const supabase = createSupabaseAdminClient();

  const { data: exam, error: eErr } = await supabase.from("exams").select("id").eq("id", examId).maybeSingle();
  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });
  if (!exam) return NextResponse.json({ error: "מבחן לא נמצא" }, { status: 404 });

  const { error: mErr } = await supabase.from("makeup_exams").delete().eq("exam_id", examId);
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 });

  const { data, error } = await supabase.from("exam_students").delete().eq("exam_id", examId).select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ deleted: data?.length ?? 0 });
}
