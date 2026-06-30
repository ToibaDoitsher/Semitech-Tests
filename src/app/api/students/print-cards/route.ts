import { NextResponse } from "next/server";
import { resolveAcademicYearScope, scopeFromSearchParams } from "@/lib/academicYears/scope";
import { dbSchemaHint } from "@/lib/db/schemaHint";
import { estimateTotalCardPages } from "@/lib/export/studentCardPrint";
import { listFilteredStudentIds, studentListFiltersFromSearchParams } from "@/lib/students/listQuery";
import { loadStudentCardData } from "@/lib/students/loadStudentCardData";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const supabase = createSupabaseAdminClient();
    const scope = await resolveAcademicYearScope(supabase, scopeFromSearchParams(searchParams));
    const filters = studentListFiltersFromSearchParams(searchParams);

    const ids = await listFilteredStudentIds(supabase, scope, filters);
    if (!ids.length) {
      return NextResponse.json({
        cards: [],
        studentCount: 0,
        estimatedPages: 0,
      });
    }

    const cards = [];
    for (const id of ids) {
      const card = await loadStudentCardData(supabase, id);
      if (card) cards.push(card);
    }

    return NextResponse.json({
      cards,
      studentCount: cards.length,
      estimatedPages: estimateTotalCardPages(cards),
    });
  } catch (e) {
    return NextResponse.json({ error: dbSchemaHint((e as Error).message) }, { status: 500 });
  }
}
