import { Frank_Ruhl_Libre, Rubik } from "next/font/google";
import Image from "next/image";
import { LoginForm } from "@/components/LoginForm";
import { LoginTimeGreeting } from "@/components/LoginTimeGreeting";

const display = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  variable: "--font-login-display",
  display: "swap",
  weight: ["500", "700"],
});

const ui = Rubik({
  subsets: ["hebrew", "latin"],
  variable: "--font-login-ui",
  display: "swap",
});

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const p = await searchParams;
  const err = typeof p.error === "string" ? p.error : undefined;
  const reauth = p.reauth === "1" || p.reauth === "true";

  return (
    <div
      className={`${display.variable} ${ui.variable} login-shell relative min-h-screen overflow-hidden`}
      style={{ fontFamily: "var(--font-login-ui), var(--font-rubik), system-ui, sans-serif" }}
    >
      <div aria-hidden className="login-atmosphere" />
      <div aria-hidden className="login-grid" />
      <div aria-hidden className="login-orb login-orb-a" />
      <div aria-hidden className="login-orb login-orb-b" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-between px-6 py-8 sm:px-10 lg:px-14 lg:py-12">
        <header className="login-fade-in flex items-center gap-3">
          <span className="relative size-11 overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/25 backdrop-blur-sm sm:size-12">
            <Image src="/logo.png" alt="" fill className="object-contain p-1.5" sizes="48px" priority />
          </span>
          <p className="text-sm font-medium tracking-wide text-[#c8e6df]/סמיטק · ניהול מבחנים</p>
        </header>

        <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <section className="login-fade-in-delay max-w-xl text-right">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-[#8fbfb4]">
              כניסה מאובטחת
            </p>
            <h1
              className="text-balance text-4xl leading-[1.15] text-white sm:text-5xl lg:text-[3.35rem]"
              style={{ fontFamily: "var(--font-login-display), var(--font-login-ui), serif" }}
            >
              מערכת מבחנים
            </h1>
            <LoginTimeGreeting />
            <p className="mt-5 max-w-md text-base leading-relaxed text-[#b7d5ce] sm:text-lg">
              ניהול מבחנים, מעקב והשלמות — במקום אחד, לפי שנת לימודים ומחצית.
            </p>

            <div className="mt-10 hidden lg:block">
              <div className="relative h-28 w-full max-w-sm opacity-40">
                <Image
                  src="/smitech-logo.png"
                  alt=""
                  fill
                  className="object-contain object-right brightness-125 contrast-75"
                  unoptimized
                />
              </div>
            </div>
          </section>

          <section className="login-fade-in-delay-2 w-full justify-self-stretch lg:justify-self-end">
            <div className="login-panel mx-auto w-full max-w-md">
              <div className="mb-6 flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-[#0f2f2a]">התחברות</h2>
                <span className="relative h-8 w-20 lg:hidden">
                  <Image src="/smitech-logo.png" alt="סמיטק" fill className="object-contain" unoptimized />
                </span>
              </div>
              {reauth ? (
                <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  יש להתחבר מחדש כדי להמשיך.
                </p>
              ) : null}
              <LoginForm initialError={err} clearStaleSession={reauth} />
            </div>
          </section>
        </main>

        <footer className="login-fade-in text-xs text-[#7aa89e]">
          גישה מורשית למשתמשי המערכת בלבד
        </footer>
      </div>
    </div>
  );
}
