"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSound } from "@/components/providers/SoundProvider";

export function SoundToggle() {
  const { muted, toggle } = useSound();

  return (
    <button
      type="button"
      onClick={toggle}
      data-no-sound
      aria-label={muted ? "הפעלת צלילים" : "השתקת צלילים"}
      title={muted ? "צלילים כבויים — לחיצה תפעיל" : "צלילים פועלים — לחיצה תשתיק"}
      className={[
        "relative inline-flex size-9 items-center justify-center rounded-2xl border transition",
        "ring-1 ring-transparent hover:shadow-md active:scale-95",
        muted
          ? "border-slate-200 bg-white text-slate-400 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-500"
          : "border-sky-200/80 bg-gradient-to-b from-white to-sky-50 text-sky-600 hover:from-sky-50 hover:to-sky-100 dark:border-sky-400/30 dark:from-zinc-900/70 dark:to-sky-950/40 dark:text-sky-300",
      ].join(" ")}
    >
      {muted ? <VolumeX className="size-5" strokeWidth={1.9} /> : <Volume2 className="size-5" strokeWidth={1.9} />}
    </button>
  );
}
