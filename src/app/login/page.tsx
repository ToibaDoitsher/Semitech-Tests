import Image from "next/image";
import { LoginAutoEnter } from "@/components/LoginAutoEnter";
import { LoginForm } from "@/components/LoginForm";
import { LoginTimeGreeting } from "@/components/LoginTimeGreeting";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const manual = p.manual === "1" || p.manual === "true";
  const err = typeof p.error === "string" ? p.error : undefined;

  const panel = (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden border-s border-emerald-100/80 bg-gradient-to-bl from-emerald-50/90 via-sky-50 to-white lg:block">
        <div className="relative z-10 flex justify-center px-8 pt-10 pb-6">
          <Image
            src="/logo.png"
            alt="לוגו המערכת"
            width={220}
            height={220}
            className="h-auto max-h-28 w-auto object-contain opacity-90 contrast-110 saturate-110"
            priority
          />
        </div>

        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 pt-24"
        >
          <Image
            src="/smitech-logo.png"
            alt=""
            width={900}
            height={600}
              className="h-auto max-h-96 w-full max-w-md object-contain opacity-20 brightness-125 contrast-75"
            unoptimized
          />
        </div>
      </aside>

      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-emerald-50/70 via-sky-50 to-white p-6 sm:p-10">
        <div className="w-full max-w-md rounded-2xl border border-emerald-100/90 bg-white/95 p-7 shadow-lg sm:p-8">
          <div className="mb-5 flex justify-center lg:hidden">
            <Image
              src="/smitech-logo.png"
              alt="סמיטק"
              width={320}
              height={160}
              className="h-auto w-full max-w-[14rem] object-contain opacity-90"
              unoptimized
            />
          </div>
          <LoginTimeGreeting />
          <h1 className="mt-4 text-2xl font-bold text-emerald-800">
            {manual ? "כניסה למערכת" : "מערכת מבחנים"}
          </h1>
          {manual ? (
            <LoginForm initialError={err} />
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-600">נכנסת אוטומטית…</p>
              <div className="mt-8 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                <div className="login-auto-progress h-full rounded-full bg-emerald-600" />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );

  if (manual) return panel;
  return <LoginAutoEnter>{panel}</LoginAutoEnter>;
}
