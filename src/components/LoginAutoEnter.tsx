"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const FADE_MS = 700;
const WAIT_MS = 3000;

export function LoginAutoEnter({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"show" | "fade" | "done">("show");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let navTimer: ReturnType<typeof setTimeout> | undefined;

    const waitTimer = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch("/api/auth/auto-enter", { method: "POST" });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) {
            throw new Error((j as { error?: string }).error ?? "כניסה אוטומטית נכשלה");
          }
          if (cancelled) return;
          setPhase("fade");
          fadeTimer = setTimeout(() => {
            if (cancelled) return;
            setPhase("done");
            router.replace("/dashboard");
            router.refresh();
          }, FADE_MS);
        } catch (e) {
          if (!cancelled) setError((e as Error).message);
        }
      })();
    }, WAIT_MS);

    return () => {
      cancelled = true;
      clearTimeout(waitTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (navTimer) clearTimeout(navTimer);
    };
  }, [router]);

  return (
    <div
      className={[
        "min-h-screen transition-opacity duration-700 ease-out",
        phase === "fade" || phase === "done" ? "pointer-events-none opacity-0" : "opacity-100",
      ].join(" ")}
    >
      {children}
      {error ? (
        <div className="fixed inset-x-0 bottom-6 z-50 mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-800 shadow-lg">
          {error}
          <a href="/login?manual=1" className="mt-2 block font-medium underline">
            מעבר להתחברות ידנית
          </a>
        </div>
      ) : null}
    </div>
  );
}
