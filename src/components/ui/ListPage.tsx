"use client";

type HeaderProps = {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
};

/** כותרת עמוד רשימה — ריווח נדיב, היררכיה ברורה */
export function ListPageHeader({ title, subtitle, actions }: HeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">{title}</h1>
        {subtitle ? (
          <p className="max-w-2xl text-base font-light leading-relaxed text-slate-500 dark:text-zinc-400">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 sm:max-w-[min(100%,28rem)]">{actions}</div>
      ) : null}
    </div>
  );
}

/** כרטיס עטיף לטבלה / תוכן רשימה */
export function ListDataCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-700/70 dark:bg-zinc-900/50">
      {children}
    </div>
  );
}

/** פס מטא מעל הטבלה (טעינה / ספירה) */
export function ListTableToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/40 dark:text-zinc-400">
      {children}
    </div>
  );
}

/** קישור פעולה ראשית (כפתור כהה) */
export const LIST_PRIMARY_LINK_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.98] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";

/** קישור משני (מסגרת) */
export const LIST_SECONDARY_LINK_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-100 dark:hover:border-zinc-500";

/** קישור שורה — עריכה / ניווט */
export const LIST_ROW_LINK_CLASS =
  "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-blue-800 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-blue-300";

/** מחיקה / סיכון — אדום עדין עד ריחוף */
export const LIST_ROW_DELETE_CLASS =
  "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-red-50 hover:text-red-700 dark:text-zinc-500 dark:hover:bg-red-950/35 dark:hover:text-red-400";
