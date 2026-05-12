"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Spinner } from "@/components/ui/Spinner";
import type { ExamTargetType, Teacher } from "@/lib/types/db";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("שגיאת טעינה");
  return r.json();
});

type AssignmentRow = {
  id: string;
  subject: string;
  active: boolean;
  target_type: ExamTargetType;
  target_id: string;
  target_label?: string;
  target_type_label?: string;
};

export function NewExamClient() {
  const router = useRouter();
  const { data: tData, isLoading: tLoad } = useSWR<{ teachers: Teacher[] }>("/api/teachers", fetcher);

  const [teacherId, setTeacherId] = useState("");
  const assignUrl = useMemo(() => {
    if (!teacherId) return null;
    return `/api/teacher-assignments?teacher_id=${encodeURIComponent(teacherId)}`;
  }, [teacherId]);

  const { data: aData, isLoading: aLoad } = useSWR<{ assignments: AssignmentRow[] }>(assignUrl, fetcher);

  const activeAssignments = useMemo(
    () => (aData?.assignments ?? []).filter((a) => a.active),
    [aData],
  );

  const [assignmentId, setAssignmentId] = useState("");
  const [examDate, setExamDate] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => activeAssignments.find((a) => a.id === assignmentId),
    [activeAssignments, assignmentId],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!teacherId || !selected || !examDate) {
      alert("מלאי את כל השדות");
      return;
    }
    setSaving(true);
    try {
      const r = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacher_id: teacherId,
          subject: selected.subject,
          exam_date: examDate,
          target_type: selected.target_type,
          target_id: selected.target_id,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j as { error?: string }).error ?? "שגיאה");
      const examId = (j as { exam?: { id: string } }).exam?.id;
      if (examId) router.push(`/exams/${examId}`);
      else router.push("/exams");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">יצירת מבחן</h1>
          <p className="mt-1 text-sm text-zinc-600">בחירת שיבוץ מורה (מקצוע + יעד) ותאריך — תואם לשיבוץ בלבד</p>
        </div>
        <Link
          href="/exams"
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
        >
          חזרה
        </Link>
      </div>

      <form onSubmit={submit} className="grid max-w-xl gap-4 rounded-xl border border-zinc-200 bg-white p-6">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">מורה</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            value={teacherId}
            onChange={(e) => {
              setTeacherId(e.target.value);
              setAssignmentId("");
            }}
            required
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
              טוען…
            </div>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">שיבוץ (מקצוע · יעד)</span>
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            value={assignmentId}
            onChange={(e) => setAssignmentId(e.target.value)}
            required
            disabled={!teacherId}
          >
            <option value="">— בחרי —</option>
            {activeAssignments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.subject} · {a.target_type_label ?? a.target_type}: {a.target_label ?? a.target_id}
              </option>
            ))}
          </select>
          {teacherId && aLoad ? (
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
              <Spinner className="size-4" />
              טוען שיבוצים…
            </div>
          ) : teacherId && !aLoad && !activeAssignments.length ? (
            <p className="mt-1 text-xs text-amber-800">אין שיבוצים פעילים למורה — הוסיפי שיבוץ במסך השיבוצים</p>
          ) : null}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-zinc-700">תאריך מבחן</span>
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400"
            value={examDate}
            onChange={(e) => setExamDate(e.target.value)}
            required
          />
        </label>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg border border-zinc-900 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {saving ? "יוצר…" : "יצירת מבחן ושיוך תלמידות"}
          </button>
        </div>
      </form>
    </div>
  );
}
