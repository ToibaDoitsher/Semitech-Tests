"use client";

import { cn } from "@/lib/utils";

type HeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

/** כותרת עמוד רשימה — ריווח נדיב, היררכיה ברורה */
export function ListPageHeader({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2.5 border-s-4 border-[var(--color-primary)] ps-5">
        <h1 className="text-balance text-3xl font-extrabold tracking-tight text-slate-900 md:text-[2.125rem] dark:text-zinc-50">
          {title}
        </h1>
        {subtitle ? (
          <p className="max-w-2xl text-[0.95rem] font-light leading-relaxed text-slate-600 dark:text-zinc-400">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:max-w-[min(100%,32rem)]">
          <div className="flex flex-wrap items-center justify-end gap-2 rounded-2xl border border-slate-200/80 bg-white/85 p-2 shadow-sm ring-1 ring-slate-900/[0.03] backdrop-blur-sm dark:border-zinc-600/70 dark:bg-zinc-900/55 dark:ring-white/[0.05]">
            {actions}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** כרטיס עטיף לטבלה / תוכן רשימה */
export function ListDataCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-slate-200/70 bg-white/95 shadow-[var(--shadow-card)] ring-1 ring-slate-900/[0.02] dark:border-slate-700/60 dark:bg-zinc-900/55 dark:ring-white/[0.04]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** פס מטא מעל הטבלה (טעינה / ספירה) */
export function ListTableToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100/90 bg-gradient-to-l from-slate-50/90 to-white px-5 py-3.5 text-sm text-slate-600 dark:border-slate-800 dark:from-slate-900/50 dark:to-zinc-900/30 dark:text-zinc-400">
      {children}
    </div>
  );
}

/** קישור פעולה ראשית (כפתור כהה) */
export const LIST_PRIMARY_LINK_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_22px_-6px_rgb(37_99_235_/_0.55)] transition hover:bg-[var(--color-primary-hover)] hover:shadow-[0_8px_28px_-6px_rgb(37_99_235_/_0.5)] active:scale-[0.98]";

/** קישור משני (מסגרת) */
export const LIST_SECONDARY_LINK_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:shadow-md active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-100 dark:hover:border-zinc-500";

/** קישור שורה — עריכה / ניווט */
export const LIST_ROW_LINK_CLASS =
  "inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-blue-50 hover:text-[var(--color-primary)] dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-blue-200";

/** מחיקה / סיכון — אדום עדין עד ריחוף */
export const LIST_ROW_DELETE_CLASS =
  "inline-flex items-center gap-1 rounded-xl px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-700 dark:text-zinc-500 dark:hover:bg-red-950/35 dark:hover:text-red-400";
