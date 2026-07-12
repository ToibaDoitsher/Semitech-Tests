"use client";

import Link from "next/link";
import { Archive, Calendar } from "lucide-react";
import { useAcademicYear } from "@/components/academicYears/AcademicYearProvider";
import { TERMS, type Term } from "@/lib/academicYears/types";

export function AcademicYearBanner() {
  const {
    viewingYear,
    activeYear,
    viewingTerm,
    readOnly,
    setViewingYearId,
    setViewingTerm,
    refresh,
    error,
    isLoading,
  } = useAcademicYear();

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-800 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200"
      >
        {error.message}
      </div>
    );
  }

  if (isLoading || !viewingYear) return null;

  async function makeTermActive(term: Term) {
    if (readOnly || !viewingYear) return;
    const r = await fetch("/api/academic-years", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year_id: viewingYear.id, active_term: term }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert((j as { error?: string }).error ?? "עדכון מחצית נכשל");
      return;
    }
    setViewingTerm(term);
    await refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-sm dark:border-emerald-800/50 dark:bg-emerald-950/30">
        <Calendar className="size-4 shrink-0 text-emerald-700" />
        <span className="font-medium text-emerald-950 dark:text-emerald-100">
          {readOnly ? `ארכיון ${viewingYear.year_name}` : `שנה פעילה ${viewingYear.year_name}`}
        </span>

        <div className="inline-flex items-center gap-0.5 rounded-lg border border-emerald-300/80 bg-white p-0.5 dark:border-emerald-700 dark:bg-emerald-900/40">
          {TERMS.map((t) => {
            const active = viewingTerm === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setViewingTerm(t)}
                className={
                  active
                    ? "rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white"
                    : "rounded-md px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:text-emerald-100 dark:hover:bg-emerald-800/60"
                }
                aria-pressed={active}
              >
                מחצית {t}
              </button>
            );
          })}
        </div>

        {!readOnly && viewingYear.active_term !== viewingTerm ? (
          <button
            type="button"
            onClick={() => void makeTermActive(viewingTerm)}
            className="rounded-lg border border-emerald-300/80 bg-white px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100"
            title="קובע את המחצית הנצפית כברירת מחדל לשנה"
          >
            הפוך לפעילה
          </button>
        ) : null}

        {readOnly ? (
          <>
            <span className="text-emerald-800/80 dark:text-emerald-300/80">· צפייה בלבד</span>
            <button
              type="button"
              onClick={() => setViewingYearId(null)}
              className="ms-auto rounded-lg bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-800"
            >
              חזרה ל{activeYear?.year_name ?? "שנה פעילה"}
            </button>
          </>
        ) : (
          <Link
            href="/archive"
            className="ms-auto inline-flex items-center gap-1 rounded-lg border border-emerald-300/80 bg-white px-2.5 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-100"
          >
            <Archive className="size-3.5" />
            מעבר לארכיון
          </Link>
        )}
      </div>

      {viewingTerm === "א" ? (
        <p className="rounded-lg border border-amber-200/90 bg-amber-50 px-3 py-1.5 text-xs text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-100">
          מחצית א מציגה רק מבחנים של מחצית א. כל הנתונים שהיו לפני ההפרדה נמצאים ב־
          <button
            type="button"
            className="mx-0.5 font-semibold underline underline-offset-2"
            onClick={() => setViewingTerm("ב")}
          >
            מחצית ב
          </button>
          — לחצי כאן כדי לראות אותם. לא נמחק כלום.
        </p>
      ) : null}
    </div>
  );
}
