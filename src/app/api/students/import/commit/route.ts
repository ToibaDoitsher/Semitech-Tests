import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  validateImportRows,
  type ParsedImportRow,
  type ValidatedImportRow,
} from "@/lib/students/excelImport";

export const dynamic = "force-dynamic";

type CommitBody = {
  rows?: ParsedImportRow[];
  updateExisting?: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json()) as CommitBody;
  const rowsIn = body.rows ?? [];
  const updateExisting = Boolean(body.updateExisting);

  if (!rowsIn.length) return NextResponse.json({ error: "אין שורות לייבוא" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const [gl, cl, sp, tr] = await Promise.all([
    supabase.from("grade_levels").select("id,name"),
    supabase.from("classes").select("id,name"),
    supabase.from("specializations").select("id,name"),
    supabase.from("tracks").select("id,name"),
  ]);

  for (const res of [gl, cl, sp, tr]) {
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 });
  }

  const gradeByName = new Map((gl.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const classByName = new Map((cl.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const specByName = new Map((sp.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const trackByName = new Map((tr.data ?? []).map((r) => [r.name.trim(), r.id] as const));
  const validated = validateImportRows(rowsIn, { gradeByName, classByName, specByName, trackByName });
  const bad = validated.filter((r) => r.errors.length > 0);
  if (bad.length) {
    return NextResponse.json(
      {
        error: "ייבוא בוטל: יש שורות לא תקינות. תקני את הקובץ ונסי שוב.",
        invalidSample: bad.slice(0, 5).map((b) => ({ rowNumber: b.rowNumber, errors: b.errors })),
      },
      { status: 400 },
    );
  }

  const { data: existingRows, error: exErr } = await supabase.from("students").select("id,tz");
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
  const tzToId = new Map((existingRows ?? []).map((r) => [r.tz.trim(), r.id] as const));

  const toInsert: {
    first_name: string;
    last_name: string;
    tz: string;
    grade_level_id: string;
    class_id: string;
    specialization_id: string | null;
    track_id: string | null;
  }[] = [];

  const toUpdate: { id: string; patch: (typeof toInsert)[number] }[] = [];

  for (const r of validated as ValidatedImportRow[]) {
    if (!r.resolved) continue;
    const patch = {
      first_name: r.first_name,
      last_name: r.last_name,
      tz: r.tz,
      grade_level_id: r.resolved.grade_level_id,
      class_id: r.resolved.class_id,
      specialization_id: r.resolved.specialization_id,
      track_id: r.resolved.track_id,
    };
    const id = tzToId.get(r.tz.trim());
    if (id) {
      if (updateExisting) toUpdate.push({ id, patch });
    } else {
      toInsert.push(patch);
    }
  }

  const chunk = 80;
  try {
    for (let i = 0; i < toInsert.length; i += chunk) {
      const slice = toInsert.slice(i, i + chunk);
      const { error } = await supabase.from("students").insert(slice);
      if (error) throw new Error(error.message);
    }
    for (const u of toUpdate) {
      const { error } = await supabase.from("students").update(u.patch).eq("id", u.id);
      if (error) throw new Error(error.message);
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    inserted: toInsert.length,
    updated: toUpdate.length,
    skipped: validated.length - toInsert.length - toUpdate.length,
  });
}
