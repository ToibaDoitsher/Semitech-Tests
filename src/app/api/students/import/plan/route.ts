import { NextResponse } from "next/server";
import { getActiveAcademicYear } from "@/lib/academicYears/years";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PlanBody = {
  valid_count?: number;
};

export async function POST(request: Request) {
  const body = (await request.json()) as PlanBody;
  const validCount = Number(body.valid_count ?? 0);

  const supabase = createSupabaseAdminClient();
  const year = await getActiveAcademicYear(supabase);
  if (!year) {
    return NextResponse.json({ error: "לא הוגדרה שנה פעילה" }, { status: 400 });
  }

  return NextResponse.json({
    plan: {
      academicYearName: year.year_name,
      willImportCount: validCount,
    },
  });
}
