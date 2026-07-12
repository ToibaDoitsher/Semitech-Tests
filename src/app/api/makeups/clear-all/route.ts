import { NextResponse } from "next/server";
import {
  readOnlyResponse,
  resolveScopeFromUrl,
} from "@/lib/academicYears/scope";
import { softDeleteMakeupsInYear } from "@/lib/scope/bulkDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = createSupabaseAdminClient();
  const scope = await resolveScopeFromUrl(supabase, new URL(request.url).searchParams);
  if (scope.readOnly) {
    return NextResponse.json(readOnlyResponse(), { status: 403 });
  }
  try {
    const deleted = await softDeleteMakeupsInYear(supabase, scope.year.id, scope.term);
    return NextResponse.json({ deleted });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
