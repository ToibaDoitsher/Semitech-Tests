import { NextResponse } from "next/server";
import { listAllCohorts } from "@/lib/cohorts/active";
import { buildPairOptions, cohortDisplayNumber, cohortWithGradeLabel, gradeInPair } from "@/lib/cohorts/grades";
import { resolveSelectedCohortPair, setSelectedCohortPair } from "@/lib/cohorts/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function pairPayload(pair: NonNullable<Awaited<ReturnType<typeof resolveSelectedCohortPair>>>) {
  return {
    cohortA: {
      id: pair.cohortA.id,
      number: pair.cohortA.number,
      name: cohortDisplayNumber(pair.cohortA),
      grade_level: gradeInPair(pair.cohortA.id, pair),
      label: cohortWithGradeLabel(pair.cohortA),
    },
    cohortB: {
      id: pair.cohortB.id,
      number: pair.cohortB.number,
      name: cohortDisplayNumber(pair.cohortB),
      grade_level: gradeInPair(pair.cohortB.id, pair),
      label: cohortWithGradeLabel(pair.cohortB),
    },
    label: `${pair.cohortA.number} + ${pair.cohortB.number}`,
  };
}

export async function GET() {
  const supabase = createSupabaseAdminClient();
  const cohorts = await listAllCohorts(supabase);
  const { options, defaultPair } = buildPairOptions(cohorts);
  const selected = await resolveSelectedCohortPair(supabase);

  return NextResponse.json({
    pairs: options.map((p) => ({
      ...p,
      isActivePair: p.isDefaultPair,
    })),
    defaultPair,
    activePair: defaultPair,
    selected: selected ? pairPayload(selected) : null,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { cohort_a_id?: string; cohort_b_id?: string };
  const a = body.cohort_a_id?.trim();
  const b = body.cohort_b_id?.trim();
  if (!a || !b || a === b) {
    return NextResponse.json({ error: "חובה לבחור זוג מחזורים (שני מחזורים שונים)" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const pair = await setSelectedCohortPair(supabase, a, b);
  if (!pair) return NextResponse.json({ error: "זוג מחזורים לא תקין" }, { status: 400 });

  return NextResponse.json({ ok: true, selected: pairPayload(pair) });
}
