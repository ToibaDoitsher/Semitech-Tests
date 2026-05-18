import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** @deprecated Use GET /api/cohorts/pair */
export async function GET() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const url = base ? `${base}/api/cohorts/pair` : "/api/cohorts/pair";
  const r = await fetch(url, { cache: "no-store" }).catch(() => null);
  if (!r?.ok) return NextResponse.json({ cohortA: null, cohortB: null });
  const j = await r.json();
  return NextResponse.json(j);
}
