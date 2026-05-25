"use client";

import Link from "next/link";
import { Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_PRIMARY_LINK_CLASS,
  LIST_ROW_DELETE_CLASS,
  LIST_ROW_LINK_CLASS,
} from "@/components/ui/ListPage";
import { ListFilterBar, matchesNameQuery, normalizeSearchText } from "@/components/ui/ListFilterBar";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { teacherDisplayName } from "@/lib/teachers/display";
import type { Teacher } from "@/lib/types/db";

import { apiFetcher } from "@/lib/api/fetcher";

export function TeachersListClient() {
  const { viewingYear } = useAcademicYear();
  const [q, setQ] = useState("");
  const [hasEmailFilter, setHasEmailFilter] = useState("");
  const [hasTzFilter, setHasTzFilter] = useState("");
  const deferred = useDeferredValue(q.trim());
  const url = useMemo(() => {
    return withYearQuery(`/api/teachers`, viewingYear?.id);
  }, [viewingYear?.id]);

  const { data, error, isLoading, mutate } = useSWR<{ teachers: Teacher[] }>(url, apiFetcher);
  const allTeachers = data?.teachers ?? [];

  const filteredTeachers = useMemo(() => {
    return allTeachers.filter((t) => {
      if (deferred) {
        const matches = matchesNameQuery(deferred, [
          t.first_name,
          t.last_name,
          (t as { full_name_generated?: string }).full_name_generated,
          t.tz,
          t.email,
        ]);
        if (!matches) return false;
      }
      if (hasEmailFilter === "1" && !normalizeSearchText(t.email ?? "")) return false;
      if (hasEmailFilter === "0" && normalizeSearchText(t.email ?? "")) return false;
      if (hasTzFilter === "1" && !normalizeSearchText(t.tz ?? "")) return false;
      if (hasTzFilter === "0" && normalizeSearchText(t.tz ?? "")) return false;
      return true;
    });
  }, [allTeachers, deferred, hasEmailFilter, hasTzFilter]);

  const count = filteredTeachers.length;
  const totalCount = allTeachers.length;
  const isFiltering = Boolean(deferred || hasEmailFilter || hasTzFilter);

  async function removeTeacher(id: string) {
    if (!confirm("למחוק מורה? השיבוצים והמבחנים הקיימים יישארו — המורה תוסתר מהרשימה.")) return;
    const r = await fetch(`/api/teachers/${id}`, { method: "DELETE" });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "מחיקה נכשלה");
      return;
    }
    await mutate();
  }

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="מורות"
        subtitle="פרטי מורה נשמרים פעם אחת — שיבוצים ומבחנים מקושרים למורה קיימת"
        actions={
          <>
            <ExportExcelButton
              label="ייצוא לאקסל"
              filename="מורות"
              sheetName="מורות"
              exportUrl="/api/export/teachers"
            />
            <Link
              href="/teachers/import"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-200"
            >
              <Upload className="size-4 shrink-0 opacity-80" strokeWidth={2} />
              ייבוא מאקסל
            </Link>
            <Link href="/teachers/new" className={LIST_PRIMARY_LINK_CLASS}>
              <Plus className="size-4 shrink-0" strokeWidth={2} />
              הוספת מורה
            </Link>
          </>
        }
      />

      <ListDataCard>
        <ListFilterBar
          searchValue={q}
          onSearchChange={setQ}
          searchLabel="חיפוש מורה"
          searchPlaceholder="למשל: שרה כהן · כהן שרה · ת״ז · מייל…"
          searchHint="ניתן לחפש שם פרטי + שם משפחה גם בסדר הפוך"
          filters={[
            {
              id: "has-email",
              label: "מייל",
              value: hasEmailFilter,
              onChange: setHasEmailFilter,
              options: [
                { value: "1", label: "יש מייל" },
                { value: "0", label: "ללא מייל" },
              ],
            },
            {
              id: "has-tz",
              label: "ת״ז",
              value: hasTzFilter,
              onChange: setHasTzFilter,
              options: [
                { value: "1", label: "יש ת״ז" },
                { value: "0", label: "ללא ת״ז" },
              ],
            },
          ]}
          isAnyActive={isFiltering}
          onClearAll={() => {
            setQ("");
            setHasEmailFilter("");
            setHasTzFilter("");
          }}
        />
      </ListDataCard>

      <ListDataCard enterDelay={0.09}>
        <ListTableToolbar>
          {isLoading ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" />
              טוען…
            </span>
          ) : error ? (
            <span className="text-red-600">{(error as Error).message}</span>
          ) : (
            <span>
              {count} מורות{isFiltering && count !== totalCount ? ` · מתוך ${totalCount}` : ""}
            </span>
          )}
        </ListTableToolbar>
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>ת״ז</TableHead>
              <TableHead>מייל</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeachers.length ? (
              filteredTeachers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium text-slate-900 dark:text-zinc-100">
                    {teacherDisplayName(t)}
                  </TableCell>
                  <TableCell>{t.tz ?? "—"}</TableCell>
                  <TableCell>{t.email ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Link href={`/teachers/${t.id}/edit`} className={LIST_ROW_LINK_CLASS}>
                        <Pencil className="size-3.5 shrink-0 opacity-80" strokeWidth={2} />
                        עריכה
                      </Link>
                      <button
                        type="button"
                        className={LIST_ROW_DELETE_CLASS}
                        onClick={() => void removeTeacher(t.id)}
                      >
                        <Trash2 className="size-3.5 shrink-0 opacity-70" strokeWidth={2} />
                        מחיקה
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-14 text-center text-slate-500 dark:text-zinc-400" colSpan={4}>
                  {isLoading ? "טוען…" : isFiltering ? "אין תוצאות תואמות לסינון" : "אין מורות"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TableClearFooter
          label="מורות"
          count={totalCount}
          apiPath={withYearQuery("/api/teachers/clear-all", viewingYear?.id)}
          confirmHint="כל המורות של שנת הלימודים הנבחרת יוסתרו מהרשימה (מחיקה רכה)."
          onCleared={() => void mutate()}
        />
      </ListDataCard>
    </div>
  );
}
