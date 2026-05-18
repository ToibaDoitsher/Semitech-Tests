import { NextResponse } from "next/server";
import { ENTITY_TO_TABLE, isLookupEntity } from "@/lib/lookups/entities";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const LOOKUPS_WITH_IS_ACTIVE = new Set(["classes", "specializations", "tracks"]);

export async function GET(_request: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "סוג לוקאפ לא תקין" }, { status: 404 });
  }

  const table = ENTITY_TO_TABLE[entity];
  const supabase = createSupabaseAdminClient();
  let q = supabase.from(table).select("id,name").order("name", { ascending: true });
  if (LOOKUPS_WITH_IS_ACTIVE.has(table)) {
    q = q.eq("is_active", true);
  }
  const { data, error } = await q;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request, ctx: { params: Promise<{ entity: string }> }) {
  const { entity } = await ctx.params;
  if (!isLookupEntity(entity)) {
    return NextResponse.json({ error: "סוג לוקאפ לא תקין" }, { status: 404 });
  }

  const body = (await request.json()) as { name?: string };
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "שם חובה" }, { status: 400 });

  const table = ENTITY_TO_TABLE[entity];
  const supabase = createSupabaseAdminClient();
  const row: Record<string, unknown> = { name };
  if (LOOKUPS_WITH_IS_ACTIVE.has(table)) row.is_active = true;
  const { data, error } = await supabase.from(table).insert(row).select("id,name").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}
