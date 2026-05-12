import { redirect } from "next/navigation";
import { requireServiceRoleEnv } from "@/lib/env";
import { clearAppSession, setAppSession } from "@/lib/auth/passwordSession";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  async function login(formData: FormData) {
    "use server";
    const { APP_PASSWORD } = requireServiceRoleEnv();
    const password = String(formData.get("password") ?? "").trim();

    if (password !== APP_PASSWORD) {
      await clearAppSession();
      redirect("/login?error=wrong_password");
    }

    await setAppSession();
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-[var(--background)] p-6">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[var(--shadow-card)]">
        <h1 className="text-xl font-bold text-slate-900">כניסה למערכת</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">הכניסי סיסמה כללית כדי להמשיך.</p>

        <form action={login} className="mt-6 space-y-4">
          <label className="block">
            <div className="text-sm font-medium text-slate-700">סיסמה</div>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 outline-none transition-shadow focus:border-[var(--color-primary)] focus:ring-2 focus:ring-blue-500/25"
              dir="ltr"
              autoFocus
            />
          </label>

          <LoginError searchParams={searchParams} />

          <button
            type="submit"
            className="w-full rounded-xl bg-[var(--color-primary)] px-4 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-[var(--color-primary-hover)]"
          >
            כניסה
          </button>
        </form>
      </div>
    </div>
  );
}

async function LoginError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (error !== "wrong_password") return null;
  return (
    <div className="rounded-xl border border-red-200/80 bg-red-50 px-3 py-2 text-sm text-red-800">
      סיסמה שגויה
    </div>
  );
}
