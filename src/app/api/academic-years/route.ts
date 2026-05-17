import { NextResponse } from "next/server";
import { requireCurrentUser } from "@/lib/auth/currentUser";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireCurrentUser();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("academic_years")
      .select("id, name, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ years: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, years: [] }, { status: 500 });
  }
}

export async function POST() {
  await requireCurrentUser();
  return NextResponse.json(
    { error: "ליצירת שנה חדשה השתמשי במסך «פתיחת שנת לימודים»" },
    { status: 400 },
  );
}
