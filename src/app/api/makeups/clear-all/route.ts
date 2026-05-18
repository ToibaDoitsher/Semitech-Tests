import { NextResponse } from "next/server";
import { softDeleteMakeupsInCohorts } from "@/lib/scope/bulkDelete";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = createSupabaseAdminClient();
  try {
    const deleted = await softDeleteMakeupsInCohorts(supabase);
    return NextResponse.json({ deleted });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
