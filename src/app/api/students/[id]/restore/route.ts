import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveAcademicYearScope,
  scopeFromSearchParams,
} from "@/lib/academicYears/scope";
import { writeAudit } from "@/lib/audit/log";
import { getCurrentUser } from "@/lib/auth/currentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = createSupabaseAdminClient();
  const scope = await resolveAcademicYearScope(
    supabase,
    scopeFromSearchParams(new URL(request.url).searchParams),
  );
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }
  const user = await getCurrentUser(supabase);

  const { data: before } = await supabase.from("students").select("*").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "תלמידה לא נמצאה" }, { status: 404 });
  if (before.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "תלמידה לא שייכת לשנה הנוכחית" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("students")
    .update({ deleted_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const name = data ? `${data.last_name} ${data.first_name}` : null;
  await writeAudit(supabase, {
    userId: user?.id ?? null,
    entityType: "student",
    entityId: id,
    actionType: "restore",
    entityNameSnapshot: name,
    oldValue: before,
    newValue: data,
  });

  return NextResponse.json({ student: data });
}
