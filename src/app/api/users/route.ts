import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/currentUser";
import { writeAudit } from "@/lib/audit/log";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const USER_COLUMNS = "id, username, full_name, active, created_at";

function userErrorMessage(error: { code?: string; message?: string }): string {
  if (error.code === "23505") return "שם משתמש כבר קיים במערכת";
  if (error.message?.includes("deleted_at")) {
    return "חסרה עמודת deleted_at בטבלת users — הריצי PATCH_AUTH_USERS.sql ב-Supabase";
  }
  return error.message ?? "שגיאה בשמירת משתמש";
}

function badRequest(error: string, ctx: Record<string, unknown> = {}) {
  console.error("[POST /api/users] 400:", error, ctx);
  return NextResponse.json({ error }, { status: 400 });
}

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, username, full_name, active, created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: userErrorMessage(error) }, { status: 500 });
    return NextResponse.json({ users: data ?? [] });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "לא מחובר" : msg }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };

    const username = (body.username ?? "").trim().toLowerCase();
    const password = (body.password ?? "").trim();

    if (!username || !password) {
      return badRequest("שם משתמש וסיסמה חובה", { hasUsername: Boolean(username), hasPassword: Boolean(password) });
    }

    const supabase = createSupabaseAdminClient();
    const password_hash = await hashPassword(password);

    const { data: existing, error: findErr } = await supabase
      .from("users")
      .select("id, deleted_at")
      .eq("username", username)
      .maybeSingle();

    if (findErr) {
      return badRequest(userErrorMessage(findErr), { stage: "find", username });
    }

    let data;
    let error;

    if (existing) {
      if (!existing.deleted_at) {
        return badRequest("שם משתמש כבר קיים במערכת", { username });
      }
      ({ data, error } = await supabase
        .from("users")
        .update({
          password_hash,
          full_name: username,
          active: true,
          deleted_at: null,
        })
        .eq("id", existing.id)
        .select(USER_COLUMNS)
        .single());
    } else {
      ({ data, error } = await supabase
        .from("users")
        .insert({
          username,
          password_hash,
          full_name: username,
          active: true,
        })
        .select(USER_COLUMNS)
        .single());
    }

    if (error) return badRequest(userErrorMessage(error), { stage: existing ? "restore" : "insert", username });
    if (!data) return badRequest("שגיאה בשמירת משתמש", { username });

    await writeAudit(supabase, {
      userId: admin.id,
      entityType: "user",
      entityId: data.id as string,
      actionType: existing ? "restore" : "create",
      newValue: { username },
    });

    return NextResponse.json({ user: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: status === 401 ? "לא מחובר" : msg }, { status });
  }
}
