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

  const { data: before } = await supabase.from("exams").select("*").eq("id", id).maybeSingle();
  if (!before) return NextResponse.json({ error: "מבחן לא נמצא" }, { status: 404 });
  if (before.academic_year_id !== scope.year.id) {
    return NextResponse.json({ error: "מבחן לא שייך לשנה הנוכחית" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("exams")
    .update({ deleted_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await writeAudit(supabase, {
    userId: user?.id ?? null,
    entityType: "exam",
    entityId: id,
    actionType: "restore",
    entityNameSnapshot: data?.subject ?? before.subject,
    oldValue: before,
    newValue: data,
  });

  return NextResponse.json({ exam: data });
}
