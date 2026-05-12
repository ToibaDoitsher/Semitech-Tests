import { NextResponse } from "next/server";
import { requireSupabasePublicEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { SUPABASE_URL } = requireSupabasePublicEnv();
    let host = "";
    try {
      host = new URL(SUPABASE_URL).hostname;
    } catch {
      host = "(כתובת לא תקינה)";
    }

    const sr = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
    const serviceHint =
      sr.startsWith("ssb_secret_")
        ? "נראה טעות הקלדה: המפתח מתחיל ב־ssb_secret — צריך sb_secret או JWT eyJ..."
        : sr.startsWith("sb_secret_") || sr.startsWith("eyJ")
          ? "פורמט מפתח נראה תקין"
          : "פורמט מפתח לא מוכר — בדקי ב־Supabase → Settings → API";

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("students").select("id").limit(1);
    if (error) {
      return NextResponse.json(
        {
          ok: false,
          supabase_host: host,
          service_key_hint: serviceHint,
          stage: "query_students",
          error: error.message,
          details: (error as { details?: string }).details,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      supabase_host: host,
      service_key_hint: serviceHint,
      students_sample: data ?? [],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, stage: "exception", error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

