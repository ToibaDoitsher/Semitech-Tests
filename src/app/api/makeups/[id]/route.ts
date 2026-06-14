import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function parseStartingGrade(raw: number | string | null | undefined): number | null | "invalid" {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 100) return "invalid";
  return n;
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    grade?: number | string | null;
    notes?: string | null;
    completed_at?: string | null;
    auto_registered?: boolean;
    starting_grade?: number | string | null;
    is_paid?: boolean;
    clear_registration?: boolean;
  };

  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }

  const { data: existing, error: loadErr } = await supabase
    .from("makeup_exams")
    .select("id, student_id, exam_id, status, academic_year_id, auto_registered")
    .eq("id", id)
    .maybeSingle();

  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "רשומת השלמה לא נמצאה" }, { status: 404 });
  if (existing.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "רשומה לא שייכת לשנה הנוכחית" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};

  if (body.clear_registration || body.auto_registered === false) {
    patch.auto_registered = false;
    patch.completed_at = null;
    patch.starting_grade = null;
    patch.is_paid = false;
  } else {
    if (body.notes !== undefined) patch.notes = body.notes?.trim() || null;

    if (body.auto_registered === true) {
      if (!body.completed_at?.trim()) {
        return NextResponse.json({ error: "תאריך השלמה חובה לרישום" }, { status: 400 });
      }
      const d = new Date(body.completed_at);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "תאריך השלמה לא תקין" }, { status: 400 });
      }
      patch.auto_registered = true;
      patch.completed_at = d.toISOString();
      if (body.starting_grade !== undefined) {
        const sg = parseStartingGrade(body.starting_grade);
        if (sg === "invalid") {
          return NextResponse.json(
            { error: "ציון התחלה חייב להיות מספר בין 0 ל-100" },
            { status: 400 },
          );
        }
        patch.starting_grade = sg;
      }
      if (body.is_paid !== undefined) patch.is_paid = Boolean(body.is_paid);
    } else if (body.auto_registered !== undefined) {
      patch.auto_registered = Boolean(body.auto_registered);
    }

    if (body.completed_at !== undefined && body.auto_registered !== true && !body.clear_registration) {
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

    if (body.starting_grade !== undefined && body.auto_registered !== true) {
      const sg = parseStartingGrade(body.starting_grade);
      if (sg === "invalid") {
        return NextResponse.json(
          { error: "ציון התחלה חייב להיות מספר בין 0 ל-100" },
          { status: 400 },
        );
      }
      patch.starting_grade = sg;
    }

    if (body.is_paid !== undefined && body.auto_registered !== true) {
      patch.is_paid = Boolean(body.is_paid);
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
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "אין שדות לעדכון" }, { status: 400 });
  }

  let { data, error } = await supabase
    .from("makeup_exams")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error && /auto_registered|starting_grade|is_paid/i.test(error.message)) {
    const fallback = { ...patch };
    delete fallback.auto_registered;
    delete fallback.starting_grade;
    delete fallback.is_paid;
    if (!Object.keys(fallback).length) {
      return NextResponse.json(
        {
          error:
            "עמודות רישום להשלמה עוד לא קיימות במסד. הריצי את supabase/PATCH_MAKEUP_AUTO_REGISTERED.sql ו-PATCH_MAKEUP_REGISTRATION_FIELDS.sql.",
        },
        { status: 400 },
      );
    }
    const retry = await supabase
      .from("makeup_exams")
      .update(fallback)
      .eq("id", id)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

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
