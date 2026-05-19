import Image from "next/image";
import { LoginTimeGreeting } from "@/components/LoginTimeGreeting";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const err = typeof p.error === "string" ? p.error : undefined;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* פאנל סמל הסמינר — בצד (ימין ב-RTL) */}
      <aside
        aria-hidden
        className="relative hidden overflow-hidden border-s border-slate-200/80 bg-gradient-to-bl from-sky-100/90 via-white to-slate-50 lg:block"
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
          <Image
            src="/logo.png"
            alt=""
            width={640}
            height={640}
            className="h-auto max-h-[min(88vh,42rem)] w-full max-w-[min(92%,28rem)] object-contain opacity-[0.11] contrast-[1.15] brightness-110"
            priority
          />
        </div>
        <div className="relative z-10 flex h-full flex-col items-center justify-center gap-6 p-10">
          <div className="rounded-3xl border border-slate-200/90 bg-white/85 p-5 shadow-lg shadow-sky-900/5 ring-1 ring-white/80 backdrop-blur-sm">
            <Image
              src="/logo.png"
              alt="סמינר בית יעקב למורות בית שמש"
              width={220}
              height={220}
              className="mx-auto h-auto w-[min(100%,13.5rem)] object-contain"
              priority
            />
          </div>
          <p className="max-w-xs text-center text-sm font-medium leading-relaxed text-slate-600">
            סמינר &apos;בית יעקב&apos; למורות בית שמש
          </p>
        </div>
      </aside>

      {/* טופס התחברות */}
      <main className="relative flex items-center justify-center bg-gradient-to-b from-sky-50 to-white p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06] lg:hidden">
          <Image
            src="/logo.png"
            alt=""
            width={400}
            height={400}
            className="h-auto max-h-[70vh] w-[85%] object-contain"
          />
        </div>

        <div className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white/95 p-7 shadow-lg backdrop-blur-sm sm:p-8">
          <div className="mb-5 flex justify-center lg:hidden">
            <span className="relative size-20 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-md ring-2 ring-white/80">
              <Image src="/logo.png" alt="לוגו הסמינר" fill className="object-contain p-2" sizes="80px" priority />
            </span>
          </div>
          <LoginTimeGreeting />
          <h1 className="mt-4 text-2xl font-bold text-[var(--color-primary)]">כניסה למערכת</h1>
          <LoginForm initialError={err} />
        </div>
      </main>
    </div>
  );
}
