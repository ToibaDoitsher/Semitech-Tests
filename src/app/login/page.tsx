import Image from "next/image";
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
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden md:flex-row md:items-stretch">
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-sky-100/80 via-[#e8f1fb] to-[var(--background)] dark:from-slate-900 dark:via-slate-900 dark:to-slate-950"
      />

      {/* לוגו גדול כרקע בעמודה — ב־RTL בצד ימין; במסכים רחבים הטופס בעמודה השנייה */}
      <div className="relative z-0 flex min-h-[min(52vh,22rem)] shrink-0 items-center justify-center overflow-hidden px-6 pt-12 pb-10 md:min-h-0 md:w-[42%] md:max-w-xl md:py-16 md:pe-4 md:ps-8">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <div className="relative aspect-square w-[min(118vw,28rem)] opacity-[0.13] sm:w-[min(100vw,30rem)] sm:opacity-[0.11] md:h-[min(82vh,40rem)] md:w-[min(118%,34rem)] md:opacity-[0.09] dark:opacity-[0.17] dark:md:opacity-[0.12]">
            <Image
              src="/logo.png"
              alt=""
              fill
              className="object-contain object-center"
              priority
              sizes="(max-width: 768px) 100vw, 544px"
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-6 pb-12 pt-2 md:w-[60%] md:py-16 md:pe-12 md:ps-4">
        <div className="w-full max-w-md rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-9 shadow-[0_24px_64px_-20px_rgb(15_23_42_/_0.18)] ring-1 ring-slate-900/[0.03] backdrop-blur-md dark:border-slate-600/60 dark:bg-slate-900/90 dark:ring-white/5">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-primary)] dark:text-blue-200">כניסה למערכת</h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">הכניסי סיסמה כללית כדי להמשיך.</p>

          <form action={login} className="mt-8 space-y-5">
            <label className="block">
              <div className="text-sm font-medium text-slate-800 dark:text-zinc-200">סיסמה</div>
              <input
                name="password"
                type="password"
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 outline-none ring-[var(--color-primary)]/0 transition-shadow focus:border-[var(--color-primary)] focus:bg-white focus:ring-4 focus:ring-[var(--color-primary)]/15 dark:border-zinc-600 dark:bg-zinc-800/50 dark:focus:bg-zinc-900"
                dir="ltr"
                autoFocus
              />
            </label>

            <LoginError searchParams={searchParams} />

            <button
              type="submit"
              className="w-full rounded-2xl bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[var(--color-primary-hover)] hover:shadow-lg active:scale-[0.99]"
            >
              כניסה
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

async function LoginError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (error !== "wrong_password") return null;
  return (
    <div className="rounded-2xl border border-red-200/90 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
      סיסמה שגויה
    </div>
  );
}
