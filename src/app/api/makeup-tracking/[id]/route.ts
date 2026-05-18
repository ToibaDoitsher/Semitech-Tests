import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    grade?: number | string | null;
    notes?: string | null;
    sent_to_teacher_at?: string | null;
    grade_received_at?: string | null;
  };

  const supabase = createSupabaseAdminClient();

  const { data: existing, error: loadErr } = await supabase
    .from("makeup_tracking")
    .select("id, makeup_exam_id, grade")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "רשומה לא נמצאה" }, { status: 404 });

  const patch: Record<string, unknown> = {};

  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;

  if (body.sent_to_teacher_at !== undefined) {
    patch.sent_to_teacher_at = body.sent_to_teacher_at;
  }

  if (body.grade !== undefined) {
    const raw = body.grade;
    if (raw === null || raw === "") {
      patch.grade = null;
      patch.grade_received_at = null;
    } else {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: "ציון לא תקין" }, { status: 400 });
      }
      patch.grade = n;
      patch.grade_received_at =
        body.grade_received_at ?? new Date().toISOString();
    }
  } else if (body.grade_received_at !== undefined) {
    patch.grade_received_at = body.grade_received_at;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "אין שדות לעדכון" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("makeup_tracking")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (existing.makeup_exam_id && patch.grade !== undefined) {
    await supabase
      .from("makeup_exams")
      .update({ grade: patch.grade as number | null })
      .eq("id", existing.makeup_exam_id);
  }

  if (existing.makeup_exam_id && patch.notes !== undefined) {
    await supabase
      .from("makeup_exams")
      .update({ notes: patch.notes as string | null })
      .eq("id", existing.makeup_exam_id);
  }

  return NextResponse.json({ tracking: data });
}
