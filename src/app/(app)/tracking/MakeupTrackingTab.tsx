"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useAcademicYear, withYearQuery } from "@/components/academicYears/AcademicYearProvider";
import { ListDataCard, ListTableToolbar } from "@/components/ui/ListPage";
import { Spinner } from "@/components/ui/Spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const fetcher = async (url: string) => {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאת טעינה");
  return j;
};

type GroupRow = {
  exam_id: string;
  teacher_name: string | null;
  subject: string;
  exam_date: string;
  grade_level?: string;
  count: number;
  open_count: number;
  with_grade_count: number;
  sent_count: number;
};

type DetailItem = {
  id: string;
  sent_to_teacher_at: string | null;
  grade_received_at: string | null;
  grade: number | null;
  notes: string | null;
  makeup_status: string;
  student: { first_name: string; last_name: string } | null;
};

function fmtDt(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("he-IL");
}

function GradeEditor({
  row,
  disabled,
  busy,
  onSaved,
}: {
  row: DetailItem;
  disabled: boolean;
  busy: boolean;
  onSaved: () => Promise<void>;
}) {
  const [grade, setGrade] = useState(row.grade != null ? String(row.grade) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setGrade(row.grade != null ? String(row.grade) : "");
  }, [row.id, row.grade]);

  async function save() {
    if (disabled || busy || saving) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/makeup-tracking/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grade: grade.trim() ? Number(grade) : null }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      await onSaved();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        className="w-16 rounded border px-1 py-0.5"
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
        disabled={disabled || busy || saving}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
        }}
      />
      {!disabled ? (
        <button
          type="button"
          className="text-xs text-sky-800 underline disabled:opacity-50"
          disabled={busy || saving}
          onClick={() => void save()}
        >
          {saving ? "…" : "שמור"}
        </button>
      ) : null}
    </div>
  );
}

export function MakeupTrackingTab() {
  const { viewingYear, readOnly } = useAcademicYear();
  const [subjectFilter, setSubjectFilter] = useState("");
  const [completed, setCompleted] = useState<"" | "true" | "false">("false");
  const listUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set("sync", "1");
    if (subjectFilter.trim()) p.set("subject", subjectFilter.trim());
    if (completed) p.set("completed", completed);
    const q = p.toString();
    return withYearQuery(`/api/makeup-tracking?${q}`, viewingYear?.id);
  }, [subjectFilter, completed, viewingYear?.id]);

  const { data, error, isLoading, mutate } = useSWR<{ groups: GroupRow[] }>(listUrl, fetcher);
  const [openExamId, setOpenExamId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const detailUrl = openExamId
    ? withYearQuery(`/api/makeup-tracking/exams/${openExamId}`, viewingYear?.id)
    : null;
  const { data: detail, mutate: mutateDetail } = useSWR<{ items: DetailItem[] }>(detailUrl, fetcher);

  const refresh = useCallback(async () => {
    await mutate();
    if (openExamId) await mutateDetail();
  }, [mutate, mutateDetail, openExamId]);

  async function api(path: string, init?: RequestInit) {
    const r = await fetch(path, init);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
  }

  return (
    <>
      <ListDataCard>
        <ListTableToolbar>
          <div className="flex flex-wrap gap-2 text-sm">
            <input
              placeholder="סינון מקצוע"
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="rounded border px-2 py-1 text-xs"
            />
            <select
              value={completed}
              onChange={(e) => setCompleted(e.target.value as "" | "true" | "false")}
              className="rounded border px-2 py-1 text-xs"
            >
              <option value="">הכל</option>
              <option value="false">פתוח</option>
              <option value="true">הושלם</option>
            </select>
          </div>
          {isLoading ? (
            <Spinner className="size-4" />
          ) : error ? (
            <span className="max-w-md text-sm text-red-600">{(error as Error).message}</span>
          ) : (
            <span>{data?.groups?.length ?? 0} מבחנים</span>
          )}
        </ListTableToolbar>
        <Table className="min-w-[720px] text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>מורה</TableHead>
              <TableHead>מקצוע</TableHead>
              <TableHead>שכבה</TableHead>
              <TableHead>תאריך</TableHead>
              <TableHead>השלמות</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.groups ?? []).map((g) => (
              <TableRow key={g.exam_id}>
                <TableCell>{g.teacher_name ?? "—"}</TableCell>
                <TableCell>{g.subject}</TableCell>
                <TableCell>{g.grade_level ?? "—"}</TableCell>
                <TableCell>{g.exam_date}</TableCell>
                <TableCell>
                  {g.open_count}/{g.count}
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="text-xs underline"
                    onClick={() => setOpenExamId(g.exam_id)}
                  >
                    פתח
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ListDataCard>

      {openExamId ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" role="presentation">
          <div className="h-full w-full max-w-xl overflow-auto bg-white p-4 shadow-xl">
            <div className="mb-3 flex justify-between">
              <h3 className="font-semibold">פירוט השלמות</h3>
              <button type="button" onClick={() => setOpenExamId(null)}>
                סגור
              </button>
            </div>
            {readOnly ? (
              <p className="mb-2 text-sm text-amber-800">שנה בארכיון — צפייה בלבד</p>
            ) : null}
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>תלמידה</TableHead>
                  <TableHead>נשלח למורה</TableHead>
                  <TableHead>ציון</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(detail?.items ?? []).map((row) => {
                  const done = row.makeup_status === "completed";
                  const name = row.student
                    ? `${row.student.last_name} ${row.student.first_name}`
                    : "—";
                  return (
                    <TableRow key={row.id}>
                      <TableCell>{name}</TableCell>
                      <TableCell>
                        {fmtDt(row.sent_to_teacher_at)}
                        {!readOnly && !done && !row.sent_to_teacher_at ? (
                          <button
                            type="button"
                            className="mr-1 underline"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await api(`/api/makeup-tracking/${row.id}/sent-to-teacher`, {
                                  method: "POST",
                                });
                                await refresh();
                              } catch (e) {
                                alert((e as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            נשלח למורה
                          </button>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <GradeEditor
                          row={row}
                          disabled={readOnly || done}
                          busy={busy}
                          onSaved={refresh}
                        />
                      </TableCell>
                      <TableCell>
                        {!readOnly && !done && row.grade != null ? (
                          <button
                            type="button"
                            className="text-emerald-700 underline"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              try {
                                await api(`/api/makeup-tracking/${row.id}/complete`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: "{}",
                                });
                                await refresh();
                              } catch (e) {
                                alert((e as Error).message);
                              } finally {
                                setBusy(false);
                              }
                            }}
                          >
                            הושלם סופית
                          </button>
                        ) : done ? (
                          "הושלם"
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}
    </>
  );
}
