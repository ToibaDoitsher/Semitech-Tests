import { NextResponse } from "next/server";
import {
  createAcademicYear,
  listAcademicYears,
  setActiveAcademicYear,
} from "@/lib/academicYears/years";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const years = await listAcademicYears(supabase);
    return NextResponse.json({ years });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, years: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { year_name?: string; set_active?: boolean };
    const year_name = String(body.year_name ?? "").trim();
    const set_active = Boolean(body.set_active);
    if (!year_name) {
      return NextResponse.json({ error: "שם שנה חובה (למשל 2027)" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const year = await createAcademicYear(supabase, year_name, set_active);
    return NextResponse.json({ year });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { active_year_id?: string };
    const id = body.active_year_id?.trim();
    if (!id) return NextResponse.json({ error: "active_year_id חובה" }, { status: 400 });

    const supabase = createSupabaseAdminClient();
    const year = await setActiveAcademicYear(supabase, id);
    return NextResponse.json({ year });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
