"use client";

import Link from "next/link";
import { Archive, Calendar } from "lucide-react";
import { useAcademicYear } from "@/components/academicYears/AcademicYearProvider";

export function AcademicYearBanner() {
  const { viewingYear, activeYear, readOnly, setViewingYearId, error, isLoading } = useAcademicYear();

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-sm text-red-800 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-200">
        {error.message}
      </div>
    );
  }

  if (isLoading || !viewingYear) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200/80 bg-sky-50/90 px-3 py-2 text-sm dark:border-sky-800/50 dark:bg-sky-950/30">
      <Calendar className="size-4 shrink-0 text-sky-600" />
      <span className="font-medium text-sky-900 dark:text-sky-100">
        {readOnly ? `ארכיון ${viewingYear.year_name}` : `שנה פעילה ${viewingYear.year_name}`}
      </span>
      {readOnly ? (
        <>
          <span className="text-sky-700/80 dark:text-sky-300/80">· צפייה בלבד</span>
          <button
            type="button"
            onClick={() => setViewingYearId(null)}
            className="ms-auto rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-sky-700"
          >
            חזרה ל{activeYear?.year_name ?? "שנה פעילה"}
          </button>
        </>
      ) : (
        <Link
          href="/archive"
          className="ms-auto inline-flex items-center gap-1 rounded-lg border border-sky-300/80 bg-white px-2.5 py-1 text-xs font-medium text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-100"
        >
          <Archive className="size-3.5" />
          מעבר לארכיון
        </Link>
      )}
    </div>
  );
}
