import { NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** כניסה אוטומטית למשתמש הפעיל הראשון (או admin) — ללא טופס */
export async function POST() {
  try {
    const supabase = createSupabaseAdminClient();

    let { data: user, error } = await supabase
      .from("users")
      .select("id, username, full_name, active")
      .eq("username", "admin")
      .eq("active", true)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!user) {
      const fallback = await supabase
        .from("users")
        .select("id, username, full_name, active")
        .eq("active", true)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 });
      }
      user = fallback.data;
    }

    if (!user) {
      return NextResponse.json(
        { error: "אין משתמש פעיל במערכת — צרי משתמש admin במסד" },
        { status: 404 },
      );
    }

    const res = NextResponse.json({
      user: { id: user.id, username: user.username, full_name: user.full_name },
    });
    res.cookies.set(USER_COOKIE, user.id as string, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "שגיאת כניסה" },
      { status: 500 },
    );
  }
}
