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
      {/* פאנל ימני — לוגו המערכת למעלה, לוגו סמיטק כרקע עדין */}
      <aside
        className="relative hidden overflow-hidden border-s border-slate-200/80 bg-gradient-to-bl from-sky-50 via-white to-slate-50 lg:block"
      >
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
            className="h-auto max-h-[min(82vh,40rem)] w-full max-w-[min(95%,32rem)] object-contain opacity-[0.18] brightness-125 contrast-[0.92]"
            unoptimized
          />
        </div>
      </aside>

      {/* טופס התחברות — רקע נקי */}
      <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-50 to-white p-6 sm:p-10">
        <div className="w-full max-w-md rounded-2xl border border-slate-200/90 bg-white p-7 shadow-lg sm:p-8">
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
          <h1 className="mt-4 text-2xl font-bold text-[var(--color-primary)]">כניסה למערכת</h1>
          <LoginForm initialError={err} />
        </div>
      </main>
    </div>
  );
}
