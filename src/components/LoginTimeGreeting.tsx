"use client";

import { useEffect, useState } from "react";

function greetingForHour(h: number): string {
  if (h >= 5 && h < 12) return "בוקר טוב";
  if (h >= 12 && h < 17) return "צהריים טובים";
  if (h >= 17 && h < 21) return "ערב טוב";
  return "לילה טוב";
}

export function LoginTimeGreeting() {
  const [line, setLine] = useState<string | null>(null);

  useEffect(() => {
    setLine(greetingForHour(new Date().getHours()));
  }, []);

  return (
    <p
      aria-live="polite"
      className={[
        "mt-4 text-xl font-medium tracking-tight text-[#d7efe8] sm:text-2xl",
        line ? "opacity-100" : "opacity-0",
        "transition-opacity duration-500",
      ].join(" ")}
    >
      {line ?? "צהריים טובים"}
    </p>
  );
}
