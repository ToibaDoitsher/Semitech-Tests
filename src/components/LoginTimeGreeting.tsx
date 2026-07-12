"use client";

import { useEffect, useState } from "react";

function greetingForHour(h: number): { line: string; emoji: string } {
  if (h >= 5 && h < 12) return { line: "בוקר טוב", emoji: "🌅" };
  if (h >= 12 && h < 18) return { line: "צהריים טובים", emoji: "😊" };
  return { line: "ערב טוב", emoji: "🌙" };
}

export function LoginTimeGreeting() {
  const [greeting, setGreeting] = useState<{ line: string; emoji: string } | null>(null);

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  const { line, emoji } = greeting ?? { line: "צהריים טובים", emoji: "😊" };

  return (
    <p
      aria-hidden={!greeting}
      aria-live="polite"
      className={[
        "text-balance text-center text-3xl font-extrabold leading-tight tracking-tight text-slate-800 md:text-4xl dark:text-zinc-50",
        greeting ? "" : "invisible",
      ].join(" ")}
    >
      <span className="inline-flex flex-wrap items-center justify-center gap-2 md:justify-start">
        <span>{line}</span>
        <span className="select-none text-[1.15em] leading-none" aria-hidden>
          {emoji}
        </span>
      </span>
    </p>
  );
}
