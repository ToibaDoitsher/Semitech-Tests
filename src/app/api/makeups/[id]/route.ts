import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    grade?: number | string | null;
    notes?: string | null;
    completed_at?: string | null;
  };

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: loadErr } = await supabase
    .from("makeup_exams")
    .select("id, student_id, exam_id, status")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "רשומת השלמה לא נמצאה" }, { status: 404 });

  const patch: Record<string, unknown> = {};

  if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;

  if (body.completed_at !== undefined) {
    if (!body.completed_at) {
      patch.completed_at = null;
    } else {
      const d = new Date(body.completed_at);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "תאריך השלמה לא תקין" }, { status: 400 });
      }
      patch.completed_at = d.toISOString();
    }
  }

  if (body.grade !== undefined) {
    const raw = body.grade;
    if (raw === null || raw === "") {
      patch.grade = null;
    } else {
      const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
      if (!Number.isFinite(n)) {
        return NextResponse.json({ error: "ציון לא תקין" }, { status: 400 });
      }
      patch.grade = n;
    }
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "אין שדות לעדכון" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("makeup_exams")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  if (patch.grade !== undefined) {
    await supabase
      .from("makeup_tracking")
      .update({
        grade: patch.grade as number | null,
        grade_received_at: patch.grade != null ? new Date().toISOString() : null,
      })
      .eq("makeup_exam_id", id);
  }

  if (patch.notes !== undefined) {
    await supabase
      .from("makeup_tracking")
      .update({ notes: patch.notes as string | null })
      .eq("makeup_exam_id", id);
  }

  return NextResponse.json({ makeup: data });
}
