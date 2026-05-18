"use client";

import Link from "next/link";
import { Settings2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  ListDataCard,
  ListPageHeader,
  ListTableToolbar,
  LIST_ROW_DELETE_CLASS,
} from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { ExportExcelButton } from "@/components/ui/ExportExcelButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableClearFooter } from "@/components/ui/TableClearFooter";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { pickLookupName } from "@/lib/lookups/display";
import type { ExamTargetType, Teacher } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type LayerOption = { grade_level: string; year_group: number; label: string };

type AssignmentRow = {
  id: string;
  teacher_id: string;
  subject: string;
  year_group: number;
  grade_level: string;
  year_label?: string;
  target_type: ExamTargetType;
  target_id: string;
  target_label?: string;
  target_type_label?: string;
  teachers: { name: string } | null;
};

type LookupItem = { id: string; name: string };

const targetStepOptions: { value: ExamTargetType; label: string }[] = [
  { value: "class", label: "כיתה" },
  { value: "specialization", label: "התמחות" },
  { value: "track", label: "מסלול" },
  { value: "psychology", label: "פסיכולוגיה" },
];

export function AssignmentsClient() {
  const { viewingYear, readOnly } = useAcademicYear();
  const assignmentsUrl = withYearQuery("/api/teacher-assignments", viewingYear?.id);
  const { data: tData, error: tErr, isLoading: tLoad } = useSWR<{ teachers: Teacher[] }>("/api/teachers", fetcher);
  const { data: aData, error: aErr, isLoading: aLoad, mutate } = useSWR<{
    assignments: AssignmentRow[];
    layers?: LayerOption[];
  }>(assignmentsUrl, fetcher);
  const { data: clData } = useSWR<{ items: LookupItem[] }>("/api/lookups/classes", fetcher);
  const { data: spData } = useSWR<{ items: LookupItem[] }>("/api/lookups/specializations", fetcher);
  const { data: trData } = useSWR<{ items: LookupItem[] }>("/api/lookups/tracks", fetcher);

  const [teacherId, setTeacherId] = useState("");
  const [subject, setSubject] = useState("");
  const [yearGroup, setYearGroup] = useState<number | "">("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [targetKind, setTargetKind] = useState<ExamTargetType>("class");
  const [targetId, setTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  const targetItems = useMemo(() => {
    if (targetKind === "class") return clData?.items ?? [];
    if (targetKind === "specialization") return spData?.items ?? [];
    return trData?.items ?? [];
  }, [targetKind, clData, spData, trData]);

  async function addAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return alert("שנה בארכיון — צפייה בלבד");
    if (!teacherId) return alert("בחרי מורה");
    if (!yearGroup || !gradeLevel) return alert("בחרי שנתון ושכבה");
    if (targetKind !== "psychology" && !targetId) return alert("בחרי יעד לשיבוץ");
    setSaving(true);
    try {
      const r = await fetch(assignmentsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacherId,
          subject,
          year_group: yearGroup,
          grade_level: gradeLevel,
          target_type: targetKind,
          target_id: targetId,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      setSubject("");
      setYearGroup("");
      setGradeLevel("");
      setTargetId("");
      await mutate();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(id: string) {
    if (readOnly) return alert("שנה בארכיון — צפייה בלבד");
    if (!confirm("למחוק שיבוץ?")) return;
    const r = await fetch(withYearQuery(`/api/teacher-assignments/${id}`, viewingYear?.id), {
      method: "DELETE",
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      alert((j as { error?: string }).error ?? "מחיקה נכשלה");
      return;
    }
    await mutate();
  }

  const rows = aData?.assignments ?? [];

  return (
    <div className="space-y-8">
      <ListPageHeader
        title="שיבוצי מורות"
        subtitle="טבלת כל השיבוצים · יעד אחד בלבד לכל שיבוץ"
        actions={
          <>
            <ExportExcelButton
              label="ייצוא לאקסל"
              filename="שיבוצי-מורות"
              sheetName="שיבוצים"
              exportUrl={withYearQuery("/api/export/assignments", viewingYear?.id)}
            />
            <Link href="/settings/classes" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-600 dark:bg-zinc-900/40 dark:text-zinc-200">
              <Settings2 className="size-4 shrink-0 opacity-80" strokeWidth={2} />
              ניהול לוקאפים
            </Link>
          </>
        }
      />

      {!readOnly ? (
      <>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-zinc-50">הוספת שיבוץ</h2>
        <p className="mt-1 text-base font-light text-slate-500 dark:text-zinc-400">שלב 1: סוג יעד · שלב 2: בחירת ערך מהרשימה</p>
      </div>

      <form
        onSubmit={addAssignment}
        className="grid gap-4 rounded-xl border border-slate-200/90 bg-white p-5 shadow-sm md:grid-cols-2 lg:grid-cols-3 dark:border-slate-700/70 dark:bg-zinc-900/50"
      >
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">מורה *</span>
          <select
            required
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          >
            <option value="">— בחרי —</option>
            {tData?.teachers?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          {tLoad ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
              <Spinner className="size-4" />
              טוען מורות…
            </div>
          ) : tErr ? (
            <p className="mt-1 text-xs text-red-700">{(tErr as Error).message}</p>
          ) : null}
        </label>

        <label className="block md:col-span-1">
          <span className="text-sm font-medium text-zinc-700">מקצוע *</span>
          <input
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            placeholder="מתמטיקה…"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">שנתון / שכבה *</span>
          <select
            required
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            value={gradeLevel && yearGroup ? `${yearGroup}:${gradeLevel}` : ""}
            onChange={(e) => {
              const [yg, gl] = e.target.value.split(":");
              setYearGroup(yg ? Number.parseInt(yg, 10) : "");
              setGradeLevel(gl ?? "");
            }}
          >
            <option value="">— בחרי —</option>
            {(aData?.layers ?? []).map((l) => (
              <option key={l.grade_level} value={`${l.year_group}:${l.grade_level}`}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="md:col-span-2 lg:col-span-3">
          <legend className="text-sm font-medium text-zinc-700">שלב 1 — סוג שיבוץ (אחד בלבד)</legend>
          <div className="mt-2 flex flex-wrap gap-3">
            {targetStepOptions.map((o) => (
              <label key={o.value} className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="targetKind"
                  value={o.value}
                  checked={targetKind === o.value}
                  onChange={() => {
                    setTargetKind(o.value);
                    setTargetId("");
                  }}
                />
                {o.label}
              </label>
            ))}
          </div>
        </fieldset>

        {targetKind === "psychology" ? (
          <p className="text-sm text-zinc-600 md:col-span-2 lg:col-span-3">
            שיבוץ פסיכולוגיה — כל תלמידות עם סימון פסיכולוגיה בשנתון/שכבה שנבחרו
          </p>
        ) : (
          <label className="block md:col-span-2 lg:col-span-3">
            <span className="text-sm font-medium text-zinc-700">שלב 2 — ערך יעד *</span>
            <select
              required
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="mt-1 w-full max-w-md rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            >
              <option value="">— בחרי —</option>
              {targetItems.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-end md:col-span-2 lg:col-span-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {saving ? "שומר…" : "הוספת שיבוץ"}
          </button>
        </div>
      </form>
      </>
      ) : null}

      <ListDataCard>
        <ListTableToolbar>
          {aLoad ? (
            <span className="inline-flex items-center gap-2">
              <Spinner className="size-4" />
              טוען שיבוצים…
            </span>
          ) : aErr ? (
            <span className="text-red-600">{(aErr as Error).message}</span>
          ) : (
            <span>{rows.length} שיבוצים</span>
          )}
        </ListTableToolbar>
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow>
              <TableHead>מורה</TableHead>
              <TableHead>מקצוע</TableHead>
              <TableHead>סוג שיבוץ</TableHead>
              <TableHead>ערך שיבוץ</TableHead>
              <TableHead>שנתון</TableHead>
              <TableHead className="w-[1%] whitespace-nowrap" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length ? (
              rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-slate-900 dark:text-zinc-100">{a.teachers?.name ?? "—"}</TableCell>
                  <TableCell>{a.subject}</TableCell>
                  <TableCell className="text-slate-600 dark:text-zinc-300">{a.target_type_label ?? a.target_type}</TableCell>
                  <TableCell className="text-slate-800 dark:text-zinc-200">{a.target_label ?? a.target_id}</TableCell>
                  <TableCell>{a.year_label ?? `שנתון ${a.year_group} — שכבה ${a.grade_level}`}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <button type="button" className={LIST_ROW_DELETE_CLASS} onClick={() => void removeRow(a.id)}>
                      <Trash2 className="size-3.5 shrink-0 opacity-70" strokeWidth={2} />
                      מחיקה
                    </button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="py-14 text-center text-slate-500 dark:text-zinc-400" colSpan={6}>
                  {aLoad ? "טוען…" : "אין שיבוצים"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <TableClearFooter
          label="שיבוצי מורות"
          count={rows.length}
          apiPath="/api/teacher-assignments/clear-all"
          scopePreviewPath="/api/scope/delete-preview"
          onCleared={() => void mutate()}
        />
      </ListDataCard>
    </div>
  );
}

function LookupSelect({
  label,
  value,
  onChange,
  items,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  items: LookupItem[];
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
      >
        <option value="">— בחרי —</option>
        {items.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}
