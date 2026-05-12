import { NextResponse } from "next/server";
import { clearAppSession } from "@/lib/auth/passwordSession";

export const dynamic = "force-dynamic";

export async function POST() {
  await clearAppSession();
  return NextResponse.json({ ok: true });
}
