import { NextResponse } from "next/server";
import { getAppPassword } from "@/lib/env";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { USER_COOKIE } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function appPasswordBypassEnabled(): boolean {
  const flag = process.env.APP_PASSWORD_BYPASS;
  if (flag == null) return false;
  return /^(1|true|on|yes)$/i.test(String(flag).trim());
}

export const dynamic = "force-dynamic";

function sessionResponse(body: Record<string, unknown>, userId: string, status = 200) {
  const res = NextResponse.json(body, { status });
  res.cookies.set(USER_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    const username = (body.username ?? "").trim().toLowerCase();
    const password = (body.password ?? "").trim();

    if (!username || !password) {
      return NextResponse.json({ error: "שם משתמש וסיסמה חובה" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, password_hash, full_name, active")
      .eq("username", username)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (user) {
      if (!user.active) {
        return NextResponse.json({ error: "משתמש לא פעיל" }, { status: 403 });
      }
      const ok = await verifyPassword(password, user.password_hash as string);
      if (!ok) {
        const appPassword = getAppPassword();
        if (
          !appPasswordBypassEnabled() ||
          !appPassword ||
          password !== appPassword
        ) {
          return NextResponse.json({ error: "שם משתמש או סיסמה שגויים" }, { status: 401 });
        }
      }
      return sessionResponse(
        {
          user: {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
          },
        },
        user.id as string,
      );
    }

    const { count, error: countErr } = await supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null);
    if (countErr) {
      return NextResponse.json({ error: countErr.message }, { status: 500 });
    }

    if ((count ?? 0) === 0) {
      const password_hash = await hashPassword(password);
      const { data: created, error: cErr } = await supabase
        .from("users")
        .insert({
          username,
          password_hash,
          full_name: username,
          active: true,
        })
        .select("id, username, full_name")
        .single();
      if (cErr || !created) {
        return NextResponse.json({ error: cErr?.message ?? "שגיאה ביצירת משתמש" }, { status: 500 });
      }
      return sessionResponse({ user: created }, created.id as string);
    }

    return NextResponse.json({ error: "שם משתמש או סיסמה שגויים" }, { status: 401 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "שגיאת התחברות" },
      { status: 500 },
    );
  }
}
