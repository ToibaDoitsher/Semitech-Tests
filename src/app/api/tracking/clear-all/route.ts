import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveScopeFromUrl,
} from "@/lib/academicYears/scope";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient();
  const scope = await resolveScopeFromUrl(supabase, new URL(request.url).searchParams);
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }
  const { data, error } = await supabase
    .from("exam_tracking")
    .delete()
    .eq("academic_year_id", scope.year.id)
    .eq("term", scope.term)
    .select("id");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ deleted: data?.length ?? 0 });
}
