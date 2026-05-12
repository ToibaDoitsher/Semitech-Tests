/** צבע כותרת טבלה / פס מטא — תואם לצבעי אייקוני הניווט ב־AppShell */

export type TableAccentKey =
  | "sky"
  | "violet"
  | "emerald"
  | "amber"
  | "rose"
  | "indigo"
  | "cyan"
  | "orange"
  | "teal"
  | "fuchsia"
  | "default";

export function tableAccentKeyFromPathname(pathname: string): TableAccentKey {
  if (pathname.startsWith("/students/import")) return "emerald";
  if (pathname.startsWith("/students")) return "violet";
  if (pathname.startsWith("/teachers")) return "amber";
  if (pathname.startsWith("/assignments")) return "rose";
  if (pathname.startsWith("/exams")) return "indigo";
  if (pathname.startsWith("/calendar")) return "cyan";
  if (pathname.startsWith("/makeups")) return "orange";
  if (pathname.startsWith("/tracking")) return "teal";
  if (pathname.startsWith("/settings")) return "fuchsia";
  if (pathname === "/" || pathname.startsWith("/dashboard")) return "sky";
  return "default";
}

const header: Record<TableAccentKey, string> = {
  sky: "sticky top-0 z-10 border-b-0 bg-gradient-to-b from-sky-50/98 via-white to-sky-50/35 text-sky-900 shadow-[inset_0_-1px_0_0_rgb(14_165_233_/_0.28)] dark:from-sky-950/45 dark:via-zinc-950 dark:to-zinc-900/90 dark:text-sky-100 dark:shadow-[inset_0_-1px_0_0_rgb(56_189_248_/_0.2)] [&_tr]:border-b-0",
  violet:
    "sticky top-0 z-10 border-b-0 bg-gradient-to-b from-violet-50/98 via-white to-violet-50/35 text-violet-900 shadow-[inset_0_-1px_0_0_rgb(167_139_250_/_0.35)] dark:from-violet-950/45 dark:via-zinc-950 dark:to-zinc-900/90 dark:text-violet-100 dark:shadow-[inset_0_-1px_0_0_rgb(196_181_253_/_0.22)] [&_tr]:border-b-0",
  emerald:
    "sticky top-0 z-10 border-b-0 bg-gradient-to-b from-emerald-50/98 via-white to-emerald-50/35 text-emerald-900 shadow-[inset_0_-1px_0_0_rgb(52_211_153_/_0.32)] dark:from-emerald-950/40 dark:via-zinc-950 dark:to-zinc-900/90 dark:text-emerald-100 dark:shadow-[inset_0_-1px_0_0_rgb(52_211_153_/_0.2)] [&_tr]:border-b-0",
  amber:
    "sticky top-0 z-10 border-b-0 bg-gradient-to-b from-amber-50/98 via-white to-amber-50/35 text-amber-950 shadow-[inset_0_-1px_0_0_rgb(251_191_36_/_0.38)] dark:from-amber-950/35 dark:via-zinc-950 dark:to-zinc-900/90 dark:text-amber-100 dark:shadow-[inset_0_-1px_0_0_rgb(252_211_77_/_0.2)] [&_tr]:border-b-0",
  rose: "sticky top-0 z-10 border-b-0 bg-gradient-to-b from-rose-50/98 via-white to-rose-50/35 text-rose-900 shadow-[inset_0_-1px_0_0_rgb(251_113_133_/_0.32)] dark:from-rose-950/40 dark:via-zinc-950 dark:to-zinc-900/90 dark:text-rose-100 dark:shadow-[inset_0_-1px_0_0_rgb(253_164_175_/_0.2)] [&_tr]:border-b-0",
  indigo:
    "sticky top-0 z-10 border-b-0 bg-gradient-to-b from-indigo-50/98 via-white to-indigo-50/35 text-indigo-900 shadow-[inset_0_-1px_0_0_rgb(129_140_248_/_0.35)] dark:from-indigo-950/45 dark:via-zinc-950 dark:to-zinc-900/90 dark:text-indigo-100 dark:shadow-[inset_0_-1px_0_0_rgb(165_180_252_/_0.22)] [&_tr]:border-b-0",
  cyan: "sticky top-0 z-10 border-b-0 bg-gradient-to-b from-cyan-50/98 via-white to-cyan-50/35 text-cyan-900 shadow-[inset_0_-1px_0_0_rgb(34_211_238_/_0.3)] dark:from-cyan-950/40 dark:via-zinc-950 dark:to-zinc-900/90 dark:text-cyan-100 dark:shadow-[inset_0_-1px_0_0_rgb(103_232_249_/_0.2)] [&_tr]:border-b-0",
  orange:
    "sticky top-0 z-10 border-b-0 bg-gradient-to-b from-orange-50/98 via-white to-orange-50/35 text-orange-950 shadow-[inset_0_-1px_0_0_rgb(251_146_60_/_0.34)] dark:from-orange-950/40 dark:via-zinc-950 dark:to-zinc-900/90 dark:text-orange-100 dark:shadow-[inset_0_-1px_0_0_rgb(253_186_116_/_0.2)] [&_tr]:border-b-0",
  teal: "sticky top-0 z-10 border-b-0 bg-gradient-to-b from-teal-50/98 via-white to-teal-50/35 text-teal-900 shadow-[inset_0_-1px_0_0_rgb(45_212_191_/_0.3)] dark:from-teal-950/40 dark:via-zinc-950 dark:to-zinc-900/90 dark:text-teal-100 dark:shadow-[inset_0_-1px_0_0_rgb(94_234_212_/_0.2)] [&_tr]:border-b-0",
  fuchsia:
    "sticky top-0 z-10 border-b-0 bg-gradient-to-b from-fuchsia-50/98 via-white to-fuchsia-50/35 text-fuchsia-900 shadow-[inset_0_-1px_0_0_rgb(232_121_249_/_0.3)] dark:from-fuchsia-950/40 dark:via-zinc-950 dark:to-zinc-900/90 dark:text-fuchsia-100 dark:shadow-[inset_0_-1px_0_0_rgb(240_171_252_/_0.2)] [&_tr]:border-b-0",
  default:
    "sticky top-0 z-10 border-b-0 bg-gradient-to-b from-slate-50 to-white text-slate-700 shadow-[inset_0_-1px_0_0_rgb(226_232_240_/_0.95)] dark:from-zinc-900 dark:to-zinc-950 dark:text-zinc-200 dark:shadow-[inset_0_-1px_0_0_rgb(63_63_70_/_0.85)] [&_tr]:border-b-0",
};

const toolbar: Record<TableAccentKey, string> = {
  sky: "border-b border-sky-200/70 bg-gradient-to-l from-sky-50/95 to-white px-5 py-3.5 text-sm font-medium text-sky-900 dark:border-sky-900/35 dark:from-sky-950/35 dark:to-zinc-900/45 dark:text-sky-100",
  violet:
    "border-b border-violet-200/70 bg-gradient-to-l from-violet-50/95 to-white px-5 py-3.5 text-sm font-medium text-violet-900 dark:border-violet-900/35 dark:from-violet-950/35 dark:to-zinc-900/45 dark:text-violet-100",
  emerald:
    "border-b border-emerald-200/70 bg-gradient-to-l from-emerald-50/95 to-white px-5 py-3.5 text-sm font-medium text-emerald-900 dark:border-emerald-900/30 dark:from-emerald-950/30 dark:to-zinc-900/45 dark:text-emerald-100",
  amber:
    "border-b border-amber-200/70 bg-gradient-to-l from-amber-50/95 to-white px-5 py-3.5 text-sm font-medium text-amber-950 dark:border-amber-900/30 dark:from-amber-950/25 dark:to-zinc-900/45 dark:text-amber-100",
  rose: "border-b border-rose-200/70 bg-gradient-to-l from-rose-50/95 to-white px-5 py-3.5 text-sm font-medium text-rose-900 dark:border-rose-900/30 dark:from-rose-950/30 dark:to-zinc-900/45 dark:text-rose-100",
  indigo:
    "border-b border-indigo-200/70 bg-gradient-to-l from-indigo-50/95 to-white px-5 py-3.5 text-sm font-medium text-indigo-900 dark:border-indigo-900/35 dark:from-indigo-950/35 dark:to-zinc-900/45 dark:text-indigo-100",
  cyan: "border-b border-cyan-200/70 bg-gradient-to-l from-cyan-50/95 to-white px-5 py-3.5 text-sm font-medium text-cyan-900 dark:border-cyan-900/30 dark:from-cyan-950/30 dark:to-zinc-900/45 dark:text-cyan-100",
  orange:
    "border-b border-orange-200/70 bg-gradient-to-l from-orange-50/95 to-white px-5 py-3.5 text-sm font-medium text-orange-950 dark:border-orange-900/30 dark:from-orange-950/30 dark:to-zinc-900/45 dark:text-orange-100",
  teal: "border-b border-teal-200/70 bg-gradient-to-l from-teal-50/95 to-white px-5 py-3.5 text-sm font-medium text-teal-900 dark:border-teal-900/30 dark:from-teal-950/30 dark:to-zinc-900/45 dark:text-teal-100",
  fuchsia:
    "border-b border-fuchsia-200/70 bg-gradient-to-l from-fuchsia-50/95 to-white px-5 py-3.5 text-sm font-medium text-fuchsia-900 dark:border-fuchsia-900/30 dark:from-fuchsia-950/30 dark:to-zinc-900/45 dark:text-fuchsia-100",
  default:
    "border-b border-slate-100/90 bg-gradient-to-l from-slate-50/90 to-white px-5 py-3.5 text-sm font-medium text-slate-600 dark:border-slate-800 dark:from-slate-900/50 dark:to-zinc-900/30 dark:text-zinc-400",
};

export function tableHeaderAccentClasses(key: TableAccentKey): string {
  return header[key];
}

export function listToolbarAccentClasses(key: TableAccentKey): string {
  return toolbar[key];
}
